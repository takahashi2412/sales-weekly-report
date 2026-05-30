import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { History, FileText, CheckCircle, Clock } from 'lucide-react';
import '../Dashboard.css';

export default function DailyHistory() {
  const { user, isManagerOrAbove } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [filterType, setFilterType] = useState('me'); // 'me' | 'team' | 'all'

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        let q;
        if (user.role === 'leader') {
          q = query(collection(db, 'dailyReports'), where('userId', '==', user.uid));
        } else {
          q = query(collection(db, 'dailyReports'), orderBy('date', 'desc'), limit(50));
        }
        const snap = await getDocs(q);

        let list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));

        if (user.role === 'leader') {
          list.sort((a, b) => b.date.localeCompare(a.date));
        }
        
        // Very basic team filter logic (in real app, we should query by teamId)
        if (filterType === 'me' && user.role !== 'leader') {
          list = list.filter(r => r.userId === user.uid);
        }
        
        // Very basic team filter logic (in real app, we should query by teamId)
        setReports(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [user, filterType, isManagerOrAbove]);

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>日報履歴 (D-03)</h1>
        <p>過去の日報提出履歴を確認します</p>
      </div>

      <div className="filter-bar glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold' }}>表示対象: </div>
        <select 
          value={filterType} 
          onChange={e => setFilterType(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
        >
          <option value="me">自分の日報</option>
          {isManagerOrAbove && <option value="all">チーム/全社の日報</option>}
        </select>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={20} /> 日報一覧
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>読み込み中...</div>
        ) : (
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>提出日</th>
                  <th>提出者</th>
                  <th>内容プレビュー</th>
                  <th>ステータス</th>
                  <th>アクション</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center' }}>日報データがありません</td></tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 'bold' }}>{r.date}</td>
                      <td>{r.userName}</td>
                      <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.content}
                      </td>
                      <td>
                        {r.status === 'reviewed' ? (
                          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><CheckCircle size={14}/> 確認済</span>
                        ) : (
                          <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={14}/> 確認待ち</span>
                        )}
                      </td>
                      <td>
                        <Link to={`/daily/${r.id}`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                          <FileText size={14} style={{ marginRight: '0.2rem' }}/> 詳細を見る
                        </Link>
                      </td>
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
