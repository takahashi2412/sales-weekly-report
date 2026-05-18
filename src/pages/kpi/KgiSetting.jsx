import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, setDoc, getDocs, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Target, CheckCircle, XCircle, Send, AlertTriangle } from 'lucide-react';

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
  const [rates, setRates] = useState({ appointRate: 0, adoptionRate: 0, orderRate: 0, monthlyOrderTarget: 0 });

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
      applyDefaultRates(list, initProduct);
    }
  };

  const applyDefaultRates = (productList, pId) => {
    const p = productList.find(x => x.productId === pId);
    if (p && p.conversionRates && p.conversionRates[user.role]) {
      setRates(p.conversionRates[user.role]);
    } else {
      setRates({ appointRate: 0, adoptionRate: 0, orderRate: 0, monthlyOrderTarget: 0 });
    }
  };

  const fetchPending = async () => {
    if (!isManagerOrAbove) return;
    try {
      const q = query(collection(db, 'kgiTargets'), where('status', '==', 'pending'));
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
    applyDefaultRates(products, pId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docId = `${user.uid}_${productId}_${month.replace('-', '')}`;
      await setDoc(doc(db, 'kgiTargets', docId), {
        userId: user.uid,
        userName: user.displayName || '名無し',
        productId,
        targetMonth: month,
        status: 'pending',
        appointRate: parseFloat(rates.appointRate),
        adoptionRate: parseFloat(rates.adoptionRate),
        orderRate: parseFloat(rates.orderRate),
        monthlyOrderTarget: parseFloat(rates.monthlyOrderTarget),
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

  // 承認/差戻しは hasOnly(['status','approvedBy','comment','updatedAt']) に合致させる
  const handleApproval = async (targetId, isApprove, comment) => {
    if (!isApprove && !comment) {
      alert('差戻しの場合はコメント（理由）を入力してください。');
      return;
    }
    
    try {
      const status = isApprove ? 'approved' : 'rejected';
      await updateDoc(doc(db, 'kgiTargets', targetId), {
        status,
        approvedBy: user.uid,
        comment: comment || '',
        updatedAt: serverTimestamp()
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
        <p>月間の目標値（KGI）を設定し、承認を受けます</p>
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

          <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              ※商材マスタの基準値（{user.role}）が初期入力されています。必要に応じて修正してください。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>アポ率</label>
                <input type="number" step="0.001" value={rates.appointRate} onChange={e => setRates({...rates, appointRate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>採用率</label>
                <input type="number" step="0.01" value={rates.adoptionRate} onChange={e => setRates({...rates, adoptionRate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>受注率</label>
                <input type="number" step="0.01" value={rates.orderRate} onChange={e => setRates({...rates, orderRate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>月次目標受注数</label>
                <input type="number" step="1" value={rates.monthlyOrderTarget} onChange={e => setRates({...rates, monthlyOrderTarget: e.target.value})} />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <Send size={18} style={{ marginRight: '0.5rem' }} /> {loading ? '申請中...' : '承認をリクエストする'}
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
                    <th>設定値 (ア/採/受/目標)</th>
                    <th>コメント / アクション</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingList.map((t, i) => (
                    <tr key={t._id}>
                      <td style={{ fontWeight: 'bold' }}>{t.userName || '不明'}</td>
                      <td>{t.targetMonth}</td>
                      <td>{products.find(p => p.productId === t.productId)?.productName || t.productId}</td>
                      <td style={{ fontSize: '0.9rem' }}>
                        {t.appointRate} / {t.adoptionRate} / {t.orderRate} / {t.monthlyOrderTarget}件
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
