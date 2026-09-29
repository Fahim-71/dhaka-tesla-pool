import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Load data now, then re-load it every `intervalMs` while the tab is visible.
 * This is how screens see ride status changes without websockets
 * (see docs/architecture.md, "Trade-offs").
 *
 * Returns { data, error, loading, refresh }:
 * - loading is true only for the very first load (no flicker on refreshes)
 * - refresh() re-loads immediately, e.g. right after pressing a button
 */
export function usePolling(load, intervalMs = 4000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      const result = await loadRef.current();
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);

  return { data, error, loading, refresh };
}
