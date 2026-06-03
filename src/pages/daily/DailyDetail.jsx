import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FileText, CheckCircle, ChevronLeft } from 'lucide-react';
import '../Dashboard.css';

export default function DailyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isManagerOrAbove } = useAuth();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const docRef = doc(db, 'dailyReports', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setReport({ id: docSnap.id, ...docSnap.data() });
        } else {
          alert('日報が見つかりません');
          navigate('/daily/history');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id, navigate]);

  const handleReview = async () => {
    try {
      await updateDoc(doc(db, 'dailyReports', id), {
        status: 'reviewed',
        reviewedBy: user.uid,
        updatedAt: serverTimestamp()
      });
      alert('日報を確認済みにしました');
      setReport(prev => ({ ...prev, status: 'reviewed', reviewedBy: user.uid }));
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました');
    }
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>読み込み中...</div>;
  if (!report) return null;

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
              <FileText size={24} /> {report.date} の日報
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>提出者: <strong style={{ color: 'var(--text-primary)' }}>{report.userName}</strong></p>
          </div>
          <div>
            {false && (report.status === 'reviewed' ? (
              <span style={{ background: '#10b98120', color: '#10b981', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={18} /> 確認済み
              </span>
            ) : (
              <span style={{ background: '#f59e0b20', color: '#f59e0b', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold' }}>
                確認待ち
              </span>
            ))}
          </div>
        </div>

        <div style={{ minHeight: '300px', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '1.05rem' }}>
          {report.content}
        </div>

        {false && isManagerOrAbove && report.status !== 'reviewed' && (
          <div style={{ marginTop: '3rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
            <button onClick={handleReview} className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={20} /> 内容を確認した（レビュー完了）
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
