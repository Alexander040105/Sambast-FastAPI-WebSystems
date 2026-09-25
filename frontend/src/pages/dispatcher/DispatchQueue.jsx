import { useEffect, useMemo, useState } from 'react';
import { assignOrderToDriver, fetchDispatchQueue, getDispatchRecommendation } from '../../api/dispatch.js';
import { fetchDrivers } from '../../api/drivers.js';
import '../../css/dispatch.css';

const QUEUE_PAGE_SIZE = 10;

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatWindow(order) {
  const start = formatDateTime(order.delivery_window_start);
  const end = formatDateTime(order.delivery_window_end);
  if (start && end) return `${start} – ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return 'No delivery window';
}

function formatAddress(location) {
  if (!location) return 'Address unavailable';
  const addressLines = [location.line1, location.line2]
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim());
  const locality = [location.city, location.province, location.postal_code]
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim())
    .join(', ');
  const parts = [...addressLines, locality].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return typeof location.label === 'string' && location.label.trim()
    ? location.label.trim()
    : 'Address unavailable';
}

function formatWeight(value) {
  if (value === null || value === undefined || value === '') return 'Weight unavailable';
  const weight = Number(value);
  return Number.isFinite(weight)
    ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(weight)} kg`
    : 'Weight unavailable';
}

function orderMatchesSearch(order, value) {
  const query = value.trim().toLocaleLowerCase();
  if (!query) return true;
  const location = order.delivery_location || {};
  return [order.id, order.order_no, location.label, location.line1, location.line2, location.city, location.province, location.postal_code]
    .some((field) => String(field ?? '').toLocaleLowerCase().includes(query));
}

function getErrorMessage(error, action) {
  const detail = error?.message || 'An unexpected error occurred.';
  if (error?.status === 400) return `The order cannot be assigned: ${detail}`;
  if (error?.status === 401) return 'Authentication is required to access dispatch. Sign in with an authorized account and retry.';
  if (error?.status === 403) return 'Your account is not permitted to perform this dispatch action.';
  if (error?.status === 404) return `The order or driver was not found. Refresh the queue and retry. ${detail}`;
  if (error?.status === 422) return `The request was rejected by the server. Check the selected order and driver. ${detail}`;
  if (error?.status === 0) return `The dispatch service could not be reached. ${detail}`;
  return `${action}: ${detail}`;
}

function driverLabel(driver) {
  return driver.license_no
    ? `Driver #${driver.id} · License ${driver.license_no}`
    : `Driver #${driver.id}`;
}

function recommendationDriverLabel(recommendation, drivers) {
  if (recommendation.driver_id === null || recommendation.driver_id === undefined) {
    return 'No driver recommended';
  }
  const driver = drivers.find((item) => Number(item.id) === Number(recommendation.driver_id));
  return driver ? driverLabel(driver) : `Driver #${recommendation.driver_id}`;
}

