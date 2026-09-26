import { useState } from 'react';
import { api } from '../../api/client';

function SetPin() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage('');
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/pin/set', {
        email: email.trim(),
        pin,
      });

      setMessage('PIN created successfully. You can now log in.');
      setPin('');
      setConfirmPin('');
    } catch (err) {
      setError(err.message || 'Unable to set PIN.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <section className="w-full max-w-md bg-white rounded-xl shadow-md p-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Set Your PIN
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Create a 4-digit PIN for your customer account.
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
              autoComplete="new-password"
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center text-xl tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPin"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Confirm PIN
            </label>

            <input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, '');
                setConfirmPin(value);
              }}
              placeholder="••••"
              autoComplete="new-password"
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center text-xl tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {message && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-sm text-green-700">{message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Saving PIN...' : 'Set PIN'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default SetPin;