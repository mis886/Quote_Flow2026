// ─────────────────────────────────────────────────────────────────
// Production (BETA) — data hook
// One hook owns all production state. Lives ONLY in the Beta module
// so the CRM AppProvider is never touched.
// ─────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import {
  listPresses, listJobs, listWorkers, listNCRs, getShopFloorSettings,
} from './db';
import type {
  Press, ProductionJob, Worker, NCR, ShopFloorSettings,
} from './types';

export interface ProductionData {
  presses: Press[];
  jobs: ProductionJob[];
  workers: Worker[];
  ncrs: NCR[];
  settings: ShopFloorSettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useProductionData(): ProductionData {
  const [presses, setPresses] = useState<Press[]>([]);
  const [jobs, setJobs]       = useState<ProductionJob[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [ncrs, setNCRs]       = useState<NCR[]>([]);
  const [settings, setSettings] = useState<ShopFloorSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [p, j, w, n, s] = await Promise.all([
      listPresses(), listJobs(), listWorkers(), listNCRs(), getShopFloorSettings(),
    ]);
    setPresses(p); setJobs(j); setWorkers(w); setNCRs(n); setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { presses, jobs, workers, ncrs, settings, loading, refresh };
}
