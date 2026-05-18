import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { BarChart3, Target, Calendar, TrendingUp } from 'lucide-react';
import '../Dashboard.css';

export default function KpiDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [summaries, setSummaries] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const prodSnap = await getDocs(collection(db, 'productMasters'));
        const prodList = [];
        prodSnap.forEach(d => {
          if (d.data().isActive !== false) prodList.push(d.data());
        });
        setProducts(prodList);

        // Fetch recent summaries
        const sumQuery = query(collection(db, 'dailyKpiSummary'), orderBy('date', 'desc'), limit(30));
        const sumSnap = await getDocs(sumQuery);
        const sumList = [];
        sumSnap.forEach(d => sumList.push(d.data()));
        setSummaries(sumList);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredSummaries = selectedProduct === 'all' 
    ? summaries 
    : summaries.filter(s => s.productId === selectedProduct);

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

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>KPIダッシュボード (K-01)</h1>
        <p>商材別・全社合計のKPIサマリー</p>
      </div>

      <div className="filter-bar glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold' }}>フィルター: </div>
        <select 
          value={selectedProduct} 
          onChange={e => setSelectedProduct(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
        >
          <option value="all">全商材合計</option>
          {products.map(p => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
        </select>
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
              <Calendar size={18} /> 直近30日の推移
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
                        <td>{s.date}</td>
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
