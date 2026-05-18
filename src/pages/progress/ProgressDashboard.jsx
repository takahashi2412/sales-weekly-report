import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { TrendingUp, Target, BarChart2 } from 'lucide-react';
import '../Dashboard.css';

export default function ProgressDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpiTotals, setKpiTotals] = useState({ total: 0, actual: 0, appoint: 0, prospect: 0 });
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const d = new Date();
        const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        
        // Fetch target for current month
        const targetQ = query(collection(db, 'kpiTargets'), where('userId', '==', user.uid), where('targetMonth', '==', currentMonthStr));
        const targetSnap = await getDocs(targetQ);
        if (!targetSnap.empty) {
          setTarget(targetSnap.docs[0].data());
        }

        // Fetch KPIs for current month
        const prefix = currentMonthStr.replace('-', ''); // YYYYMM
        const kpiQ = query(collection(db, 'dailyKpi'), where('userId', '==', user.uid));
        const kpiSnap = await getDocs(kpiQ);
        
        const totals = { total: 0, actual: 0, appoint: 0, prospect: 0 };
        kpiSnap.forEach(doc => {
          const data = doc.data();
          if (data.date && data.date.startsWith(prefix)) {
            totals.total += data.totals?.total || 0;
            totals.actual += data.totals?.actual || 0;
            totals.appoint += data.totals?.appoint || 0;
            totals.prospect += data.totals?.prospect || 0;
          }
        });
        setKpiTotals(totals);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const targetAppoints = target ? Math.floor((target.monthlyOrderTarget || 0) / (target.orderRate || 1) / (target.adoptionRate || 1)) : 0;
  const progressPercent = targetAppoints > 0 ? Math.min(100, Math.round((kpiTotals.appoint / targetAppoints) * 100)) : 0;

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>進捗ダッシュボード (P-01)</h1>
        <p>当月のKGI・KPI目標に対する現在の進捗状況</p>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>読み込み中...</div>
      ) : (
        <>
          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Target size={24} /> 今月の目標と進捗 (アポ数)
            </h2>
            
            {!target ? (
              <div style={{ color: '#f59e0b', padding: '1rem', background: '#fef3c7', borderRadius: '8px' }}>
                今月のKGIが設定されていません。「KPI管理 &gt; KGI月次設定」から目標を設定してください。
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1.2rem' }}>
                  <span>現在のアポ数: <strong>{kpiTotals.appoint}</strong></span>
                  <span>目標アポ数: <strong>{targetAppoints}</strong></span>
                </div>
                <div style={{ width: '100%', height: '24px', background: 'var(--bg-primary)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <div style={{ 
                    width: `${progressPercent}%`, 
                    height: '100%', 
                    background: progressPercent >= 100 ? '#10b981' : '#3b82f6',
                    transition: 'width 1s ease-in-out'
                  }} />
                </div>
                <div style={{ textAlign: 'right', marginTop: '0.5rem', fontWeight: 'bold', color: progressPercent >= 100 ? '#10b981' : 'var(--text-primary)' }}>
                  達成率: {progressPercent}%
                </div>
              </div>
            )}
          </div>

          <div className="dashboard-grid">
            <div className="stat-card glass-panel" style={{ padding: '1.5rem' }}>
              <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <BarChart2 size={20} />
                <h3>架電実績</h3>
              </div>
              <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem' }}>
                {kpiTotals.total} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>件</span>
              </div>
            </div>
            
            <div className="stat-card glass-panel" style={{ padding: '1.5rem' }}>
              <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <TrendingUp size={20} />
                <h3>有効通話</h3>
              </div>
              <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem' }}>
                {kpiTotals.actual} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>件</span>
              </div>
            </div>

            <div className="stat-card glass-panel" style={{ padding: '1.5rem' }}>
              <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <Target size={20} />
                <h3>見込獲得</h3>
              </div>
              <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem' }}>
                {kpiTotals.prospect} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>件</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
