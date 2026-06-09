-- Migration: 2026-06-09 — Team roster aliases
--
-- Attribution matches a record's doer/owner/who (free text) against the roster.
-- Historically those fields sometimes stored the Google profile NAME of the
-- login (e.g. "Mangla Rubber Technologies A" for sc1@manglarubbers.com) rather
-- than the email or the roster display_name — so the row failed to match and
-- fell back to 'Other'.
--
-- Going forward the app stamps the email. This column lets the office register
-- any additional names/emails a login may appear under (the stray profile name,
-- a nickname, an old email) so existing records still attribute correctly.
-- Stored as a JSONB array of lowercased strings.

ALTER TABLE team_roster ADD COLUMN IF NOT EXISTS aliases JSONB DEFAULT '[]'::jsonb;
