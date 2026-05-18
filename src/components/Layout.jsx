import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileEdit, LogOut, Users, FileText, Network, BookOpen, Menu, ChevronLeft, Target, FileSpreadsheet, History, ClipboardList, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

export default function Layout() {
  const location = useLocation();
  const { user, logout, isExecutive, isManagerOrAbove } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const PRODUCTS = {
    'visit': 'HP（訪問）',
    'web': 'Web',
    'replace': 'リプレイス',
    'meo': 'MEO'
  };

  const getPageTitle = () => {
    if (location.pathname.startsWith('/dashboard')) return 'ダッシュボード';
    if (location.pathname.startsWith('/form')) return '週次報告入力';
    if (location.pathname.startsWith('/training')) return 'メンバー育成';
    if (location.pathname.startsWith('/history')) return 'マイヒストリー';
    if (location.pathname.startsWith('/accounts')) return 'アカウント管理 (S-01)';
    if (location.pathname.startsWith('/teams')) return 'チーム・組織管理 (S-02)';
    if (location.pathname.startsWith('/products')) return '商材マスタ管理 (S-06)';
    return '';
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className={`app-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div 
        className={`mobile-overlay ${isMobileMenuOpen ? 'open' : ''}`} 
        onClick={closeMobileMenu}
      ></div>
      <aside className={`sidebar glass-panel ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
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
          {/* Dashboard available to Everyone */}
          <Link 
            to="/dashboard" 
            className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
            title="総合ダッシュボード"
            onClick={closeMobileMenu}
          >
            <LayoutDashboard size={20} />
            <span className="nav-label">総合ダッシュボード</span>
          </Link>

          <Link 
            to="/daily" 
            className={`nav-item ${location.pathname.startsWith('/daily') ? 'active' : ''}`}
            title="日報管理"
            onClick={closeMobileMenu}
          >
            <ClipboardList size={20} />
            <span className="nav-label">日報管理</span>
          </Link>

          {/* KPI Management is handled by /kpi */}
          <Link 
            to="/kpi" 
            className={`nav-item ${location.pathname === '/kpi' ? 'active' : ''}`}
            title="KPIダッシュボード"
            onClick={closeMobileMenu}
          >
            <Target size={20} />
            <span className="nav-label">KPIダッシュボード</span>
          </Link>
          <Link 
            to="/kpi/history" 
            className={`nav-item ${location.pathname === '/kpi/history' ? 'active' : ''}`}
            title="KPI履歴・推移"
            onClick={closeMobileMenu}
          >
            <History size={20} />
            <span className="nav-label">KPI履歴・推移</span>
          </Link>
          <Link 
            to="/kpi/input" 
            className={`nav-item ${location.pathname.startsWith('/kpi/input') ? 'active' : ''}`}
            title="日次KPI入力 (手動)"
            onClick={closeMobileMenu}
          >
            <FileText size={20} />
            <span className="nav-label">日次KPI入力</span>
          </Link>
          <Link 
            to="/kpi/setting" 
            className={`nav-item ${location.pathname.startsWith('/kpi/setting') ? 'active' : ''}`}
            title="KGI月次設定"
            onClick={closeMobileMenu}
          >
            <Target size={20} />
            <span className="nav-label">KGI月次設定</span>
          </Link>

          {isManagerOrAbove && (
            <Link 
              to="/kpi/csv" 
              className={`nav-item ${location.pathname.startsWith('/kpi/csv') ? 'active' : ''}`}
              title="実績CSV取込"
              onClick={closeMobileMenu}
            >
              <FileSpreadsheet size={20} />
              <span className="nav-label">実績CSV取込</span>
            </Link>
          )}

          <Link 
            to="/progress" 
            className={`nav-item ${location.pathname.startsWith('/progress') ? 'active' : ''}`}
            title="進捗管理"
            onClick={closeMobileMenu}
          >
            <TrendingUp size={20} />
            <span className="nav-label">進捗管理</span>
          </Link>

          {isExecutive && (
            <>
              <Link 
                to="/teams" 
                className={`nav-item ${location.pathname.startsWith('/teams') ? 'active' : ''}`}
                title="チーム・組織管理"
                onClick={closeMobileMenu}
              >
                <Network size={20} />
                <span className="nav-label">チーム・組織管理</span>
              </Link>
              <Link 
                to="/accounts" 
                className={`nav-item ${location.pathname.startsWith('/accounts') ? 'active' : ''}`}
                title="アカウント管理"
                onClick={closeMobileMenu}
              >
                <Users size={20} />
                <span className="nav-label">アカウント管理</span>
              </Link>
              <Link 
                to="/products" 
                className={`nav-item ${location.pathname.startsWith('/products') ? 'active' : ''}`}
                title="商材マスタ管理"
                onClick={closeMobileMenu}
              >
                <BookOpen size={20} />
                <span className="nav-label">商材マスタ管理</span>
              </Link>
            </>
          )}

          {isManagerOrAbove && (
            <>
              <Link 
                to="/form" 
                className={`nav-item ${location.pathname.startsWith('/form') ? 'active' : ''}`}
                title="週次報告入力"
                onClick={closeMobileMenu}
              >
                <FileEdit size={20} />
                <span className="nav-label">週次報告入力</span>
              </Link>
              <Link 
                to="/training" 
                className={`nav-item ${location.pathname.startsWith('/training') ? 'active' : ''}`}
                title="メンバー育成"
                onClick={closeMobileMenu}
              >
                <BookOpen size={20} />
                <span className="nav-label">メンバー育成</span>
              </Link>
            </>
          )}

          <Link 
            to="/history" 
            className={`nav-item ${location.pathname.startsWith('/history') ? 'active' : ''}`}
            title="マイヒストリー"
            onClick={closeMobileMenu}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className="mobile-menu-btn" 
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              {getPageTitle()}
            </h1>
          </div>
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user?.currentProductId && (
              <span className="product-badge" style={{
                background: 'var(--accent-primary)',
                color: 'white',
                padding: '0.2rem 0.6rem',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 'bold'
              }}>
                {PRODUCTS[user.currentProductId] || user.currentProductId}担当
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="avatar">{user?.name ? user.name[0] : 'U'}</div>
              <span>{user?.name} {user?.title ? `(${user.title})` : ''}</span>
            </div>
          </div>
        </header>
        <div className="content-area animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
