-- Add Twilio call tracking columns to call_sessions
ALTER TABLE call_sessions
  ADD COLUMN IF NOT EXISTS twilio_call_sid  TEXT,
  ADD COLUMN IF NOT EXISTS twilio_status    TEXT;

CREATE INDEX IF NOT EXISTS idx_call_sessions_twilio_sid ON call_sessions (twilio_call_sid);
