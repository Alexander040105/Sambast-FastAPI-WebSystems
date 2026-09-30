import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, saveAccessToken } from '../../api/client';
import { getUser, isAuthenticated, saveAuth } from '../../auth/storage';
import { homeForRole } from '../../auth/roles';

const ROLES = [
  { value: 'admin', label: 'Admin', caption: 'Full system access' },
  { value: 'dispatcher', label: 'Dispatcher', caption: 'Fleet & dispatch desk' },
  { value: 'ops_manager', label: 'Ops Manager', caption: 'Reports & oversight' },
  { value: 'driver', label: 'Driver', caption: 'Self-serve sign-up' },
];

const ROLE_LABELS = Object.fromEntries(
  ROLES.map((role) => [role.value, role.label])
);

function StaffRegister() {
  const navigate = useNavigate();

  const sessionUser = isAuthenticated() ? getUser() : null;
  const isAdminSession = sessionUser?.role === 'admin';

  const [form, setForm] = useState({
    role: 'driver',
    name: '',
    email: '',
    phone: '',
    license_no: '',
    password: '',
    password_confirm: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const isDriver = form.role === 'driver';
  const needsAdmin = !isDriver && !isAdminSession;

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setError('');
  }

  function selectRole(role) {
    setForm((currentForm) => ({ ...currentForm, role }));
    setError('');
  }

  function resetForm() {
    setCreated(null);
    setError('');
    setForm((currentForm) => ({
      ...currentForm,
      name: '',
      email: '',
      phone: '',
      license_no: '',
      password: '',
      password_confirm: '',
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Please enter a full name.');
      return;
    }

    if (!form.email.trim()) {
      setError('Please enter an email address.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (form.password !== form.password_confirm) {
      setError('Passwords do not match. Please try again.');
      return;
    }

    if (needsAdmin) {
      setError('Creating staff accounts requires an admin session. Sign in as an admin first.');
      return;
    }

    setIsLoading(true);

    try {
      if (isDriver) {
        const data = await api.post('/auth/register/driver', {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          name: form.name.trim(),
          license_no: form.license_no.trim() || undefined,
          phone: form.phone.trim() || undefined,
        });

        const authData = data?.data || data;

        if (isAdminSession) {
          // An admin is creating this driver — keep the admin session.
          setCreated({ role: 'driver', email: form.email.trim().toLowerCase(), name: form.name.trim() });
          return;
        }

        if (authData?.access_token) {
          saveAccessToken(authData.access_token);
          saveAuth({
            access_token: authData.access_token,
            refresh_token: authData.refresh_token,
            user: authData.user,
          });
        }

        navigate(homeForRole('driver'), { replace: true });
        return;
      }

      await api.post('/admin/users', {
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
        password: form.password,
        role: form.role,
      });

      setCreated({ role: form.role, email: form.email.trim().toLowerCase(), name: form.name.trim() });
    } catch (err) {
      setError(
        err.status === 409
          ? 'An account with that email already exists.'
          : err.message || 'Unable to create the account. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (created) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-ruby-600">Sambast</h1>
          </div>

          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-800">
              {ROLE_LABELS[created.role]} account created
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              {created.name} · {created.email}
            </p>
            <p className="mt-2 text-xs text-emerald-700">
              They can now sign in on the login page with this email and password.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={resetForm}
              className="w-full rounded-lg bg-ruby-600 px-5 py-3 font-medium text-white hover:bg-ruby-700"
            >
              Create another account
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              Go to sign-in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-ruby-600">Sambast</h1>

          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Staff Registration
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Internal — create admin, dispatcher, ops manager, or driver accounts.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <span className="mb-2 block text-sm font-medium text-gray-700">
              Role
            </span>

            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => selectRole(role.value)}
                  className={
                    form.role === role.value
                      ? 'rounded-lg border border-ruby-600 bg-ruby-50 p-3 text-left'
                      : 'rounded-lg border border-gray-300 p-3 text-left hover:border-gray-400'
                  }
                >
                  <span
                    className={
                      form.role === role.value
                        ? 'block text-sm font-semibold text-ruby-700'
                        : 'block text-sm font-semibold text-gray-900'
                    }
                  >
                    {role.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {role.caption}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {needsAdmin && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                Creating {ROLE_LABELS[form.role]} accounts requires an admin
                session.{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="font-medium underline hover:text-amber-900"
                >
                  Sign in as an admin
                </button>
                , then return here.
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Full Name
            </label>

            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Juan Dela Cruz"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
            />
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
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
            />
          </div>

          {isDriver && (
            <>
              <div>
                <label
                  htmlFor="license_no"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  License Number{' '}
                  <span className="font-normal text-gray-500">(optional)</span>
                </label>

                <input
                  id="license_no"
                  name="license_no"
                  type="text"
                  value={form.license_no}
                  onChange={handleChange}
                  placeholder="N01-23-456789"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Contact Number{' '}
                  <span className="font-normal text-gray-500">(optional)</span>
                </label>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength="11"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, '')
                      .slice(0, 11);

                    setForm((currentForm) => ({
                      ...currentForm,
                      phone: value,
                    }));

                    setError('');
                  }}
                  placeholder="09123456789"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
                />
              </div>
            </>
          )}

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
              autoComplete="new-password"
              minLength="8"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
            />
          </div>

          <div>
            <label
              htmlFor="password_confirm"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Confirm Password
            </label>

            <input
              id="password_confirm"
              name="password_confirm"
              type="password"
              autoComplete="new-password"
              minLength="8"
              value={form.password_confirm}
              onChange={handleChange}
              required
              placeholder="Repeat your password"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || needsAdmin}
            className="w-full rounded-lg bg-ruby-600 px-5 py-3 font-medium text-white hover:bg-ruby-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading
              ? 'Creating account...'
              : `Create ${ROLE_LABELS[form.role]} account`}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="font-medium text-ruby-600 hover:text-ruby-700"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
}

export default StaffRegister;
