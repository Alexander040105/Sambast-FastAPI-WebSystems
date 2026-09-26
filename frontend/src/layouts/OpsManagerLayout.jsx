import '../css/shared-layout.css';
import '../css/ops-dashboard.css';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { auth } from '../api';

function OverviewIcon() {
  return <svg aria-hidden="true" className="dispatcher-nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="2.5" y="2.5" width="6" height="6" rx="1" />
    <rect x="11.5" y="2.5" width="6" height="6" rx="1" />
    <rect x="2.5" y="11.5" width="6" height="6" rx="1" />
    <rect x="11.5" y="11.5" width="6" height="6" rx="1" />
  </svg>;
}

export function OpsManagerLayout() {
  const navigate = useNavigate();
  const role = auth.getRole();

  function handleLogout() {
    auth.clearAuth();
    navigate('/login');
  }

  return (
    <div className="ops-shell dispatcher-layout routes-figma-view">
      <aside className="dispatcher-sidebar ops-sidebar">
        <div className="dispatcher-brand-lockup">
          <span className="dispatcher-brand-mark" aria-hidden="true">D</span>
          <span className="dispatcher-brand-name">DeliverEase</span>
        </div>
        <p className="dispatcher-sidebar-caption">Operations Management</p>
        <nav className="dispatcher-nav ops-navigation" aria-label="Operations management">
          <NavLink to="/ops" end className={({ isActive }) => `dispatcher-nav-link${isActive ? ' active' : ''}`}>
            <OverviewIcon />
            <span className="dispatcher-nav-text">Overview</span>
          </NavLink>
        </nav>
        <div className="ops-sidebar-footer">
          <div className="ops-account-row">
            <span className="ops-user-avatar" aria-hidden="true">OM</span>
            <span className="ops-user-copy"><strong>Operations Manager</strong><small>{role ? role.replaceAll('_', ' ') : 'Operations'}</small></span>
          </div>
          <button onClick={handleLogout} aria-label="Logout" title="Logout" className="btn btn-ghost btn-sm dispatcher-logout">
            <svg aria-hidden="true" className="dispatcher-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" />
            </svg>
            <span className="dispatcher-nav-text">Logout</span>
          </button>
        </div>
      </aside>
      <main className="ops-workspace"><Outlet /></main>
    </div>
  );
}
