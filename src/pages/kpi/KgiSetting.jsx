import { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, doc, setDoc, getDocs, updateDoc, query, where, serverTimestamp, addDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Target, CheckCircle, XCircle, Send, AlertTriangle, Calculator } from 'lucide-react';

export default function KgiSetting() {
  const { user, isManagerOrAbove } = useAuth();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingList, setPendingList] = useState([]);

  // KGI Form State
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [productId, setProductId] = useState('');
  
  // Define default rates based on user spec
  const [rates, setRates] = useState({ 
    workDays: 20,        // 月間稼働日数
    monthlyOrderTarget: 8, 
    grossProfitTarget: 2500, // 月次粗利目標 P
    orderRate: 25,       // 受注率 (%)
    adoptionRate: 50,    // 採用率 (%) - アポに対する採用比率など
    appointRate: 10,     // アポ率 (%)
    prospectRate: 10,    // 見込率 (%)
    contactRate: 25,     // 接触率 (%)
    recallRate: 50,      // 再コール率 (%)
    actualCallRate: 50   // 実コール率 (%)
  });

  const fetchProducts = async () => {
    const snap = await getDocs(collection(db, 'productMasters'));
    const list = [];
    snap.forEach(d => {
      if (d.data().isActive !== false) list.push(d.data());
    });
    setProducts(list);
    
    if (!productId && list.length > 0) {
      const initProduct = user?.currentProductId || list[0].productId;
      setProductId(initProduct);
    }
  };

  const fetchPending = async () => {
    if (!isManagerOrAbove) return;
    try {
      const q = query(collection(db, 'kpiTargets'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push({ _id: d.id, ...d.data(), commentInput: '' }));
      setPendingList(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchPending();
  }, [user]);

  const handleProductChange = (e) => {
    const pId = e.target.value;
    setProductId(pId);
  };

  // リアルタイム自動計算ロジック
  const calculations = useMemo(() => {
    const safeDiv = (numerator, percent) => {
      const p = parseFloat(percent);
      if (!p || p <= 0) return 0;
      return Math.ceil(numerator / (p / 100));
    };

    const target = parseFloat(rates.monthlyOrderTarget) || 0;
    
    // 逆算ロジック (例)
    // 採用数 = 受注数 / 受注率
    // アポ数 = 採用数 / 採用率
    // オーナー接触数 = アポ数 / アポ率
    // 実コール数 = オーナー接触数 / 接触率
    // 総コール数 = 実コール数 / 実コール率
    
    const requiredAdoptions = safeDiv(target, rates.orderRate);
    const requiredAppoints = safeDiv(requiredAdoptions, rates.adoptionRate);
    const requiredContacts = safeDiv(requiredAppoints, rates.appointRate);
    const requiredActualCalls = safeDiv(requiredContacts, rates.contactRate);
    const requiredTotalCalls = safeDiv(requiredActualCalls, rates.actualCallRate);

    // 副次指標の計算
    const estimatedProspects = Math.floor(requiredContacts * (parseFloat(rates.prospectRate)/100 || 0));
    const estimatedRecalls = Math.floor(requiredTotalCalls * (parseFloat(rates.recallRate)/100 || 0));

    return {
      requiredAdoptions,
      requiredAppoints,
      requiredContacts,
      requiredActualCalls,
      requiredTotalCalls,
      estimatedProspects,
      estimatedRecalls
    };
  }, [rates]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docId = `${user.uid}_${productId}_${month.replace('-', '')}`;
      await setDoc(doc(db, 'kpiTargets', docId), {
        userId: user.uid,
        userName: user.displayName || '名無し',
        productId,
        targetMonth: month,
        status: 'pending',
        ...Object.keys(rates).reduce((acc, key) => ({ ...acc, [key]: parseFloat(rates[key]) }), {}),
        calculatedTargets: calculations, // 計算結果も保存
        comment: '',
        approvedBy: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      alert('KGI目標を申請しました！マネージャーの承認をお待ちください。');
    } catch (error) {
      console.error(error);
      alert('申請に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (targetId, isApprove, comment) => {
    if (!isApprove && !comment) {
      alert('差戻しの場合はコメント（理由）を入力してください。');
      return;
    }
    
    try {
      const status = isApprove ? 'approved' : 'rejected';
      await updateDoc(doc(db, 'kpiTargets', targetId), {
        status,
        approvedBy: user.uid,
        comment: comment || '',
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'auditLogs'), {
        action: isApprove ? 'kgiApprove' : 'kgiReject',
        executedBy: {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.name || '',
          role: user.role || ''
        },
        target: {
          type: 'kpi',
          id: targetId,
          name: 'KGI申請'
        },
        changes: {
          before: { status: 'pending' },
          after: { status, comment: comment || '' }
        },
        timestamp: serverTimestamp()
      });

      alert(isApprove ? '承認しました。' : '差し戻しました。');
      fetchPending();
    } catch (e) {
      console.error(e);
      alert('操作に失敗しました。権限またはルールを確認してください。');
    }
  };

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>KGI・KPI月次設定 (K-03)</h1>
        <p>月間の目標値（KGI）を設定し、自動計算された必要行動量を確認・申請します</p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h2><Target size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> あなたのKGI設定（申請）</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label>対象月</label>
              <input 
                type="month" 
                value={month} 
                onChange={e => setMonth(e.target.value)} 
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label>対象商材</label>
              <select 
                value={productId} 
                onChange={handleProductChange}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              >
                {products.map(p => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
              </select>
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>各種転換率・目標の入力</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>月間稼働日数 (日)</label>
                <input type="number" step="1" value={rates.workDays} onChange={e => setRates({...rates, workDays: e.target.value})} />
              </div>
              <div className="form-group">
                <label>月次目標受注数</label>
                <input type="number" step="1" value={rates.monthlyOrderTarget} onChange={e => setRates({...rates, monthlyOrderTarget: e.target.value})} />
              </div>
              <div className="form-group">
                <label>月次粗利目標 P</label>
                <input type="number" step="1" value={rates.grossProfitTarget} onChange={e => setRates({...rates, grossProfitTarget: e.target.value})} />
              </div>
              <div className="form-group">
                <label>受注率 (%)</label>
                <input type="number" step="0.1" value={rates.orderRate} onChange={e => setRates({...rates, orderRate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>採用率 (%)</label>
                <input type="number" step="0.1" value={rates.adoptionRate} onChange={e => setRates({...rates, adoptionRate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>アポ率 (%)</label>
                <input type="number" step="0.1" value={rates.appointRate} onChange={e => setRates({...rates, appointRate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>接触率 (%)</label>
                <input type="number" step="0.1" value={rates.contactRate} onChange={e => setRates({...rates, contactRate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>実コール率 (%)</label>
                <input type="number" step="0.1" value={rates.actualCallRate} onChange={e => setRates({...rates, actualCallRate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>見込率 (%)</label>
                <input type="number" step="0.1" value={rates.prospectRate} onChange={e => setRates({...rates, prospectRate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>再コール率 (%)</label>
                <input type="number" step="0.1" value={rates.recallRate} onChange={e => setRates({...rates, recallRate: e.target.value})} />
              </div>
            </div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #bae6fd' }}>
            <h3 style={{ marginBottom: '1rem', color: '#0369a1', fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>
              <Calculator size={18} style={{ marginRight: '0.5rem' }} /> 自動計算された月間必要行動量
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', textAlign: 'center' }}>
              <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>必要採用数</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{calculations.requiredAdoptions}</div>
              </div>
              <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>必要アポ数</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{calculations.requiredAppoints}</div>
              </div>
              <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>必要接触数</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{calculations.requiredContacts}</div>
              </div>
              <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>必要実コール数</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{calculations.requiredActualCalls}</div>
              </div>
              <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '2px solid #0284c7' }}>
                <div style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 'bold' }}>必要総架電数</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#0284c7' }}>{calculations.requiredTotalCalls}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>推計見込数: <strong>{calculations.estimatedProspects}</strong></span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>推計再コール: <strong>{calculations.estimatedRecalls}</strong></span>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '1rem' }}>
            <Send size={18} style={{ marginRight: '0.5rem' }} /> {loading ? '申請中...' : 'この目標と行動量で承認をリクエストする'}
          </button>
        </form>
      </div>

      {isManagerOrAbove && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2><AlertTriangle size={20} style={{ marginRight: '0.5rem', color: '#f59e0b', verticalAlign: 'middle' }} /> 承認待ちのKGI一覧</h2>
          
          {pendingList.length === 0 ? (
            <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)' }}>現在承認待ちの申請はありません。</p>
          ) : (
            <div className="table-container" style={{ marginTop: '1.5rem' }}>
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>申請者</th>
                    <th>対象月</th>
                    <th>商材</th>
                    <th>目標受注 / 必須架電</th>
                    <th>コメント / アクション</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingList.map((t, i) => (
                    <tr key={t._id}>
                      <td style={{ fontWeight: 'bold' }}>{t.userName || '不明'}</td>
                      <td>{t.targetMonth}</td>
                      <td>{products.find(p => p.productId === t.productId)?.productName || t.productId}</td>
                      <td style={{ fontSize: '0.95rem' }}>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{t.monthlyOrderTarget}件</span> / 
                        <span style={{ color: '#0284c7', fontWeight: 'bold' }}> {t.calculatedTargets?.requiredTotalCalls || '-'}件</span>
                      </td>
                      <td style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          placeholder="差戻し理由など..." 
                          value={t.commentInput}
                          onChange={(e) => {
                            const newList = [...pendingList];
                            newList[i].commentInput = e.target.value;
                            setPendingList(newList);
                          }}
                          style={{ padding: '0.4rem', width: '150px' }}
                        />
                        <button 
                          className="btn btn-primary btn-sm" 
                          style={{ padding: '0.4rem', background: '#10b981', borderColor: '#10b981' }}
                          onClick={() => handleApproval(t._id, true, t.commentInput)}
                        >
                          <CheckCircle size={14} /> 承認
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '0.4rem', color: '#ef4444', borderColor: '#ef4444' }}
                          onClick={() => handleApproval(t._id, false, t.commentInput)}
                        >
                          <XCircle size={14} /> 差戻し
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
