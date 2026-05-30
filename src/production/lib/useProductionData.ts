import { useCallback, useEffect, useState } from 'react';
import {
  listPresses, listJobs, listWorkers, listNCRs, getShopFloorSettings,
  listCompounds, listProducts,
} from './db';
import { useRealtimeTables } from './useRealtimeTable';
import type {
  Press, ProductionJob, Worker, NCR, ShopFloorSettings, Compound, Product,
} from './types';

export interface ProductionData {
  presses: Press[];
  jobs: ProductionJob[];
  workers: Worker[];
  ncrs: NCR[];
  settings: ShopFloorSettings | null;
  compounds: Compound[];
  products: Product[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useProductionData(): ProductionData {
  const [presses, setPresses] = useState<Press[]>([]);
  const [jobs, setJobs]       = useState<ProductionJob[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [ncrs, setNCRs]       = useState<NCR[]>([]);
  const [settings, setSettings] = useState<ShopFloorSettings | null>(null);
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [p, j, w, n, s, c, pr] = await Promise.all([
      listPresses(), listJobs(), listWorkers(), listNCRs(),
      getShopFloorSettings(), listCompounds(), listProducts(),
    ]);
    setPresses(p); setJobs(j); setWorkers(w); setNCRs(n); setSettings(s);
    setCompounds(c); setProducts(pr);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useRealtimeTables(
    [
      'prod_jobs', 'prod_presses', 'prod_workers',
      'prod_ncrs', 'prod_shop_floor_settings', 'prod_job_stage_events',
      'prod_products', 'prod_compounds', 'prod_boms',
    ],
    refresh,
  );

  return { presses, jobs, workers, ncrs, settings, compounds, products, loading, refresh };
}
