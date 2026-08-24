'use client';

import { useEffect, useRef, useState } from 'react';

const CLIENT_ID_KEY = 'midnight-club-client-id';

function clientId() {
  const existing = window.localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  window.localStorage.setItem(CLIENT_ID_KEY, generated);
  return generated;
}

export function useProgressSync<T>({ snapshot, restore }: { snapshot: T; restore: (progress: T) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<'loading' | 'saved' | 'saving' | 'offline'>('loading');
  const restoreRef = useRef(restore);

  useEffect(() => {
    restoreRef.current = restore;
  }, [restore]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/progress?clientId=${encodeURIComponent(clientId())}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Unable to load progress');
        const body = await response.json() as { progress: T | null };
        if (body.progress) restoreRef.current(body.progress);
        setStatus('saved');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setStatus('offline');
      } finally {
        if (!controller.signal.aborted) setLoaded(true);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus('saving');
      try {
        const response = await fetch('/api/progress', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ clientId: clientId(), progress: snapshot }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Unable to save progress');
        setStatus('saved');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setStatus('offline');
      }
    }, 700);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loaded, snapshot]);

  return { loaded, status };
}
