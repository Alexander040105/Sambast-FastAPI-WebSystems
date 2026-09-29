import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

function OtpVerification() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(
    location.state?.email || ''
  );

  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!email) {
      navigate('/register', { replace: true });
    }
  }, [email, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    setError('');
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
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
        email: normalizedEmail,
        otp,
      });

      navigate('/set-pin', {
        state: {
          email: normalizedEmail,
        },
      });
    } catch (err) {
      setError(
        err.message ||
          'Unable to verify OTP. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Please enter your email address.');
      return;
    }

    setIsResending(true);

    try {
      const data = await api.post('/auth/otp/resend', {
        email: normalizedEmail,
      });

      setMessage(
        data?.message ||
          data?.data?.message ||
          'A new OTP has been sent.'
      );
    } catch (err) {
      setError(
        err.message ||
          'Unable to resend OTP. Please try again.'
      );
    } finally {
      setIsResending(false);
    }
  }

  if (!email) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-indigo-600">
            Sambast
          </h1>

          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Verify Your Email
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Enter the 6-digit OTP sent to your email.
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
              setMessage('');
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

        {message && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">
              {message}
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-5"
        >
          <div>
            <label
              htmlFor="otp"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              OTP
            </label>

            <input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              maxLength="6"
              value={otp}
              onChange={(event) => {
                const value = event.target.value
                  .replace(/\D/g, '')
                  .slice(0, 6);

                setOtp(value);
                setError('');
                setMessage('');
              }}
              required
              placeholder="123456"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />

            <p className="mt-1 text-xs text-gray-500">
              Enter exactly 6 digits.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading
              ? 'Verifying...'
              : 'Verify OTP'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResending
              ? 'Resending...'
              : 'Resend OTP'}
          </button>
        </div>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to Registration
          </button>
        </div>
      </div>
    </div>
  );
}

export default OtpVerification;