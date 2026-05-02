-- VoteShield Database Schema
-- Applied automatically by Docker Compose on first boot

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS voters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_hash TEXT NOT NULL,
  constituency_code TEXT NOT NULL,
  voter_id_hash TEXT NOT NULL,
  language TEXT DEFAULT 'hi',
  enrolled_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voter_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voter_id UUID REFERENCES voters(id),
  change_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  alert_sent_at TIMESTAMPTZ,
  ticket TEXT
);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket TEXT UNIQUE NOT NULL,
  reporter_hash TEXT NOT NULL,
  category TEXT NOT NULL,
  urgency INT NOT NULL,
  summary TEXT NOT NULL,
  required_action TEXT,
  constituency TEXT,
  latitude TEXT,
  longitude TEXT,
  status TEXT DEFAULT 'OPEN',
  assigned_squad TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS misinfo_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_hash TEXT NOT NULL,
  verdict TEXT NOT NULL,
  explanation TEXT,
  sources JSONB,
  language TEXT,
  response_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roll_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  constituency_code TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  voter_count INT,
  changes_count INT,
  taken_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voters_constituency ON voters(constituency_code);
CREATE INDEX IF NOT EXISTS idx_voters_voter_id_hash ON voters(voter_id_hash);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_urgency ON incidents(urgency DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_ticket ON incidents(ticket);
CREATE INDEX IF NOT EXISTS idx_misinfo_verdict ON misinfo_checks(verdict);
