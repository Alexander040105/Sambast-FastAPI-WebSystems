import { useState, useEffect } from 'react';
import { auth } from '../../api/index.js';
import { fetchVehicles, createVehicle, updateVehicle, deleteVehicle } from '../../api/vehicles.js';
import { Modal } from '../../components/Modal.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';

const TYPE_OPTIONS = [
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Truck' },
  { value: 'motorcycle', label: 'Motorcycle' },
];

const INITIAL_FORM = {
  plate_no: '',
  type: 'van',
  max_weight_kg: '',
  max_volume_m3: '',
  is_active: true,
};

function validateForm(form) {
  const errors = {};
  if (!form.plate_no.trim()) errors.plate_no = 'Plate number is required';
  else if (!/^[A-Z]{3}-\d{4}$/.test(form.plate_no.toUpperCase())) errors.plate_no = 'Format: ABC-1234';
  if (!form.max_weight_kg) errors.max_weight_kg = 'Max weight is required';
  else if (Number(form.max_weight_kg) <= 0) errors.max_weight_kg = 'Must be greater than 0';
  if (form.max_volume_m3 && Number(form.max_volume_m3) <= 0) errors.max_volume_m3 = 'Must be greater than 0';
  return errors;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function VehicleManagement() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState(null);
  const isAdmin = auth.getRole() === 'admin';

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchVehicles();
      setVehicles(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingVehicle(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEditModal(vehicle) {
    setEditingVehicle(vehicle);
    setFormData({
      plate_no: vehicle.plate_no,
      type: vehicle.type,
      max_weight_kg: String(vehicle.max_weight_kg),
      max_volume_m3: String(vehicle.max_volume_m3),
      is_active: vehicle.is_active,
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingVehicle(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
  }

  function handleChange(e) {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? e.target.checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
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
        plate_no: formData.plate_no.toUpperCase().trim(),
        type: formData.type,
        max_weight_kg: Number(formData.max_weight_kg),
        max_volume_m3: formData.max_volume_m3 ? Number(formData.max_volume_m3) : null,
        is_active: formData.is_active,
      };

      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, payload);
      } else {
        await createVehicle(payload);
      }
      closeModal();
      await loadVehicles();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete(vehicle) {
    setVehicleToDelete(vehicle);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!vehicleToDelete) return;
    try {
      await deleteVehicle(vehicleToDelete.id);
      setDeleteDialogOpen(false);
      setVehicleToDelete(null);
      await loadVehicles();
    } catch (err) {
      setError(err.message);
      setDeleteDialogOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="fleet-state" role="status">
        <span className="loading-spinner" />
        <span className="sr-only">Loading vehicles...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fleet-state fleet-state-error" role="alert">
        <p className="error-message">Failed to load vehicles: {error}</p>
        <button onClick={loadVehicles} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="fleet-records" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="section-header">
        <h1>Vehicles</h1>
        <button onClick={openCreateModal} className="btn btn-primary">
          Add Vehicle
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-state-icon" style={{ width: '3rem', height: '3rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10l4-8m-4 8l-4-8" />
          </svg>
          <p className="empty-state-title">No vehicles found</p>
          <p className="empty-state-text">Use Add Vehicle above to register the first vehicle.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Plate No.</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Max Weight (kg)</th>
                <th style={{ textAlign: 'right' }}>Max Volume (m³)</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ width: '5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '500' }}>{vehicle.plate_no}</td>
                  <td><span className="type-label">{vehicle.type.charAt(0).toUpperCase() + vehicle.type.slice(1)}</span></td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{vehicle.max_weight_kg.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{vehicle.max_volume_m3 == null ? '—' : Number(vehicle.max_volume_m3).toLocaleString()}</td>
                  <td>
                    <span className={vehicle.is_active ? 'state-active' : 'state-inactive'}>
                      {vehicle.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {formatDate(vehicle.created_at)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
                      <button
                        onClick={() => openEditModal(vehicle)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.3125rem' }}
                        aria-label={`Edit ${vehicle.plate_no}`}
                      >
                        <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {isAdmin && <button
                        onClick={() => confirmDelete(vehicle)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.3125rem', color: 'var(--color-danger)' }}
                        aria-label={`Delete ${vehicle.plate_no}`}
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

      <Modal isOpen={modalOpen} onClose={closeModal} title={editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'} size="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="form-grid">
            <div>
              <label htmlFor="plate_no" className="label">Plate Number</label>
              <input
                type="text"
                id="plate_no"
                name="plate_no"
                value={formData.plate_no}
                onChange={handleChange}
                className={`input ${formErrors.plate_no ? 'input-error' : ''}`}
                placeholder="ABC-1234"
                disabled={submitting}
              />
              {formErrors.plate_no && <p className="error-message">{formErrors.plate_no}</p>}
            </div>
            <div>
              <label htmlFor="type" className="label">Type</label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="select"
                disabled={submitting}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="max_weight_kg" className="label">Max Weight (kg)</label>
              <input
                type="number"
                id="max_weight_kg"
                name="max_weight_kg"
                value={formData.max_weight_kg}
                onChange={handleChange}
                className={`input ${formErrors.max_weight_kg ? 'input-error' : ''}`}
                placeholder="1500"
                min="1"
                disabled={submitting}
              />
              {formErrors.max_weight_kg && <p className="error-message">{formErrors.max_weight_kg}</p>}
            </div>
            <div>
              <label htmlFor="max_volume_m3" className="label">Max Volume (m³)</label>
              <input
                type="number"
                id="max_volume_m3"
                name="max_volume_m3"
                value={formData.max_volume_m3}
                onChange={handleChange}
                className={`input ${formErrors.max_volume_m3 ? 'input-error' : ''}`}
                placeholder="12"
                min="0.1"
                step="0.1"
                disabled={submitting}
              />
              <p className="empty-state-text">Optional.</p>
              {formErrors.max_volume_m3 && <p className="error-message">{formErrors.max_volume_m3}</p>}
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                style={{ width: '1rem', height: '1rem', accentColor: 'var(--color-primary)' }}
              />
              <label htmlFor="is_active" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Active
              </label>
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
                editingVehicle ? 'Update' : 'Create'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {isAdmin && <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Vehicle"
        message={`Are you sure you want to delete ${vehicleToDelete?.plate_no || 'this vehicle'}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />}
    </div>
  );
}
