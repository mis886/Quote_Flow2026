-- Pipeline / Kanban support
-- Run once against the live Supabase DB (SQL editor). Idempotent.

-- Follow-up pipeline stage tracking
ALTER TABLE followups ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'Sent Quotation';
ALTER TABLE followups ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ;
ALTER TABLE followups ADD COLUMN IF NOT EXISTS outcome TEXT;

-- Backfill: any existing follow-up with no stage starts in "Sent Quotation",
-- clocked from when it was created.
UPDATE followups
   SET stage = 'Sent Quotation',
       stage_entered_at = COALESCE(stage_entered_at, created_at, NOW())
 WHERE stage IS NULL;

-- Closed follow-ups → Closed lane with a neutral outcome (adjust manually if known)
UPDATE followups
   SET stage = 'Closed'
 WHERE status = 'closed' AND (stage IS NULL OR stage <> 'Closed');

-- Per-lane TAT config (JSON map lane -> days) on the settings singleton
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS pipeline_tat JSONB;
