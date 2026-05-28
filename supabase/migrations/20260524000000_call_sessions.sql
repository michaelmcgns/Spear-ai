-- Live call session data and agent learning profiles

CREATE TABLE IF NOT EXISTS call_sessions (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id              TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  duration_seconds      INTEGER     DEFAULT 0,
  transcript            JSONB       DEFAULT '[]',
  coaching_cards_fired  JSONB       DEFAULT '[]',
  cards_accepted        JSONB       DEFAULT '[]',
  cards_dismissed       JSONB       DEFAULT '[]',
  outcome               TEXT        DEFAULT 'unknown'
                          CHECK (outcome IN ('closed', 'not_closed', 'follow_up', 'unknown')),
  talk_ratio_agent      FLOAT       CHECK (talk_ratio_agent    BETWEEN 0 AND 100),
  talk_ratio_prospect   FLOAT       CHECK (talk_ratio_prospect BETWEEN 0 AND 100),
  disc_profile_detected CHAR(1)     CHECK (disc_profile_detected IN ('D','I','S','C')),
  nepq_phases_completed JSONB       DEFAULT '{}',
  objections_raised     JSONB       DEFAULT '[]',
  overall_score         FLOAT       CHECK (overall_score BETWEEN 1 AND 10),
  notes                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_agent_id   ON call_sessions (agent_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_created_at ON call_sessions (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_profiles (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id                TEXT        UNIQUE NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  avg_talk_ratio          FLOAT,
  avg_overall_score       FLOAT,
  total_calls             INTEGER     DEFAULT 0,
  close_rate              FLOAT,
  most_common_disc_type   CHAR(1),
  weak_nepq_phases        JSONB       DEFAULT '[]',
  strong_nepq_phases      JSONB       DEFAULT '[]',
  most_missed_objections  JSONB       DEFAULT '[]',
  most_accepted_card_types JSONB      DEFAULT '[]',
  last_5_outcomes         JSONB       DEFAULT '[]',
  coaching_focus          TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_agent_id ON agent_profiles (agent_id);
