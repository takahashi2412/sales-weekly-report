import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { TrendingUp, Users, Target, Calendar } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { getVisibleUsers } from '../../utils/teamUtils';

export default function KpiCompare() {
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

  useEffect(() => {
    if (loading || !selectedProduct || teamMembers.length === 0) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // --- 1. メンバー間KPI比較 (直近7日/30日) ---
        const today = new Date();
        const pastDate = new Date();
        pastDate.setDate(today.getDate() - parseInt(dateRange, 10));
        
        const endStr = today.toISOString().split('T')[0].replace(/-/g, '');
        const startStr = pastDate.toISOString().split('T')[0].replace(/-/g, '');

        const qRecent = query(
          collection(db, 'dailyKpi'),
          where('productId', '==', selectedProduct),
          where('date', '>=', startStr),
          where('date', '<=', endStr)
        );
        const snapRecent = await getDocs(qRecent);
        
        const aggRecent = {};
        teamMembers.forEach(m => {
          aggRecent[m.id] = { name: m.name, total: 0, actual: 0, prospect: 0, appoint: 0 };
        });

        snapRecent.forEach(d => {
          const data = d.data();
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
        const monthStr = selectedMonth.replace('-', ''); // YYYYMM
        const startMonthStr = `${monthStr}01`;
        const endMonthStr = `${monthStr}31`;
        
        const qMonth = query(
          collection(db, 'dailyKpi'),
          where('productId', '==', selectedProduct),
          where('date', '>=', startMonthStr),
          where('date', '<=', endMonthStr)
        );
        const snapMonth = await getDocs(qMonth);

        // Fetch KGI Targets
        const kgiMap = {};
        for (const m of teamMembers) {
          const kgiRef = doc(db, 'users', m.id, 'kgiSettings', monthStr);
          const kgiSnap = await getDoc(kgiRef);
          if (kgiSnap.exists()) {
            kgiMap[m.id] = kgiSnap.data().targets?.[selectedProduct]?.appoint || 0;
          } else {
            kgiMap[m.id] = 0; // Default or not set
          }
        }

        const aggMonth = {};
        teamMembers.forEach(m => {
          aggMonth[m.id] = { 
            name: m.name, 
            kgiAppoint: kgiMap[m.id] || 0,
            currentAppoint: 0 
          };
        });

        snapMonth.forEach(d => {
          const data = d.data();
          if (aggMonth[data.userId]) {
            aggMonth[data.userId].currentAppoint += (data.totals?.appoint || 0);
          }
        });

        const proj = Object.values(aggMonth).map(d => {
          const bDays = parseInt(businessDays, 10) || 20;
          const pDays = parseInt(passedDays, 10) || 1;
          const rate = bDays / pDays;
          
          const projected = Math.round(d.currentAppoint * rate);
          return {
            ...d,
            projectedAppoint: projected,
            diff: projected - d.kgiAppoint
          };
        });
        
        setProjectionData(proj.sort((a, b) => b.projectedAppoint - a.projectedAppoint));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [selectedProduct, dateRange, selectedMonth, businessDays, passedDays, teamMembers.length, loading]);

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
        <p>メンバー間のKPI実績比較と、当月末の着地予測</p>
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
              <Target size={20} /> 月末着地予測 (アポ数)
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
                  <th>KGI目標</th>
                  <th>現状実績</th>
                  <th style={{ background: 'rgba(59,130,246,0.1)' }}>着地予測</th>
                  <th>目標との差分</th>
                </tr>
              </thead>
              <tbody>
                {projectionData.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center' }}>データがありません</td></tr>
                ) : (
                  projectionData.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 'bold' }}>{d.name}</td>
                      <td>{d.kgiAppoint}</td>
                      <td>{d.currentAppoint}</td>
                      <td style={{ background: 'rgba(59,130,246,0.05)', fontWeight: 'bold' }}>
                        {d.projectedAppoint} <TrendingUp size={14} style={{ marginLeft: '4px', color: 'var(--accent-primary)' }}/>
                      </td>
                      <td style={{ fontWeight: 'bold', color: d.diff >= 0 ? '#10b981' : '#ef4444' }}>
                        {d.diff > 0 ? `+${d.diff}` : d.diff}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
