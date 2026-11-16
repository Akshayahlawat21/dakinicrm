import test from 'node:test';
import assert from 'node:assert/strict';
import { DASHBOARD_PERIOD_OPTIONS, getDashboardAnalyticsPeriod, getDashboardDateFilter } from '../dashboardPeriods.js';

test('dashboard offers All time alongside existing date presets', () => {
  assert.deepEqual(DASHBOARD_PERIOD_OPTIONS.map((item) => item.label), [
    'All time', 'This week', 'This month', 'This quarter', 'Year to date'
  ]);
});

test('All time maps to the unbounded analytics and client-side filters', () => {
  assert.equal(getDashboardAnalyticsPeriod('All time'), 'all_time');
  assert.equal(getDashboardDateFilter('All time'), 'all');
});

test('existing presets preserve their original mappings', () => {
  assert.equal(getDashboardAnalyticsPeriod('This week'), 'week');
  assert.equal(getDashboardAnalyticsPeriod('This month'), 'month');
  assert.equal(getDashboardAnalyticsPeriod('This quarter'), 'quarter');
  assert.equal(getDashboardAnalyticsPeriod('Year to date'), 'ytd');
});
