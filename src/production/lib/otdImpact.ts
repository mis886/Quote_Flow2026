// ─────────────────────────────────────────────────────────────────
// OTD Impact engine — pure functions, no Supabase calls.
// Ports v2 mock (MRT_ERP_Phase1_2_v2.html lines 1484-1545).
// ─────────────────────────────────────────────────────────────────

import type { ProductionJob, JobStage } from './types';

export interface Headcount { finishers: number; inspectors: number; }
export type Risk = 'safe' | 'atrisk' | 'breach';

export interface JobRatesHint {
  setupTime?: number;   // hrs
  finishRate?: number;  // pcs/finisher/hr
  inspRate?: number;    // pcs/inspector/hr
  pdiTime?: number;     // hrs/job
  cureTime?: number;    // min
  cavities?: number;
}

const DEFAULTS: Required<JobRatesHint> = {
  setupTime: 0.5, finishRate: 10, inspRate: 20, pdiTime: 0.25,
  cureTime: 18, cavities: 2,
};

export function calcMouldRate(rates: JobRatesHint = {}): number {
  const cureTime = rates.cureTime ?? DEFAULTS.cureTime;
  const cavities = rates.cavities ?? DEFAULTS.cavities;
  return (60 / cureTime) * cavities;
}

export function calcJobRemainingTAT(
  job: ProductionJob,
  hc: Headcount,
  rates: JobRatesHint = {}
): number {
  // Pull rates from the job's own cure/cavity columns where available,
  // otherwise fall back to the hints/defaults. Phase 3 will source rates
  // from the product master.
  const r: Required<JobRatesHint> = {
    setupTime: rates.setupTime ?? DEFAULTS.setupTime,
    finishRate: rates.finishRate ?? DEFAULTS.finishRate,
    inspRate: rates.inspRate ?? DEFAULTS.inspRate,
    pdiTime: rates.pdiTime ?? DEFAULTS.pdiTime,
    cureTime: job.cure_time_min ?? rates.cureTime ?? DEFAULTS.cureTime,
    cavities: job.cavities ?? rates.cavities ?? DEFAULTS.cavities,
  };
  const stages: JobStage[] = ['moulding', 'finishing', 'inspection', 'pdi'];
  const curIdx = stages.indexOf(job.stage);
  if (curIdx === -1) return 0; // queued or already past pdi

  const qtyRem = Math.max(0, job.qty - (job.qty_done || 0));
  let hrs = 0;
  stages.forEach((s, i) => {
    if (i < curIdx) return;
    const q = i === curIdx ? qtyRem : job.qty;
    if (s === 'moulding')   hrs += q / calcMouldRate(r) + r.setupTime;
    if (s === 'finishing')  hrs += q / Math.max(1, r.finishRate * hc.finishers);
    if (s === 'inspection') hrs += q / Math.max(1, r.inspRate   * hc.inspectors);
    if (s === 'pdi')        hrs += r.pdiTime;
  });
  return hrs;
}

export interface JobImpact {
  job: ProductionJob;
  remHrs: number;
  projEnd: Date;
  promised: Date | null;
  bufferHrs: number;
  risk: Risk;
  otHrs: number;
  extraWorkers: number;
}

export function getJobImpact(
  job: ProductionJob,
  hc: Headcount,
  now: Date = new Date()
): JobImpact {
  const remHrs   = calcJobRemainingTAT(job, hc);
  const projEnd  = new Date(now.getTime() + remHrs * 3_600_000);
  const promised = job.promised_date
    ? new Date(job.promised_date + 'T17:00:00')
    : null;
  const bufferHrs = promised ? (promised.getTime() - projEnd.getTime()) / 3_600_000 : 0;
  let risk: Risk = 'safe';
  if (promised) {
    if (bufferHrs < 0) risk = bufferHrs < -8 ? 'breach' : 'atrisk';
  }
  const otHrs = risk !== 'safe' ? Math.ceil(Math.abs(bufferHrs) * 10) / 10 : 0;
  return { job, remHrs, projEnd, promised, bufferHrs, risk, otHrs, extraWorkers: 0 };
}

export function getOTDImpactSummary(jobs: ProductionJob[], hc: Headcount) {
  const impacts = jobs
    .filter(j => ['moulding', 'finishing', 'inspection', 'pdi'].includes(j.stage))
    .map(j => getJobImpact(j, hc));
  return {
    safe:   impacts.filter(i => i.risk === 'safe').length,
    atrisk: impacts.filter(i => i.risk === 'atrisk').length,
    breach: impacts.filter(i => i.risk === 'breach').length,
    impacts,
  };
}
