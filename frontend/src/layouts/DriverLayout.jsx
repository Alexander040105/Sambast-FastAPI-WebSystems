import '../css/shared-layout.css';
import '../css/driver.css';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../api';

function ManifestIcon() {
  return <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <rect x="4.25" y="3.5" width="11.5" height="14" rx="1.7" />
    <path d="M7 3.5v-.25A1.25 1.25 0 0 1 8.25 2h3.5A1.25 1.25 0 0 1 13 3.25v.25" />
    <path d="m6.8 8.1.8.8 1.35-1.45M10.8 8.5h2.3m-6.3 4 .8.8 1.35-1.45m1.85.4h2.3" />
  </svg>;
}

function RoutePathIcon() {
  return <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M6.7 15.5h5.5c1.9 0 3.3-1.4 3.3-3.3S14.1 8.9 12.2 8.9H7.8c-1.9 0-3.3-1.4-3.3-3.3S5.9 3.2 7.8 3.2H13" />
    <circle cx="4" cy="15.5" r="2.7" strokeWidth="2.5" />
    <circle cx="15.7" cy="3.2" r="2.7" strokeWidth="2.5" />
  </svg>;
}

export function DriverLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const handleLogout = () => {
    auth.clearAuth();
    navigate('/login');
  };
  const navItems = [
    { path: '/driver', label: 'Manifest', icon: <ManifestIcon />, end: true },
    { path: '/driver/route', label: 'Active Route', icon: <RoutePathIcon />, end: true },
  ];

  return (
    <div className="driver-layout">
      <header className="driver-topbar">
        <div className="driver-topbar-inner">
          <span className="driver-topbar-title">Driver</span>
          <button onClick={handleLogout} className="driver-logout">Log out</button>
        </div>
      </header>
      <main className="driver-main"><Outlet /></main>
      <nav className="driver-bottom-nav" aria-label="Driver navigation">
        {navItems.map((item) => <NavLink
          key={item.path}
          to={item.path}
          end={item.end}
          className={({ isActive }) => `driver-nav-item${isActive || (item.path === '/driver/route' && location.pathname.startsWith('/driver/stops/')) ? ' active' : ''}`}
        >
          <span className="driver-nav-icon">{item.icon}</span>{item.label}
        </NavLink>)}
      </nav>
    </div>
  );
}
