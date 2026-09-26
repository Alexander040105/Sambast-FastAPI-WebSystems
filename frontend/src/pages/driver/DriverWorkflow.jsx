import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  arriveAtStop,
  completeStop,
  failStop,
  getDriverManifest,
  startRoute,
} from '../../api/driverApp.js';

const EMPTY_STOPS = [];

function statusText(status) {
  return ({ en_route: 'Next stop', pending: 'Pending', arrived: 'Arrived', delivered: 'Done', failed: 'Failed' })[status] || status;
}

function StatusBadge({ status, current = false }) {
  return <span className={`driver-status driver-status-${status}`}>{current && ['pending', 'en_route'].includes(status) ? 'Next stop' : statusText(status)}</span>;
}

function StopCard({ stop, featured = false, onStart, startLabel = 'Start Route' }) {
  return (
    <article className={`driver-stop-card${featured ? ' driver-stop-card-featured' : ''}${['delivered', 'failed'].includes(stop.status) ? ' driver-stop-card-finished' : ''}`}>
      <Link className="driver-stop-main" to={`/driver/stops/${stop.id}`}>
        <span className="driver-stop-number" aria-hidden="true">{stop.status === 'delivered' ? '✓' : stop.sequence}</span>
        <span className="driver-stop-content">
          <span className="driver-stop-topline">
            <span className="driver-stop-recipient">{stop.recipient}</span>
            <StatusBadge status={stop.status} current={featured} />
          </span>
          <span className="driver-stop-address">{stop.address}</span>
          <span className="driver-stop-meta">{stop.window}{stop.weight ? ` · ${stop.weight}` : ''}</span>
        </span>
      </Link>
      {featured && onStart && <button className="driver-card-action" type="button" onClick={onStart}>{startLabel} to Stop {stop.sequence}</button>}
    </article>
  );
}

