import { createBrowserRouter } from 'react-router-dom';

import Register from '../pages/auth/Register';
import OtpVerification from '../pages/auth/OtpVerification';
import SetPin from '../pages/auth/SetPin';
import Login from '../pages/auth/Login';

import ProtectedRoute from '../components/ProtectedRoute';
import CustomerLayout from '../layouts/CustomerLayout';

export const router = createBrowserRouter([
  // Public routes
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

  // Protected customer routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <CustomerLayout />,
        children: [
          {
            path: '/customer',
            element: (
              <div className="p-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  Customer Dashboard
                </h1>

                <p className="mt-2 text-gray-600">
                  Welcome to the Sambast customer portal.
                </p>
              </div>
            ),
          },
        ],
      },
    ],
  },
]);