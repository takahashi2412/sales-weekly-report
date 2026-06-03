import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { TrendingUp, Users, Target, Calendar, AlertCircle } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { getVisibleUsers } from '../../utils/teamUtils';

export default function Analysis() {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  
  // Filters
  const [selectedProduct, setSelectedProduct] = useState('');
  const [dateRange, setDateRange] = useState('7'); // 7 or 30
  
  // Projection settings
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [businessDays, setBusinessDays] = useState(20);
  const [passedDays, setPassedDays] = useState(10); // 経過日数
  
  const [compareData, setCompareData] = useState([]);
  const [projectionData, setProjectionData] = useState([]);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const prodSnap = await getDocs(collection(db, 'productMasters'));
        const pList = [];
        prodSnap.forEach(d => { if (d.data().isActive !== false) pList.push(d.data()); });
        setProducts(pList);
        if (pList.length > 0) setSelectedProduct(pList[0].productId);

        const visible = await getVisibleUsers(user);
        setTeamMembers(visible);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchMeta();
  }, [user]);

  // Handle auto calculation of passedDays and fetching default workDays
  useEffect(() => {
    if (!selectedMonth) return;
    const today = new Date();
    const selDate = new Date(`${selectedMonth}-01`);
    
    let pDays = 0;
    if (today.getFullYear() === selDate.getFullYear() && today.getMonth() === selDate.getMonth()) {
      // Current month: calculate weekdays up to today
      let d = new Date(selDate);
      while (d <= today) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) pDays++; // skip Sun, Sat
        d.setDate(d.getDate() + 1);
      }
      setPassedDays(pDays || 1);
    } else if (selDate < today) {
      // Past month
      setPassedDays(businessDays); // assume all passed
    } else {
      // Future month
      setPassedDays(1);
    }
  }, [selectedMonth]); // Wait, businessDays might change, but let's just trigger on selectedMonth

  useEffect(() => {
    if (loading || !selectedProduct || teamMembers.length === 0) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // --- 1. メンバー間KPI比較 (直近7日/30日) ---
        const today = new Date();
        const pastDate = new Date();
        pastDate.setDate(today.getDate() - parseInt(dateRange, 10));
        
        const formatDateLocal = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        const endStr = formatDateLocal(today);
        const startStr = formatDateLocal(pastDate);

        let snapRecentDocs = [];
        if (user.role === 'leader') {
          const promises = teamMembers.map(m => getDocs(query(
            collection(db, 'dailyKpi'),
            where('userId', '==', m.id),
            where('date', '>=', startStr),
            where('date', '<=', endStr)
          )));
          const snaps = await Promise.all(promises);
          snaps.forEach(snap => snap.forEach(d => snapRecentDocs.push(d)));
        } else {
          const qRecent = query(
            collection(db, 'dailyKpi'),
            where('date', '>=', startStr),
            where('date', '<=', endStr)
          );
          const snapRecent = await getDocs(qRecent);
          snapRecent.forEach(d => snapRecentDocs.push(d));
        }
        
        const aggRecent = {};
        teamMembers.forEach(m => {
          aggRecent[m.id] = { name: m.name, total: 0, actual: 0, prospect: 0, appoint: 0 };
        });

        snapRecentDocs.forEach(d => {
          const data = d.data();
          if (user.role === 'leader') {
            if (data.productId !== selectedProduct) return;
            if (data.date < startStr || data.date > endStr) return;
          } else {
            if (data.productId !== selectedProduct) return;
          }
          
          if (aggRecent[data.userId]) {
            const tr = aggRecent[data.userId];
            tr.total += (data.totals?.total || 0);
            tr.actual += (data.totals?.actual || 0);
            tr.prospect += (data.totals?.prospect || 0);
            tr.appoint += (data.totals?.appoint || 0);
          }
        });
        setCompareData(Object.values(aggRecent).sort((a,b) => b.total - a.total));

        // --- 2. 月末着地予測 ---
        const monthStr = selectedMonth;
        const startMonthStr = `${monthStr}-01`;
        const endMonthStr = `${monthStr}-31`;
        
        let snapMonthDocs = [];
        if (user.role === 'leader') {
          const promises = teamMembers.map(m => getDocs(query(
            collection(db, 'orders'),
            where('userId', '==', m.id),
            where('orderDate', '>=', startMonthStr),
            where('orderDate', '<=', endMonthStr)
          )));
          const snaps = await Promise.all(promises);
          snaps.forEach(snap => snap.forEach(d => snapMonthDocs.push(d)));
        } else {
          const qMonth = query(
            collection(db, 'orders'),
            where('orderDate', '>=', startMonthStr),
            where('orderDate', '<=', endMonthStr)
          );
          const snapMonth = await getDocs(qMonth);
          snapMonth.forEach(d => snapMonthDocs.push(d));
        }

        // Fetch KGI Targets
        const kgiMap = {};
        let maxWorkDays = 20;
        for (const m of teamMembers) {
          const docId = `${m.id}_${selectedProduct}_${monthStr.replace('-', '')}`;
          const kgiRef = doc(db, 'kpiTargets', docId);
          const kgiSnap = await getDoc(kgiRef);
          if (kgiSnap.exists() && (kgiSnap.data().status === 'approved' || kgiSnap.data().status === 'pending')) {
            const data = kgiSnap.data();
            const wDays = data.workDays || 20;
            if (wDays > maxWorkDays) maxWorkDays = wDays;
            
            kgiMap[m.id] = {
              targetProfit: data.grossProfitTarget || 0,
              workDays: wDays
            };
          } else {
            kgiMap[m.id] = { targetProfit: 0, workDays: 20 }; 
          }
        }
        
        const aggMonth = {};
        teamMembers.forEach(m => {
          aggMonth[m.id] = { 
            name: m.name, 
            kgiProfit: kgiMap[m.id]?.targetProfit || 0,
            workDays: kgiMap[m.id]?.workDays || 20,
            currentProfit: 0 
          };
        });

        snapMonthDocs.forEach(d => {
          const data = d.data();
          if (data.productId !== selectedProduct) return;
          if (user.role === 'leader' && (data.orderDate < startMonthStr || data.orderDate > endMonthStr)) {
            return;
          }
          
          if (aggMonth[data.userId]) {
            aggMonth[data.userId].currentProfit += (Number(data.grossProfitPoint) || 0);
          }
        });

        const proj = Object.values(aggMonth).map(d => {
          const bDays = parseInt(businessDays, 10) || d.workDays || 20;
          const pDays = parseInt(passedDays, 10) || 1;
          const rate = bDays / pDays;
          
          const projected = Math.round(d.currentProfit * rate);
          return {
            ...d,
            projectedProfit: projected,
            diff: (projected - d.kgiProfit)
          };
        });
        
        setProjectionData(proj.sort((a, b) => b.projectedProfit - a.projectedProfit));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [selectedProduct, dateRange, selectedMonth, businessDays, passedDays, teamMembers.length]);

  if (loading && products.length === 0) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>読み込み中...</div>;
  }

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <Breadcrumb items={[
        { label: 'KPIダッシュボード', path: '/kpi' },
        { label: 'KPI比較・着地予測 (K-05)' }
      ]} />

      <div className="page-header" style={{ marginBottom: '2rem', marginTop: '1rem' }}>
        <h1>KPI比較・着地予測 (K-05)</h1>
        <p>メンバー間のKPI実績比較と、当月末の受注着地予測</p>
      </div>

      <div className="filter-bar glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontWeight: 'bold' }}>商材:</label>
          <select 
            value={selectedProduct} 
            onChange={e => setSelectedProduct(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
          >
            {products.map(p => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
          </select>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Section 1: メンバー間KPI比較 */}
        <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} /> メンバー間KPI比較
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
              <select 
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
                style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              >
                <option value="7">直近7日間</option>
                <option value="30">直近30日間</option>
              </select>
            </div>
          </div>
          
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="reports-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '120px' }}>メンバー名</th>
                  <th>架電数</th>
                  <th>有効通話</th>
                  <th>見込数</th>
                  <th>アポ数</th>
                </tr>
              </thead>
              <tbody>
                {compareData.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center' }}>データがありません</td></tr>
                ) : (
                  compareData.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 'bold' }}>{d.name}</td>
                      <td>{d.total}</td>
                      <td>{d.actual}</td>
                      <td>{d.prospect}</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{d.appoint}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: 着地予測 */}
        <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={20} /> 月末着地予測 (粗利)
            </h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>稼働日数:</span>
                <input 
                  type="number" min="1" max="31" value={businessDays} 
                  onChange={e => setBusinessDays(e.target.value)}
                  style={{ padding: '0.4rem', width: '60px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>経過日数:</span>
                <input 
                  type="number" min="1" max="31" value={passedDays} 
                  onChange={e => setPassedDays(e.target.value)}
                  style={{ padding: '0.4rem', width: '60px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>
          </div>
          
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="reports-table">
              <thead>
                <tr>
                  <th>メンバー名</th>
                  <th>目標粗利(P)</th>
                  <th>現状粗利(P)</th>
                  <th style={{ background: 'rgba(16, 185, 129, 0.1)' }}>粗利着地予測(P)</th>
                  <th>目標との差分</th>
                  <th>ステータス</th>
                </tr>
              </thead>
              <tbody>
                {projectionData.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center' }}>データがありません</td></tr>
                ) : (
                  projectionData.map((d, i) => {
                    const isBehind = parseFloat(d.diff) < 0;
                    return (
                      <tr key={i} style={isBehind ? { background: '#fef2f2' } : {}}>
                        <td style={{ fontWeight: 'bold' }}>{d.name}</td>
                        <td>{d.kgiProfit.toLocaleString()}</td>
                        <td>{d.currentProfit.toLocaleString()}</td>
                        <td style={{ background: 'rgba(16, 185, 129, 0.05)', fontWeight: 'bold', color: '#059669' }}>
                          {d.projectedProfit.toLocaleString()} <TrendingUp size={14} style={{ marginLeft: '4px', color: '#10b981' }}/>
                        </td>
                        <td style={{ fontWeight: 'bold', color: isBehind ? '#ef4444' : '#10b981' }}>
                          {!isBehind ? `+${d.diff.toLocaleString()}` : d.diff.toLocaleString()}
                        </td>
                        <td>
                          {isBehind ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold', background: '#fee2e2', padding: '2px 8px', borderRadius: '12px' }}>
                              <AlertCircle size={14} /> ペース遅れ
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.85rem', fontWeight: 'bold', background: '#d1fae5', padding: '2px 8px', borderRadius: '12px' }}>
                              順調
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            ※ 着地予測 ＝ (現状実績 ÷ 経過日数) × 稼働日数。粗利実績は受注明細に入力された暫定値を元に計算しています。
          </div>
        </div>
      </div>
    </div>
  );
}
