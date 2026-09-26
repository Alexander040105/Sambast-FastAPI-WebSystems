import { useState } from 'react';
import { api } from '../../api/client';

function OtpVerification() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
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

    if (!/^\d{6}$/.test(otp)) {
      setError('OTP must be exactly 6 digits.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/otp/verify', {
        email: email.trim(),
        otp,
      });

      setMessage(
        'OTP verified successfully. You can continue to set your PIN.'
      );
    } catch (err) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setMessage('');
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address first.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/otp/resend', {
        email: email.trim(),
      });

      setMessage('A new OTP has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Unable to resend OTP.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <section className="w-full max-w-md bg-white rounded-xl shadow-md p-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Verify Your Email
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Enter the 6-digit OTP sent to your email address.
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              disabled={isLoading}
            />
          </div>

          <div>
            <label
              htmlFor="otp"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              6-Digit OTP
            </label>

            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, '');
                setOtp(value);
              }}
              placeholder="123456"
              autoComplete="one-time-code"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center text-xl tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              disabled={isLoading}
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
            {isLoading ? 'Verifying...' : 'Verify OTP'}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={isLoading}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Resend OTP
          </button>
        </form>
      </section>
    </main>
  );
}

export default OtpVerification;