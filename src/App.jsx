import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AccountManagement from './pages/AccountManagement';
import TeamManagement from './pages/TeamManagement';
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
      
      {/* Protected Routes */}
      <Route 
        path="/" 
        element={user ? <Layout /> : <Navigate to="/login" replace />}
      >
        {/* Default route based on roleGroup */}
        <Route index element={
          user?.roleGroup === 'executive' ? <Navigate to="/dashboard" replace /> : 
          (user?.roleGroup === 'manager' ? <Navigate to="/dashboard" replace /> : <Navigate to="/history" replace />)
        } />
        
        {/* Everyone can see dashboard and reports (Dashboard handles data filtering internally) */}
        <Route path="dashboard" element={['executive', 'manager'].includes(user?.roleGroup) ? <Dashboard /> : <Navigate to="/" replace />} />
        <Route path="dashboard/report/:id" element={['executive', 'manager'].includes(user?.roleGroup) ? <ReportViewer /> : <Navigate to="/" replace />} />
        
        {/* Executive only routes */}
        {user?.roleGroup === 'executive' && (
          <>
            <Route path="accounts" element={<AccountManagement />} />
            <Route path="teams" element={<TeamManagement />} />
          </>
        )}

        {/* Manager & Executive routes */}
        {['executive', 'manager'].includes(user?.roleGroup) && (
          <>
            <Route path="form" element={<WeeklyForm isHistoryDetail={false} />} />
            <Route path="training">
              <Route index element={<TrainingList />} />
              <Route path=":memberId" element={<TrainingDetail />} />
              <Route path=":memberId/record/:recordId" element={<TrainingRecordForm />} />
            </Route>
          </>
        )}

        {/* Everyone */}
        <Route path="history">
          <Route index element={<HistoryList />} />
          <Route path=":reportId" element={<HistoryDetail />} />
        </Route>

        {/* Catch-all to redirect invalid paths based on role */}
        <Route path="*" element={<Navigate to="/" replace />} />
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
