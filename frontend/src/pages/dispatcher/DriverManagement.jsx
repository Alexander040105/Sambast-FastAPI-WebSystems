import { useEffect, useMemo, useState } from 'react';
import { auth } from '../../api/index.js';
import { createDriver, fetchDrivers, updateDriver, deleteDriver } from '../../api/drivers.js';
import { Modal } from '../../components/Modal.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'off_duty', label: 'Off Duty' },
  { value: 'suspended', label: 'Suspended' },
];
const PAGE_SIZE = 20;
const INITIAL_FORM = { user_id: '', license_no: '', status: 'active' };

function getStatusBadge(status) {
  const labels = { active: 'Active', off_duty: 'Off Duty', suspended: 'Suspended' };
  return <span className={`status status-${status}`}>{labels[status] || status}</span>;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function DriverManagement() {
  const [drivers, setDrivers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState(null);
  const isAdmin = auth.getRole() === 'admin';

  const filteredDrivers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return drivers.filter((driver) => {
      const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;
      const matchesSearch = !query || [driver.id, driver.user_id, driver.license_no]
        .some((value) => String(value ?? '').toLocaleLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [drivers, search, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredDrivers.length / PAGE_SIZE));
  const visiblePage = Math.min(currentPage, pageCount);
  const visibleDrivers = filteredDrivers.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE);
  const rangeStart = filteredDrivers.length ? (visiblePage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(visiblePage * PAGE_SIZE, filteredDrivers.length);

  useEffect(() => { loadDrivers(); }, []);

  async function loadDrivers() {
    try {
      setLoading(true);
      setError(null);
      setDrivers(await fetchDrivers());
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
    setFormData({ user_id: '', license_no: driver.license_no || '', status: driver.status || 'active' });
    setFormErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingDriver(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    if (formErrors[name]) setFormErrors((current) => ({ ...current, [name]: null }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = {};
    const userId = Number(formData.user_id);
    if (!editingDriver && (!Number.isInteger(userId) || userId <= 0)) errors.user_id = 'Enter an existing driver user ID';
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      const payload = { license_no: formData.license_no.trim() || null, status: formData.status };
      if (editingDriver) await updateDriver(editingDriver.id, payload);
      else await createDriver({ user_id: userId, ...payload });
      closeModal();
      await loadDrivers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
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

  if (loading) return <div className="fleet-state" role="status"><span className="loading-spinner" />Loading drivers…</div>;
  if (error) return <div className="fleet-state fleet-state-error" role="alert"><p className="error-message">Failed to load drivers: {error}</p><button onClick={loadDrivers} className="btn btn-primary">Retry</button></div>;

  return (
    <div className="fleet-records">
      <div className="section-header fleet-table-toolbar">
        <h1>Drivers</h1>
        <div className="fleet-table-controls">
          <label className="fleet-search">
            <span className="sr-only">Search drivers by ID, user ID, or license number</span>
            <input className="input" type="search" value={search} placeholder="Search drivers..." onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} />
          </label>
          <label className="fleet-filter">
            <span className="sr-only">Filter drivers by status</span>
            <select className="select" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}>
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">Add Driver</button>
      </div>
      {filteredDrivers.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">{drivers.length === 0 ? 'No drivers yet.' : 'No drivers match your search or filter.'}</p>
          {drivers.length === 0 ? (
            <p className="empty-state-text">Add a driver using the ID of an existing user with the driver role. Use Add Driver above to begin.</p>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatusFilter('all'); setCurrentPage(1); }}>Clear search and filter</button>
          )}
        </div>
      ) : (
        <div className="table-container"><table className="table drivers-table">
          <thead><tr><th scope="col">Driver</th><th scope="col">License No.</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col" className="actions-column">Actions</th></tr></thead>
          <tbody>{visibleDrivers.map((driver) => <tr key={driver.id}>
            <td><div style={{ fontWeight: 500 }}>Driver #{driver.id}</div><div style={{ color: 'var(--text-muted)' }}>User ID {driver.user_id}</div></td>
            <td className="license-cell" title={driver.license_no || undefined}>{driver.license_no || '—'}</td>
            <td>{getStatusBadge(driver.status)}</td>
            <td style={{ color: 'var(--text-muted)' }}>{formatDate(driver.created_at)}</td>
            <td className="actions-column">
              <button onClick={() => openEditModal(driver)} className="btn btn-ghost btn-sm" style={{ padding: '0.3125rem' }} aria-label={`Edit driver ${driver.id}`}>
                <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              {isAdmin && <button onClick={() => { setDriverToDelete(driver); setDeleteDialogOpen(true); }} className="btn btn-ghost btn-sm" style={{ padding: '0.3125rem', color: 'var(--color-danger)' }} aria-label={`Delete driver ${driver.id}`}>
                <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>}
            </td>
          </tr>)}</tbody>
        </table></div>
      )}
      <div className="fleet-table-footer" aria-label="Driver table pagination">
        <span>Showing {rangeStart}–{rangeEnd} of {filteredDrivers.length}</span>
        <div className="fleet-pagination-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(visiblePage - 1)} disabled={visiblePage <= 1}>Previous</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(visiblePage + 1)} disabled={visiblePage >= pageCount}>Next</button>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={closeModal} title={editingDriver ? 'Edit Driver' : 'Add Driver'} size="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {!editingDriver && <div>
            <label htmlFor="driver-user-id" className="label">Existing Driver User ID</label>
            <input id="driver-user-id" name="user_id" type="number" min="1" step="1" value={formData.user_id} onChange={handleChange} className={`input ${formErrors.user_id ? 'input-error' : ''}`} disabled={submitting} required />
            {formErrors.user_id && <p className="error-message">{formErrors.user_id}</p>}
            <p className="empty-state-text">The backend has no eligible-user lookup or user creation endpoint. Enter an existing user ID with the driver role; the server will validate it.</p>
          </div>}
          <div className="form-grid">
            <div>
              <label htmlFor="driver-license" className="label">License Number</label>
              <input id="driver-license" name="license_no" value={formData.license_no} onChange={handleChange} className={`input ${formErrors.license_no ? 'input-error' : ''}`} disabled={submitting} />
              {formErrors.license_no && <p className="error-message">{formErrors.license_no}</p>}
            </div>
            <div>
              <label htmlFor="driver-status" className="label">Status</label>
              <select id="driver-status" name="status" value={formData.status} onChange={handleChange} className="select" disabled={submitting}>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={closeModal} className="btn btn-secondary" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : editingDriver ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
      {isAdmin && <ConfirmDialog isOpen={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} onConfirm={handleDelete} title="Delete Driver" message={`Delete driver #${driverToDelete?.id}? This action cannot be undone.`} confirmText="Delete" variant="danger" />}
    </div>
  );
}
