// ─────────────────────────────────────────────────────────────────
// Production (BETA) — types
// Lives under src/production/ to keep the Beta module isolated.
// Never imported by CRM code.
// ─────────────────────────────────────────────────────────────────

export type JobStage =
  | 'queued' | 'moulding' | 'finishing'
  | 'inspection' | 'pdi' | 'dispatch' | 'dispatched';

export type JobStatus =
  | 'queued' | 'setup' | 'running' | 'in-progress'
  | 'passed' | 'pending' | 'ncr' | 'awaiting' | 'in-review'
  | 'ready' | 'dispatched' | 'late';

export type Priority = 'normal' | 'emergency';
export type PressStatus = 'idle' | 'setup' | 'running' | 'maintenance';
export type Department = 'finishing' | 'inspection' | 'press';

export interface ProductionJob {
  id: string;
  job_card_no?: string | null;
  order_id?: string | null;
  order_line_seq?: number | null;
  customer_id?: string | null;
  customer_name?: string | null;
  product_desc: string;
  qty: number;
  qty_to_mould?: number | null;
  qty_done?: number | null;
  promised_date?: string | null;
  lsd?: string | null;
  order_start_date?: string | null;
  target_completion_date?: string | null;
  priority: Priority;
  emergency_reason?: string | null;
  notes?: string | null;
  stage: JobStage;
  status: JobStatus;

  batch_code?: string | null;
  batch_name?: string | null;
  mould_code?: string | null;
  cavities?: number | null;
  cure_time_min?: number | null;
  cure_temp_c?: number | null;
  compound_code?: string | null;
  tikli_size?: string | null;
  press_id?: string | null;

  inspector?: string | null;
  inspection_result?: 'pending' | 'passed' | 'ncr' | null;

  pdi_officer?: string | null;
  inspection_passed_at?: string | null;

  courier?: string | null;
  consignment_no?: string | null;
  dispatched_at?: string | null;
  otd_result?: 'on-time' | 'late' | null;

  fg_stock_at_print?: number | null;
  wip_stock_at_print?: number | null;
  press_operator_name?: string | null;
  finishing_checked_by?: string | null;
  inspection_checked_by?: string | null;
  approved_by?: string | null;
  po_no?: string | null;
  type_item_moc?: string | null;

  created_at?: string;
  updated_at?: string;
}

export interface Press {
  id: string;
  name: string;
  tonnage: string;
  status: PressStatus;
  active_job_id?: string | null;
  pct_done?: number | null;
  eta_text?: string | null;
  updated_at?: string;
}

export interface Worker {
  id: string;
  name: string;
  role: string;
  department: Department;
  present: boolean;
  shift?: 'day' | 'night' | 'both' | null;  // press operators: day, night, or both shifts
  press_id?: string | null;             // press they operate (press dept only)
  updated_at?: string;
}

export interface NCR {
  id: string;
  job_id: string;
  defect_desc?: string | null;
  defect_code?: string | null;
  responsible_stage?: string | null;
  action?: 'rework' | 'reject' | null;
  raised_by?: string | null;
  raised_at?: string;
  resolved_at?: string | null;
}

export interface JobStageEvent {
  id: number;
  job_id: string;
  from_stage?: JobStage | null;
  to_stage: JobStage;
  ts: string;
  actor?: string | null;
  notes?: string | null;
}

// ── Phase 2: Product Master, Compounds, BOM ──────────────────────

