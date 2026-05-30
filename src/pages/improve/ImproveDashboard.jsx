import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { RefreshCw, Plus, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import '../Dashboard.css';

export default function ImproveDashboard() {
  const { user, isManagerOrAbove } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  
  // For creating new tasks
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [usersList, setUsersList] = useState([]);

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
          // Fetch users for manager to assign tasks
          const uSnap = await getDocs(collection(db, 'users'));
          const uList = [];
          uSnap.forEach(d => uList.push({ uid: d.id, ...d.data() }));
          setUsersList(uList);
          if (uList.length > 0) setTargetUserId(uList[0].uid);
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

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !targetUserId) return;
    
    try {
      const docRef = await addDoc(collection(db, 'improveTasks'), {
        userId: targetUserId,
        assignedBy: user.uid,
        title: newTaskTitle.trim(),
        status: 'pending',
        deadline: '',
        result: '',
        createdAt: serverTimestamp()
      });
      
      const targetUser = usersList.find(u => u.uid === targetUserId);
      setTasks([{ 
        id: docRef.id, 
        userId: targetUserId,
        assignedBy: user.uid,
        title: newTaskTitle.trim(),
        status: 'pending',
        createdAt: new Date()
      }, ...tasks]);
      setNewTaskTitle('');
      alert('改善タスクを作成しました');
    } catch (error) {
      console.error(error);
      alert('タスクの作成に失敗しました');
    }
  };

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>改善ダッシュボード (I-01)</h1>
        <p>個人の課題に対する改善タスクの状況サマリー</p>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <Clock size={20} />
            <h3>進行中・未着手タスク</h3>
          </div>
          <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem', color: '#f59e0b' }}>
            {pendingCount} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>件</span>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
          <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <CheckCircle size={20} />
            <h3>完了タスク</h3>
          </div>
          <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem', color: '#10b981' }}>
            {completedCount} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>件</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isManagerOrAbove ? '1fr 1fr' : '1fr', gap: '2rem' }}>
        {isManagerOrAbove && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} /> 新規タスクの割り当て
            </h2>
            <form onSubmit={handleCreateTask}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>対象メンバー</label>
                <select 
                  value={targetUserId} 
                  onChange={e => setTargetUserId(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                  required
                >
                  {usersList.map(u => <option key={u.uid} value={u.uid}>{u.name || u.uid}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>改善テーマ・タスク内容</label>
                <input 
                  type="text" 
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  placeholder="例：ヒアリング項目の徹底"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>タスクを割り当てる</button>
            </form>
          </div>
        )}

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={20} /> 最新の改善タスク
            </h2>
            <Link to="/improve/tasks" className="btn btn-secondary btn-sm">すべて見る</Link>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center' }}>読み込み中...</div>
          ) : tasks.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>タスクがありません</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {tasks.slice(0, 5).map(t => (
                <li key={t.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '1.1rem' }}>{t.title}</strong>
                    {t.status === 'completed' ? (
                      <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 'bold' }}>完了</span>
                    ) : (
                      <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 'bold' }}>進行中</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    対象: {isManagerOrAbove ? (usersList.find(u => u.uid === t.userId)?.name || t.userId) : '自分'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
