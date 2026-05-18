import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Save, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../Dashboard.css';

export default function EducationNew() {
  const { user, isManagerOrAbove } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  
  const [targetUserId, setTargetUserId] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [theme, setTheme] = useState('');
  const [content, setContent] = useState('');
  const [progress, setProgress] = useState('medium');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const uSnap = await getDocs(collection(db, 'users'));
        const uList = [];
        uSnap.forEach(d => uList.push({ uid: d.id, ...d.data() }));
        setUsersList(uList);
        if (uList.length > 0) setTargetUserId(uList[0].uid);
      } catch (e) {
        console.error(e);
      }
    };
    if (isManagerOrAbove) {
      fetchUsers();
    } else {
      navigate('/dashboard');
    }
  }, [isManagerOrAbove, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetUserId || !theme.trim() || !content.trim()) {
      return alert('必須項目を入力してください');
    }
    
    setLoading(true);
    try {
      const targetUser = usersList.find(u => u.uid === targetUserId);
      const docId = `${targetUserId}_${date.replace(/-/g, '')}_${Date.now()}`;
      
      await setDoc(doc(db, 'educationRecords', docId), {
        userId: targetUserId,
        userName: targetUser?.name || 'Unknown',
        trainerId: user.uid,
        date,
        theme: theme.trim(),
        content: content.trim(),
        progress,
        createdAt: serverTimestamp()
      });
      
      alert('教育記録を保存しました');
      navigate('/education');
    } catch (error) {
      console.error(error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (!isManagerOrAbove) return null;

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>教育メモ入力 (E-02)</h1>
        <p>メンバーに対する教育・指導の記録を残します</p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>対象メンバー</label>
              <select 
                value={targetUserId}
                onChange={e => setTargetUserId(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              >
                {usersList.map(u => <option key={u.uid} value={u.uid}>{u.name || u.uid}</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>実施日</label>
              <input 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>教育テーマ</label>
            <input 
              type="text" 
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="例：ヒアリングスキルの向上、クロージングの練習"
              required
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>指導内容とフィードバック</label>
            <textarea 
              value={content}
              onChange={e => setContent(e.target.value)}
              required
              rows={8}
              placeholder="指導した内容や本人の課題、次回の目標などを記入してください"
              style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>理解度 / 評価</label>
            <select 
              value={progress}
              onChange={e => setProgress(e.target.value)}
              style={{ width: '100%', maxWidth: '200px', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            >
              <option value="high">高い（よく理解している）</option>
              <option value="medium">普通（概ね理解している）</option>
              <option value="low">低い（再度指導が必要）</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
            <Save size={20} />
            {loading ? '保存中...' : '教育記録を保存する'}
          </button>
        </form>
      </div>
    </div>
  );
}
