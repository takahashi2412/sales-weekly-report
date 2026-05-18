import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { RefreshCw, CheckCircle, ChevronLeft, Save } from 'lucide-react';
import '../Dashboard.css';

export default function ImproveTaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);
  
  const [result, setResult] = useState('');
  const [status, setStatus] = useState('pending');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const docRef = doc(db, 'improveTasks', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const t = { id: docSnap.id, ...docSnap.data() };
          setTask(t);
          setResult(t.result || '');
          setStatus(t.status || 'pending');
        } else {
          alert('タスクが見つかりません');
          navigate('/improve/tasks');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [id, navigate]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'improveTasks', id), {
        result,
        status,
        updatedAt: serverTimestamp()
      });
      alert('タスクを更新しました');
      setTask(prev => ({ ...prev, result, status }));
    } catch (error) {
      console.error(error);
      alert('エラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>読み込み中...</div>;
  if (!task) return null;

  const isOwner = task.userId === user.uid;

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <button 
        onClick={() => navigate(-1)} 
        className="btn btn-secondary" 
        style={{ display: 'inline-flex', alignItems: 'center', marginBottom: '2rem' }}
      >
        <ChevronLeft size={18} /> 戻る
      </button>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <RefreshCw size={24} /> {task.title}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              作成日: {task.createdAt?.toDate ? task.createdAt.toDate().toLocaleDateString() : '不明'}
            </p>
          </div>
          <div>
            {task.status === 'completed' ? (
              <span style={{ background: '#10b98120', color: '#10b981', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={18} /> 完了
              </span>
            ) : (
              <span style={{ background: '#f59e0b20', color: '#f59e0b', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold' }}>
                進行中
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>ステータス</label>
            <select 
              value={status} 
              onChange={e => setStatus(e.target.value)}
              style={{ width: '100%', maxWidth: '200px', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            >
              <option value="pending">進行中</option>
              <option value="completed">完了</option>
            </select>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>改善結果・取り組み内容</label>
            <textarea 
              value={result}
              onChange={e => setResult(e.target.value)}
              rows={8}
              placeholder="改善に取り組んだ結果や進捗を記入してください"
              style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical' }}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={saving}
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
            <Save size={20} />
            {saving ? '保存中...' : '進捗を更新する'}
          </button>
        </form>
      </div>
    </div>
  );
}
