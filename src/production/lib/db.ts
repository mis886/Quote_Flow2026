// ─────────────────────────────────────────────────────────────────
// Production (BETA) — Supabase data access
// All queries hit `prod_*` tables only. Beta is read-only on CRM.
// ─────────────────────────────────────────────────────────────────

import { supabase } from '../../lib/supabase';
import type {
  Press, ProductionJob, Worker, NCR, ShopFloorSettings,
  JobStage,
} from './types';

// ── Presses ────────────────────────────────────────────────────────
export async function listPresses(): Promise<Press[]> {
  const { data, error } = await supabase
    .from('prod_presses')
    .select('*')
    .order('id');
  if (error) { console.error('listPresses', error); return []; }
  return data || [];
}

export async function updatePress(id: string, patch: Partial<Press>) {
  const { error } = await supabase
    .from('prod_presses')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Jobs ───────────────────────────────────────────────────────────
export async function listJobs(): Promise<ProductionJob[]> {
  const { data, error } = await supabase
    .from('prod_jobs')
    .select('*')
    .order('promised_date', { ascending: true, nullsFirst: false });
  if (error) { console.error('listJobs', error); return []; }
  return data || [];
}

export async function insertJob(job: ProductionJob): Promise<ProductionJob> {
  const { data, error } = await supabase
    .from('prod_jobs')
    .insert(job)
    .select()
    .single();
  if (error) throw error;
  return data as ProductionJob;
}

export async function updateJob(id: string, patch: Partial<ProductionJob>) {
  const { error } = await supabase
    .from('prod_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function logStageEvent(
  job_id: string,
  to_stage: JobStage,
  from_stage: JobStage | null,
  actor: string | null = null,
  notes: string | null = null
) {
  await supabase.from('prod_job_stage_events').insert({
    job_id, from_stage, to_stage, actor, notes,
  });
}

// ── Workers ────────────────────────────────────────────────────────
export async function listWorkers(): Promise<Worker[]> {
  const { data, error } = await supabase
    .from('prod_workers')
    .select('*')
    .order('id');
  if (error) { console.error('listWorkers', error); return []; }
  return data || [];
}

export async function setWorkerPresent(id: string, present: boolean) {
  const { error } = await supabase
    .from('prod_workers')
    .update({ present, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── NCRs ───────────────────────────────────────────────────────────
export async function listNCRs(): Promise<NCR[]> {
  const { data, error } = await supabase
    .from('prod_ncrs')
    .select('*')
    .order('raised_at', { ascending: false });
  if (error) { console.error('listNCRs', error); return []; }
  return data || [];
}

export async function insertNCR(ncr: NCR) {
  const { error } = await supabase.from('prod_ncrs').insert(ncr);
  if (error) throw error;
}

// ── Shop-floor settings ────────────────────────────────────────────
export async function getShopFloorSettings(): Promise<ShopFloorSettings | null> {
  const { data, error } = await supabase
    .from('prod_shop_floor_settings')
    .select('*')
    .eq('id', 'config')
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error('getShopFloorSettings', error);
    return null;
  }
  return data || null;
}

export async function updateShopFloorSettings(patch: Partial<ShopFloorSettings>) {
  const { error } = await supabase
    .from('prod_shop_floor_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 'config');
  if (error) throw error;
}

// ── ID generator (MRT-YYYY-NNN like existing convention) ───────────
export function nextJobId(existingIds: string[]): string {
  const yr = new Date().getFullYear();
  let max = 0;
  for (const id of existingIds) {
    const m = id.match(/^MRT-\d+-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `MRT-${yr}-${String(max + 1).padStart(3, '0')}`;
}
