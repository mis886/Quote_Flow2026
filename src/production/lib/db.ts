// ─────────────────────────────────────────────────────────────────
// Production (BETA) — Supabase data access
// All queries hit `prod_*` tables only. Beta is read-only on CRM.
// ─────────────────────────────────────────────────────────────────

import { supabase } from '../../lib/supabase';
import type {
  Press, ProductionJob, Worker, NCR, ShopFloorSettings,
  JobStage, Compound, Product, BOMRow,
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

// ── Compounds ──────────────────────────────────────────────────────
export async function listCompounds(): Promise<Compound[]> {
  const { data, error } = await supabase
    .from('prod_compounds')
    .select('*')
    .order('code');
  if (error) { console.error('listCompounds', error); return []; }
  return data || [];
}

export async function upsertCompound(c: Partial<Compound> & { id: string }): Promise<Compound> {
  const { data, error } = await supabase
    .from('prod_compounds')
    .upsert({ ...c, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as Compound;
}

export async function deleteCompound(id: string) {
  const { error } = await supabase.from('prod_compounds').delete().eq('id', id);
  if (error) throw error;
}

// ── Products ───────────────────────────────────────────────────────
export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('prod_products')
    .select('*')
    .order('code');
  if (error) { console.error('listProducts', error); return []; }
  return data || [];
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('prod_products')
    .select('*')
    .eq('id', id)
    .single();
  if (error) { console.error('getProduct', error); return null; }
  return data as Product;
}

export async function upsertProduct(p: Partial<Product> & { id: string; code: string; name: string }): Promise<Product> {
  const { data, error } = await supabase
    .from('prod_products')
    .upsert({ ...p, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('prod_products').delete().eq('id', id);
  if (error) throw error;
}

// ── BOM ────────────────────────────────────────────────────────────
export async function listBOMForProduct(productId: string): Promise<BOMRow[]> {
  const { data, error } = await supabase
    .from('prod_boms')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order');
  if (error) { console.error('listBOM', error); return []; }
  return data || [];
}

export async function addBOMRow(row: Omit<BOMRow, 'id' | 'created_at'>): Promise<BOMRow> {
  const { data, error } = await supabase
    .from('prod_boms')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as BOMRow;
}

export async function updateBOMRow(id: number, patch: Partial<BOMRow>) {
  const { error } = await supabase.from('prod_boms').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteBOMRow(id: number) {
  const { error } = await supabase.from('prod_boms').delete().eq('id', id);
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