export function DispatchQueue() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [recommendation, setRecommendation] = useState(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [driversLoading, setDriversLoading] = useState(true);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [queueError, setQueueError] = useState(null);
  const [driversError, setDriversError] = useState(null);
  const [recommendationError, setRecommendationError] = useState(null);
  const [assignmentError, setAssignmentError] = useState(null);
  const [refreshError, setRefreshError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => orderMatchesSearch(order, search));
  }, [orders, search]);
  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => Number(order.id) === Number(selectedOrderId)) || null,
    [filteredOrders, selectedOrderId],
  );
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / QUEUE_PAGE_SIZE));
  const visiblePage = Math.min(currentPage, pageCount);
  const visibleOrders = filteredOrders.slice((visiblePage - 1) * QUEUE_PAGE_SIZE, visiblePage * QUEUE_PAGE_SIZE);
  const rangeStart = filteredOrders.length ? (visiblePage - 1) * QUEUE_PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(visiblePage * QUEUE_PAGE_SIZE, filteredOrders.length);

  async function loadQueue({ initial = false } = {}) {
    setQueueLoading(true);
    if (initial) setQueueError(null);
    if (!initial) setRefreshError(null);
    try {
      const response = await fetchDispatchQueue();
      if (!Array.isArray(response?.data)) {
        throw new Error('Unexpected dispatch queue response: expected a data array.');
      }
      setOrders(response.data);
      setSelectedOrderId((currentId) => (
        currentId !== null && !response.data.some((order) => Number(order.id) === Number(currentId))
          ? null
          : currentId
      ));
      return response.data;
    } catch (error) {
      if (initial) setQueueError(error);
      else setRefreshError(error);
      throw error;
    } finally {
      setQueueLoading(false);
    }
  }

  async function loadDrivers() {
    setDriversLoading(true);
    setDriversError(null);
    try {
      setDrivers(await fetchDrivers());
    } catch (error) {
      setDriversError(error);
    } finally {
      setDriversLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (!isMounted) return;
      loadQueue({ initial: true }).catch(() => {});
      loadDrivers();
    });
    return () => { isMounted = false; };
  }, []);

  function resetOrderActions() {
    setSelectedDriverId('');
    setRecommendation(null);
    setRecommendationError(null);
    setAssignmentError(null);
    setRefreshError(null);
  }

  function handleQueueSearch(value) {
    setSearch(value);
    setCurrentPage(1);
    const selected = orders.find((order) => Number(order.id) === Number(selectedOrderId));
    if (selected && !orderMatchesSearch(selected, value)) {
      setSelectedOrderId(null);
      resetOrderActions();
    }
  }

  function selectOrder(order) {
    resetOrderActions();
    setSuccessMessage('');
    setSelectedOrderId(order.id);
  }

  async function handleRecommendation() {
    if (!selectedOrder) return;
    setRecommendation(null);
    setRecommendationError(null);
    setAssignmentError(null);
    setSuccessMessage('');
    setRecommendationLoading(true);
    try {
      const result = await getDispatchRecommendation(selectedOrder.id);
      setRecommendation(result);
      if (result.driver_id !== null && result.driver_id !== undefined) {
        const matchingDriver = drivers.find((driver) => Number(driver.id) === Number(result.driver_id));
        if (matchingDriver) setSelectedDriverId(String(matchingDriver.id));
      }
    } catch (error) {
      setRecommendationError(error);
    } finally {
      setRecommendationLoading(false);
    }
  }

  async function handleAssignment(event) {
    event.preventDefault();
    if (!selectedOrder || !selectedDriverId) return;
    setAssignmentError(null);
    setRefreshError(null);
    setSuccessMessage('');
    setAssignmentLoading(true);
    try {
      const result = await assignOrderToDriver(selectedOrder.id, {
        driver_id: Number(selectedDriverId),
      });
      if (result?.status !== 'success' || !Number.isFinite(Number(result.delivery_id))) {
        throw new Error('The server did not confirm the assignment.');
      }
      setSuccessMessage(
        `Order ${selectedOrder.order_no} assigned. Delivery #${result.delivery_id} was created.`,
      );
      await loadQueue().catch(() => {});
    } catch (error) {
      setAssignmentError(error);
    } finally {
      setAssignmentLoading(false);
    }
  }

  return (
    <section className="dispatch-page" aria-labelledby="dispatch-title">
      <header className="dispatch-page-header">
        <div>
          <p className="dispatch-kicker">DISPATCHER / OPERATIONS</p>
          <h1 id="dispatch-title">Dispatch Queue</h1>
          <p className="dispatch-intro">Review ready orders and assign a driver.</p>
        </div>
        <button
          type="button"
          className="dispatch-refresh"
          onClick={() => loadQueue().catch(() => {})}
          disabled={queueLoading}
        >
          {queueLoading ? 'Refreshing…' : 'Refresh queue'}
        </button>
      </header>

      {queueError ? (
        <div className="dispatch-state dispatch-state-error" role="alert">
          <p>{getErrorMessage(queueError, 'Could not load the dispatch queue')}</p>
          <button type="button" className="dispatch-button dispatch-button-primary" onClick={() => loadQueue({ initial: true }).catch(() => {})} disabled={queueLoading}>
            {queueLoading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : (
        <>
        {successMessage && (
          <p className="dispatch-success dispatch-page-feedback" role="status" aria-live="polite">{successMessage}</p>
        )}
        <div className="dispatch-workspace">
          <section className="dispatch-queue-pane" aria-labelledby="queue-heading">
            <div className="dispatch-pane-heading">
              <div>
                <p className="dispatch-section-label">READY FOR DISPATCH</p>
                <h2 id="queue-heading">Orders</h2>
              </div>
              <div className="dispatch-queue-tools">
                <label className="dispatch-search">
                  <input type="search" aria-label="Search orders by order number or delivery address" value={search} placeholder="Search orders..." onChange={(event) => handleQueueSearch(event.target.value)} />
                </label>
                <span className="dispatch-count" aria-label={`${filteredOrders.length} matching orders`}>{queueLoading ? '—' : filteredOrders.length}</span>
              </div>
            </div>

            {refreshError && (
              <p className="dispatch-inline-error" role="alert">
                Could not refresh the queue: {getErrorMessage(refreshError, 'Refresh failed')}
              </p>
            )}

            {queueLoading && orders.length === 0 ? (
              <div className="dispatch-state" role="status">Loading dispatch queue…</div>
            ) : orders.length === 0 ? (
              <div className="dispatch-empty">
                <h3>No orders waiting for dispatch.</h3>
                <p>Orders will appear here when the backend marks them ready.</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="dispatch-empty">
                <h3>No orders match your search.</h3>
                <button type="button" className="dispatch-text-button" onClick={() => { setSearch(''); setCurrentPage(1); }}>Clear search</button>
              </div>
            ) : (
              <div className="dispatch-table-wrap" aria-busy={queueLoading}>
                <table className="dispatch-table">
                  <thead>
                    <tr>
                      <th scope="col">Order #</th>
                      <th scope="col">Delivery window</th>
                      <th scope="col">Delivery address</th>
                      <th scope="col" className="dispatch-weight-column">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((order) => (
                      <tr key={order.id} className={Number(order.id) === Number(selectedOrderId) ? 'is-selected' : ''}>
                        <td>
                          <button
                            type="button"
                            className="dispatch-order-link"
                            aria-pressed={Number(order.id) === Number(selectedOrderId)}
                            onClick={() => selectOrder(order)}
                          >
                            {order.order_no || `Order #${order.id}`}
                          </button>
                        </td>
                        <td>{formatWindow(order)}</td>
                        <td className="dispatch-address-cell">{formatAddress(order.delivery_location)}</td>
                        <td className="dispatch-weight-column">{formatWeight(order.total_weight_kg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(!queueLoading || orders.length > 0) && (
              <div className="dispatch-queue-footer" aria-label="Dispatch queue pagination">
                <span>Showing {rangeStart}–{rangeEnd} of {filteredOrders.length}</span>
                <div className="fleet-pagination-actions">
                  <button type="button" className="dispatch-button dispatch-button-secondary" onClick={() => setCurrentPage(visiblePage - 1)} disabled={visiblePage <= 1}>Previous</button>
                  <button type="button" className="dispatch-button dispatch-button-secondary" onClick={() => setCurrentPage(visiblePage + 1)} disabled={visiblePage >= pageCount}>Next</button>
                </div>
              </div>
            )}
          </section>

          <aside className="dispatch-detail-pane" aria-labelledby="order-detail-heading">
            {!selectedOrder ? (
              <div className="dispatch-detail-empty">
                <p className="dispatch-section-label">ORDER DETAILS</p>
                <h2 id="order-detail-heading">Select an order</h2>
                <p>Choose an order from the queue to review its delivery details and assignment options.</p>
              </div>
            ) : (
              <>
                <div className="dispatch-pane-heading dispatch-detail-heading">
                  <div>
                    <p className="dispatch-section-label">ORDER DETAILS</p>
                    <h2 id="order-detail-heading">{selectedOrder.order_no || `Order #${selectedOrder.id}`}</h2>
                  </div>
                  <span className="dispatch-record-id">#{selectedOrder.id}</span>
                </div>

                <dl className="dispatch-order-facts">
                  <div>
                    <dt>Delivery window</dt>
                    <dd>{formatWindow(selectedOrder)}</dd>
                  </div>
                  <div>
                    <dt>Delivery address</dt>
                    <dd>{formatAddress(selectedOrder.delivery_location)}</dd>
                  </div>
                  <div>
                    <dt>Total weight</dt>
                    <dd>{formatWeight(selectedOrder.total_weight_kg)}</dd>
                  </div>
                </dl>

                <section className="dispatch-recommendation" aria-labelledby="recommendation-heading">
                  <div className="dispatch-subsection-heading">
                    <div>
                      <p className="dispatch-section-label">BACKEND SUGGESTION</p>
                      <h3 id="recommendation-heading">Assignment recommendation</h3>
                    </div>
                    <button
                      type="button"
                      className="dispatch-button dispatch-button-secondary"
                      onClick={handleRecommendation}
                      disabled={recommendationLoading}
                    >
                      {recommendationLoading ? 'Getting recommendation…' : 'Get recommendation'}
                    </button>
                  </div>

                  {recommendationError && (
                    <p className="dispatch-inline-error" role="alert">
                      {getErrorMessage(recommendationError, 'Could not get a recommendation')}
                    </p>
                  )}

                  {recommendation && (
                    <dl className="dispatch-recommendation-facts" aria-live="polite">
                      <div>
                        <dt>Recommended driver</dt>
                        <dd>{recommendationDriverLabel(recommendation, drivers)}</dd>
                      </div>
                      <div>
                        <dt>Recommended vehicle</dt>
                        <dd>{recommendation.vehicle_id === null || recommendation.vehicle_id === undefined ? 'No vehicle recommended' : `Vehicle #${recommendation.vehicle_id}`}</dd>
                      </div>
                      <div className="dispatch-reason">
                        <dt>Reason</dt>
                        <dd>{recommendation.reason}</dd>
                      </div>
                    </dl>
                  )}
                </section>

                <form className="dispatch-assignment" onSubmit={handleAssignment}>
                  <label htmlFor="dispatch-driver">Assign driver</label>
                  <select
                    id="dispatch-driver"
                    value={selectedDriverId}
                    onChange={(event) => setSelectedDriverId(event.target.value)}
                    disabled={driversLoading || Boolean(driversError) || drivers.length === 0 || assignmentLoading}
                    required
                  >
                    <option value="">{driversLoading ? 'Loading drivers…' : 'Select a driver'}</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>{driverLabel(driver)}</option>
                    ))}
                  </select>
                  {driversError && (
                    <p className="dispatch-inline-error" role="alert">
                      Could not load drivers for manual selection: {getErrorMessage(driversError, 'Driver request failed')}
                      <button type="button" className="dispatch-text-button" onClick={loadDrivers} disabled={driversLoading}>Retry</button>
                    </p>
                  )}
                  {!driversLoading && !driversError && drivers.length === 0 && (
                    <p className="dispatch-help">No driver records were returned by the backend.</p>
                  )}
                  <p className="dispatch-help">The driver list is general; the backend does not provide order-specific eligibility here.</p>
                  {assignmentError && (
                    <p className="dispatch-inline-error" role="alert">
                      {getErrorMessage(assignmentError, 'Assignment failed')}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="dispatch-button dispatch-button-primary"
                    disabled={!selectedDriverId || driversLoading || Boolean(driversError) || assignmentLoading}
                  >
                    {assignmentLoading ? 'Assigning…' : 'Assign driver'}
                  </button>
                </form>
              </>
            )}
          </aside>
        </div>
        </>
      )}
    </section>
  );
}
