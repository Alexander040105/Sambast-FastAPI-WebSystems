import { useState, useEffect, useMemo } from 'react';
import { auth } from '../../api/index.js';
import { fetchShifts, createShift, updateShift, deleteShift } from '../../api/shifts.js';
import { fetchDrivers } from '../../api/drivers.js';
import { fetchVehicles } from '../../api/vehicles.js';
import { Modal } from '../../components/Modal.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const INITIAL_FORM = {
  driver_id: '',
  vehicle_id: '',
  starts_at: '',
  ends_at: '',
  status: 'scheduled',
};

function getDefaultDateTime(offsetHours = 0) {
  const date = new Date();
  date.setHours(date.getHours() + offsetHours);
  date.setMinutes(0);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date.toISOString().slice(0, 16);
}

function validateForm(form, drivers, vehicles) {
  const errors = {};
  if (!form.driver_id) errors.driver_id = 'Driver is required';
  else if (!drivers.find((d) => d.id === Number(form.driver_id))) errors.driver_id = 'Invalid driver';
  if (!form.vehicle_id) errors.vehicle_id = 'Vehicle is required';
  else if (form.vehicle_id && !vehicles.find((v) => v.id === Number(form.vehicle_id))) errors.vehicle_id = 'Invalid vehicle';
  if (!form.starts_at) errors.starts_at = 'Start time is required';
  if (!form.ends_at) errors.ends_at = 'End time is required';
  if (form.starts_at && form.ends_at && new Date(form.starts_at) >= new Date(form.ends_at)) {
    errors.ends_at = 'End time must be after start time';
  }
  return errors;
}

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
}

function getStatusBadge(status) {
  switch (status) {
    case 'active':
      return <span className="status status-active">Active</span>;
    case 'completed':
      return <span className="status status-completed">Completed</span>;
    case 'scheduled':
    default:
      return <span className="status status-scheduled">Scheduled</span>;
  }
}

