// Production workflow actions. Each one writes to `prod_*` tables only.

import {
  updateJob, updatePress, logStageEvent, listPresses, listJobs,
} from './db';
import type { JobStage } from './types';

export async function assignJobToPress(jobId: string, pressId: string) {
  const [presses, jobs] = await Promise.all([listPresses(), listJobs()]);
  const job   = jobs.find(j => j.id === jobId);
  const press = presses.find(p => p.id === pressId);
  if (!job || !press) throw new Error('Job or press not found');
  if (press.status !== 'idle') throw new Error(`${press.name} is ${press.status}`);

  await updateJob(jobId, {
    press_id: pressId,
    stage: 'moulding',
    status: 'setup',
  });
  await updatePress(pressId, {
    active_job_id: jobId,
    status: 'setup',
    pct_done: 5,
    eta_text: `Setting up ${job.mould_code || 'mould'}`,
  });
  await logStageEvent(jobId, 'moulding', job.stage as JobStage, null, `Assigned to ${press.name}`);
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

  // Press currently running → moulding complete; advance job.
  await updateJob(job.id, {
    stage: 'finishing',
    status: 'in-progress',
    press_id: null,
  });
  await updatePress(pressId, {
    active_job_id: null,
    status: 'idle',
    pct_done: 0,
    eta_text: 'Awaiting next job',
  });
  await logStageEvent(job.id, 'finishing', 'moulding', null, 'Moulding complete');
}
