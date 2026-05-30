import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { RefreshCw, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import '../Dashboard.css';

export default function ImproveTasks() {
  const { user, isManagerOrAbove } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        let q;
        if (user.role === 'leader') {
          q = query(collection(db, 'improveTasks'), where('userId', '==', user.uid));
        } else {
          q = query(collection(db, 'improveTasks'), orderBy('createdAt', 'desc'), limit(50));
        }
        
        if (isManagerOrAbove) {
          const uSnap = await getDocs(collection(db, 'users'));
          const uList = [];
          uSnap.forEach(d => uList.push({ uid: d.id, ...d.data() }));
          setUsersList(uList);
        }
        
        const snap = await getDocs(q);
        let list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        
        if (user.role === 'leader') {
          list.sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeB - timeA;
          });
        }
        
        setTasks(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [user, isManagerOrAbove]);

  const filteredTasks = tasks.filter(t => filter === 'all' || t.status === filter);

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>改善タスク一覧 (I-02)</h1>
        <p>割り当てられた改善タスクの管理と進捗確認</p>
      </div>

      <div className="filter-bar glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold' }}>ステータス: </div>
        <select 
          value={filter} 
          onChange={e => setFilter(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
        >
          <option value="all">すべて</option>
          <option value="pending">進行中・未着手</option>
          <option value="completed">完了</option>
        </select>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={20} /> タスク一覧
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>読み込み中...</div>
        ) : (
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>作成日</th>
                  <th>対象者</th>
                  <th>タスク内容</th>
                  <th>ステータス</th>
                  <th>アクション</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center' }}>該当するタスクがありません</td></tr>
                ) : (
                  filteredTasks.map((t) => (
                    <tr key={t.id}>
                      <td>{t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : '最近'}</td>
                      <td>{isManagerOrAbove ? (usersList.find(u => u.uid === t.userId)?.name || t.userId) : '自分'}</td>
                      <td style={{ fontWeight: 'bold' }}>{t.title}</td>
                      <td>
                        {t.status === 'completed' ? (
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>完了</span>
                        ) : (
                          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>進行中</span>
                        )}
                      </td>
                      <td>
                        <Link to={`/improve/tasks/${t.id}`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                          <FileText size={14} style={{ marginRight: '0.2rem' }}/> 詳細・更新
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
