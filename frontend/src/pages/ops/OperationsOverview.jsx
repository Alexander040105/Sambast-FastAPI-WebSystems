import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getDeliveryCosts,
  getDriverPerformance,
  getFailedDeliveries,
  getAnalyticsPeriods,
} from '../../mocks/temporaryAnalyticsService.js';

const REASON_COLORS = ['#b42318', '#756fba', '#efb91a', '#24824e'];

function loadAnalytics(periodKey) {
  return Promise.all([
    getDriverPerformance(periodKey),
    getDeliveryCosts(periodKey),
    getFailedDeliveries(periodKey),
  ]).then(([driverPerformance, deliveryCosts, failedDeliveries]) => ({
    driverPerformance,
    deliveryCosts,
    failedDeliveries,
  }));
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
}

function formatUpdatedTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function CalendarIcon() {
  return <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3.5" width="12" height="10.5" rx="1.5" />
    <path d="M5 2v3M11 2v3M2 6.5h12M5 9h1m3 0h1m-5 2h1m3 0h1" />
  </svg>;
}

function SummaryChip({ color, children }) {
  return <span className="ops-summary-chip"><i style={{ '--chip-color': color }} />{children}</span>;
}

function DriverPerformance({ data }) {
  const { summary, series } = data;
  return (
    <section className="ops-panel ops-performance-panel" aria-labelledby="driver-performance-title">
      <div className="ops-panel-heading ops-performance-heading">
        <div>
          <h2 id="driver-performance-title">Driver performance</h2>
          <p>On-time, delivery volume, and failure trends for the selected week.</p>
        </div>
        <div className="ops-summary-chips" aria-label="Driver performance summary">
          <SummaryChip color="var(--ops-periwinkle)">{summary.onTimePercent.toFixed(1)}% on-time</SummaryChip>
          <SummaryChip color="var(--ops-yellow)">{summary.deliveriesPerDay} deliveries / day</SummaryChip>
          <SummaryChip color="var(--ops-danger)">{summary.failureRate.toFixed(1)}% failure rate</SummaryChip>
        </div>
      </div>
      <div className="ops-chart ops-performance-chart" role="img" aria-label="Daily on-time delivery percentage for the week">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 18, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--ops-border)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--ops-muted)', fontSize: 11 }} dy={4} />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              cursor={{ fill: 'var(--ops-chart-hover)' }}
              contentStyle={{ background: '#fff', border: '1px solid var(--ops-border)', borderRadius: 5, fontSize: 12 }}
              formatter={(value) => [`${value}%`, 'On-time']}
              labelFormatter={(label) => label}
            />
            <ReferenceLine y={0} stroke="var(--ops-border)" />
            <Bar dataKey="onTimePercent" maxBarSize={22} radius={[2, 2, 0, 0]}>
              {series.map((item, index) => <Cell key={item.day} fill={index === series.length - 1 ? 'var(--ops-yellow)' : 'var(--ops-periwinkle)'} />)}
              <LabelList dataKey="onTimePercent" position="top" formatter={(value) => `${value}%`} fill="var(--ops-text-secondary)" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function DeliveryCosts({ data }) {
  const { summary, series } = data;
  return (
    <section className="ops-panel ops-lower-panel" aria-labelledby="delivery-costs-title">
      <div className="ops-panel-heading">
        <div>
          <h2 id="delivery-costs-title">Delivery costs</h2>
          <p>Daily delivery cost per stop for the selected week.</p>
        </div>
        <SummaryChip color="var(--ops-yellow)">Avg {formatCurrency(summary.averageCostPerStop)} / stop</SummaryChip>
      </div>
      <div className="ops-chart ops-cost-chart" role="img" aria-label="Daily delivery cost per stop for the week">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 18, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--ops-border)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--ops-muted)', fontSize: 11 }} dy={4} />
            <YAxis domain={[0, 20]} hide />
            <Tooltip
              cursor={{ fill: 'var(--ops-chart-hover)' }}
              contentStyle={{ background: '#fff', border: '1px solid var(--ops-border)', borderRadius: 5, fontSize: 12 }}
              formatter={(value) => [formatCurrency(value), 'Cost per stop']}
            />
            <ReferenceLine y={0} stroke="var(--ops-border)" />
            <Bar dataKey="costPerStop" maxBarSize={23} radius={[2, 2, 0, 0]}>
              {series.map((item, index) => <Cell key={item.day} fill={index === series.length - 1 ? 'var(--ops-periwinkle)' : 'var(--ops-yellow)'} />)}
              <LabelList dataKey="costPerStop" position="top" formatter={(value) => formatCurrency(value)} fill="var(--ops-text-secondary)" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="ops-chart-scale" aria-hidden="true"><span>$0</span><span>$10</span><span>$20</span></div>
    </section>
  );
}

