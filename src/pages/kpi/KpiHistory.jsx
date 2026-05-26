import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { History, FileText, Database, Users, Download } from 'lucide-react';
import { getVisibleUsers } from '../../utils/teamUtils';
import CsvExportModal from '../../components/CsvExportModal';
import '../Dashboard.css';

export default function KpiHistory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('all');
  const [kpiList, setKpiList] = useState([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const prodSnap = await getDocs(collection(db, 'productMasters'));
        const prodList = [];
        prodSnap.forEach(d => {
          if (d.data().isActive !== false) prodList.push(d.data());
        });
        setProducts(prodList);

        const visibleUsers = await getVisibleUsers(user);
        setTeamMembers(visibleUsers);

        // Fetch recent KPIs (all visible, up to 100 or so to avoid huge reads)
        // Since we can't easily do `in` query for > 10, we fetch recent and filter in memory.
        const kpiQuery = query(collection(db, 'dailyKpi'), orderBy('date', 'desc'), limit(500));
        const kpiSnap = await getDocs(kpiQuery);
        const kpis = [];
        const visibleIds = visibleUsers.map(u => u.id);
        
        kpiSnap.forEach(d => {
          const data = d.data();
          if (visibleIds.includes(data.userId)) {
            const member = visibleUsers.find(u => u.id === data.userId);
            kpis.push({ id: d.id, userName: member?.name || '不明', ...data });
          }
        });
        
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

  const formatDate = (d) => {
    if (!d) return '';
    if (d.includes('-')) return d.replace(/-/g, '/');
    if (d.length === 8) return `${d.substring(0, 4)}/${d.substring(4, 6)}/${d.substring(6, 8)}`;
    return d;
  };

  const filteredKpiList = selectedUser === 'all' 
    ? kpiList 
    : kpiList.filter(k => k.userId === selectedUser);

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>KPI履歴・推移 (K-04)</h1>
        <p>過去の日次KPIデータと入力ソースの確認</p>
      </div>

      <div className="filter-bar glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={18} style={{ color: 'var(--text-secondary)' }} />
          <label style={{ fontWeight: 'bold' }}>メンバー:</label>
          <select 
            value={selectedUser} 
            onChange={e => setSelectedUser(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
          >
            {teamMembers.length > 1 && <option value="all">全員</option>}
            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        
        <button 
          className="btn btn-primary" 
          onClick={() => setIsExportModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Download size={18} /> CSV出力
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={20} /> 直近のKPI履歴
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>読み込み中...</div>
        ) : (
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>メンバー</th>
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
                {filteredKpiList.length === 0 ? (
                  <tr><td colSpan="10" style={{ textAlign: 'center' }}>KPI履歴がありません</td></tr>
                ) : (
                  filteredKpiList.map((k, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 'bold' }}>
                        <Link to={`/kpi/detail/${k.id}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                          {formatDate(k.date)}
                        </Link>
                      </td>
                      <td>{k.userName}</td>
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

      <CsvExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        usersData={teamMembers}
      />
    </div>
  );
}
