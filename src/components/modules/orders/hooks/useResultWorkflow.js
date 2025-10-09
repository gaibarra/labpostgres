// Experimental unified workflow (no breaking changes yet)
// Goal: Centralize result lifecycle: draft -> validated -> reported -> delivered
// Provides: prepareDraft, applyEdits, validateAndLock, reopenForCorrection, markDelivered
// NOTE: Currently a skeleton to guide incremental refactor.
import { useRef, useCallback } from 'react';
import apiClient from '@/lib/apiClient';

export function useResultWorkflow() {
  const stateRef = useRef({ stage: 'idle', lastOrderId: null });

  const prepareDraft = useCallback((order) => {
    stateRef.current = { stage: 'draft', lastOrderId: order?.id };
    return { ...order };
  }, []);

  const applyEdits = useCallback((orderId, draftResults) => {
    if (stateRef.current.lastOrderId !== orderId) stateRef.current.lastOrderId = orderId;
    stateRef.current.stage = 'editing';
    return draftResults;
  }, []);

  const persistDraft = useCallback(async (orderId, draftResults, meta = {}) => {
    const payload = { results: draftResults, status: meta.status || 'Pendiente', validation_notes: meta.validation_notes || '' };
    const saved = await apiClient.put(`/work-orders/${orderId}`, payload);
    return saved;
  }, []);

  const validateAndLock = useCallback(async (orderId) => {
    const updated = await apiClient.post(`/work-orders/${orderId}/validate`, {});
    stateRef.current.stage = 'validated';
    return updated;
  }, []);

  const reopenForCorrection = useCallback(async (orderId) => {
    const updated = await apiClient.post(`/work-orders/${orderId}/reopen`, {});
    stateRef.current.stage = 'editing';
    return updated;
  }, []);

  const markDelivered = useCallback(async (orderId) => {
    const delivered = await apiClient.post(`/work-orders/${orderId}/send-report`, {});
    stateRef.current.stage = 'delivered';
    return delivered;
  }, []);

  return {
    stage: stateRef.current.stage,
    prepareDraft,
    applyEdits,
    persistDraft,
    validateAndLock,
    reopenForCorrection,
    markDelivered
  };
}
