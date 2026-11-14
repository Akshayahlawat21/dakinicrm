import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRevenueMonthLabel } from '../revenueTrend.js';

test('formats ISO date and ISO timestamp month values', () => {
  assert.equal(formatRevenueMonthLabel('2026-06-01'), 'Jun 26');
  assert.equal(formatRevenueMonthLabel('2026-11-01T00:00:00Z'), 'Nov 26');
});

test('formats YYYY-MM month values', () => {
  assert.ok(['Sep 26', 'Sept 26'].includes(formatRevenueMonthLabel('2026-09')));
});

test('never renders Invalid Date for missing or malformed month values', () => {
  assert.equal(formatRevenueMonthLabel(null), 'Unknown period');
  assert.equal(formatRevenueMonthLabel('not-a-date'), 'not-a-date');
});
