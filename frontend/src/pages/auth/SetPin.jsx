import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

function SetPin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(
    location.state?.email || ''
  );

  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }

    if (!/^\d{4}$/.test(pinConfirm)) {
      setError('PIN confirmation must be exactly 4 digits.');
      return;
    }

    if (pin !== pinConfirm) {
      setError('PIN and PIN confirmation do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/pin/set', {
        email: normalizedEmail,
        pin,
        pin_confirm: pinConfirm,
      });

      navigate('/login', {
        state: {
          email: normalizedEmail,
          message: 'PIN set successfully. You can now log in.',
        },
      });
    } catch (err) {
      setError(
        err.message ||
          'Unable to set your PIN. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Registration Session Missing
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Please complete registration and OTP verification first.
          </p>

          <button
            type="button"
            onClick={() => navigate('/register')}
            className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700"
          >
            Back to Registration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-indigo-600">
            Sambast
          </h1>

          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Set Your PIN
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Create a 4-digit PIN for your customer account.
          </p>
        </div>

        <div className="mt-5">
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Email Address
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError('');
            }}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">
              {error}
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-5"
        >
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

          <div>
            <label
              htmlFor="pinConfirm"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Confirm PIN
            </label>

            <input
              id="pinConfirm"
              name="pinConfirm"
              type="password"
              inputMode="numeric"
              maxLength="4"
              value={pinConfirm}
              onChange={(event) => {
                const value = event.target.value
                  .replace(/\D/g, '')
                  .slice(0, 4);

                setPinConfirm(value);
                setError('');
              }}
              required
              placeholder="••••"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading
              ? 'Setting PIN...'
              : 'Set PIN'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => navigate('/verify-otp')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to OTP Verification
          </button>
        </div>
      </div>
    </div>
  );
}

export default SetPin;