-- Mangla Rubbers EQ System - Supabase Schema

-- 1. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    seg TEXT,
    gstin TEXT,
    inco TEXT,
    curr TEXT,
    pay TEXT,
    sites JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ENQUIRIES TABLE
CREATE TABLE IF NOT EXISTS enquiries (
    id TEXT PRIMARY KEY,
    recv TIMESTAMPTZ NOT NULL,
    src TEXT NOT NULL,
    cust TEXT NOT NULL,
    site_id TEXT,
    contact_id TEXT,
    contact TEXT,
    email TEXT,
    urg TEXT DEFAULT 'Normal',
    status TEXT DEFAULT 'New',
    assigned TEXT,
    notes TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    age_h INTEGER DEFAULT 0,
    q_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. QUOTES TABLE
CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    enq_ref TEXT REFERENCES enquiries(id),
    cust TEXT NOT NULL,
    date DATE NOT NULL,
    validity DATE,
    status TEXT DEFAULT 'Sent',
    inco TEXT,
    curr TEXT,
    pay TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    quote_ref TEXT REFERENCES quotes(id),
    enq_ref TEXT REFERENCES enquiries(id),
    cust TEXT NOT NULL,
    po_no TEXT NOT NULL,
    po_date DATE NOT NULL,
    dlv_date DATE,
    status TEXT DEFAULT 'Processing',
    value NUMERIC DEFAULT 0,
    items JSONB DEFAULT '[]'::jsonb,
    po_filename TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. FOLLOWUPS TABLE
CREATE TABLE IF NOT EXISTS followups (
    id TEXT PRIMARY KEY,
    quote_id TEXT REFERENCES quotes(id) UNIQUE,
    owner TEXT,
    next_date DATE,
    logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;

-- CREATE POLICIES (Allow all authenticated users with @manglarubbers.com domain)
-- This is a simple policy. In production, you might want more granular project-based access.
CREATE POLICY "Allow company access" ON customers FOR ALL TO authenticated USING (auth.jwt() ->> 'email' LIKE '%@manglarubbers.com');
CREATE POLICY "Allow company access" ON enquiries FOR ALL TO authenticated USING (auth.jwt() ->> 'email' LIKE '%@manglarubbers.com');
CREATE POLICY "Allow company access" ON quotes FOR ALL TO authenticated USING (auth.jwt() ->> 'email' LIKE '%@manglarubbers.com');
CREATE POLICY "Allow company access" ON orders FOR ALL TO authenticated USING (auth.jwt() ->> 'email' LIKE '%@manglarubbers.com');
CREATE POLICY "Allow company access" ON followups FOR ALL TO authenticated USING (auth.jwt() ->> 'email' LIKE '%@manglarubbers.com');
  
-- 6. APP SETTINGS
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY DEFAULT 'config',
    header_url TEXT,
    sig_name TEXT DEFAULT 'Akash Gupta',
    sig_des TEXT DEFAULT 'Rubber Technologist',
    sig_phone TEXT DEFAULT '+91-817171 6630',
    sig_url TEXT,
    bank_name TEXT DEFAULT 'ICICI BANK LTD.',
    bank_acc TEXT DEFAULT '0000000000',
    bank_ifsc TEXT DEFAULT 'ICIC0000000',
    bank_swift TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow company access" ON app_settings FOR ALL TO authenticated USING (auth.jwt() ->> 'email' LIKE '%@manglarubbers.com');

-- Seed initial config
INSERT INTO app_settings (id) VALUES ('config') ON CONFLICT (id) DO NOTHING;

-- 7. AUTHORIZED SIGNATORIES
CREATE TABLE IF NOT EXISTS authorized_signatories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    designation TEXT NOT NULL,
    phone TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE authorized_signatories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow company access" ON authorized_signatories FOR ALL TO authenticated USING (auth.jwt() ->> 'email' LIKE '%@manglarubbers.com');

