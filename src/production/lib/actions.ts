// Production workflow actions. Each one writes to `prod_*` tables only.

import {
  updateJob, updatePress, logStageEvent, listPresses, listJobs,
  insertNCR, setWorkerPresent,
} from './db';
import type { JobStage } from './types';

// ── Press / Moulding ──────────────────────────────────────────────

export async function assignJobsToPress(jobIds: string[], pressId: string) {
  if (jobIds.length === 0) return;
  const [presses, jobs] = await Promise.all([listPresses(), listJobs()]);
  const press = presses.find(p => p.id === pressId);
  if (!press) throw new Error('Press not found');
  if (press.status !== 'idle') throw new Error(`${press.name} is ${press.status}`);

  // Update every selected job: stage→moulding, status→queued, press_id assigned.
  // Only the FIRST job becomes active on the press card (status='setup'); the
  // rest remain status='queued' so the operator works through them.
  const [firstId, ...restIds] = jobIds;
  const firstJob = jobs.find(j => j.id === firstId);
  if (!firstJob) throw new Error('First job not found');

  await updateJob(firstId, {
    press_id: pressId, stage: 'moulding', status: 'setup',
  });
  for (const id of restIds) {
    await updateJob(id, {
      press_id: pressId, stage: 'moulding', status: 'queued',
    });
  }

  await updatePress(pressId, {
    active_job_id: firstId,
    status: 'setup',
    pct_done: 5,
    eta_text: jobIds.length > 1
      ? `Setting up ${firstJob.mould_code || 'mould'} · +${restIds.length} queued`
      : `Setting up ${firstJob.mould_code || 'mould'}`,
  });

  await logStageEvent(firstId, 'moulding', firstJob.stage as JobStage, null,
    jobIds.length > 1 ? `Assigned to ${press.name} (batch of ${jobIds.length})` : `Assigned to ${press.name}`);
  for (const id of restIds) {
    await logStageEvent(id, 'moulding', null, null, `Queued on ${press.name} after ${firstId}`);
  }
}

// Kept as a thin wrapper for single-job press assignment.
export async function assignJobToPress(jobId: string, pressId: string) {
  return assignJobsToPress([jobId], pressId);
}

export async function markPressDone(pressId: string) {
  const [presses, jobs] = await Promise.all([listPresses(), listJobs()]);
  const press = presses.find(p => p.id === pressId);
  if (!press || !press.active_job_id) throw new Error('No active job on press');
  const job = jobs.find(j => j.id === press.active_job_id);
  if (!job) throw new Error('Job not found');

  // Setup → Running is a soft toggle; otherwise advance to Finishing.
  if (press.status === 'setup') {
    await updatePress(pressId, {
      status: 'running', pct_done: 10, eta_text: '~35 min',
    });
    await updateJob(job.id, { status: 'running' });
    return;
  }

  // Press currently running → moulding complete on the active job.
  // Promote the next queued job on this press (if any) into active.
  const nextOnPress = jobs.find(j =>
    j.press_id === pressId && j.id !== job.id && j.stage === 'moulding' && j.status === 'queued'
  );

  await updateJob(job.id, {
    stage: 'finishing',
    status: 'in-progress',
    press_id: null,
  });
  await logStageEvent(job.id, 'finishing', 'moulding', null, 'Moulding complete');

  if (nextOnPress) {
    await updateJob(nextOnPress.id, { status: 'setup' });
    await updatePress(pressId, {
      active_job_id: nextOnPress.id,
      status: 'setup',
      pct_done: 5,
      eta_text: `Setting up ${nextOnPress.mould_code || 'mould'}`,
    });
  } else {
    await updatePress(pressId, {
      active_job_id: null,
      status: 'idle',
      pct_done: 0,
      eta_text: 'Awaiting next job',
    });
  }
}

