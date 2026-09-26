import '../../css/fleet.css';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { DriverManagement } from './DriverManagement.jsx';
import { VehicleManagement } from './VehicleManagement.jsx';
import { ShiftManagement } from './ShiftManagement.jsx';

const fleetTabs = [
  { path: '/dispatcher/fleet/drivers', label: 'Drivers' },
  { path: '/dispatcher/fleet/vehicles', label: 'Vehicles' },
  { path: '/dispatcher/fleet/shifts', label: 'Shifts' },
];

export function FleetPage() {
  const location = useLocation();
  const isDriversPage = location.pathname === '/dispatcher/fleet/drivers';
  const isVehiclesPage = location.pathname === '/dispatcher/fleet/vehicles';
  const isShiftsPage = location.pathname === '/dispatcher/fleet/shifts';
  const isApprovedFleetPage = isDriversPage || isVehiclesPage || isShiftsPage;

  return (
    <div className={`fleet-module${isDriversPage ? ' drivers-figma-page' : ''}${isVehiclesPage ? ' vehicles-figma-page' : ''}${isShiftsPage ? ' shifts-figma-page' : ''}`}>
      <header className="page-header">
        <div>
          <h1 className="page-title">{isApprovedFleetPage ? 'Fleet Workspace' : 'Fleet'}</h1>
          <p className="page-summary">{isApprovedFleetPage ? 'Manage drivers, vehicles, and active shifts.' : 'Manage drivers, vehicles, and operating shifts.'}</p>
        </div>
      </header>

      <nav className="fleet-tabs" aria-label="Fleet tabs">
        {fleetTabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => `fleet-tab ${isActive ? 'active' : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

export function FleetDriversPage() { return <DriverManagement />; }
export function FleetVehiclesPage() { return <VehicleManagement />; }
export function FleetShiftsPage() { return <ShiftManagement />; }
