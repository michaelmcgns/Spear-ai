-- ============================================================
-- Compliance tables — all append-only (no DELETE/UPDATE via API)
-- Run this migration against your Supabase project.
-- ============================================================

-- 1. Consent log (two-party recording consent)
CREATE TABLE IF NOT EXISTS consent_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
  agent_id      UUID        NOT NULL,
  prospect_state TEXT       NOT NULL,   -- state name or "Unknown"
  session_id    TEXT        NOT NULL,
  confirmed_at  TIMESTAMPTZ NOT NULL
);

-- No UPDATE / DELETE exposed — enforce via RLS
ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert_only_consent_log" ON consent_log
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "select_own_consent_log"  ON consent_log
  FOR SELECT TO authenticated USING (agent_id = auth.uid());

-- 2. Flagged coaching events (regulatory + IUL language)
CREATE TABLE IF NOT EXISTS flagged_coaching_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
  agent_id         UUID,
  session_id       TEXT,
  flag_type        TEXT        NOT NULL    CHECK (flag_type IN ('regulatory', 'iul_language')),
  original_content TEXT        NOT NULL,
  replaced_content TEXT        NOT NULL
);

ALTER TABLE flagged_coaching_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert_only_flagged_events" ON flagged_coaching_events
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "select_flagged_events_admin" ON flagged_coaching_events
  FOR SELECT TO authenticated USING (agent_id = auth.uid());

-- 3. Profiles and leads compliance fields are skipped here —
--    those tables are not yet created in this project. Add when ready.

-- 4. Call session compliance fields
-- (Assumes a `call_sessions` table — adjust if different)
ALTER TABLE call_sessions
  ADD COLUMN IF NOT EXISTS consent_log_id   UUID REFERENCES consent_log(id),
  ADD COLUMN IF NOT EXISTS tcpa_confirmed   BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tcpa_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_region      TEXT        DEFAULT 'US';

-- 6. Audio retention helper view (identifies EU audio older than 30 days)
CREATE OR REPLACE VIEW expired_eu_audio AS
  SELECT id, agent_id, created_at, data_region
  FROM call_sessions
  WHERE data_region = 'EU'
    AND created_at < NOW() - INTERVAL '30 days';
