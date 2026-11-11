export function formatRevenueMonthLabel(rawMonth, locale) {
  if (rawMonth == null || rawMonth === '') return 'Unknown period';
  let date = rawMonth instanceof Date ? rawMonth : null;
  const value = String(rawMonth).trim();
  if (!date) {
    const yearMonth = value.match(/^(\d{4})[-/](\d{1,2})$/);
    if (yearMonth) date = new Date(Number(yearMonth[1]), Number(yearMonth[2]) - 1, 1);
    else date = new Date(value);
  }
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  }
  return value || 'Unknown period';
}