export interface Compound {
  id: string;
  code: string;
  name: string;
  grade: string;
  shore_a?: number | null;
  shelf_days?: number | null;
  colour?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  customer_id?: string | null;
  customer_name?: string | null;
  compound_id?: string | null;
  mould_code?: string | null;
  cavities?: number | null;
  tonnage?: number | null;
  cure_temp_c?: number | null;
  cure_time_min?: number | null;
  shot_weight_g?: number | null;
  setup_time_hrs?: number | null;
  finish_rate?: number | null;
  insp_rate?: number | null;
  pdi_time_hrs?: number | null;
  draw_ref?: string | null;
  revision?: string | null;
  unit_cost?: number | null;
  is_active?: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BOMRow {
  id?: number;
  product_id: string;
  is_compound: boolean;
  raw_code: string;
  raw_name: string;
  qty_per_batch?: number | null;
  unit?: string | null;
  supplier?: string | null;
  kg_per_batch?: number | null;
  batches_per_run?: number | null;
  sort_order?: number;
  created_at?: string;
}

export interface ShopFloorSettings {
  id: 'config';
  shift_started: boolean;
  shift_hours: number;
  shift_hours_left: number;
  overtime_max: number;
  planned_finishers: number;
  planned_inspectors: number;
  emergency_active: boolean;
  // Per-shift config (added 2026-06-01)
  active_shift?: 'day' | 'night';
  day_shift_hours?: number;
  night_shift_hours?: number;
  day_ot_max?: number;
  night_ot_max?: number;
  day_shift_start?: string;    // HH:MM
  night_shift_start?: string;  // HH:MM
}

export interface PdiLog {
  id: string;                  // PDI-YYYY-NNNNN
  job_card_id: string;
  pdi_date: string;            // ISO date
  pdi_officer: string;
  qty_checked: number;
  passed: number;
  failed: number;
  hold: number;
  remarks?: string | null;
  entered_by?: string | null;
  order_id?: string | null;
  created_at?: string;
  corrected_at?: string | null;
  corrected_by?: string | null;
  correction_note?: string | null;
}

export interface ProdAttachment {
  id?: number;
  type: 'dpr' | 'pdi_doc' | 'other';
  shift_date: string;           // ISO date
  shift?: 'day' | 'night' | null;
  job_card_id?: string | null;
  log_entry_id?: string | null;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  uploaded_by?: string | null;
  notes?: string | null;
  created_at?: string;
}

// ── Beta: Append-only production records ─────────────────────────

export interface MoldingSession {
  id: string;                     // MLD-YYYY-NNNNN
  job_card_id: string;
  molding_date: string;           // ISO date
  shift?: string | null;          // A | B | C
  operation_type?: string | null; // Production | Trial | Rework
  press_no: string;
  die_no?: string | null;
  tikli_size?: string | null;
  cure_time_min?: number | null;
  cure_temp_c?: number | null;
  scorch_time_min?: number | null;
  die_change_min?: number | null;
  dori_khatam_min?: number | null;
  spray?: string | null;
  weight_before_g?: number | null;
  weight_after_g?: number | null;
  qty_molded: number;
  planned_qty?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  working_time_min?: number | null;
  operator_name: string;
  remarks?: string | null;
  entered_by?: string | null;
  order_id?: string | null;
  item_code?: string | null;
  our_desc?: string | null;
  type_item_moc?: string | null;
  created_at?: string;
  corrected_at?: string | null;
  corrected_by?: string | null;
  correction_note?: string | null;
}

export interface FinishingSession {
  id: string;                     // FIN-YYYY-NNNNN
  job_card_id: string;
  finishing_date: string;
  actual_qty: number;
  planned_qty?: number | null;
  working_hours?: number | null;
  finisher_name: string;
  is_rework?: boolean;
  remarks?: string | null;
  entered_by?: string | null;
  order_id?: string | null;
  die_no?: string | null;
  type_item_moc?: string | null;
  created_at?: string;
  corrected_at?: string | null;
  corrected_by?: string | null;
  correction_note?: string | null;
}

export interface InspectionSession {
  id: string;                     // INS-YYYY-NNNNN
  job_card_id: string;
  inspection_date: string;
  qty_to_inspect: number;
  qty_inspected: number;          // = qty_to_inspect
  passed: number;
  rejected: number;
  rework: number;
  scrapped: number;
  inspector_name: string;
  start_time?: string | null;
  end_time?: string | null;
  working_hours?: number | null;
  rejection_reasons?: string | null;
  remarks?: string | null;
  entered_by?: string | null;
  order_id?: string | null;
  die_no?: string | null;
  type_item_moc?: string | null;
  created_at?: string;
  corrected_at?: string | null;
  corrected_by?: string | null;
  correction_note?: string | null;
}

export type DispatchStatus = 'Dispatched' | 'In Transit' | 'Delivered' | 'Returned';

export interface Dispatch {
  id: string;                     // DSP-YYYY-NNNNN
  invoice_no: string;             // computed: e.g. '26-27/SGST/0650'
  invoice_seq?: string | null;    // 4-digit portion user enters, e.g. '0650'
  financial_year?: string | null; // e.g. '26-27'
  unit_id?: string | null;        // 'Unit 1' | 'Unit 2'
  tax_type?: string | null;       // 'SGST' | 'IGST'
  dispatch_date: string;
  customer_name: string;
  po_no?: string | null;
  po_date?: string | null;
  total_qty_dispatched?: number;
  mode?: string | null;           // Road|Courier|Rail|Air|Hand Delivery
  courier_name?: string | null;
  tracking_number?: string | null;
  bilty_no?: string | null;
  bilty_date?: string | null;
  no_of_cartons?: number | null;
  invoice_value?: number | null;
  status: DispatchStatus;
  remarks?: string | null;
  entered_by?: string | null;
  received_by_crm?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DispatchItem {
  id: string;                     // DI-{epoch}-{seq}
  dispatch_id: string;
  job_card_id: string;
  qty_dispatched: number;
  unit?: string;
  ordered_qty?: number | null;
  remaining_qty?: number | null;
  order_id?: string | null;
  po_no?: string | null;
  ordered_item?: string | null;
  die_no?: string | null;
  moc?: string | null;
  dispatch_date?: string | null;
  invoice_no?: string | null;
  entered_by?: string | null;
  created_at?: string;
}

// ── Derived JC status (never stored) ─────────────────────────────

export type JCDerivedStatus =
  | 'Pending Molding'
  | 'Molding'
  | 'Finishing'
  | 'Inspection'
  | 'Ready to Dispatch'
  | 'Partially Dispatched'
  | 'Dispatched';

export interface JCStats {
  molded: number;
  finished: number;
  passed: number;
  rejected: number;
  rework: number;
  scrapped: number;
  dispatched: number;
  yieldRate: number;   // round(passed/molded*100)
  readyQty: number;    // passed - dispatched
}
