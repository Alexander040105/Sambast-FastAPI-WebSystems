import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAvailableRoutes, getRouteDetail, saveStopOrder } from '../../api/routes.js';
import '../../css/route-detail.css';

const STATUS_LABELS = {
  pending: 'Pending',
  en_route: 'En route',
  arrived: 'Arrived',
  completed: 'Completed',
  failed: 'Failed',
};

function formatDuration(minutes) {
  if (!Number.isFinite(Number(minutes))) return 'Not available';
  const total = Math.max(0, Math.round(Number(minutes)));
  const hours = Math.floor(total / 60);
  const remainingMinutes = total % 60;
  return hours ? `${hours}h ${remainingMinutes}m remaining` : `${remainingMinutes}m remaining`;
}

function getOrderedStops(route, orderedIds) {
  if (!route) return [];
  const stopById = new Map(route.stops.map((stop) => [String(stop.id), stop]));
  return orderedIds.map((id) => stopById.get(String(id))).filter(Boolean);
}

function reorderPendingIds(route, orderedIds, sourceId, targetId) {
  if (!route || sourceId === targetId) return orderedIds;
  const pendingPositions = [];
  const pendingIds = [];
  orderedIds.forEach((id, index) => {
    if (route.stops.find((stop) => String(stop.id) === String(id))?.status === 'pending') {
      pendingPositions.push(index);
      pendingIds.push(String(id));
    }
  });
  const sourceIndex = pendingIds.indexOf(String(sourceId));
  const targetIndex = pendingIds.indexOf(String(targetId));
  if (sourceIndex < 0 || targetIndex < 0) return orderedIds;

  const [movedId] = pendingIds.splice(sourceIndex, 1);
  pendingIds.splice(targetIndex, 0, movedId);
  const nextIds = [...orderedIds];
  pendingPositions.forEach((position, index) => { nextIds[position] = pendingIds[index]; });
  return nextIds;
}

