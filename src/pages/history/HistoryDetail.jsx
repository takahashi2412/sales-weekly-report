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
  const [activeTab, setActiveTab] = useState('weekly'); // weekly, daily, kpi, improve

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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', marginTop: '1rem' }}>
        {[
          { id: 'weekly', label: '週次報告' },
          { id: 'daily', label: '日報履歴 (D-04)' },
          { id: 'kpi', label: 'KPI詳細 (K-06)' },
          { id: 'improve', label: '改善詳細 (P-02)' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)} 
            style={{ 
              padding: '0.5rem 1rem', 
              background: 'none', 
              border: 'none', 
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'weekly' && (
        <WeeklyForm injectedReport={report} isHistoryDetail={true} />
      )}
      
      {activeTab === 'daily' && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>日報履歴 (D-04)</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
            Phase 2 にて日報データベースと連携し、この週の日報一覧が表示される予定です。
          </p>
        </div>
      )}

      {activeTab === 'kpi' && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>KPI詳細 (K-06)</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
            Phase 2 にてKPI管理機能と連携し、詳細な目標・実績の推移グラフが表示される予定です。<br/>
            （現在の実績値は「週次報告」タブで確認できます）
          </p>
        </div>
      )}

      {activeTab === 'improve' && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>改善詳細 (P-02)</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
            Phase 2 にて改善アクションの進捗管理が表示される予定です。<br/>
            （現在の改善アクションは「週次報告」タブで確認できます）
          </p>
        </div>
      )}
    </div>
  );
}
