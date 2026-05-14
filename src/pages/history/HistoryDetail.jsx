import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import WeeklyForm from '../WeeklyForm';
import Breadcrumb from '../../components/Breadcrumb';

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
      <Breadcrumb items={[
        { label: 'マイヒストリー', path: '/history' },
        { label: `${report.week} の報告` }
      ]} />

      {/* Render the Weekly Form in Edit Mode */}
      <WeeklyForm injectedReport={report} isHistoryDetail={true} />
    </div>
  );
}
