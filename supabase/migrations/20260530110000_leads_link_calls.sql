-- Link call_sessions to leads
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_call_sessions_lead_id ON call_sessions (lead_id);
