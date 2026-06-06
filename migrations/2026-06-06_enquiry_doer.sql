-- Add doer column to enquiries to track who submitted each enquiry
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS doer TEXT;
