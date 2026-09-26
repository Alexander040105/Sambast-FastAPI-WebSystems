import '../css/shared-layout.css';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../api';

function NavigationIcon({ name }) {
  const paths = {
    dashboard: <><path d="m3.5 10 8.5-7 8.5 7" /><path d="M5.5 9v11h13V9M9.5 20v-6h3v6" /></>,
    fleet: <><path d="M3 13.5 4.5 8h12l3 5.5v5h-2v-2H5.5v2h-2z" /><path d="M5.5 13.5h12M7 8l1 5.5m8-5.5-1 5.5" /><circle cx="7" cy="16.5" r="1" /><circle cx="16" cy="16.5" r="1" /></>,
    queue: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" /><path d="m4.2 7.6 7.8 4.5 7.8-4.5M12 12.2V21M8 5.3l8 4.6" /></>,
    routes: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h3a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3" /></>,
    logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" /></>,
  };

  return (
    <svg aria-hidden="true" className="dispatcher-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export function DispatcherLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDriversPage = location.pathname === '/dispatcher/fleet/drivers';
  const isVehiclesPage = location.pathname === '/dispatcher/fleet/vehicles';
  const isShiftsPage = location.pathname === '/dispatcher/fleet/shifts';
  const isDispatchQueuePage = location.pathname === '/dispatcher/queue';
  const isRoutesPage = location.pathname.startsWith('/dispatcher/routes');
  const isApprovedFleetPage = isDriversPage || isVehiclesPage || isShiftsPage || isDispatchQueuePage || isRoutesPage;

  const handleLogout = () => {
    auth.clearAuth();
    navigate('/login');
  };

  const navItems = [
    { path: '/dispatcher', label: 'Dashboard', icon: 'dashboard', end: true },
    { path: '/dispatcher/fleet', label: 'Fleet', icon: 'fleet' },
    { path: '/dispatcher/queue', label: 'Dispatch Queue', icon: 'queue' },
    { path: '/dispatcher/routes', label: 'Routes', icon: 'routes' },
  ];

  return (
    <div className={`dispatcher-app-shell dispatcher-layout${isDriversPage ? ' drivers-figma-view' : ''}${isVehiclesPage ? ' vehicles-figma-view' : ''}${isShiftsPage ? ' shifts-figma-view' : ''}${isDispatchQueuePage ? ' dispatch-figma-view' : ''}${isRoutesPage ? ' routes-figma-view' : ''}`}>
      <aside className="dispatcher-sidebar">
        <div className="dispatcher-brand-lockup">
          <span className="dispatcher-brand-mark" role="img" aria-label={isApprovedFleetPage ? 'DeliverEase' : 'Sambast'} title={isApprovedFleetPage ? 'DeliverEase' : 'Sambast'}>{isApprovedFleetPage ? 'D' : 'S'}</span>
          <span className="dispatcher-brand-name">DeliverEase</span>
        </div>
        <nav className="dispatcher-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              aria-label={item.label}
              title={item.label}
              className={({ isActive }) => `dispatcher-nav-link ${isActive ? 'active' : ''}`}
            >
              <NavigationIcon name={item.icon} />
              <span className="dispatcher-nav-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout} aria-label="Logout" title="Logout" className="btn btn-ghost btn-sm dispatcher-logout"><NavigationIcon name="logout" /><span className="dispatcher-nav-text">Logout</span></button>
      </aside>
      <main className="page-container dispatcher-workspace">
        <Outlet />
      </main>
    </div>
  );
}
