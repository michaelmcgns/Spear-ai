-- ============================================================
-- Fix missing columns in call_sessions and subscriptions
-- Run once in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. subscriptions: add current_period_end if missing
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- 2. call_sessions: add all columns from original migration
--    (safe to run even if some already exist)
ALTER TABLE public.call_sessions
  ADD COLUMN IF NOT EXISTS user_id              UUID,
  ADD COLUMN IF NOT EXISTS outcome              TEXT        DEFAULT 'unknown'
                             CHECK (outcome IN ('closed','not_closed','follow_up','unknown')),
  ADD COLUMN IF NOT EXISTS talk_ratio_agent     FLOAT,
  ADD COLUMN IF NOT EXISTS talk_ratio_prospect  FLOAT,
  ADD COLUMN IF NOT EXISTS disc_profile_detected CHAR(1),
  ADD COLUMN IF NOT EXISTS nepq_phases_completed JSONB       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS objections_raised    JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS overall_score        FLOAT,
  ADD COLUMN IF NOT EXISTS coaching_cards_fired JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cards_accepted       JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cards_dismissed      JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS prospect_name        TEXT,
  ADD COLUMN IF NOT EXISTS prospect_phone       TEXT;

-- 3. RLS on call_sessions using user_id
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_calls_select" ON public.call_sessions;
DROP POLICY IF EXISTS "users_own_calls_insert" ON public.call_sessions;
DROP POLICY IF EXISTS "users_own_calls_update" ON public.call_sessions;

CREATE POLICY "users_own_calls_select" ON public.call_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_own_calls_insert" ON public.call_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_own_calls_update" ON public.call_sessions
  FOR UPDATE USING (user_id = auth.uid());

-- 4. Update your own subscription plan
UPDATE public.subscriptions
  SET plan = 'agent', status = 'active'
  WHERE user_id = 'd10fa54f-7c73-4ac4-aa17-8271736b4a17';
