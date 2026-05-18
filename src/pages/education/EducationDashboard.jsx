import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { BookOpen, Users, Plus, Award } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import '../Dashboard.css';

export default function EducationDashboard() {
  const { user, isManagerOrAbove } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  
  if (!isManagerOrAbove) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const q = query(collection(db, 'educationRecords'), orderBy('date', 'desc'), limit(10));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setRecords(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>教育ダッシュボード (E-01)</h1>
        <p>チームメンバーへの教育・指導状況のサマリー</p>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }} onClick={() => window.location.href='/education/new'}>
          <div style={{ background: '#3b82f620', padding: '1rem', borderRadius: '50%', color: '#3b82f6', marginBottom: '1rem' }}>
            <Plus size={32} />
          </div>
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>新規教育記録を作成</h3>
        </div>

        <div className="stat-card glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #8b5cf6' }}>
          <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <Award size={20} />
            <h3>今月の教育実施数</h3>
          </div>
          <div className="stat-value" style={{ fontSize: '2.5rem', fontWeight: 'bold', marginTop: '1rem', color: '#8b5cf6' }}>
            {records.length} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>回</span>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={20} /> 最新の教育記録
          </h2>
          <Link to="/education/history" className="btn btn-secondary btn-sm">すべて見る</Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>読み込み中...</div>
        ) : (
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>実施日</th>
                  <th>対象メンバー</th>
                  <th>テーマ</th>
                  <th>理解度/評価</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center' }}>記録がありません</td></tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td style={{ fontWeight: 'bold' }}>{r.userName}</td>
                      <td>{r.theme}</td>
                      <td>
                        <span style={{ 
                          background: r.progress === 'high' ? '#10b98120' : r.progress === 'low' ? '#ef444420' : '#f59e0b20', 
                          color: r.progress === 'high' ? '#10b981' : r.progress === 'low' ? '#ef4444' : '#f59e0b',
                          padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold'
                        }}>
                          {r.progress === 'high' ? '高い' : r.progress === 'low' ? '低い' : '普通'}
                        </span>
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
