-- ============================================================
-- RLS policies for call_sessions + agent_profiles
-- + prospect_name column on call_sessions
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. prospect_name column (safe to run even if already added)
ALTER TABLE call_sessions
  ADD COLUMN IF NOT EXISTS prospect_name TEXT;

-- 2. RLS on call_sessions — users can only see/write their own calls
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_own_calls_select"
  ON call_sessions FOR SELECT
  USING (agent_id = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "users_own_calls_insert"
  ON call_sessions FOR INSERT
  WITH CHECK (agent_id = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "users_own_calls_update"
  ON call_sessions FOR UPDATE
  USING (agent_id = auth.uid()::text);

-- 3. RLS on agent_profiles — users can only see/write their own profile
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_own_profile_select"
  ON agent_profiles FOR SELECT
  USING (agent_id = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "users_own_profile_insert"
  ON agent_profiles FOR INSERT
  WITH CHECK (agent_id = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "users_own_profile_update"
  ON agent_profiles FOR UPDATE
  USING (agent_id = auth.uid()::text);