export function RouteDetailPage() {
  const { routeId: routeParam } = useParams();
  const navigate = useNavigate();
  const routeId = routeParam || '';
  const [routeOptions, setRouteOptions] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState('');
  const [route, setRoute] = useState(null);
  const [savedStopIds, setSavedStopIds] = useState([]);
  const [orderedStopIds, setOrderedStopIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [draggedStopId, setDraggedStopId] = useState(null);
  const [dropTargetStopId, setDropTargetStopId] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    let active = true;
    getAvailableRoutes()
      .then((options) => { if (active) setRouteOptions(options); })
      .catch((error) => { if (active) setRoutesError(error.message || 'Could not load routes.'); })
      .finally(() => { if (active) setRoutesLoading(false); });
    return () => { active = false; };
  }, []);

  async function loadRoute() {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getRouteDetail(routeId);
      const ids = result.stops.map((stop) => String(stop.id));
      setRoute(result);
      setSavedStopIds(ids);
      setOrderedStopIds(ids);
    } catch (error) {
      setRoute(null);
      setLoadError({ routeId, message: error.message || 'Could not load route details.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (!routeParam) {
      return () => { active = false; };
    }
    getRouteDetail(routeId)
      .then((result) => {
        if (!active) return;
        setLoadError(null);
        const ids = result.stops.map((stop) => String(stop.id));
        setRoute(result);
        setSavedStopIds(ids);
        setOrderedStopIds(ids);
      })
      .catch((error) => {
        if (active) {
          setRoute(null);
          setLoadError({ routeId, message: error.message || 'Could not load route details.' });
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [routeId, routeParam]);

  const orderedStops = useMemo(() => getOrderedStops(route, orderedStopIds), [route, orderedStopIds]);
  const visibleLoadError = loadError?.routeId === routeId ? loadError.message : '';
  const selectedRoute = route?.id === routeId ? route : null;
  const isLoading = Boolean(routeParam) && (loading || (!visibleLoadError && !selectedRoute));
  const hasUnsavedOrder = orderedStopIds.length !== savedStopIds.length || orderedStopIds.some((id, index) => id !== savedStopIds[index]);

  function moveStop(sourceId, targetId) {
    const next = reorderPendingIds(route, orderedStopIds, sourceId, targetId);
    if (next.every((id, index) => id === orderedStopIds[index])) return;
    setOrderedStopIds(next);
    setSaveError('');
    const newSequence = next.indexOf(String(sourceId)) + 1;
    setAnnouncement(`Stop moved to position ${newSequence}. Changes are not saved yet.`);
  }

  async function handleSaveOrder() {
    if (!hasUnsavedOrder || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const updatedRoute = await saveStopOrder(routeId, orderedStopIds);
      const ids = updatedRoute.stops.map((stop) => String(stop.id));
      setRoute(updatedRoute);
      setSavedStopIds(ids);
      setOrderedStopIds(ids);
      setAnnouncement('Stop order saved.');
    } catch (error) {
      setSaveError(error.message || 'Could not save the stop order.');
    } finally {
      setSaving(false);
    }
  }

  function handleResetOrder() {
    setOrderedStopIds(savedStopIds);
    setSaveError('');
    setAnnouncement('Unsaved changes discarded.');
  }

  function handleDragStart(event, stop) {
    if (stop.status !== 'pending') {
      event.preventDefault();
      return;
    }
    setDraggedStopId(String(stop.id));
    setDropTargetStopId(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(stop.id));
  }

  function handleDrop(event, targetStop) {
    event.preventDefault();
    const sourceId = draggedStopId || event.dataTransfer.getData('text/plain');
    if (sourceId) moveStop(sourceId, String(targetStop.id));
    setDraggedStopId(null);
    setDropTargetStopId(null);
  }

  return (
    <section className="route-detail-page" aria-labelledby="route-page-title">
      <header className="route-summary">
        <div className="route-summary-heading">
          <div>
            <p className="route-eyebrow">Route Workspace</p>
            <h1 id="route-page-title">{selectedRoute?.id || 'Select a route'}</h1>
          </div>
          <div className="route-heading-controls">
            <label className="route-select-label" htmlFor="route-selector">Route</label>
            <select
              className="route-selector"
              id="route-selector"
              value={routeParam || ''}
              onChange={(event) => navigate(event.target.value ? `/dispatcher/routes/${encodeURIComponent(event.target.value)}` : '/dispatcher/routes')}
              disabled={routesLoading || loading || Boolean(routesError) || routeOptions.length === 0 || saving}
            >
              <option value="">Select a route</option>
              {routeOptions.map((option) => <option key={option.id} value={option.id}>{option.id}</option>)}
            </select>
            {selectedRoute && <span className={`route-status route-status-${selectedRoute.status}`}>{selectedRoute.status.replaceAll('_', ' ')}</span>}
          </div>
        </div>
        {selectedRoute && <dl className="route-summary-fields">
          <div><dt>Assigned driver</dt><dd>{selectedRoute.assignedDriver || 'Unassigned'}</dd></div>
          <div><dt>Vehicle ID</dt><dd>{selectedRoute.vehicle || 'Unassigned'}</dd></div>
          <div><dt>Estimated time</dt><dd>{formatDuration(selectedRoute.estimatedRemainingMin)}</dd></div>
        </dl>}
      </header>

      {!routeParam ? <div className="route-state" role="status">
        {routesLoading ? 'Loading routes…' : routesError ? routesError : routeOptions.length ? 'Select a route to view its details and ordered sequence.' : 'No routes are available.'}
      </div> : isLoading ? <div className="route-state" role="status">Loading route details…</div>
        : visibleLoadError ? <div className="route-state route-state-error" role="alert"><p>{visibleLoadError}</p><button className="route-button route-button-secondary" type="button" onClick={loadRoute} disabled={isLoading}>Retry</button></div>
          : !selectedRoute ? <div className="route-state" role="status">Route details are unavailable.</div>
            : <>
              <section className="route-sequence" aria-labelledby="route-sequence-title">
                <div className="route-sequence-heading">
                  <h2 id="route-sequence-title">Ordered Sequence</h2>
                  <span className="route-stop-count">{route.stops.length} stops</span>
                  {hasUnsavedOrder && <span className="route-unsaved-indicator">Unsaved changes</span>}
                </div>

                <ol className="route-stop-list" aria-label="Ordered route stops" aria-busy={saving}>
                  {orderedStops.map((stop, index) => {
                    const reorderable = stop.status === 'pending';
                    const isActiveStop = ['en_route', 'arrived'].includes(stop.status);
                    const isDragged = draggedStopId === String(stop.id);
                    return <li
                      className={`route-stop-row${reorderable ? ' is-reorderable' : ' is-fixed'}${isActiveStop ? ' is-active-stop' : ''}${isDragged ? ' is-dragging' : ''}${dropTargetStopId === String(stop.id) ? ' is-drop-target' : ''}`}
                      key={stop.id}
                      onDragOver={(event) => { if (reorderable) { event.preventDefault(); if (draggedStopId !== String(stop.id)) setDropTargetStopId(String(stop.id)); } }}
                      onDrop={(event) => { if (reorderable) handleDrop(event, stop); }}
                      onDragEnd={() => { setDraggedStopId(null); setDropTargetStopId(null); }}
                    >
                      <div className="route-stop-position">
                        {reorderable ? <button
                          className="route-drag-handle"
                          type="button"
                          draggable
                          aria-label={`Reorder stop ${index + 1}: ${stop.destination}. Use up or down arrow keys to move.`}
                          onDragStart={(event) => handleDragStart(event, stop)}
                          onKeyDown={(event) => {
                            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                            event.preventDefault();
                            const direction = event.key === 'ArrowUp' ? -1 : 1;
                            const pendingStops = orderedStops.filter((item) => item.status === 'pending');
                            const currentIndex = pendingStops.findIndex((item) => String(item.id) === String(stop.id));
                            const target = pendingStops[currentIndex + direction];
                            if (target) moveStop(stop.id, target.id);
                          }}
                        ><svg aria-hidden="true" viewBox="0 0 16 16"><circle cx="5" cy="4" r="1" /><circle cx="11" cy="4" r="1" /><circle cx="5" cy="8" r="1" /><circle cx="11" cy="8" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="11" cy="12" r="1" /></svg></button> : <span className="route-fixed-mark" aria-hidden="true">·</span>}
                        <span className="route-stop-number">{String(index + 1).padStart(2, '0')}</span>
                      </div>
                      <div className="route-stop-details">
                        <h3>{stop.destination}</h3>
                        <p>{stop.address}</p>
                        <span className="route-stop-window">{stop.deliveryWindow || 'Delivery window unavailable'}</span>
                      </div>
                      <span className={`route-stop-status route-stop-status-${stop.status}`}>{STATUS_LABELS[stop.status] || stop.status.replaceAll('_', ' ')}</span>
                    </li>;
                  })}
                </ol>

                <div className="route-sequence-footer">
                  <p className="route-reorder-guidance">Completed and active stops remain fixed. Only pending stops can move.</p>
                  <div className="route-order-actions">
                    {hasUnsavedOrder && <>
                      <button className="route-button route-button-secondary" type="button" onClick={handleResetOrder} disabled={saving}>Reset</button>
                      <button className="route-button route-button-primary" type="button" onClick={handleSaveOrder} disabled={saving}>{saving ? 'Saving…' : 'Save Stop Order'}</button>
                    </>}
                  </div>
                </div>
                {saveError && <p className="route-inline-error" role="alert">{saveError}</p>}
                <p className="route-sr-only" aria-live="polite">{announcement}</p>
              </section>
            </>}
    </section>
  );
}
