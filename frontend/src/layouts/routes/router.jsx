import { createBrowserRouter } from 'react-router-dom';
import { DispatcherLayout, DriverLayout, OpsManagerLayout } from '..';

const routes = [
  {
    path: '/login',
    element: null,
  },
  {
    element: <DispatcherLayout />,
    children: [
      { path: '/dispatcher', element: null },
      { path: '/dispatcher/fleet', element: null },
      { path: '/dispatcher/queue', element: null },
      { path: '/dispatcher/routes', element: null },
    ],
  },
  {
    element: <DriverLayout />,
    children: [
      { path: '/driver', element: null },
      { path: '/driver/route', element: null },
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