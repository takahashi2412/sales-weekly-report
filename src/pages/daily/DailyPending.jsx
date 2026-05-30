import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Link, Navigate } from 'react-router-dom';
import { Clock, AlertTriangle, FileText } from 'lucide-react';
import '../Dashboard.css';

export default function DailyPending() {
  const { user, isManagerOrAbove } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingReports, setPendingReports] = useState([]);
  const [tab, setTab] = useState('unreviewed'); // 'unreviewed' | 'unsubmitted'

  if (!isManagerOrAbove) {
    return <Navigate to="/daily" replace />;
  }

  useEffect(() => {
    const fetchPending = async () => {
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
        snap.forEach(d => {
          const data = d.data();
          if (data.status === 'submitted') {
            list.push({ id: d.id, ...data });
          }
        });

        if (user.role === 'leader') {
          list.sort((a, b) => b.date.localeCompare(a.date));
        }
        setPendingReports(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if (tab === 'unreviewed') {
      fetchPending();
    } else {
      setLoading(false); // Unsubmitted logic requires joining users and reports, mocked for now
    }
  }, [tab]);

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>未提出・確認待ち (D-05)</h1>
        <p>チームメンバーの日報提出状況を管理します</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          className={`btn ${tab === 'unreviewed' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('unreviewed')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Clock size={18} /> 確認待ち一覧
        </button>
        <button 
          className={`btn ${tab === 'unsubmitted' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('unsubmitted')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <AlertTriangle size={18} /> 未提出者一覧
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        {tab === 'unreviewed' && (
          <>
            <h2 style={{ marginBottom: '1.5rem' }}>マネージャー確認待ちの日報</h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>読み込み中...</div>
            ) : (
              <div className="table-container">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>提出日</th>
                      <th>提出者</th>
                      <th>内容プレビュー</th>
                      <th>アクション</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingReports.length === 0 ? (
                      <tr><td colSpan="4" style={{ textAlign: 'center' }}>確認待ちの日報はありません</td></tr>
                    ) : (
                      pendingReports.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 'bold' }}>{r.date}</td>
                          <td>{r.userName}</td>
                          <td style={{ maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.content}
                          </td>
                          <td>
                            <Link to={`/daily/${r.id}`} className="btn btn-primary btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <FileText size={14} /> 内容を確認
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'unsubmitted' && (
          <>
            <h2 style={{ marginBottom: '1.5rem' }}>本日の未提出者</h2>
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              未提出者の一覧表示機能は開発中です。
            </div>
          </>
        )}
      </div>
    </div>
  );
}
