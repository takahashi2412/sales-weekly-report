import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import WeeklyForm from '../WeeklyForm';

export default function HistoryDetail() {
  const { reportId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const docRef = doc(db, 'reports', reportId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setReport({ id: docSnap.id, ...docSnap.data() });
        } else {
          alert('指定された報告が見つかりません');
        }
      } catch (error) {
        console.error("Error fetching report:", error);
      } finally {
        setLoading(false);
      }
    };

    if (reportId) {
      fetchReport();
    }
  }, [reportId]);

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>読み込み中...</div>;
  }

  if (!report) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>データがありません。</div>;
  }

  return (
    <div className="history-detail-page">
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <Link to="/history" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }} className="hover-underline">マイヒストリー</Link>
        <ChevronRight size={16} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{report.week} の報告</span>
      </div>

      {/* Render the Weekly Form in Edit Mode */}
      <WeeklyForm injectedReport={report} isHistoryDetail={true} />
    </div>
  );
}
