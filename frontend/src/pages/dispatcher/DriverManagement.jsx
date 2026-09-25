import { useState, useEffect } from 'react';
import { fetchDrivers, createDriver, updateDriver, deleteDriver } from '../../data/mockDrivers.js';
import { Modal } from '../../components/Modal.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'off_duty', label: 'Off Duty' },
  { value: 'suspended', label: 'Suspended' },
];

const INITIAL_FORM = {
  name: '',
  email: '',
  phone: '',
  license_no: '',
  status: 'active',
};

function validateForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email format';
  if (!form.phone.trim()) errors.phone = 'Phone is required';
  else if (!/^09\d{9}$/.test(form.phone)) errors.phone = 'Phone must be 11 digits starting with 09';
  if (!form.license_no.trim()) errors.license_no = 'License number is required';
  return errors;
}

function getStatusBadge(status) {
  switch (status) {
    case 'active':
      return <span className="status status-active">Active</span>;
    case 'off_duty':
      return <span className="status status-off_duty">Off Duty</span>;
    case 'suspended':
      return <span className="status status-suspended">Suspended</span>;
    default:
      return <span className="status" style={{ color: 'var(--text-muted)' }}><span style={{ background: 'var(--text-muted)' }} />{status}</span>;
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function DriverManagement() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState(null);

  useEffect(() => {
    loadDrivers();
  }, []);

  async function loadDrivers() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDrivers();
      setDrivers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingDriver(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEditModal(driver) {
    setEditingDriver(driver);
    setFormData({
      name: driver.user?.name || '',
      email: driver.user?.email || '',
      phone: driver.user?.phone || '',
      license_no: driver.license_no || '',
      status: driver.status || 'active',
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingDriver(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        license_no: formData.license_no.trim(),
        status: formData.status,
      };

      if (editingDriver) {
        await updateDriver(editingDriver.id, {
          license_no: payload.license_no,
          status: payload.status,
          user: { name: payload.name, email: payload.email, phone: payload.phone },
        });
      } else {
        await createDriver(payload);
      }
      closeModal();
      await loadDrivers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete(driver) {
    setDriverToDelete(driver);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!driverToDelete) return;
    try {
      await deleteDriver(driverToDelete.id);
      setDeleteDialogOpen(false);
      setDriverToDelete(null);
      await loadDrivers();
    } catch (err) {
      setError(err.message);
      setDeleteDialogOpen(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
        <span className="loading-spinner" style={{ color: 'var(--color-primary)' }} />
        <span className="sr-only">Loading drivers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p className="error-message" style={{ fontSize: '0.8125rem', marginBottom: '0.75rem' }}>Failed to load drivers: {error}</p>
        <button onClick={loadDrivers} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="section-header">
        <h1>Drivers</h1>
        <button onClick={openCreateModal} className="btn btn-primary">
          Add Driver
        </button>
      </div>

      {drivers.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-state-icon" style={{ width: '3rem', height: '3rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="empty-state-title">No drivers found</p>
          <p className="empty-state-text">Get started by adding your first driver.</p>
          <button onClick={openCreateModal} className="btn btn-primary">
            Add First Driver
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>License No.</th>
                <th>Status</th>
                <th>Contact</th>
                <th>Created</th>
                <th style={{ width: '5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td style={{ fontWeight: '500' }}>{driver.user?.name || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{driver.license_no}</td>
                  <td>{getStatusBadge(driver.status)}</td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    <div>{driver.user?.email || '—'}</div>
                    <div>{driver.user?.phone || '—'}</div>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {formatDate(driver.created_at)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
                      <button
                        onClick={() => openEditModal(driver)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.3125rem' }}
                        aria-label={`Edit ${driver.user?.name}`}
                      >
                        <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => confirmDelete(driver)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.3125rem', color: 'var(--color-danger)' }}
                        aria-label={`Delete ${driver.user?.name}`}
                      >
                        <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editingDriver ? 'Edit Driver' : 'Add Driver'} size="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="form-grid">
            <div>
              <label htmlFor="name" className="label">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`input ${formErrors.name ? 'input-error' : ''}`}
                placeholder="Juan Dela Cruz"
                disabled={submitting}
              />
              {formErrors.name && <p className="error-message">{formErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`input ${formErrors.email ? 'input-error' : ''}`}
                placeholder="juan@sambast.ph"
                disabled={submitting}
              />
              {formErrors.email && <p className="error-message">{formErrors.email}</p>}
            </div>
            <div>
              <label htmlFor="phone" className="label">Phone</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={`input ${formErrors.phone ? 'input-error' : ''}`}
                placeholder="09171234567"
                disabled={submitting}
              />
              {formErrors.phone && <p className="error-message">{formErrors.phone}</p>}
            </div>
            <div>
              <label htmlFor="license_no" className="label">License Number</label>
              <input
                type="text"
                id="license_no"
                name="license_no"
                value={formData.license_no}
                onChange={handleChange}
                className={`input ${formErrors.license_no ? 'input-error' : ''}`}
                placeholder="DL-2024-001234"
                disabled={submitting}
              />
              {formErrors.license_no && <p className="error-message">{formErrors.license_no}</p>}
            </div>
            <div>
              <label htmlFor="status" className="label">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="select"
                disabled={submitting}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={closeModal} className="btn btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="loading-spinner" style={{ marginRight: '0.5rem' }} />
                  Saving...
                </>
              ) : (
                editingDriver ? 'Update' : 'Create'
              )}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Driver"
        message={`Are you sure you want to delete ${driverToDelete?.user?.name || 'this driver'}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
