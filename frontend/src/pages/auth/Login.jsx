import { useState } from 'react';
import { api } from '../../api/client';
import { saveAuth } from '../../auth/storage';

function Login() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }

    setIsLoading(true);

    try {
      const data = await api.post('/auth/login', {
        email: email.trim(),
        pin,
      });

      saveAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
      });

      console.log('Login successful:', data);
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <section className="w-full max-w-md bg-white rounded-xl shadow-md p-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Customer Login
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Sign in to your Sambast customer account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email Address
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label
              htmlFor="pin"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              4-Digit PIN
            </label>

            <input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, '');
                setPin(value);
              }}
              placeholder="••••"
              autoComplete="current-password"
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center text-xl tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <a
            href="/register"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Create a customer account
          </a>
        </div>
      </section>
    </main>
  );
}

export default Login;