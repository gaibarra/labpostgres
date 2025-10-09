import { apiClient } from './apiClient';

export async function listAntibiotics({ q = '', className = '', active = null, page = 1, pageSize = 100, sort = 'name' } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (className) params.set('class', className);
  if (active !== null) params.set('active', active ? 'true' : 'false');
  if (page) params.set('page', String(page));
  if (pageSize) params.set('pageSize', String(pageSize));
  if (sort) params.set('sort', sort);
  return apiClient.get(`/antibiotics?${params.toString()}`);
}

export async function listAntibioticClasses() {
  return apiClient.get('/antibiotics/classes');
}

export async function getAntibiogramResults({ work_order_id, analysis_id = null, isolate_no = 1 }) {
  const params = new URLSearchParams();
  if (!work_order_id) throw new Error('work_order_id requerido');
  params.set('work_order_id', work_order_id);
  if (analysis_id) params.set('analysis_id', analysis_id);
  if (isolate_no) params.set('isolate_no', String(isolate_no));
  return apiClient.get(`/antibiogram/results?${params.toString()}`);
}

export async function upsertAntibiogramResults(payload) {
  return apiClient.post('/antibiogram/results', payload);
}

export async function deleteAntibiogramResults(payload) {
  return apiClient.delete('/antibiogram/results', { method: 'DELETE', body: payload });
}

export default {
  listAntibiotics,
  listAntibioticClasses,
  getAntibiogramResults,
  upsertAntibiogramResults,
  deleteAntibiogramResults,
};
