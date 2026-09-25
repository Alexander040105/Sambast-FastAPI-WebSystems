import '../css/shared-layout.css';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../api';

export function DispatcherLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    auth.clearAuth();
    navigate('/login');
  };

  const navItems = [
    { path: '/dispatcher', label: 'Dashboard' },
    { path: '/dispatcher/fleet', label: 'Fleet' },
    { path: '/dispatcher/queue', label: 'Dispatch Queue' },
    { path: '/dispatcher/routes', label: 'Routes' },
  ];

  return (
    <div className="min-h-screen dispatcher-layout" style={{ backgroundColor: 'var(--color-sambast-paper)' }}>
      <header className="header-bar">
        <div className="header-inner">
          <h1 className="header-title">
            <span className="header-brand">Sambast</span>
            <span className="header-context">Dispatcher Console</span>
          </h1>
          <div className="flex items-center gap-3">
            <nav className="nav-main hidden md:flex" aria-label="Main navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `nav-main-item ${isActive ? 'active' : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">Logout</button>
          </div>
        </div>
      </header>
      <main className="page-container dispatcher-workspace">
        <Outlet />
      </main>
    </div>
  );
}
