-- Track who submitted each entry (email of logged-in user at time of creation)
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS doer TEXT;
ALTER TABLE quotes    ADD COLUMN IF NOT EXISTS doer TEXT;
ALTER TABLE orders    ADD COLUMN IF NOT EXISTS doer TEXT;
