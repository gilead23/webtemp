/**
 * Minimal run store — local state + polling.
 *
 * This module provides a zustand-free, dependency-free hook that exposes the
 * same surface the consuming page already uses:
 *   { loadRun, startPolling, stop, run, summary, perms }
 *
 * It polls the artifact client every few seconds while mounted.
 */

import { useEffect, useRef, useState } from 'react';
import { artifactClient } from '../services/artifactClient';

type Perm = { status?: string; [k: string]: any };

export interface RunStoreApi {
  loadRun: (id: string) => Promise<void>;
  startPolling: (id: string) => void;
  stop: () => void;
  run: any;
  summary: any[];
  perms: Record<string, Perm>;
}

const POLL_MS = 4000;

export function useRunStore(): RunStoreApi {
  const [run, setRun] = useState<any>(null);
  const [summary, setSummary] = useState<any[]>([]);
  const [perms, setPerms] = useState<Record<string, Perm>>({});
  const timerRef = useRef<number | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const fetchOnce = async (id: string) => {
    try {
      const client = artifactClient as any;
      const header =
        (client.getRunHeader && (await client.getRunHeader(id))) ||
        (client.getHeader && (await client.getHeader(id))) ||
        null;
      if (!aliveRef.current) return;
      if (header) setRun(header);

      // Summary (profit-factor per permutation, etc.) — best-effort lookup
      let sum: any[] = [];
      if (client.getSummary) {
        try { sum = (await client.getSummary(id)) || []; } catch { /* ignore */ }
      }
      if (Array.isArray(sum) && aliveRef.current) setSummary(sum);

      // Permutation map — best-effort lookup
      let p: Record<string, Perm> = {};
      if (client.getPermutations) {
        try {
          const raw = await client.getPermutations(id);
          if (Array.isArray(raw)) {
            raw.forEach((row: any, i: number) => {
              const key = row?.perm_id ?? row?.id ?? String(i);
              p[key] = row;
            });
          } else if (raw && typeof raw === 'object') {
            p = raw as Record<string, Perm>;
          }
        } catch { /* ignore */ }
      }
      if (aliveRef.current) setPerms(p);
    } catch {
      // swallow network errors — UI will just keep the last good state
    }
  };

  const loadRun = async (id: string) => {
    await fetchOnce(id);
  };

  const startPolling = (id: string) => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => { void fetchOnce(id); }, POLL_MS);
  };

  const stop = () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  return { loadRun, startPolling, stop, run, summary, perms };
}