export function DriverWorkflow() {
  const location = useLocation();
  const navigate = useNavigate();
  const { stopId } = useParams();
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionFeedback, setActionFeedback] = useState({ stopId: null, error: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [podFile, setPodFile] = useState(null);
  const [podPreviewUrl, setPodPreviewUrl] = useState('');
  const podPreviewUrlRef = useRef('');
  const [recipientName, setRecipientName] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [failureNotes, setFailureNotes] = useState('');

  function handlePhotoChange(file) {
    if (podPreviewUrlRef.current) URL.revokeObjectURL(podPreviewUrlRef.current);
    const nextPreviewUrl = file ? URL.createObjectURL(file) : '';
    podPreviewUrlRef.current = nextPreviewUrl;
    setPodPreviewUrl(nextPreviewUrl);
    setPodFile(file);
  }

  useEffect(() => () => {
    if (podPreviewUrlRef.current) URL.revokeObjectURL(podPreviewUrlRef.current);
  }, []);

  async function refreshManifest() {
    setLoadError('');
    try { setManifest(await getDriverManifest()); }
    catch (error) { setLoadError(error.message || 'Could not load today’s manifest.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    getDriverManifest()
      .then((data) => { if (active) setManifest(data); })
      .catch((error) => { if (active) setLoadError(error.message || 'Could not load today’s manifest.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const stops = manifest?.stops ?? EMPTY_STOPS;
  const currentStop = stops.find((stop) => ['en_route', 'arrived'].includes(stop.status)) || stops.find((stop) => stop.status === 'pending') || null;
  const selectedStop = stopId ? stops.find((stop) => Number(stop.id) === Number(stopId)) : null;
  const currentPath = location.pathname;
  const screen = currentPath.endsWith('/complete') ? 'complete'
    : currentPath.endsWith('/fail') ? 'fail'
      : currentPath === '/driver/route' ? 'route'
        : stopId ? 'detail' : 'manifest';
  const actionError = actionFeedback.stopId === String(stopId || currentStop?.id || '') ? actionFeedback.error : '';

  async function runAction(action, forStopId, after) {
    setActionFeedback({ stopId: String(forStopId), error: '' });
    setActionLoading(true);
    try {
      setManifest(await action());
      after?.();
    } catch (error) {
      setActionFeedback({ stopId: String(forStopId), error: error.message || 'The action could not be completed.' });
    } finally { setActionLoading(false); }
  }

  function openStop(stop, subpage = '') {
    navigate(`/driver/stops/${stop.id}${subpage}`);
  }

  function beginRoute(stop) {
    runAction(() => startRoute(stop.id), stop.id, () => openStop(stop));
  }

  const pageTitle = screen === 'manifest' ? 'Today’s Deliveries'
    : screen === 'route' ? 'Active Route'
      : screen === 'complete' ? `Complete Stop ${selectedStop?.sequence ?? ''}`
        : screen === 'fail' ? 'Mark as Failed' : `Stop #${selectedStop?.sequence ?? ''} Details`;
  return (
    <div className="driver-workflow">
      <header className={`driver-page-heading${stopId ? ' driver-page-heading-sub' : ''}`}>
        {stopId && <button className="driver-back-button" type="button" aria-label="Back to stop details" onClick={() => screen === 'detail' ? navigate('/driver') : openStop(selectedStop)}>‹</button>}
        <div>
          <h1>{pageTitle}</h1>
          <p>{selectedStop ? `${selectedStop.orderNo} · ${selectedStop.recipient}` : <>{manifest?.dateLabel || 'Today'} · {manifest?.shiftLabel || 'Shift'}</>}</p>
        </div>
        {!stopId && <span className="driver-stop-count">{loading ? '—' : `${stops.length} Stops`}</span>}
      </header>

      {actionError && screen === 'manifest' && <p className="driver-action-error" role="alert">{actionError}</p>}

      {loading ? <div className="driver-state" role="status">Loading manifest…</div>
        : loadError ? <div className="driver-state driver-state-error" role="alert"><p>{loadError}</p><button className="driver-button driver-button-secondary" type="button" onClick={() => { setLoading(true); refreshManifest(); }}>Retry</button></div>
          : screen === 'detail' || screen === 'complete' || screen === 'fail' ? (
            selectedStop ? <StopWorkflowScreen
              screen={screen}
              stop={selectedStop}
              isCurrentStop={currentStop?.id === selectedStop.id}
              routeStarted={manifest.routeStarted}
              failureReasons={manifest.failureReasons}
              actionError={actionError}
              actionLoading={actionLoading}
              failureReason={failureReason}
              failureNotes={failureNotes}
              recipientName={recipientName}
              podFile={podFile}
              previewUrl={podPreviewUrl}
              onFailureReasonChange={setFailureReason}
              onFailureNotesChange={setFailureNotes}
              onRecipientNameChange={setRecipientName}
              onPhotoChange={handlePhotoChange}
              onStart={() => beginRoute(selectedStop)}
              onArrive={() => runAction(() => arriveAtStop(selectedStop.id), selectedStop.id)}
              onComplete={() => runAction(() => completeStop(selectedStop.id, podFile?.name, recipientName), selectedStop.id, () => { handlePhotoChange(null); setRecipientName(''); navigate('/driver/route'); })}
              onFail={() => runAction(() => failStop(selectedStop.id, failureReason, failureNotes), selectedStop.id, () => { setFailureReason(''); setFailureNotes(''); navigate('/driver/route'); })}
              onBack={(path) => navigate(path || '/driver')}
            /> : <div className="driver-state" role="status">This stop is not in today’s manifest. <Link to="/driver">Return to manifest</Link></div>
          ) : screen === 'route' ? (
            <section className="driver-route-view" aria-label="Active route stops">
              {manifest.routeStarted && currentStop ? <>
                <p className="driver-section-label">Current stop</p>
                <StopCard stop={currentStop} featured />
                <button className="driver-button driver-button-primary" type="button" onClick={() => openStop(currentStop)}>Open Stop {currentStop.sequence}</button>
                <p className="driver-section-label driver-upcoming-label">Upcoming stops</p>
                {stops.filter((stop) => stop.sequence > currentStop.sequence && !['delivered', 'failed'].includes(stop.status)).map((stop) => <StopCard key={stop.id} stop={stop} />)}
              </> : currentStop ? <div className="driver-state">Your route has not started. <Link to="/driver">Open the manifest to start</Link>.</div> : <div className="driver-state">All stops are complete.</div>}
            </section>
          ) : (
            <section className="driver-stop-list" aria-label="Ordered delivery stops">
              {currentStop && <StopCard stop={currentStop} featured onStart={() => manifest.routeStarted ? openStop(currentStop) : beginRoute(currentStop)} startLabel={manifest.routeStarted ? 'Continue' : 'Start Route'} />}
              {stops.filter((stop) => stop.id !== currentStop?.id).map((stop) => <StopCard key={stop.id} stop={stop} />)}
              {!stops.length && <div className="driver-state">No stops are assigned to this manifest.</div>}
            </section>
          )}
    </div>
  );
}

function StopWorkflowScreen({
  screen, stop, isCurrentStop, routeStarted, failureReasons, actionError, actionLoading,
  failureReason, failureNotes, recipientName, podFile, previewUrl, onFailureReasonChange, onFailureNotesChange,
  onRecipientNameChange, onPhotoChange, onStart, onArrive, onComplete, onFail, onBack,
}) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const isFinished = ['delivered', 'failed'].includes(stop.status);

  if (screen === 'complete') return (
    <article className="driver-detail driver-complete-screen">
      <section className="driver-pod-panel" aria-labelledby="pod-heading">
        <h2 id="pod-heading">Proof of Delivery</h2>
        <p>Capture a clear photo of the cargo at the destination.</p>
        <input ref={cameraRef} className="driver-file-input" type="file" accept="image/*" capture="environment" onChange={(event) => { onPhotoChange(event.target.files?.[0] || null); event.currentTarget.value = ''; }} aria-label="Take proof photo" />
        <input ref={galleryRef} className="driver-file-input" type="file" accept="image/*" onChange={(event) => { onPhotoChange(event.target.files?.[0] || null); event.currentTarget.value = ''; }} aria-label="Choose proof photo from gallery" />
        {previewUrl ? <div className="driver-photo-preview"><img src={previewUrl} alt="Selected proof of delivery preview" /></div> : <div className="driver-photo-empty">No delivery photo selected</div>}
        <div className="driver-upload-actions">
          <button className="driver-button driver-button-secondary" type="button" onClick={() => cameraRef.current?.click()}>{podFile ? 'Retake' : 'Take Photo'}</button>
          <button className="driver-button driver-button-secondary" type="button" onClick={() => galleryRef.current?.click()}>From Gallery</button>
        </div>
        <label className="driver-field-label" htmlFor="recipient-name">Recipient name (optional)</label>
        <input id="recipient-name" className="driver-text-input" type="text" value={recipientName} onChange={(event) => onRecipientNameChange(event.target.value)} autoComplete="name" />
      </section>
      <button className="driver-button driver-button-primary" type="button" onClick={onComplete} disabled={!podFile || actionLoading}>{actionLoading ? 'Saving delivery…' : 'Complete Delivery'}</button>
      {actionError && <p className="driver-action-error" role="alert">{actionError}</p>}
    </article>
  );

  if (screen === 'fail') return (
    <article className="driver-detail driver-fail-screen">
      <section className="driver-failure-panel" aria-labelledby="failure-heading">
        <h2 id="failure-heading">Select Reason for Failure</h2>
        <p>Required for dispatch evaluation.</p>
        <fieldset className="driver-reason-list"><legend className="driver-visually-hidden">Failure reason</legend>
          {failureReasons.map((reason) => <label className={`driver-reason-option${failureReason === reason.value ? ' selected' : ''}`} key={reason.value}>
            <input type="radio" name="failure-reason" value={reason.value} checked={failureReason === reason.value} onChange={() => onFailureReasonChange(reason.value)} />
            <span>{reason.label}</span>
          </label>)}
        </fieldset>
        <label className="driver-field-label" htmlFor="failure-notes">Additional notes</label>
        <textarea id="failure-notes" className="driver-notes-input" value={failureNotes} onChange={(event) => onFailureNotesChange(event.target.value)} rows={4} />
      </section>
      <button className="driver-button driver-button-danger" type="button" onClick={onFail} disabled={!failureReason || actionLoading}>{actionLoading ? 'Updating stop…' : 'Confirm Delivery Failure'}</button>
      {actionError && <p className="driver-action-error" role="alert">{actionError}</p>}
    </article>
  );

  return (
    <article className="driver-detail">
      <section className="driver-customer-panel">
        <p className="driver-detail-kicker">Customer &amp; destination</p>
        <h2>{stop.recipient}</h2>
        <dl className="driver-detail-facts">
          <div><dt>Delivery address</dt><dd>{stop.address}</dd></div>
          {stop.instructions && <div><dt>Access code &amp; instructions</dt><dd>{stop.instructions}</dd></div>}
        </dl>
      </section>
      <dl className="driver-detail-metrics">
        <div><dt>Cargo weight</dt><dd>{stop.weight || 'Not provided'}</dd></div>
        <div><dt>Delivery window</dt><dd>{stop.window || 'Not provided'}</dd></div>
      </dl>

      {isCurrentStop && stop.status === 'pending' && !routeStarted && <button className="driver-button driver-button-primary" type="button" onClick={onStart} disabled={actionLoading}>{actionLoading ? 'Starting route…' : `Start Route to Stop ${stop.sequence}`}</button>}
      {isCurrentStop && (stop.status === 'en_route' || (stop.status === 'pending' && routeStarted)) && <button className="driver-button driver-button-primary" type="button" onClick={onArrive} disabled={actionLoading}>{actionLoading ? 'Updating stop…' : 'Confirm Arrival'}</button>}
      {isCurrentStop && stop.status === 'arrived' && <div className="driver-stop-actions">
        <button className="driver-button driver-button-primary" type="button" onClick={() => onBack(`/driver/stops/${stop.id}/complete`)}>Complete Delivery</button>
        <button className="driver-button driver-button-secondary driver-issue-button" type="button" onClick={() => onBack(`/driver/stops/${stop.id}/fail`)}>Unable to Deliver / Issue</button>
      </div>}
      {!isCurrentStop && !isFinished && <p className="driver-sequence-note">Complete the current stop before starting this delivery.</p>}
      {isFinished && <section className={`driver-result-panel driver-result-${stop.status}`} role="status"><h2>{stop.status === 'delivered' ? 'Delivery completed' : 'Delivery failed'}</h2>{stop.status === 'delivered' && stop.deliveredAt && <p>Delivered at {stop.deliveredAt}</p>}{stop.status === 'delivered' && stop.podPhotoName && <p>Proof photo filename: {stop.podPhotoName}</p>}{stop.status === 'failed' && <p>Reason: {failureReasons.find((reason) => reason.value === stop.failureReason)?.label || stop.failureReason}</p>}</section>}
      {actionError && <p className="driver-action-error" role="alert">{actionError}</p>}
    </article>
  );
}
