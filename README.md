# MRT ERP — EnqBoss

Internal ERP for **Mangla Rubber Technologies**. Manages the full sales pipeline: enquiries → quotations → orders, with PDF generation and Supabase-backed persistence.

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 19 + Vite 6 |
| Styling | Tailwind CSS v4 |
| Routing | React Router DOM v7 |
| Database | Supabase (PostgreSQL) |
| File Storage | AWS S3 (via `@aws-sdk`) |
| PDF Generation | jsPDF + jspdf-autotable |
| Charts | Recharts |
| State | React Context (`src/store/index.tsx`) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project (see [Database Setup](#database-setup))
- AWS S3 bucket for file uploads (optional)

### 1. Clone & Install

```bash
git clone <repo-url>
cd EnqBoss
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public (anon) key |
| `VITE_S3_ACCESS_KEY_ID` | AWS access key (for doc uploads) |
| `VITE_S3_SECRET_ACCESS_KEY` | AWS secret key |
| `VITE_S3_REGION` | AWS region (e.g. `ap-south-1`) |
| `VITE_S3_BUCKET` | S3 bucket name |

> **Never commit `.env.local` or real credentials to git.** `.env.example` should always contain empty placeholder values only.

### 3. Run Dev Server

```bash
npm run dev
# App runs at http://localhost:3000
```

### 4. Build for Production

```bash
npm run build
# Output in /dist
```

---

## Database Setup

Run the SQL files against your Supabase project in this order:

1. `database_schema.sql` — core tables
2. `db_schema_update.sql` — incremental migrations
3. `supabase_schema.sql` — additional schema

Key tables:

| Table | Purpose |
|---|---|
| `enquiries` | Inbound enquiries |
| `quotes` | Quotations (linked to enquiries) |
| `orders` | Confirmed orders / proforma invoices |
| `customers` | Customer master with sites & contacts |
| `authorized_signatories` | Company signatories for PDF signing |
| `app_settings` | Single-row config: logo, signature image, bank details |
| `followups` | Follow-up logs per quote |

Access is restricted to `@manglarubbers.com` Google accounts only (enforced in `src/store/index.tsx`).

---

## Project Structure

```
src/
├── pages/
│   ├── NewQuote.tsx       # Create / Edit quotation form
│   ├── Quotes.tsx         # Quotation register (list + actions)
│   ├── NewOrder.tsx       # Create / Edit order
│   ├── Orders.tsx         # Order register
│   ├── NewEnquiry.tsx     # Create enquiry
│   ├── Enquiries.tsx      # Enquiry register
│   ├── Customers.tsx      # Customer list
│   ├── NewCustomer.tsx    # Create / Edit customer
│   ├── Settings.tsx       # App settings: logo, signature, bank, signatories
│   ├── Dashboard.tsx      # Analytics overview
│   └── FollowUps.tsx      # Follow-up management
├── components/
│   ├── Layout.tsx         # Shell with sidebar + topbar
│   ├── Sidebar.tsx        # Navigation
│   ├── DetailPanel.tsx    # Slide-in detail view
│   ├── SendQuoteModal.tsx # Email compose modal
│   └── ui/               # Shared button/badge components
├── lib/
│   ├── pdfGenerator.ts    # Quote PDF + Proforma Invoice PDF
│   ├── supabase.ts        # Supabase client + auth helpers
│   ├── types.ts           # All TypeScript interfaces
│   └── utils.ts           # formatINR, generateId, etc.
└── store/
    └── index.tsx          # Global state (AppContext + all CRUD actions)
```

---

## Key Workflows

### Create Quotation
`/quotes/new` → fill customer, trading terms, line items, signatory → **Generate PDF & Save**

### Edit Quotation
`/quotes/new?id=MRT-XXXX` → all fields pre-loaded including signatory → change status if needed → **Generate PDF & Save**

### Convert Enquiry → Quote
`/quotes/new?enqRef=ENQ-XXXX` → line items pre-populated → add unit prices → save

### Convert Quote → Order
From the Quotes register, click the order icon on a Won quote → `/orders/new?quoteRef=MRT-XXXX`

### Signature on PDFs
The signature image is stored in `app_settings.sig_url`. Set it once in **Settings → Signature**. The signatory name/designation on a quote is saved per-quote in `authorized_person` (JSON column). You can maintain a company-wide list of signatories under **Settings → Authorized Signatories**.

---

## Making Changes

### Adding a new field to Quote
1. Add the field to `Quote` interface in `src/lib/types.ts`
2. Update `mapQuoteToDB` in `src/store/index.tsx` to write the field
3. Update `mapQuoteFromDB` to read it back (handle snake_case ↔ camelCase as needed)
4. Add the input to `src/pages/NewQuote.tsx`
5. Render it in `src/lib/pdfGenerator.ts` if it should appear on the PDF

### Adding a new page / route
1. Create the component in `src/pages/`
2. Add a `<Route>` in `src/App.tsx`
3. Add a nav link in `src/components/Sidebar.tsx`

### Changing PDF layout
Edit `src/lib/pdfGenerator.ts`. `generateQuotePDF` handles quotations, `generatePIPDF` handles proforma invoices. Both use jsPDF with mm units on A4.

---

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run lint` | TypeScript type-check (`tsc --noEmit`) |
| `npm run preview` | Preview production build locally |