// Advance a specific job to the next stage (used by tables, not press card).
export async function advanceJob(jobId: string, toStage: JobStage) {
  const jobs = await listJobs();
  const job = jobs.find(j => j.id === jobId);
  if (!job) throw new Error('Job not found');
  const status =
    toStage === 'dispatch'   ? 'ready' :
    toStage === 'finishing'  ? 'in-progress' :
    toStage === 'inspection' ? 'pending' :
    toStage === 'pdi'        ? 'awaiting' :
    toStage === 'dispatched' ? 'dispatched' :
    'in-progress';
  await updateJob(jobId, { stage: toStage, status });
  await logStageEvent(jobId, toStage, job.stage as JobStage, null, null);
}

// ── Finishing ─────────────────────────────────────────────────────

export async function setJobQtyDone(jobId: string, qtyDone: number) {
  await updateJob(jobId, { qty_done: Math.max(0, Math.floor(qtyDone)) });
}

// ── Inspection ────────────────────────────────────────────────────

export async function passInspection(jobId: string, inspector?: string) {
  const jobs = await listJobs();
  const job = jobs.find(j => j.id === jobId);
  if (!job) throw new Error('Job not found');
  await updateJob(jobId, {
    status: 'passed',
    inspection_result: 'passed',
    inspector: inspector ?? job.inspector ?? null,
    inspection_passed_at: new Date().toISOString(),
  });
  await logStageEvent(jobId, 'inspection', 'inspection', inspector || null, 'Inspection passed');
  await advanceJob(jobId, 'pdi');
}

export async function raiseNCR(
  jobId: string,
  payload: {
    defect_desc: string;
    defect_code: string;
    responsible_stage: string;
    action: 'rework' | 'reject';
  }
) {
  const jobs = await listJobs();
  const job = jobs.find(j => j.id === jobId);
  if (!job) throw new Error('Job not found');
  const ncrId = `NCR-${Date.now()}`;
  await insertNCR({
    id: ncrId,
    job_id: jobId,
    defect_desc: payload.defect_desc,
    defect_code: payload.defect_code,
    responsible_stage: payload.responsible_stage,
    action: payload.action,
  });
  await updateJob(jobId, {
    status: 'ncr',
    inspection_result: 'ncr',
  });
  await logStageEvent(jobId, 'inspection', 'inspection', null,
    `NCR: ${payload.defect_code} → ${payload.action}`);
}

export async function reworkFromNCR(jobId: string) {
  const jobs = await listJobs();
  const job = jobs.find(j => j.id === jobId);
  if (!job) throw new Error('Job not found');
  await updateJob(jobId, {
    stage: 'finishing',
    status: 'queued',
    qty_done: 0,
  });
  await logStageEvent(jobId, 'finishing', 'inspection', null, 'Re-routed to Finishing for rework');
}

// ── PDI ───────────────────────────────────────────────────────────

export async function approvePDI(jobId: string, officer: string) {
  const jobs = await listJobs();
  const job = jobs.find(j => j.id === jobId);
  if (!job) throw new Error('Job not found');
  await updateJob(jobId, {
    pdi_officer: officer,
    status: 'ready',
    stage: 'dispatch',
  });
  await logStageEvent(jobId, 'dispatch', 'pdi', officer, 'PDI approved');
}

// ── Dispatch ──────────────────────────────────────────────────────

export async function confirmDispatch(
  jobId: string,
  payload: { courier: string; consignment_no: string }
) {
  const jobs = await listJobs();
  const job = jobs.find(j => j.id === jobId);
  if (!job) throw new Error('Job not found');

  const promised = job.promised_date ? new Date(job.promised_date + 'T17:00:00') : null;
  const now = new Date();
  const onTime = promised ? now.getTime() <= promised.getTime() : true;

  await updateJob(jobId, {
    courier: payload.courier,
    consignment_no: payload.consignment_no,
    stage: 'dispatched',
    status: onTime ? 'dispatched' : 'late',
    otd_result: onTime ? 'on-time' : 'late',
    dispatched_at: now.toISOString(),
  });
  await logStageEvent(jobId, 'dispatched', 'dispatch', null,
    `Dispatched via ${payload.courier} · ${onTime ? 'On Time' : 'LATE'}`);
}

// ── Shift Briefing ────────────────────────────────────────────────

export async function toggleWorkerPresence(id: string, present: boolean) {
  await setWorkerPresent(id, present);
}
