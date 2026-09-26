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
    label: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(start)
      + '–'
      + new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(end),
  };
}

function response(data, periodKey) {
  return { ...data, period: weekPeriod(periodKey), updatedAt: new Date().toISOString() };
}

export async function getAnalyticsPeriods() {
  return ['this_week', 'previous_week'].map((key) => weekPeriod(key));
}

export async function getDriverPerformance(periodKey = 'this_week') {
  const previousWeek = periodKey === 'previous_week';
  return response({
    summary: previousWeek
      ? { onTimePercent: 90.8, deliveriesPerDay: 169, failureRate: 3.7 }
      : { onTimePercent: 91.4, deliveriesPerDay: 178, failureRate: 3.4 },
    series: previousWeek ? [
      { day: 'Mon', onTimePercent: 91, deliveries: 166, failureRate: 3.5 },
      { day: 'Tue', onTimePercent: 92, deliveries: 171, failureRate: 3.4 },
      { day: 'Wed', onTimePercent: 90, deliveries: 165, failureRate: 3.8 },
      { day: 'Thu', onTimePercent: 88, deliveries: 162, failureRate: 4.2 },
      { day: 'Fri', onTimePercent: 92, deliveries: 175, failureRate: 3.6 },
      { day: 'Sat', onTimePercent: 91, deliveries: 174, failureRate: 3.5 },
      { day: 'Sun', onTimePercent: 90, deliveries: 171, failureRate: 3.9 },
    ] : [
      { day: 'Mon', onTimePercent: 92, deliveries: 171, failureRate: 3.1 },
      { day: 'Tue', onTimePercent: 94, deliveries: 182, failureRate: 3.0 },
      { day: 'Wed', onTimePercent: 91, deliveries: 176, failureRate: 3.6 },
      { day: 'Thu', onTimePercent: 89, deliveries: 169, failureRate: 4.1 },
      { day: 'Fri', onTimePercent: 93, deliveries: 185, failureRate: 3.2 },
      { day: 'Sat', onTimePercent: 90, deliveries: 181, failureRate: 3.5 },
      { day: 'Sun', onTimePercent: 88, deliveries: 180, failureRate: 3.9 },
    ]
  }, periodKey);
}

export async function getDeliveryCosts(periodKey = 'this_week') {
  const previousWeek = periodKey === 'previous_week';
  return response({
    summary: { averageCostPerStop: previousWeek ? 18.1 : 18.4 },
    series: previousWeek ? [
      { day: 'Mon', costPerStop: 17.4 },
      { day: 'Tue', costPerStop: 17.8 },
      { day: 'Wed', costPerStop: 18.0 },
      { day: 'Thu', costPerStop: 18.2 },
      { day: 'Fri', costPerStop: 18.7 },
      { day: 'Sat', costPerStop: 18.3 },
      { day: 'Sun', costPerStop: 18.1 },
    ] : [
      { day: 'Mon', costPerStop: 17.1 },
      { day: 'Tue', costPerStop: 17.6 },
      { day: 'Wed', costPerStop: 18.2 },
      { day: 'Thu', costPerStop: 18.8 },
      { day: 'Fri', costPerStop: 19.1 },
      { day: 'Sat', costPerStop: 18.5 },
      { day: 'Sun', costPerStop: 19.4 },
    ]
  }, periodKey);
}

export async function getFailedDeliveries(periodKey = 'this_week') {
  const previousWeek = periodKey === 'previous_week';
  return response({
    summary: previousWeek
      ? { failedCount: 40, failureRate: 3.7, changeFromPreviousWeek: -1 }
      : { failedCount: 42, failureRate: 3.4, changeFromPreviousWeek: 2 },
    reasons: previousWeek ? [
      { reason: 'Address issue', count: 16 },
      { reason: 'Customer unavailable', count: 13 },
      { reason: 'Vehicle / route delay', count: 7 },
      { reason: 'Package issue', count: 4 },
    ] : [
      { reason: 'Address issue', count: 18 },
      { reason: 'Customer unavailable', count: 12 },
      { reason: 'Vehicle / route delay', count: 8 },
      { reason: 'Package issue', count: 4 },
    ],
    daily: previousWeek ? [
      { day: 'Mon', count: 4 },
      { day: 'Tue', count: 4 },
      { day: 'Wed', count: 6 },
      { day: 'Thu', count: 7 },
      { day: 'Fri', count: 5 },
      { day: 'Sat', count: 8 },
      { day: 'Sun', count: 6 },
    ] : [
      { day: 'Mon', count: 2 },
      { day: 'Tue', count: 3 },
      { day: 'Wed', count: 4 },
      { day: 'Thu', count: 5 },
      { day: 'Fri', count: 6 },
      { day: 'Sat', count: 5 },
      { day: 'Sun', count: 7 },
    ]
  }, periodKey);
}
