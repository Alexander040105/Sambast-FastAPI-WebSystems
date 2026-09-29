import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, saveAccessToken } from '../../api/client';
import { saveAuth } from '../../auth/storage';
import { homeForRole } from '../../auth/roles';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState('customer');
  const [contactNo, setContactNo] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const successMessage = location.state?.message || '';

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError('');

    let payload;

    if (mode === 'customer') {
      const normalizedContactNo = contactNo.trim();

      if (!/^\d{11}$/.test(normalizedContactNo)) {
        setError('Contact number must be exactly 11 digits.');
        return;
      }

      if (!/^\d{4}$/.test(pin)) {
        setError('PIN must be exactly 4 digits.');
        return;
      }

      payload = { contact_no: normalizedContactNo, pin };
    } else {
      const normalizedEmail = email.trim();

      if (!normalizedEmail || !password) {
        setError('Email and password are required.');
        return;
      }

      payload = { email: normalizedEmail, password };
    }

    setIsLoading(true);

    try {
      const data = await api.post('/auth/login', payload);

      const authData = data?.data || data;

      if (authData?.access_token) {
        saveAccessToken(authData.access_token);
        saveAuth({
          access_token: authData.access_token,
          refresh_token: authData.refresh_token,
          user: authData.user,
        });
      }

      navigate(homeForRole(authData?.user?.role), { replace: true });
    } catch (err) {
      setError(
        err.message || 'Unable to log in. Please check your credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-indigo-600">
            Sambast
          </h1>

          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            {mode === 'customer' ? 'Customer Login' : 'Staff Login'}
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            {mode === 'customer'
              ? 'Enter your contact number and 4-digit PIN.'
              : 'Enter your work email and password.'}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-lg bg-gray-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => switchMode('customer')}
            className={
              mode === 'customer'
                ? 'rounded-md bg-white py-2 text-indigo-600 shadow-sm'
                : 'rounded-md py-2 text-gray-500 hover:text-gray-700'
            }
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => switchMode('staff')}
            className={
              mode === 'staff'
                ? 'rounded-md bg-white py-2 text-indigo-600 shadow-sm'
                : 'rounded-md py-2 text-gray-500 hover:text-gray-700'
            }
          >
            Staff
          </button>
        </div>

        {successMessage && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">
              {successMessage}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">
              {error}
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-5"
        >
          {mode === 'customer' ? (
            <>
              <div>
                <label
                  htmlFor="contactNo"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Contact Number
                </label>

                <input
                  id="contactNo"
                  name="contactNo"
                  type="tel"
                  inputMode="numeric"
                  maxLength="11"
                  value={contactNo}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, '')
                      .slice(0, 11);

                    setContactNo(value);
                    setError('');
                  }}
                  required
                  placeholder="09123456789"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />

                <p className="mt-1 text-xs text-gray-500">
                  Enter exactly 11 digits.
                </p>
              </div>

              <div>
                <label
                  htmlFor="pin"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  4-Digit PIN
                </label>

                <input
                  id="pin"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength="4"
                  value={pin}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, '')
                      .slice(0, 4);

                    setPin(value);
                    setError('');
                  }}
                  required
                  placeholder="••••"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Work Email
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError('');
                  }}
                  required
                  placeholder="you@sambast.ph"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError('');
                  }}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
