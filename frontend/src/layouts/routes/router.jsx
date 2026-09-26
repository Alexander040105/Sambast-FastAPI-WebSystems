import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DispatcherLayout, DriverLayout, OpsManagerLayout } from '..';
import { FleetPage, FleetDriversPage, FleetVehiclesPage, FleetShiftsPage } from '../../pages/dispatcher/FleetPage.jsx';
import { DispatchQueue } from '../../pages/dispatcher/DispatchQueue.jsx';
import { RouteDetailPage } from '../../pages/dispatcher/RouteDetailPage.jsx';
import { DriverWorkflow } from '../../pages/driver/DriverWorkflow.jsx';

const routes = [
  {
    path: '/login',
    element: null,
  },
  {
    element: <DispatcherLayout />,
    children: [
      { path: '/dispatcher', element: null },
      {
        path: '/dispatcher/fleet',
        element: <FleetPage />,
        children: [
          { path: 'drivers', element: <FleetDriversPage /> },
          { path: 'vehicles', element: <FleetVehiclesPage /> },
          { path: 'shifts', element: <FleetShiftsPage /> },
          { index: true, element: <Navigate to="drivers" replace /> },
        ],
      },
      { path: '/dispatcher/queue', element: <DispatchQueue /> },
      { path: '/dispatcher/routes', element: <RouteDetailPage /> },
      { path: '/dispatcher/routes/:routeId', element: <RouteDetailPage /> },
    ],
  },
  {
    element: <DriverLayout />,
    children: [
      { path: '/driver', element: <DriverWorkflow /> },
      { path: '/driver/route', element: <DriverWorkflow /> },
      { path: '/driver/stops/:stopId', element: <DriverWorkflow /> },
      { path: '/driver/stops/:stopId/complete', element: <DriverWorkflow /> },
      { path: '/driver/stops/:stopId/fail', element: <DriverWorkflow /> },
    ],
  },
  {
    element: <OpsManagerLayout />,
    children: [
      { path: '/ops', element: null },
      { path: '/ops/drivers', element: null },
      { path: '/ops/costs', element: null },
      { path: '/ops/failures', element: null },
    ],
  },
  { path: '*', element: null },
];

export const router = createBrowserRouter(routes);