export function ShiftManagement() {
  const [shifts, setShifts] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState(null);
  const isAdmin = auth.getRole() === 'admin';

  const activeDrivers = useMemo(() => drivers.filter((d) => d.status === 'active'), [drivers]);
  const activeVehicles = useMemo(() => vehicles.filter((v) => v.is_active), [vehicles]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const [shiftsData, driversData, vehiclesData] = await Promise.all([
        fetchShifts(),
        fetchDrivers(),
        fetchVehicles(),
      ]);
      setShifts(shiftsData);
      setDrivers(driversData);
      setVehicles(vehiclesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingShift(null);
    setFormData({
      ...INITIAL_FORM,
      starts_at: getDefaultDateTime(1),
      ends_at: getDefaultDateTime(9),
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function openEditModal(shift) {
    setEditingShift(shift);
    setFormData({
      driver_id: String(shift.driver_id),
      vehicle_id: shift.vehicle_id == null ? '' : String(shift.vehicle_id),
      starts_at: shift.starts_at.slice(0, 16),
      ends_at: shift.ends_at.slice(0, 16),
      status: shift.status,
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingShift(null);
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
    const errors = validateForm(formData, activeDrivers, activeVehicles);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        driver_id: Number(formData.driver_id),
        vehicle_id: formData.vehicle_id ? Number(formData.vehicle_id) : null,
        starts_at: new Date(formData.starts_at).toISOString(),
        ends_at: new Date(formData.ends_at).toISOString(),
        status: formData.status,
      };

      if (editingShift) {
        await updateShift(editingShift.id, payload);
      } else {
        await createShift(payload);
      }
      closeModal();
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete(shift) {
    setShiftToDelete(shift);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!shiftToDelete) return;
    try {
      await deleteShift(shiftToDelete.id);
      setDeleteDialogOpen(false);
      setShiftToDelete(null);
      await loadAll();
    } catch (err) {
      setError(err.message);
      setDeleteDialogOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="fleet-state" role="status">
        <span className="loading-spinner" />
        <span className="sr-only">Loading shifts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fleet-state fleet-state-error" role="alert">
        <p className="error-message">Failed to load shifts: {error}</p>
        <button onClick={loadAll} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="fleet-records" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="section-header">
        <h1>Shifts</h1>
        <button onClick={openCreateModal} className="btn btn-primary" disabled={activeDrivers.length === 0}>
          Add Shift
        </button>
      </div>

      {(activeDrivers.length === 0 || activeVehicles.length === 0) && (
        <div className="warning-banner">
          {activeDrivers.length === 0 && 'No active drivers available. '}
          {activeVehicles.length === 0 && 'No active vehicles available; shifts can be created without an assigned vehicle. '}
          {activeDrivers.length === 0 && 'Add drivers first to create shifts.'}
        </div>
      )}

      {shifts.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-state-icon" style={{ width: '3rem', height: '3rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="empty-state-title">No shifts scheduled</p>
          <p className="empty-state-text">Use Add Shift above to schedule the first shift.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ width: '5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id}>
                  <td style={{ fontWeight: '500' }}>{(() => { const driver = drivers.find((item) => item.id === shift.driver_id); return driver ? `Driver #${driver.id}${driver.license_no ? ` · ${driver.license_no}` : ''}` : `Driver #${shift.driver_id}`; })()}</td>
                  <td>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '500' }}>{vehicles.find((item) => item.id === shift.vehicle_id)?.plate_no || 'Unassigned'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {vehicles.find((item) => item.id === shift.vehicle_id)?.type || '—'}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8125rem' }}>{formatDateTime(shift.starts_at)}</td>
                  <td style={{ fontSize: '0.8125rem' }}>{formatDateTime(shift.ends_at)}</td>
                  <td>{getStatusBadge(shift.status)}</td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {formatDateShort(shift.created_at)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
                      <button
                        onClick={() => openEditModal(shift)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.3125rem' }}
                        aria-label={`Edit shift ${shift.id}`}
                      >
                        <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {isAdmin && <button
                        onClick={() => confirmDelete(shift)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.3125rem', color: 'var(--color-danger)' }}
                        aria-label={`Delete shift ${shift.id}`}
                      >
                        <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editingShift ? 'Edit Shift' : 'Create Shift'} size="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="form-grid">
            <div>
              <label htmlFor="driver_id" className="label">Driver</label>
              <select
                id="driver_id"
                name="driver_id"
                value={formData.driver_id}
                onChange={handleChange}
                className={`select ${formErrors.driver_id ? 'input-error' : ''}`}
                disabled={submitting}
              >
                <option value="">Select driver</option>
                {activeDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    Driver #{d.id}{d.license_no ? ` (${d.license_no})` : ''}
                  </option>
                ))}
              </select>
              {formErrors.driver_id && <p className="error-message">{formErrors.driver_id}</p>}
            </div>
            <div>
              <label htmlFor="vehicle_id" className="label">Vehicle</label>
              <select
                id="vehicle_id"
                name="vehicle_id"
                value={formData.vehicle_id}
                onChange={handleChange}
                className={`select ${formErrors.vehicle_id ? 'input-error' : ''}`}
                disabled={submitting}
              >
                <option value="">Unassigned</option>
                {activeVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_no} ({v.type}, {v.max_weight_kg}kg)
                  </option>
                ))}
              </select>
              {formErrors.vehicle_id && <p className="error-message">{formErrors.vehicle_id}</p>}
            </div>
            <div>
              <label htmlFor="starts_at" className="label">Start Time</label>
              <input
                type="datetime-local"
                id="starts_at"
                name="starts_at"
                value={formData.starts_at}
                onChange={handleChange}
                className={`input ${formErrors.starts_at ? 'input-error' : ''}`}
                disabled={submitting}
              />
              {formErrors.starts_at && <p className="error-message">{formErrors.starts_at}</p>}
            </div>
            <div>
              <label htmlFor="ends_at" className="label">End Time</label>
              <input
                type="datetime-local"
                id="ends_at"
                name="ends_at"
                value={formData.ends_at}
                onChange={handleChange}
                className={`input ${formErrors.ends_at ? 'input-error' : ''}`}
                disabled={submitting}
              />
              {formErrors.ends_at && <p className="error-message">{formErrors.ends_at}</p>}
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
            <button type="submit" className="btn btn-primary" disabled={submitting || activeDrivers.length === 0}>
              {submitting ? (
                <>
                  <span className="loading-spinner" style={{ marginRight: '0.5rem' }} />
                  Saving...
                </>
              ) : (
                editingShift ? 'Update' : 'Create'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {isAdmin && <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Shift"
        message={`Are you sure you want to delete this shift? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />}
    </div>
  );
}
