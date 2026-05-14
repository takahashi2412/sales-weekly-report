import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, AlertCircle, BarChart3, Target } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

export default function Dashboard() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch teams to build hierarchy
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        const teamsList = [];
        teamsSnapshot.forEach(doc => teamsList.push({ id: doc.id, ...doc.data() }));

        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersList = [];
        usersSnapshot.forEach((doc) => {
          usersList.push({ uid: doc.id, ...doc.data() });
        });

        const querySnapshot = await getDocs(collection(db, 'reports'));
        const allReports = [];
        querySnapshot.forEach((doc) => {
          allReports.push({ id: doc.id, ...doc.data() });
        });

        // Group by user and find the latest report
        const latestReportsMap = {};
        allReports.forEach(r => {
          // If the user doesn't have a userId for some reason, use userName as fallback
          const uid = r.userId || r.userName;
          if (!uid) return;
          
          if (!latestReportsMap[uid] || (r.updatedAt > latestReportsMap[uid].updatedAt)) {
            latestReportsMap[uid] = r;
          }
        });

        const now = Date.now();
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

        // Determine which users to show based on roleGroup and team hierarchy
        let visibleUsers = usersList;

        if (user?.roleGroup === 'manager') {
          // Find teams managed by this user
          const managedTeamIds = new Set();
          
          // Helper function to recursively find child teams
          const findChildren = (parentId) => {
            const children = teamsList.filter(t => t.parentId === parentId);
            children.forEach(child => {
              managedTeamIds.add(child.id);
              findChildren(child.id);
            });
          };

          // Find root managed teams
          const directManagedTeams = teamsList.filter(t => t.managerId === user.uid);
          directManagedTeams.forEach(t => {
            managedTeamIds.add(t.id);
            findChildren(t.id);
          });

          // Filter visible users: User themselves OR users in their managed teams
          visibleUsers = usersList.filter(u => 
            u.uid === user.uid || managedTeamIds.has(u.teamId)
          );
        } else if (user?.roleGroup === 'member') {
          // Members only see themselves (though routing should block them from dashboard anyway)
          visibleUsers = usersList.filter(u => u.uid === user.uid);
        }

        // Process visible users
        const processedReports = visibleUsers.map(u => {
          const r = latestReportsMap[u.uid] || null;
          
          let isSubmitted = false;
          let weeklyGrossProfit = 0;
          let roi = 0;
          let weeklyOrders = 0;
          let dateStr = '-';
          let reportId = null;

          if (r) {
            isSubmitted = (now - (r.updatedAt || 0)) < SEVEN_DAYS_MS;
            dateStr = r.date || '-';
            reportId = r.id;
            
            const fd = r.formData || {};
            const monthlyCost = Number(fd.orgMembers || 0) * Number(fd.monthlyCostPerMember || 0);
            const mDays = Number(fd.monthlyWorkingDays) || 1;
            const wDays = Number(fd.weeklyWorkingDays) || 0;
            const weeklyCost = monthlyCost ? Math.floor(monthlyCost * (wDays / mDays)) : 0;
            
            roi = (weeklyCost > 0 && fd.weeklyGrossProfit) ? (fd.weeklyGrossProfit / weeklyCost).toFixed(2) : 0;
            weeklyGrossProfit = fd.weeklyGrossProfit || 0;
            weeklyOrders = fd.weeklyOrders || 0;
          }

          return {
            id: u.uid,
            reportId: reportId,
            userName: u.name || '名前未設定',
            branch: u.branch || '営業部',
            title: u.title || '一般',
            status: isSubmitted ? '提出済' : '未提出',
            weeklyGrossProfit: weeklyGrossProfit,
            roi: roi,
            weeklyOrders: weeklyOrders,
            date: dateStr
          };
        });

        setReports(processedReports);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div style={{padding: '3rem', textAlign: 'center'}}>データを集計中...</div>;
  }

  // Calculate Org Stats
  const totalOrders = reports.reduce((sum, r) => sum + Number(r.weeklyOrders || 0), 0);
  const totalGross = reports.reduce((sum, r) => sum + Number(r.weeklyGrossProfit || 0), 0);
  
  // Avg ROI calculation (Average of each user's ROI, or Total Gross / Total Cost)
  // Simple average for now
  const avgRoi = reports.length > 0 
    ? (reports.reduce((sum, r) => sum + Number(r.roi), 0) / reports.length).toFixed(2) 
    : 0;

  const kpiStats = [
    { label: '組織全体 受注件数（最新週）', value: `${totalOrders}件`, subtext: '全責任者の合計', icon: <Target className="text-blue-500" /> },
    { label: '組織全体 粗利（最新週）', value: `${totalGross} P`, subtext: '万円換算', icon: <TrendingUp className="text-green-500" /> },
    { label: '平均週間ROI', value: `${avgRoi} 倍`, subtext: '全責任者の平均', icon: <BarChart3 className="text-red-500" /> },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>組織KPIダッシュボード</h1>
        <p>システム管理者用：全営業組織の予算・採算とKPI達成状況のサマリー</p>
      </div>

      <div className="stats-grid">
        {kpiStats.map((stat, i) => (
          <div key={i} className="stat-card glass-panel">
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-info">
              <h3>{stat.label}</h3>
              <p className="stat-value">{stat.value}</p>
              <p className="stat-subtext text-muted" style={{fontSize: '0.75rem', marginTop: '4px'}}>{stat.subtext}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="reports-section glass-panel">
        <div className="section-header">
          <h2>各責任者の採算状況（直近の提出）</h2>
        </div>
        
        <div className="table-container">
          <table className="reports-table">
            <thead>
              <tr>
                <th>責任者名</th>
                <th>今週の粗利</th>
                <th>週間ROI</th>
                <th>提出ステータス</th>
                <th>最終提出日時</th>
                <th>アクション</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{textAlign: 'center', padding: '2rem'}}>
                    まだ名簿にメンバーが登録されていません。アカウント管理から追加してください。
                  </td>
                </tr>
              ) : (
                reports.map(report => (
                  <tr key={report.id}>
                    <td>
                      <div style={{fontWeight: 'bold'}}>{report.userName}</div>
                      <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>{report.branch} / {report.title}</div>
                    </td>
                    <td style={{fontWeight: 'bold'}}>{report.weeklyGrossProfit} P</td>
                    <td>{report.roi} 倍</td>
                    <td>
                      <span className={`status-badge ${report.status === '提出済' ? 'success' : 'warning'}`}>
                        {report.status}
                      </span>
                    </td>
                    <td>{report.date}</td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        disabled={!report.reportId}
                        onClick={() => navigate(`/dashboard/report/${report.reportId}`)}
                      >
                        {report.reportId ? '詳細・PDCAを見る' : '提出データなし'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
