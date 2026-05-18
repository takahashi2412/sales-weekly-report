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

import TrainingList from './pages/training/TrainingList';
import TrainingDetail from './pages/training/TrainingDetail';
import TrainingRecordForm from './pages/training/TrainingRecordForm';

import HistoryList from './pages/history/HistoryList';
import HistoryDetail from './pages/history/HistoryDetail';

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      
      {/* Protected Routes using AuthGuard */}
      <Route element={<AuthGuard />}>
        <Route path="/" element={<Layout />}>
          
          {/* Default Route */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          {/* Dashboard available to Everyone */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="dashboard/report/:id" element={<ReportViewer />} />
          
          {/* Executive & Manager Routes */}
          <Route element={<AuthGuard allowedRoles={['executive', 'manager']} />}>
            <Route path="form" element={<WeeklyForm isHistoryDetail={false} />} />
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
