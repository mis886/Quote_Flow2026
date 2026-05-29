export type EnqStatus = 'New' | 'In Review' | 'Quoted' | 'Won' | 'Lost' | 'Parked';
export type Urgency = 'Hot' | 'Urgent' | 'Normal' | 'Low';
export type QuoteStatus = 'Draft' | 'Sent' | 'Won' | 'Lost' | 'Parked';
export type OrderStatus = 'Processing' | 'Delivered';

export interface LineItem {
  seq: number;
  desc: string;
  mat: string;
  qty: number;
  uom: string;
  drwg?: string;
}

export interface QuoteItem extends LineItem {
  hsn: string;
  unitPrice: number;
  gst: number;
  total: number;
  rateAsPerWeight?: string;   // text shown in "Rate as per Weight" column
  rateOverride?: boolean;     // when true, rate cell shows rateText (or "Regret") instead of numeric
  rateText?: string;          // custom text for rate cell when rateOverride is on
}

export interface OrderItem extends LineItem {
  hsn?: string;
  agreedRate: number;
  gst: number;
  total: number;
  remarks?: string;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  isPrimary?: boolean;
}

export interface Site {
  id: string;
  name: string;
  city: string;
  state?: string;
  country?: string;
  address?: string;
  fullAddress?: string;
  dispatchAddress?: string;
  transporter?: string;
  leadTimeNote?: string;
  gstin?: string;
  isPrimary?: boolean;
  contacts: Contact[];
}

export interface Attachment {
  id: string;
  fileName: string;
  storagePath: string;
  uploadedAt: string;
}

export interface Enquiry {
  id: string;
  recv: string;
  src: string;
  cust: string;
  custEnqDocNo?: string;
  siteId?: string;
  contactId?: string;
  contact: string;
  email: string;
  urg: Urgency;
  status: EnqStatus;
  assigned: string;
  notes: string;
  ageH: number;
  qRef: string | null;
  items: LineItem[];
  attachments?: Attachment[];
  gmailMessageId?: string;
}

export interface Quote {
  id: string;
  enqRef: string;
  cust: string;
  siteId?: string;
  date: string;
  validity: string;
  status: QuoteStatus;
  inco: string;
  curr: string;
  pay: string;
  items: QuoteItem[];
  notes?: string[];           // numbered notes printed below item table in PDF
  attachments?: Attachment[];
  authorizedPerson?: {
    name: string;
    designation: string;
    phone?: string;
  };
  terms?: string;
  unitId?: string;
  custEnquiryDocNo?: string;
}

export interface Order {
  id: string;
  quoteRef: string;
  enqRef: string;
  cust: string;
  siteId?: string;
  poNo: string;
  poDate: string;
  dlvDate: string;
  status: OrderStatus;
  value: number;
  inco?: string;
  items: OrderItem[];
  poFileName?: string;
  attachments?: Attachment[];
  authorizedPerson?: {
    name: string;
    designation: string;
    phone?: string;
  };
  terms?: string;
  bankingDetails?: {
    bankName: string;
    accountNo: string;
    ifscCode: string;
    branchName?: string;
    swiftCode?: string;
  };
  unitId?: string;
  bankAccountId?: string;
  priceBasis?: string;
  countryOfOrigin?: string;
  eximCode?: string;
  customPoint?: string;
  pan?: string;
  hsn?: string;
  shipToAddress?: string;
  sheetsExportedAt?: string;
}

