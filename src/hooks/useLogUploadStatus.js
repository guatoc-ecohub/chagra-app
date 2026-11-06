import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks the current log's upload status without changing the durable queue.
 * A local save starts as "syncing" when the browser has a connection; the
 * sync manager moves it to "pending" after a failed attempt and the receipt
 * event moves it to "synced".
 */
export default function useLogUploadStatus() {
  const [status, setStatus] = useState('idle');
  const receiptRef = useRef({ id: null, status: 'idle' });

  const setForReceipt = useCallback((id, nextStatus) => {
    if (!id || receiptRef.current.id !== id) return;
    receiptRef.current.status = nextStatus;
    setStatus(nextStatus);
  }, []);

  useEffect(() => {
    const onSynced = (event) => {
      const logId = event.detail?.result?.data?.id;
      setForReceipt(logId, 'synced');
    };
    const onPending = (event) => {
      setForReceipt(event.detail?.logId, 'pending');
    };

    window.addEventListener('chagra:log-synced', onSynced);
    window.addEventListener('chagra:log-sync-pending', onPending);
    return () => {
      window.removeEventListener('chagra:log-synced', onSynced);
      window.removeEventListener('chagra:log-sync-pending', onPending);
    };
  }, [setForReceipt]);

  const beginUpload = useCallback((id, online) => {
    const nextStatus = online ? 'syncing' : 'pending';
    receiptRef.current = { id, status: nextStatus };
    setStatus(nextStatus);
  }, []);

  const confirmUpload = useCallback((id) => setForReceipt(id, 'synced'), [setForReceipt]);

  const resetUpload = useCallback(() => {
    receiptRef.current = { id: null, status: 'idle' };
    setStatus('idle');
  }, []);

  const currentStatus = useCallback(() => receiptRef.current.status, []);

  return { status, beginUpload, confirmUpload, resetUpload, currentStatus };
}
