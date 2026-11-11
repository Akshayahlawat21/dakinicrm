import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllPaginatedLeads } from '../fetchAllPaginatedLeads.js';

test('fetches every database page using bounded page requests', async () => {
  const calls = [];
  const fetchPage = async ({ skip, limit }) => {
    calls.push({ skip, limit });
    const rows = Array.from({ length: Math.min(limit, 235 - skip) }, (_, i) => ({ id: skip + i + 1 }));
    return { success: true, data: { data: rows, total: 235 } };
  };
  const rows = await fetchAllPaginatedLeads(fetchPage, { pageSize: 100, concurrency: 2 });
  assert.equal(rows.length, 235);
  assert.deepEqual(calls.map((call) => call.skip), [0, 100, 200]);
  assert.equal(new Set(rows.map((row) => row.id)).size, 235);
});

test('does not silently return a partial lead list when a page fails', async () => {
  const fetchPage = async ({ skip, limit }) => {
    if (skip === 100) return { success: false, error: { message: 'database unavailable' } };
    return { success: true, data: { data: Array.from({ length: 100 }, (_, i) => ({ id: skip + i })), total: 250 } };
  };
  await assert.rejects(() => fetchAllPaginatedLeads(fetchPage), /database unavailable/);
});
