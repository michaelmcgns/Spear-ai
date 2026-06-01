-- Add product_focus to agent profiles (or create the table if it doesn't exist)
CREATE TABLE IF NOT EXISTS agent_profiles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  product_focus TEXT DEFAULT 'life_insurance',
  agency_name   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_profiles_select" ON agent_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "agent_profiles_insert" ON agent_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agent_profiles_update" ON agent_profiles FOR UPDATE USING (auth.uid() = user_id);
