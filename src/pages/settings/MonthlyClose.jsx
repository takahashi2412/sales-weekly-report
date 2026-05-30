import { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, doc, setDoc, getDocs, query, where, orderBy, limit, serverTimestamp, addDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Save, History, Building2, Calculator, Search } from 'lucide-react';
import '../Dashboard.css';

export default function MonthlyClose() {
  const { user, isExecutive } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [pastData, setPastData] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [products, setProducts] = useState([]);
  const [provisionalData, setProvisionalData] = useState({ grossProfit: 0, orders: 0 });
  
  const [formData, setFormData] = useState({
    period: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })(),
    userId: '',
    productId: '',
    confirmedGrossProfit: '',
    confirmedOrders: '',
    monthlyRoi: ''
  });

  const [filterPeriod, setFilterPeriod] = useState(formData.period);

  useEffect(() => {
    const fetchLeadersAndProducts = async () => {
      try {
        const uSnap = await getDocs(collection(db, 'users'));
        const lList = [];
        uSnap.forEach(d => {
          lList.push({ id: d.id, ...d.data() });
        });
        setLeaders(lList);

        const pSnap = await getDocs(collection(db, 'productMasters'));
        const pList = [];
        pSnap.forEach(d => {
          if (d.data().isActive !== false) pList.push(d.data());
        });
        setProducts(pList);

        if (lList.length > 0 || pList.length > 0) {
          setFormData(prev => ({ 
            ...prev, 
            userId: lList.length > 0 ? lList[0].id : prev.userId,
            productId: pList.length > 0 ? pList[0].productId : prev.productId
          }));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchLeadersAndProducts();
  }, []);

  useEffect(() => {
    const fetchProvisional = async () => {
      if (!formData.period || !formData.userId || !formData.productId) return;
      try {
        const start = `${formData.period}-01`;
        const end = `${formData.period}-31`;
        const q = query(
          collection(db, 'orders'),
          where('userId', '==', formData.userId),
          where('productId', '==', formData.productId),
          where('orderDate', '>=', start),
          where('orderDate', '<=', end)
        );
        const snap = await getDocs(q);
        let grossProfit = 0;
        let orders = 0;
        snap.forEach(d => {
          grossProfit += (Number(d.data().grossProfitPoint) || 0);
          orders++;
        });
        setProvisionalData({ grossProfit, orders });
      } catch (e) {
        console.error(e);
      }
    };
    fetchProvisional();
  }, [formData.period, formData.userId, formData.productId]);

  const fetchPastData = async () => {
    try {
      const q = query(collection(db, 'monthlyClose'), orderBy('period', 'desc'), limit(500));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setPastData(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPastData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'period' || name === 'userId' || name === 'productId') ? value : (value === '' ? '' : Number(value))
    }));
  };

  const runRoleMigration = async () => {
    try {
      const titleToRole = {
        '代表': 'executive', '取締役': 'executive', '役員': 'executive', '統括': 'executive',
        '副統括': 'manager', 'MG': 'manager', 'PMG': 'manager', 'SM': 'manager',
        'TL': 'leader', '一般': 'leader', 'none': 'leader'
      };

      const usersSnap = await getDocs(collection(db, 'users'));
      let updatedCount = 0;
      for (const d of usersSnap.docs) {
        const data = d.data();
        if (!data.role && data.title) {
          const role = titleToRole[data.title] || 'leader';
          await setDoc(doc(db, 'users', d.id), { role }, { merge: true });
          console.log(`Updated: ${data.name} → role: ${role}`);
          updatedCount++;
        }
      }
      alert(`Role migration complete. Updated ${updatedCount} users.`);
      // Reload leaders after migration
      const uSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'leader')));
      const lList = [];
      uSnap.forEach(d => lList.push({ id: d.id, ...d.data() }));
      setLeaders(lList);
      if (lList.length > 0) setFormData(prev => ({ ...prev, userId: lList[0].id }));
    } catch (e) {
      console.error('Migration Error:', e);
      alert('Migration failed. Check console.');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isExecutive) {
      alert('権限がありません');
      return;
    }
    if (!formData.userId) {
      alert('メンバーを選択してください');
      return;
    }
    
    setLoading(true);
    try {
      const docId = `${formData.period}_${formData.userId}_${formData.productId}`;
      const dataToSave = {
        userId: formData.userId,
        productId: formData.productId,
        period: formData.period,
        confirmedGrossProfit: formData.confirmedGrossProfit,
        confirmedOrders: formData.confirmedOrders,
        monthlyRoi: formData.monthlyRoi,
        closedBy: user.uid,
        closedAt: serverTimestamp()
      };

      console.log("Saving monthlyClose to doc:", docId, dataToSave);
      await setDoc(doc(db, 'monthlyClose', docId), dataToSave, { merge: true });

      console.log("Saving auditLogs for monthlyClose...");
      await addDoc(collection(db, 'auditLogs'), {
        action: 'monthlyCloseUpdate',
        executedBy: {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.name || '',
          role: user.role || ''
        },
        target: {
          type: 'monthlyClose',
          id: docId,
          name: `月次締めデータ (${formData.period} / ${formData.userId})`
        },
        changes: {
          after: dataToSave
        },
        timestamp: serverTimestamp()
      });

      alert('月次締めデータを保存しました。');
      fetchPastData();
    } catch (e) {
      console.error('Save Error details:', e);
      console.error('Stack trace:', e.stack);
      alert(`保存に失敗しました。エラー: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return pastData.filter(d => d.period === filterPeriod);
  }, [pastData, filterPeriod]);

  const aggregate = useMemo(() => {
    const totalGross = filteredData.reduce((s, d) => s + (d.confirmedGrossProfit || 0), 0);
    const totalOrders = filteredData.reduce((s, d) => s + (d.confirmedOrders || 0), 0);
    const avgRoi = filteredData.length > 0 
      ? (filteredData.reduce((s, d) => s + (d.monthlyRoi || 0), 0) / filteredData.length).toFixed(2)
      : 0;
    
    return { totalGross, totalOrders, avgRoi };
  }, [filteredData]);

  const getUserDisplayName = (uid) => {
    const l = leaders.find(x => x.id === uid);
    if (!l) return uid;
    return `${l.name} (${l.title || '一般'})`;
  };

  if (!isExecutive) {
    return <div style={{ padding: '2rem' }}>アクセス権限がありません。</div>;
  }

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>月次締め管理 (S-06)</h1>
        <p>確定した月次結果をメンバー別に入力し、全社のダッシュボードへ反映させます</p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2><Building2 size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--accent-primary)' }} /> メンバー別 月次結果入力</h2>
          <button 
            type="button" 
            onClick={runRoleMigration}
            className="btn btn-secondary btn-sm" 
            style={{ background: '#f59e0b', color: 'white', border: 'none' }}
          >
            システム移行: roleを一括補完
          </button>
        </div>
        
        <form onSubmit={handleSave} style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>対象月</label>
              <input 
                type="month" 
                name="period"
                value={formData.period} 
                onChange={handleChange} 
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>メンバー選択</label>
              <select 
                name="userId"
                value={formData.userId}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              >
                {leaders.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.title || '一般'})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>商材選択</label>
              <select 
                name="productId"
                value={formData.productId}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              >
                {products.map(p => (
                  <option key={p.productId} value={p.productId}>{p.productName}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>暫定粗利 (P)</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{provisionalData.grossProfit.toLocaleString()} P</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>暫定件数 (件)</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{provisionalData.orders.toLocaleString()} 件</span>
              </div>
            </div>
            
            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>確定粗利 (P)</label>
              <input 
                type="number" 
                name="confirmedGrossProfit"
                min="0"
                step="1"
                value={formData.confirmedGrossProfit} 
                onChange={handleChange} 
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>確定件数 (件)</label>
              <input 
                type="number" 
                name="confirmedOrders"
                min="0"
                step="1"
                value={formData.confirmedOrders} 
                onChange={handleChange} 
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>月間ROI実績 (倍)</label>
              <input 
                type="number" 
                min="0"
                step="0.1"
                name="monthlyRoi"
                value={formData.monthlyRoi} 
                onChange={handleChange} 
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ padding: '1rem 3rem', fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center' }}
          >
            <Save size={20} style={{ marginRight: '0.5rem' }} />
            {loading ? '保存中...' : 'データを確定する'}
          </button>
        </form>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2><History size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> メンバー別 確定履歴一覧</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
            <Search size={18} style={{ color: 'var(--text-secondary)' }} />
            <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>対象月フィルター:</label>
            <input 
              type="month" 
              value={filterPeriod} 
              onChange={e => setFilterPeriod(e.target.value)} 
              style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            />
          </div>
        </div>
        
        <div className="table-container">
          <table className="reports-table">
            <thead>
              <tr>
                <th>メンバー名</th>
                <th>対象月</th>
                <th>商材</th>
                <th>確定粗利</th>
                <th>確定件数</th>
                <th>ROI実績</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '1rem' }}>選択された月のデータがありません</td>
                </tr>
              ) : (
                filteredData.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 'bold' }}>{getUserDisplayName(d.userId)}</td>
                    <td>{d.period}</td>
                    <td>{products.find(p => p.productId === d.productId)?.productName || d.productId || '-'}</td>
                    <td>{Number(d.confirmedGrossProfit).toLocaleString()} P</td>
                    <td>{Number(d.confirmedOrders).toLocaleString()} 件</td>
                    <td>{d.monthlyRoi} 倍</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredData.length > 0 && (
          <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calculator size={18} /> 全社合計 ({filterPeriod})
            </h3>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>合計粗利</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                  {Number(aggregate.totalGross).toLocaleString()} <span style={{ fontSize: '1rem' }}>P</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>合計件数</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                  {Number(aggregate.totalOrders).toLocaleString()} <span style={{ fontSize: '1rem' }}>件</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>平均ROI</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                  {aggregate.avgRoi} <span style={{ fontSize: '1rem' }}>倍</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
