import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { BarChart3, Target, Calendar, TrendingUp } from 'lucide-react';
import { getVisibleUserIds } from '../../utils/teamUtils';
import '../Dashboard.css';

export default function KpiDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [viewScope, setViewScope] = useState(() => {
    if (user.role === 'executive') return 'company';
    if (user.role === 'manager') return 'team';
    return 'personal';
  });

  const [dashboardData, setDashboardData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const prodSnap = await getDocs(collection(db, 'productMasters'));
        const prodList = [];
        prodSnap.forEach(d => {
          if (d.data().isActive !== false) prodList.push(d.data());
        });
        setProducts(prodList);

        if (viewScope === 'company' && user.role === 'executive') {
          // Company level -> use dailyKpiSummary
          const sumQuery = query(collection(db, 'dailyKpiSummary'), orderBy('date', 'desc'), limit(100));
          const sumSnap = await getDocs(sumQuery);
          const sumList = [];
          sumSnap.forEach(d => sumList.push(d.data()));
          setDashboardData(sumList);
        } else {
          // Team or Personal -> fetch dailyKpi and aggregate
          const visibleIds = await getVisibleUserIds(
            viewScope === 'personal' ? { ...user, role: 'leader' } : user
          );
          
          if (visibleIds.length === 0) {
            setDashboardData([]);
            return;
          }

          // Fetch recent dailyKpis
          // Firebase 'in' is limited to 10, so if team > 10, we must fetch all or chunk.
          // For simplicity, we fetch recent ones and filter.
          const kpiQuery = query(collection(db, 'dailyKpi'), orderBy('date', 'desc'), limit(500));
          const kpiSnap = await getDocs(kpiQuery);
          
          const aggregated = {};
          
          kpiSnap.forEach(d => {
            const data = d.data();
            if (visibleIds.includes(data.userId)) {
              const key = `${data.date}_${data.productId}`;
              if (!aggregated[key]) {
                aggregated[key] = {
                  date: data.date,
                  productId: data.productId,
                  totals: { total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 }
                };
              }
              const aggTotals = aggregated[key].totals;
              const dTotals = data.totals || {};
              aggTotals.total += (dTotals.total || 0);
              aggTotals.actual += (dTotals.actual || 0);
              aggTotals.recall += (dTotals.recall || 0);
              aggTotals.owner += (dTotals.owner || 0);
              aggTotals.prospect += (dTotals.prospect || 0);
              aggTotals.appoint += (dTotals.appoint || 0);
            }
          });

          // Sort by date desc
          const sorted = Object.values(aggregated).sort((a, b) => b.date.localeCompare(a.date));
          setDashboardData(sorted);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [viewScope, user]);

  const filteredSummaries = selectedProduct === 'all' 
    ? dashboardData 
    : dashboardData.filter(s => s.productId === selectedProduct);

  const aggregateTotals = () => {
    const agg = { total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 };
    filteredSummaries.forEach(s => {
      Object.keys(agg).forEach(k => {
        agg[k] += s.totals[k] || 0;
      });
    });
    return agg;
  };

  const totals = aggregateTotals();

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.substring(0,4)}/${dateStr.substring(4,6)}/${dateStr.substring(6,8)}`;
  };

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>KPIダッシュボード (K-01)</h1>
        <p>KPI実績サマリー</p>
      </div>

      <div className="filter-bar glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontWeight: 'bold' }}>表示範囲:</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {user.role === 'executive' && (
              <button 
                onClick={() => setViewScope('company')}
                style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: viewScope === 'company' ? 'var(--accent-primary)' : 'transparent', color: viewScope === 'company' ? 'white' : 'var(--text-primary)', cursor: 'pointer' }}
              >
                全社
              </button>
            )}
            {(user.role === 'manager' || user.role === 'executive') && (
              <button 
                onClick={() => setViewScope('team')}
                style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: viewScope === 'team' ? 'var(--accent-primary)' : 'transparent', color: viewScope === 'team' ? 'white' : 'var(--text-primary)', cursor: 'pointer' }}
              >
                自チーム
              </button>
            )}
            <button 
              onClick={() => setViewScope('personal')}
              style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: viewScope === 'personal' ? 'var(--accent-primary)' : 'transparent', color: viewScope === 'personal' ? 'white' : 'var(--text-primary)', cursor: 'pointer' }}
            >
              個人
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontWeight: 'bold' }}>商材フィルター:</label>
          <select 
            value={selectedProduct} 
            onChange={e => setSelectedProduct(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
          >
            <option value="all">全商材合計</option>
            {products.map(p => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>読み込み中...</div>
      ) : (
        <>
          <div className="dashboard-grid">
            <div className="stat-card glass-panel" style={{ padding: '1.5rem' }}>
              <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <Target size={20} />
                <h3>合計架電数</h3>
              </div>
              <div className="stat-value" style={{ fontSize: '2.5rem', fontWeight: 'bold', marginTop: '1rem' }}>
                {totals.total.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>件</span>
              </div>
            </div>
            
            <div className="stat-card glass-panel" style={{ padding: '1.5rem' }}>
              <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <BarChart3 size={20} />
                <h3>有効通話 / 担当者通話</h3>
              </div>
              <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem' }}>
                {totals.actual.toLocaleString()} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>/ {totals.owner.toLocaleString()}</span>
              </div>
            </div>

            <div className="stat-card glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
              <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <TrendingUp size={20} style={{ color: '#10b981' }} />
                <h3>見込数 / アポ数</h3>
              </div>
              <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem', color: '#10b981' }}>
                {totals.prospect.toLocaleString()} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>/ {totals.appoint.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ marginTop: '2rem', padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} /> データ一覧
            </h3>
            <div className="table-container">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>商材</th>
                    <th>架電数</th>
                    <th>有効通話</th>
                    <th>再コール</th>
                    <th>担当者通話</th>
                    <th>見込数</th>
                    <th>アポ数</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center' }}>データがありません</td></tr>
                  ) : (
                    filteredSummaries.map((s, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 'bold' }}>{formatDate(s.date)}</td>
                        <td>{products.find(p => p.productId === s.productId)?.productName || s.productId}</td>
                        <td>{s.totals?.total || 0}</td>
                        <td>{s.totals?.actual || 0}</td>
                        <td>{s.totals?.recall || 0}</td>
                        <td>{s.totals?.owner || 0}</td>
                        <td>{s.totals?.prospect || 0}</td>
                        <td>{s.totals?.appoint || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
