-- ============================================================
-- Spear — Enterprise Client Onboarding
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- EDIT ONLY THE TWO VALUES ON LINES 12–13, THEN HIT RUN.
--   manager_email → their login email (must have signed up first)
--   agency_name   → their company/agency name
-- ============================================================

DO $$
DECLARE
  manager_email  TEXT := 'MANAGER_EMAIL_HERE';  -- ← change this
  agency_name    TEXT := 'AGENCY_NAME_HERE';     -- ← change this
  manager_id     UUID;
  org_id         UUID;
BEGIN

  -- Look up the manager
  SELECT id INTO manager_id FROM auth.users WHERE email = manager_email;
  IF manager_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email "%". Have them sign up first.', manager_email;
  END IF;

  -- Create the org
  INSERT INTO organizations (name, owner_id, plan)
  VALUES (agency_name, manager_id, 'enterprise')
  RETURNING id INTO org_id;

  -- Add manager as owner
  INSERT INTO org_members (org_id, user_id, role, invite_accepted, joined_at)
  VALUES (org_id, manager_id, 'owner', TRUE, NOW());

  -- Upgrade subscription
  UPDATE subscriptions SET plan = 'enterprise', status = 'active'
  WHERE user_id = manager_id;

  RAISE NOTICE '✓ Org "%" created', agency_name;
  RAISE NOTICE '✓ % set as owner', manager_email;
  RAISE NOTICE '✓ Subscription upgraded to enterprise';

END $$;

-- Confirm (run separately after the block above succeeds)
SELECT o.name AS org, o.plan, u.email, m.role, s.plan AS sub, s.status
FROM organizations o
JOIN auth.users u    ON u.id = o.owner_id
JOIN org_members m   ON m.org_id = o.id AND m.user_id = u.id
LEFT JOIN subscriptions s ON s.user_id = u.id
ORDER BY o.created_at DESC LIMIT 1;
