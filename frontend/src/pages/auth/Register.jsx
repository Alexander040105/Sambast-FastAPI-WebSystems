import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '',
    contact_no: '',
    email: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError('');

    if (!form.full_name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!/^\d{11}$/.test(form.contact_no.trim())) {
      setError('Contact number must be exactly 11 digits.');
      return;
    }

    if (!form.email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/register', {
        full_name: form.full_name.trim(),
        contact_no: form.contact_no.trim(),
        email: form.email.trim().toLowerCase(),
      });

      navigate('/verify-otp', {
        state: {
          email: form.email.trim().toLowerCase(),
        },
      });
    } catch (err) {
      setError(
        err.message || 'Unable to register. Please try again.'
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
            Create Your Account
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Register as a customer to start ordering.
          </p>
        </div>

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
              htmlFor="full_name"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Full Name
            </label>

            <input
              id="full_name"
              name="full_name"
              type="text"
              value={form.full_name}
              onChange={handleChange}
              required
              placeholder="Juan Dela Cruz"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label
              htmlFor="contact_no"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Contact Number
            </label>

            <input
              id="contact_no"
              name="contact_no"
              type="tel"
              inputMode="numeric"
              maxLength="11"
              value={form.contact_no}
              onChange={handleChange}
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
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Email Address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
}

export default Register;