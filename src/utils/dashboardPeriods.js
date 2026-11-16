export const DASHBOARD_PERIOD_OPTIONS = [
  { label: 'All time', analyticsPeriod: 'all_time', dateFilter: 'all' },
  { label: 'This week', analyticsPeriod: 'week', dateFilter: 'week' },
  { label: 'This month', analyticsPeriod: 'month', dateFilter: 'month' },
  { label: 'This quarter', analyticsPeriod: 'quarter', dateFilter: 'quarter' },
  { label: 'Year to date', analyticsPeriod: 'ytd', dateFilter: 'ytd' },
];

export function getDashboardPeriodOption(label) {
  return DASHBOARD_PERIOD_OPTIONS.find((option) => option.label === label)
    || DASHBOARD_PERIOD_OPTIONS.find((option) => option.label === 'This month');
}

export function getDashboardAnalyticsPeriod(label) {
  return getDashboardPeriodOption(label).analyticsPeriod;
}

export function getDashboardDateFilter(label) {
  return getDashboardPeriodOption(label).dateFilter;
}
