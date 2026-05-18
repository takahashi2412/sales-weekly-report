import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Send, FileEdit } from 'lucide-react';
import '../Dashboard.css';

export default function DailyInput() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [content, setContent] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return alert('内容を入力してください');
    
    setLoading(true);
    try {
      const docId = `${user.uid}_${date.replace(/-/g, '')}`;
      await setDoc(doc(db, 'dailyReports', docId), {
        userId: user.uid,
        userName: user.displayName || '名無し',
        date: date,
        content: content.trim(),
        status: 'submitted',
        reviewedBy: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      alert('日報を提出しました');
      setContent('');
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>日報入力 (D-02)</h1>
        <p>本日の業務内容や所感を記入して提出します</p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileEdit size={18} /> 対象日
            </label>
            <input 
              type="date" 
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              style={{ width: '100%', maxWidth: '200px', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ fontWeight: 'bold' }}>業務内容・所感</label>
            <textarea 
              value={content}
              onChange={e => setContent(e.target.value)}
              required
              rows={10}
              placeholder="・今日の成果\n・課題・改善点\n・明日の予定など"
              style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical' }}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
            <Send size={20} />
            {loading ? '送信中...' : '日報を提出する'}
          </button>
        </form>
      </div>
    </div>
  );
}
