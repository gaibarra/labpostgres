function parsePagination(query) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize || query.limit || '25', 10), 1), 200);
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset, limit: pageSize };
}

function buildMeta({ page, pageSize, total }) {
  const pageCount = Math.ceil(total / pageSize) || 1;
  return { page, pageSize, total, pageCount, hasNext: page < pageCount };
}

function buildSearchFilter(search, columns) {
  if (!search || !columns?.length) return { clause: '', params: [] };
  const like = `%${search.toLowerCase()}%`;
  const clause = columns.map((c,i)=>`LOWER(${c}) LIKE $${i+1}`).join(' OR ');
  return { clause: `(${clause})`, params: Array(columns.length).fill(like) };
}

module.exports = { parsePagination, buildMeta, buildSearchFilter };
