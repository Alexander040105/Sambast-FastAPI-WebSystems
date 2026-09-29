import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DispatcherLayout, DriverLayout, OpsManagerLayout } from '..';
import { FleetPage, FleetDriversPage, FleetVehiclesPage, FleetShiftsPage } from '../../pages/dispatcher/FleetPage.jsx';
import { DispatchQueue } from '../../pages/dispatcher/DispatchQueue.jsx';
import { RouteDetailPage } from '../../pages/dispatcher/RouteDetailPage.jsx';
import { DriverWorkflow } from '../../pages/driver/DriverWorkflow.jsx';

import Register from '../../pages/auth/Register';
import OtpVerification from '../../pages/auth/OtpVerification';
import SetPin from '../../pages/auth/SetPin';
import Login from '../../pages/auth/Login';

import Storefront from '../../pages/storefront/Storefront';
import ProductDetail from '../../pages/storefront/ProductDetail';

import Cart from '../../pages/cart/Cart';
import Checkout from '../../pages/checkout/Checkout';

import OrderHistory from '../../pages/orders/OrderHistory';
import OrderDetail from '../../pages/orders/OrderDetail';

import OrderTracking from '../../pages/tracking/OrderTracking';
import Notifications from '../../pages/notifications/Notifications';

import Catalog from '../../pages/admin/Catalog';
import AdminOrders from '../../pages/admin/Orders';

import ProtectedRoute from '../../components/ProtectedRoute';
import AdminRoute from '../../components/AdminRoute';

import CustomerLayout from '../../layouts/CustomerLayout';
import AdminLayout from '../../layouts/AdminLayout';

const routes = [
  // --------------------------------
  // Auth routes (FE-A)
  // --------------------------------
  {
    path: '/',
    element: <Register />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/verify-otp',
    element: <OtpVerification />,
  },
  {
    path: '/set-pin',
    element: <SetPin />,
  },
  {
    path: '/login',
    element: <Login />,
  },

  // --------------------------------
  // Customer routes (FE-A)
  // --------------------------------
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <CustomerLayout />,
        children: [
          {
            path: '/customer',
            element: <Storefront />,
          },
          {
            path: '/customer/cart',
            element: <Cart />,
          },
          {
            path: '/customer/checkout',
            element: <Checkout />,
          },
          {
            path: '/customer/products/:productId',
            element: <ProductDetail />,
          },
          {
            path: '/customer/orders',
            element: <OrderHistory />,
          },
          {
            path: '/customer/orders/:orderNo',
            element: <OrderDetail />,
          },
          {
            path: '/customer/orders/:orderNo/track',
            element: <OrderTracking />,
          },
          {
            path: '/customer/notifications',
            element: <Notifications />,
          },
        ],
      },
    ],
  },

  // --------------------------------
  // Admin routes (FE-A)
  // --------------------------------
  {
    element: <AdminRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            path: '/admin/catalog',
            element: <Catalog />,
          },
          {
            path: '/admin/orders',
            element: <AdminOrders />,
          },
        ],
      },
    ],
  },

  // --------------------------------
  // Dispatcher routes (FE-B)
  // --------------------------------
  {
    element: <DispatcherLayout />,
    children: [
      { path: '/dispatcher', element: <Navigate to="/dispatcher/fleet" replace /> },
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

  // --------------------------------
  // Driver routes (FE-B)
  // --------------------------------
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

  // --------------------------------
  // Ops manager routes (FE-B)
  // --------------------------------
  {
    element: <OpsManagerLayout />,
    children: [
      {
        path: '/ops',
        lazy: async () => ({
          Component: (await import('../../pages/ops/OperationsOverview.jsx')).OperationsOverview,
        }),
      },
    ],
  },
  { path: '*', element: null },
];

export const router = createBrowserRouter(routes);