export interface CompanyUnit {
  id: string;
  name: string;
  gstin?: string;
  address?: string;
  signatory_id?: string;
  header_url?: string | null;
  sig_url?: string | null;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BankAccount {
  id: string;
  unit_id: string;
  beneficiary: string;
  bank_name: string;
  branch_address?: string;
  account_no: string;
  ifsc: string;
  branch_code?: string;
  micr?: string;
  swift?: string;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type CustomerTier = 'New' | 'Bronze' | 'Silver' | 'Gold';

export interface Customer {
  id: string;
  code: string;
  name: string;
  seg: string;
  gstin: string;
  pan?: string;
  inco: string;
  curr: string;
  pay: string;
  sites: Site[];
  tier?: CustomerTier;
  turnover?: number;          // annual FY turnover in INR
  revenue?: number;           // total revenue from this customer
  ratingPayment?: number;     // 0–10, weight 30%
  ratingOrders?: number;      // 0–10, weight 40%
  ratingTrend?: number;       // 0–10, weight 30%
  nextOrders?: string[];      // predicted next products
}

export interface FollowUpLog {
  ts: string;
  who: string;
  channel: 'Called' | 'WhatsApp' | 'Email' | 'Meeting' | 'Visit';
  note: string;
  nextDate?: string;
  nextChannel?: string;
  nextNote?: string;
}

// ── Pipeline / Kanban ──────────────────────────────────────────────
// The board tracks an enquiry all the way to won. The first two lanes are
// derived from enquiry status (no quote yet); the rest are quote stages
// stored on the FollowUp record.

// Quote-stage values persisted on FollowUp.stage. 'Closed' is one lane;
// the actual result lives in `outcome`.
export type PipelineStage =
  | 'Sent Quotation'
  | 'Offer Acknowledged'
  | '1st Follow-up'
  | '2nd Follow-up'
  | 'Negotiation'
  | 'Closed';

export type PipelineOutcome = 'Won' | 'Lost' | 'Rejected' | 'Other';

// All board lanes left→right. 'New Enquiry' and 'To Quote' are enquiry-backed
// (pre-quote); the remainder map 1:1 to PipelineStage.
export type BoardLane = 'New Enquiry' | 'To Quote' | PipelineStage;

export const PIPELINE_STAGES: PipelineStage[] = [
  'Sent Quotation',
  'Offer Acknowledged',
  '1st Follow-up',
  '2nd Follow-up',
  'Negotiation',
  'Closed',
];

export const BOARD_LANES: BoardLane[] = ['New Enquiry', 'To Quote', ...PIPELINE_STAGES];

// Default turnaround time (in days) allowed in each lane before a TAT warning.
// 'Closed' has no TAT — the clock stops once closed.
// Kept for backward-compat with configs saved before TAT became hour-precise.
export const DEFAULT_STAGE_TAT: Record<BoardLane, number> = {
  'New Enquiry': 1,
  'To Quote': 2,
  'Sent Quotation': 1,
  'Offer Acknowledged': 2,
  '1st Follow-up': 3,
  '2nd Follow-up': 4,
  'Negotiation': 7,
  'Closed': 0,
};

// Default TAT in HOURS — the canonical unit. Derived from the day defaults.
export const DEFAULT_STAGE_TAT_H: Record<BoardLane, number> = {
  'New Enquiry': 24,
  'To Quote': 48,
  'Sent Quotation': 24,
  'Offer Acknowledged': 48,
  '1st Follow-up': 72,
  '2nd Follow-up': 96,
  'Negotiation': 168,
  'Closed': 0,
};

export interface FollowUp {
  id: string; // quote_id
  quote_id: string;
  owner: string;
  next_date: string | null;
  next_time?: string | null;
  status?: 'open' | 'closed';
  stage?: PipelineStage;            // current quote-stage lane
  stage_entered_at?: string;        // ISO ts the card entered `stage` (TAT clock)
  outcome?: PipelineOutcome | null; // result when stage === 'Closed'
  logs: FollowUpLog[];
  created_at?: string;
  updated_at?: string;
}

export interface DataStore {
  enquiries: Enquiry[];
  quotes: Quote[];
  orders: Order[];
  customers: Customer[];
  followups: FollowUp[];
  settings: AppSettings | null;
  signatories: AuthorizedSignatory[];
  units: CompanyUnit[];
  bankAccounts: BankAccount[];
}

export interface AuthorizedSignatory {
  id: string;
  name: string;
  designation: string;
  phone: string;
  is_default: boolean;
}

export interface AppSettings {
  id: string;
  header_url: string | null;
  sig_url: string | null;
  bank_name: string;
  bank_acc: string;
  bank_ifsc: string;
  bank_swift: string;
  gmail_enabled: boolean;
  gmail_labels: string[];
  gmail_sync_freq: number;
  gmail_last_sync: string | null;
  intelligence_pin?: string;
  sheets_webhook_url?: string;
  sheets_drive_folder_id?: string;
  // Per-lane TAT in days (legacy). Superseded by pipeline_tat_h.
  pipeline_tat?: Partial<Record<BoardLane, number>>;
  // Per-lane TAT in HOURS, editable in Settings. Falls back to pipeline_tat
  // (×24) then DEFAULT_STAGE_TAT_H.
  pipeline_tat_h?: Partial<Record<BoardLane, number>>;
}
