import '../../css/fleet.css';
import { NavLink, Outlet } from 'react-router-dom';
import { DriverManagement } from './DriverManagement.jsx';
import { VehicleManagement } from './VehicleManagement.jsx';
import { ShiftManagement } from './ShiftManagement.jsx';

const fleetTabs = [
  { path: '/dispatcher/fleet/drivers', label: 'Drivers' },
  { path: '/dispatcher/fleet/vehicles', label: 'Vehicles' },
  { path: '/dispatcher/fleet/shifts', label: 'Shifts' },
];

export function FleetPage() {
  return (
    <div className="page-container fleet-module">
      <header className="page-header">
        <h1 className="page-title">Fleet Management</h1>
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
