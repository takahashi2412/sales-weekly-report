import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AuthGuard from './components/AuthGuard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AccountManagement from './pages/AccountManagement';
import TeamManagement from './pages/TeamManagement';
import ProductManagement from './pages/ProductManagement';
import WeeklyForm from './pages/WeeklyForm';
import ReportViewer from './pages/ReportViewer';
import AuditLog from './pages/settings/AuditLog';
import MonthlyClose from './pages/settings/MonthlyClose';

import TrainingList from './pages/training/TrainingList';
import TrainingDetail from './pages/training/TrainingDetail';
import TrainingRecordForm from './pages/training/TrainingRecordForm';

import HistoryList from './pages/history/HistoryList';
import HistoryDetail from './pages/history/HistoryDetail';
import CsvImport from './pages/kpi/CsvImport';
import DailyKpiInput from './pages/kpi/DailyKpiInput';
import KgiSetting from './pages/kpi/KgiSetting';
import KpiDashboard from './pages/kpi/KpiDashboard';
import KpiHistory from './pages/kpi/KpiHistory';
import KpiDetail from './pages/kpi/KpiDetail';
import Analysis from './pages/kpi/Analysis';

import DailyDashboard from './pages/daily/DailyDashboard';
import DailyInput from './pages/daily/DailyInput';
import DailyHistory from './pages/daily/DailyHistory';
import DailyDetail from './pages/daily/DailyDetail';
import DailyPending from './pages/daily/DailyPending';

import ProgressDashboard from './pages/progress/ProgressDashboard';
import ProgressDetail from './pages/progress/ProgressDetail';
import ProgressHistory from './pages/progress/ProgressHistory';
import ProgressCompare from './pages/progress/ProgressCompare';

import ImproveDashboard from './pages/improve/ImproveDashboard';
import ImproveTasks from './pages/improve/ImproveTasks';
import ImproveTaskDetail from './pages/improve/ImproveTaskDetail';
import ImproveHistory from './pages/improve/ImproveHistory';
import ImproveAnalysis from './pages/improve/ImproveAnalysis';

import EducationDashboard from './pages/education/EducationDashboard';
import EducationNew from './pages/education/EducationNew';
import EducationHistory from './pages/education/EducationHistory';
import EducationUserDetail from './pages/education/EducationUserDetail';
import EducationThemeAnalysis from './pages/education/EducationThemeAnalysis';

import Notifications from './pages/common/Notifications';

import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

const TEMP_SEED = async () => {
  const products = [
    {
      productId: 'visit', productName: 'HP（訪問）', productLabel: '訪問',
      isActive: true, validFrom: '2026-05-01', validTo: null,
      conversionRates: {
        manager: { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 1 },
        pmgr:    { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 2 },
        smgr:    { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 3 },
        tl:      { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 4 },
        general: { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 5 },
      }
    },
    {
      productId: 'web', productName: 'Web', productLabel: 'Web',
      isActive: true, validFrom: '2026-05-01', validTo: null,
      conversionRates: {
        manager: { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 1 },
        pmgr:    { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 2 },
        smgr:    { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 3 },
        tl:      { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 4 },
        general: { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 5 },
      }
    },
    {
      productId: 'replace', productName: 'リプレイス', productLabel: 'リプ',
      isActive: true, validFrom: '2026-05-01', validTo: null,
      conversionRates: {
        manager: { appointRate: 0.035, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 3 },
        pmgr:    { appointRate: 0.035, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 5 },
        smgr:    { appointRate: 0.035, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 6 },
        tl:      { appointRate: 0.040, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 8 },
        general: { appointRate: 0.040, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 8 },
      }
    },
    {
      productId: 'meo', productName: 'MEO', productLabel: 'MEO',
      isActive: true, validFrom: '2026-05-01', validTo: null,
      conversionRates: {
        manager: { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 2 },
        pmgr:    { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 4 },
        smgr:    { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 5 },
        tl:      { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 6 },
        general: { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 7 },
      }
    },
  ];

  for (const p of products) {
    await setDoc(doc(db, 'productMasters', p.productId), {
      ...p,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    console.log('Seeded:', p.productId);
  }
};

function AppRoutes() {
  const { user } = useAuth();
  
  // UNCOMMENT TO SEED ONCE
  // import { useEffect } from 'react';
  // useEffect(() => { TEMP_SEED(); }, []);

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      
      {/* Protected Routes using AuthGuard */}
      <Route element={<AuthGuard />}>
        <Route path="/" element={<Layout />}>
          
          {/* Default Route */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          {/* Dashboard and KPI input available to Everyone */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="dashboard/report/:id" element={<ReportViewer />} />
          <Route path="kpi" element={<KpiDashboard />} />
          <Route path="kpi/history" element={<KpiHistory />} />
          <Route path="kpi/input" element={<DailyKpiInput />} />
          <Route path="kpi/setting" element={<KgiSetting />} />
          <Route path="kpi/detail" element={<KpiDetail />} />
          <Route path="kpi/detail/:id" element={<KpiDetail />} />
          <Route path="kpi/analysis" element={<Analysis />} />

          <Route path="daily" element={<DailyDashboard />} />
          <Route path="daily/new" element={<DailyInput />} />
          <Route path="daily/history" element={<DailyHistory />} />
          <Route path="daily/pending" element={<DailyPending />} />
          <Route path="daily/:id" element={<DailyDetail />} />

          <Route path="progress" element={<ProgressDashboard />} />
          <Route path="progress/history" element={<ProgressHistory />} />
          <Route path="progress/compare" element={<ProgressCompare />} />
          <Route path="progress/:userId" element={<ProgressDetail />} />

          <Route path="improve" element={<ImproveDashboard />} />
          <Route path="improve/tasks" element={<ImproveTasks />} />
          <Route path="improve/tasks/:id" element={<ImproveTaskDetail />} />
          <Route path="improve/history" element={<ImproveHistory />} />
          <Route path="improve/analysis" element={<ImproveAnalysis />} />

          <Route path="education" element={<EducationDashboard />} />
          <Route path="education/new" element={<EducationNew />} />
          <Route path="education/history" element={<EducationHistory />} />
          <Route path="education/themes" element={<EducationThemeAnalysis />} />
          <Route path="education/:userId" element={<EducationUserDetail />} />

          <Route path="notifications" element={<Notifications />} />
          
          {/* Executive & Manager Routes */}
          <Route element={<AuthGuard allowedRoles={['executive', 'manager']} />}>
            <Route path="form" element={<WeeklyForm isHistoryDetail={false} />} />
            <Route path="kpi/csv" element={<CsvImport />} />
            <Route path="training">
              <Route index element={<TrainingList />} />
              <Route path=":memberId" element={<TrainingDetail />} />
              <Route path=":memberId/record/:recordId" element={<TrainingRecordForm />} />
            </Route>
          </Route>
          
          {/* Executive Only Routes */}
          <Route element={<AuthGuard allowedRoles={['executive']} />}>
            <Route path="accounts" element={<AccountManagement />} />
            <Route path="teams" element={<TeamManagement />} />
            <Route path="products" element={<ProductManagement />} />
            <Route path="settings/audit" element={<AuditLog />} />
            <Route path="settings/monthly-close" element={<MonthlyClose />} />
          </Route>

          {/* Routes for Everyone (leader, manager, executive) */}
          <Route path="history">
            <Route index element={<HistoryList />} />
            <Route path=":reportId" element={<HistoryDetail />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
