import { api } from './client.js';

function weekPeriod(periodKey) {
  const end = new Date();
  const day = (end.getDay() + 6) % 7;
  end.setDate(end.getDate() - day - (periodKey === 'previous_week' ? 7 : 0));
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  return {
    key: periodKey,
    start: start.toISOString(),
    end: end.toISOString(),
    label:
      new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(start)
      + '–'
      + new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(end),
  };
}

export async function getAnalyticsPeriods() {
  return ['this_week', 'previous_week'].map((key) => weekPeriod(key));
}

export async function getDriverPerformance(periodKey = 'this_week') {
  const res = await api.get('/analytics/driver-performance', { period_key: periodKey });
  return {
    ...res,
    summary: {
      onTimePercent: res.summary.on_time_percent,
      deliveriesPerDay: res.summary.deliveries_per_day,
      failureRate: res.summary.failure_rate,
      ...res.summary,
    },
    series: (res.series || []).map((s) => ({
      day: s.day,
      onTimePercent: s.on_time_percent,
      deliveries: s.deliveries,
      failureRate: s.failure_rate,
      ...s,
    })),
    updatedAt: res.updated_at || new Date().toISOString(),
  };
}

export async function getDeliveryCosts(periodKey = 'this_week') {
  const res = await api.get('/analytics/delivery-costs', { period_key: periodKey });
  return {
    ...res,
    summary: {
      averageCostPerStop: res.summary.average_cost_per_stop,
      ...res.summary,
    },
    series: (res.series || []).map((s) => ({
      day: s.day,
      costPerStop: s.cost_per_stop,
      ...s,
    })),
    updatedAt: res.updated_at || new Date().toISOString(),
  };
}

export async function getFailedDeliveries(periodKey = 'this_week') {
  const res = await api.get('/analytics/failed-deliveries', { period_key: periodKey });
  return {
    ...res,
    summary: {
      failedCount: res.summary.failed_count,
      failureRate: res.summary.failure_rate,
      changeFromPreviousWeek: res.summary.change_from_previous_week,
      ...res.summary,
    },
    reasons: (res.reasons || []).map((r) => ({
      reason: r.reason,
      count: r.count,
    })),
    daily: (res.daily || []).map((d) => ({
      day: d.day,
      count: d.count,
    })),
    updatedAt: res.updated_at || new Date().toISOString(),
  };
}
