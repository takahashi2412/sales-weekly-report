import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Calendar, History, FileText, Database } from 'lucide-react';
import '../Dashboard.css';

export default function KpiHistory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [kpiList, setKpiList] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const prodSnap = await getDocs(collection(db, 'productMasters'));
        const prodList = [];
        prodSnap.forEach(d => {
          if (d.data().isActive !== false) prodList.push(d.data());
        });
        setProducts(prodList);

        // Fetch recent personal KPIs
        const kpiQuery = query(collection(db, 'dailyKpi'), where('userId', '==', user.uid), orderBy('date', 'desc'), limit(30));
        const kpiSnap = await getDocs(kpiQuery);
        const kpis = [];
        kpiSnap.forEach(d => kpis.push({ id: d.id, ...d.data() }));
        setKpiList(kpis);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const SourceBadge = ({ source }) => {
    if (source === 'manual') {
      return (
        <span style={{ background: '#f59e0b', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
          <FileText size={12} /> 手動入力
        </span>
      );
    }
    return (
      <span style={{ background: '#3b82f6', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
        <Database size={12} /> CSV取込
      </span>
    );
  };

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>KPI履歴・推移 (K-04)</h1>
        <p>過去の日次KPIデータと入力ソースの確認</p>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={20} /> 個人の直近KPI履歴
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>読み込み中...</div>
        ) : (
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>入力ソース</th>
                  <th>対象商材</th>
                  <th>架電数</th>
                  <th>有効通話</th>
                  <th>再コール</th>
                  <th>担当者通話</th>
                  <th>見込数</th>
                  <th>アポ数</th>
                </tr>
              </thead>
              <tbody>
                {kpiList.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center' }}>KPI履歴がありません</td></tr>
                ) : (
                  kpiList.map((k, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 'bold' }}>
                        {k.date.substring(0, 4)}/{k.date.substring(4, 6)}/{k.date.substring(6, 8)}
                      </td>
                      <td><SourceBadge source={k.source} /></td>
                      <td>{products.find(p => p.productId === k.productId)?.productName || k.productId}</td>
                      <td>{k.totals?.total || 0}</td>
                      <td>{k.totals?.actual || 0}</td>
                      <td>{k.totals?.recall || 0}</td>
                      <td>{k.totals?.owner || 0}</td>
                      <td>{k.totals?.prospect || 0}</td>
                      <td>{k.totals?.appoint || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
