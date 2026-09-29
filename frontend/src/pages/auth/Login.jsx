import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, saveAccessToken } from '../../api/client';
import { saveAuth } from '../../auth/storage';
import { homeForRole } from '../../auth/roles';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const successMessage = location.state?.message || '';

  async function handleSubmit(event) {
    event.preventDefault();

    setError('');

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError('Email and password are required.');
      return;
    }

    setIsLoading(true);

    try {
      const data = await api.post('/auth/login', {
        email: normalizedEmail,
        password,
      });

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
          <h1 className="text-3xl font-bold text-ruby-600">
            Sambast
          </h1>

          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Sign In
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Enter your email and password.
          </p>
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
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Email Address
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
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
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
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-ruby-600 px-5 py-3 font-medium text-white hover:bg-ruby-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="font-medium text-ruby-600 hover:text-ruby-700"
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
