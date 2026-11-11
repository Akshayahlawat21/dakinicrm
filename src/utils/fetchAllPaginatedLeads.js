/**
 * Fetch every permission-scoped page from the Leads API.
 * The API remains the source of truth; this helper stores no records in browser storage.
 */
export async function fetchAllPaginatedLeads(fetchPage, { pageSize = 100, concurrency = 4 } = {}) {
  if (typeof fetchPage !== 'function') throw new TypeError('fetchPage must be a function');
  const first = await fetchPage({ skip: 0, limit: pageSize });
  const firstRows = first?.data?.data;
  if (!first?.success || !Array.isArray(firstRows)) {
    throw new Error(first?.error?.message || first?.error || 'Unable to retrieve leads from the database.');
  }
  const total = Math.max(firstRows.length, Number(first.data.total) || firstRows.length);
  const allRows = [...firstRows];
  const pageCount = Math.ceil(total / pageSize);
  const batchSize = Math.max(1, Math.min(8, Number(concurrency) || 4));

  for (let startPage = 1; startPage < pageCount; startPage += batchSize) {
    const pageNumbers = Array.from(
      { length: Math.min(batchSize, pageCount - startPage) },
      (_, index) => startPage + index
    );
    const responses = await Promise.all(pageNumbers.map((pageNo) =>
      fetchPage({ skip: pageNo * pageSize, limit: pageSize })
    ));
    for (const response of responses) {
      if (!response?.success || !Array.isArray(response.data?.data)) {
        throw new Error(response?.error?.message || response?.error || 'A page of leads could not be loaded.');
      }
      allRows.push(...response.data.data);
    }
  }
  return allRows;
}
