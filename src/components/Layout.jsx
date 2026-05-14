import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileEdit, LogOut, Users, FileText, Network, BookOpen, Menu, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className={`app-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar glass-panel">
        <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isSidebarCollapsed ? '1.5rem 0.5rem 1rem' : '1.5rem 1rem 1rem', position: 'relative' }}>
          {!isSidebarCollapsed && <img src="/logo.png" alt="Rush up Logo" style={{ maxWidth: '140px', height: 'auto', marginBottom: '1rem' }} />}
          {!isSidebarCollapsed && <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)', textAlign: 'center' }}>Sales Weekly Report</h2>}
          {isSidebarCollapsed && <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)', fontSize: '1.2rem', marginBottom: '1rem' }}>R</div>}
          
          <button 
            className="sidebar-toggle-btn" 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
          >
            {isSidebarCollapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {['executive', 'manager'].includes(user?.roleGroup) && (
            <Link 
              to="/dashboard" 
              className={`nav-item ${location.pathname.startsWith('/dashboard') ? 'active' : ''}`}
              title="ダッシュボード"
            >
              <LayoutDashboard size={20} />
              <span className="nav-label">ダッシュボード</span>
            </Link>
          )}

          {user?.roleGroup === 'executive' && (
            <>
              <Link 
                to="/teams" 
                className={`nav-item ${location.pathname === '/teams' ? 'active' : ''}`}
                title="チーム・組織管理"
              >
                <Network size={20} />
                <span className="nav-label">チーム・組織管理</span>
              </Link>
              <Link 
                to="/accounts" 
                className={`nav-item ${location.pathname === '/accounts' ? 'active' : ''}`}
                title="アカウント管理"
              >
                <Users size={20} />
                <span className="nav-label">アカウント管理</span>
              </Link>
            </>
          )}

          {['executive', 'manager'].includes(user?.roleGroup) && (
            <>
              <Link 
                to="/form" 
                className={`nav-item ${location.pathname === '/form' ? 'active' : ''}`}
                title="週次報告入力"
              >
                <FileEdit size={20} />
                <span className="nav-label">週次報告入力</span>
              </Link>
              <Link 
                to="/training" 
                className={`nav-item ${location.pathname === '/training' ? 'active' : ''}`}
                title="メンバー育成"
              >
                <BookOpen size={20} />
                <span className="nav-label">メンバー育成</span>
              </Link>
            </>
          )}

          <Link 
            to="/history" 
            className={`nav-item ${location.pathname === '/history' ? 'active' : ''}`}
            title="マイヒストリー"
          >
            <FileText size={20} />
            <span className="nav-label">マイヒストリー</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <button className="btn btn-secondary w-full" style={{ width: '100%', display: 'flex', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start' }} onClick={logout} title="ログアウト">
            <LogOut size={18} />
            <span className="nav-label">ログアウト</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar glass-panel">
          <div className="user-info">
            <div className="avatar">{user?.name ? user.name[0] : 'U'}</div>
            <span>{user?.name} {user?.title ? `(${user.title})` : ''}</span>
          </div>
        </header>
        <div className="content-area animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