function FailedDeliveries({ data }) {
  const { summary, reasons, daily } = data;
  const totalReasons = reasons.reduce((total, item) => total + item.count, 0);
  const changeLabel = `${summary.changeFromPreviousWeek > 0 ? '+' : ''}${summary.changeFromPreviousWeek} vs previous week`;
  return (
    <section className="ops-panel ops-lower-panel ops-failures-panel" aria-labelledby="failed-deliveries-title">
      <div className="ops-panel-heading">
        <div>
          <h2 id="failed-deliveries-title">Failed deliveries</h2>
          <p>Reason breakdown and daily failures for the selected week.</p>
        </div>
        <SummaryChip color="var(--ops-danger)">{summary.failedCount} failed · {summary.failureRate.toFixed(1)}%</SummaryChip>
      </div>
      <ul className="ops-reason-list" aria-label="Failed delivery reasons">
        {reasons.map((item, index) => (
          <li key={item.reason}>
            <span className="ops-reason-name"><i style={{ '--reason-color': REASON_COLORS[index % REASON_COLORS.length] }} />{item.reason}</span>
            <span className="ops-reason-value">{item.count} · {totalReasons ? ((item.count / totalReasons) * 100).toFixed(1) : '0.0'}%</span>
          </li>
        ))}
      </ul>
      <div className="ops-failure-chart-heading"><span>Failed deliveries / day</span><span>{changeLabel}</span></div>
      <div className="ops-chart ops-failure-chart" role="img" aria-label="Failed deliveries per day for the week">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={daily} margin={{ top: 14, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--ops-border)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--ops-muted)', fontSize: 11 }} dy={4} />
            <YAxis allowDecimals={false} hide />
            <Tooltip
              cursor={{ fill: 'var(--ops-chart-hover)' }}
              contentStyle={{ background: '#fff', border: '1px solid var(--ops-border)', borderRadius: 5, fontSize: 12 }}
              formatter={(value) => [value, 'Failed deliveries']}
            />
            <ReferenceLine y={0} stroke="var(--ops-border)" />
            <Bar dataKey="count" maxBarSize={22} radius={[2, 2, 0, 0]}>
              {daily.map((item, index) => <Cell key={item.day} fill={index === daily.length - 1 ? 'var(--ops-periwinkle)' : 'var(--ops-danger)'} />)}
              <LabelList dataKey="count" position="top" fill="var(--ops-text-secondary)" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function OperationsOverview() {
  const [analytics, setAnalytics] = useState(null);
  const [periodOptions, setPeriodOptions] = useState([]);
  const [periodKey, setPeriodKey] = useState('this_week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getAnalyticsPeriods(), loadAnalytics(periodKey)])
      .then(([periods, data]) => {
        if (!active) return;
        setPeriodOptions(periods);
        setAnalytics(data);
      })
      .catch((loadError) => { if (active) setError(loadError.message || 'Unable to load operations analytics.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [periodKey]);

  function retry() {
    setLoading(true);
    setError('');
    loadAnalytics(periodKey)
      .then(setAnalytics)
      .catch((loadError) => setError(loadError.message || 'Unable to load operations analytics.'))
      .finally(() => setLoading(false));
  }

  const period = analytics?.driverPerformance.period;
  const updatedAt = analytics?.driverPerformance.updatedAt;

  return (
    <div className="ops-overview-page">
      <header className="ops-page-header">
        <div>
          <h1>Operations Overview</h1>
          <p>Monitor driver performance, delivery costs, and failed-delivery trends across the network.</p>
        </div>
        <div className="ops-page-meta">
          {updatedAt && <span className="ops-updated-time"><span aria-hidden="true">↻</span> Updated {formatUpdatedTime(updatedAt)}</span>}
          {period && <div className="ops-date-range"><CalendarIcon /><label className="ops-visually-hidden" htmlFor="ops-date-range">Analytics date range</label><select id="ops-date-range" value={periodKey} onChange={(event) => { setLoading(true); setError(''); setPeriodKey(event.target.value); }}>
            {periodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select><span className="ops-date-caret" aria-hidden="true" /></div>}
        </div>
      </header>

      {error ? <div className="ops-load-error" role="alert"><p>{error}</p><button type="button" onClick={retry}>Retry</button></div>
        : loading || !analytics ? <div className="ops-loading" role="status">Loading operations analytics…</div>
          : <div className="ops-analytics-grid">
            <DriverPerformance data={analytics.driverPerformance} />
            <DeliveryCosts data={analytics.deliveryCosts} />
            <FailedDeliveries data={analytics.failedDeliveries} />
          </div>}
    </div>
  );
}
