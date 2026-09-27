import { createBrowserRouter } from 'react-router-dom';

import Register from '../pages/auth/Register';
import OtpVerification from '../pages/auth/OtpVerification';
import SetPin from '../pages/auth/SetPin';
import Login from '../pages/auth/Login';

import Storefront from '../pages/storefront/Storefront';
import ProductDetail from '../pages/storefront/ProductDetail';

import Cart from '../pages/cart/Cart';
import Checkout from '../pages/checkout/Checkout';

import OrderHistory from '../pages/orders/OrderHistory';
import OrderDetail from '../pages/orders/OrderDetail';

import OrderTracking from '../pages/tracking/OrderTracking';
import Notifications from '../pages/notifications/Notifications';

import ProtectedRoute from '../components/ProtectedRoute';
import CustomerLayout from '../layouts/CustomerLayout';

export const router = createBrowserRouter([
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
]);