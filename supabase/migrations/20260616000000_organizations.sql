-- ============================================================
-- Organizations — multi-agent team support
-- Enables: manager oversight, agent tracking, team leaderboard
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  owner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan        TEXT        NOT NULL DEFAULT 'team',
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);

-- 2. Org members — links users to an org with a role
CREATE TABLE IF NOT EXISTS org_members (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  role            TEXT        NOT NULL DEFAULT 'agent'
                    CHECK (role IN ('owner', 'manager', 'agent')),
  -- invite flow
  invite_email    TEXT,
  invite_token    TEXT        UNIQUE,
  invite_accepted BOOLEAN     DEFAULT FALSE,
  invited_by      UUID        REFERENCES auth.users(id),
  joined_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id   ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id  ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_token    ON org_members(invite_token);
CREATE INDEX IF NOT EXISTS idx_org_members_email    ON org_members(invite_email);

-- 3. Helper: get the org_id for the current user
CREATE OR REPLACE FUNCTION public.my_org_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT org_id FROM org_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- 4. Helper: get all agent user_ids in the current user's org
CREATE OR REPLACE FUNCTION public.my_org_agent_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT user_id FROM org_members
  WHERE org_id = public.my_org_id()
    AND user_id IS NOT NULL;
$$;

-- 5. Helper: is the current user a manager/owner in their org?
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
  );
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members   ENABLE ROW LEVEL SECURITY;

-- Organizations: owner can read/update their own org
CREATE POLICY "org_owner_select" ON organizations FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "org_owner_update" ON organizations FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "org_member_select" ON organizations FOR SELECT
  USING (id = public.my_org_id());

-- Org members: managers see everyone in their org; agents see only themselves
CREATE POLICY "org_members_manager_select" ON org_members FOR SELECT
  USING (
    org_id = public.my_org_id()
    AND public.is_manager()
  );

CREATE POLICY "org_members_self_select" ON org_members FOR SELECT
  USING (user_id = auth.uid());

-- Managers can insert/update members in their org
CREATE POLICY "org_members_manager_insert" ON org_members FOR INSERT
  WITH CHECK (
    org_id = public.my_org_id()
    AND public.is_manager()
  );

CREATE POLICY "org_members_manager_update" ON org_members FOR UPDATE
  USING (
    org_id = public.my_org_id()
    AND public.is_manager()
  );

-- ── EXTEND call_sessions RLS for managers ────────────────────────────────────
-- Managers can read calls from any agent in their org

DROP POLICY IF EXISTS "managers_read_org_calls" ON call_sessions;
CREATE POLICY "managers_read_org_calls" ON call_sessions FOR SELECT
  USING (
    agent_id::uuid IN (SELECT public.my_org_agent_ids())
    AND public.is_manager()
  );

-- ── EXTEND agent_profiles RLS for managers ───────────────────────────────────
DROP POLICY IF EXISTS "managers_read_org_profiles" ON agent_profiles;
CREATE POLICY "managers_read_org_profiles" ON agent_profiles FOR SELECT
  USING (
    user_id IN (SELECT public.my_org_agent_ids())
    AND public.is_manager()
  );

-- ── Auto-update updated_at on organizations ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
