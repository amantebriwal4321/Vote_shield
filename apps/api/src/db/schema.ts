import { pgTable, text, uuid, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

// ─── Registered voters who opted in for roll watch ───────────────
export const voters = pgTable('voters', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneHash: text('phone_hash').notNull(),
  constituencyCode: text('constituency_code').notNull(),
  voterIdHash: text('voter_id_hash').notNull(),
  language: text('language').default('hi'),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow(),
});

// ─── Voter roll change alerts sent ───────────────────────────────
export const voterAlerts = pgTable('voter_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  voterId: uuid('voter_id').references(() => voters.id),
  changeType: text('change_type').notNull(), // DELETED | MODIFIED | RESTORED
  oldStatus: text('old_status'),
  newStatus: text('new_status'),
  alertSentAt: timestamp('alert_sent_at', { withTimezone: true }),
  ticket: text('ticket'),
});

// ─── Incident reports ────────────────────────────────────────────
export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticket: text('ticket').unique().notNull(),
  reporterHash: text('reporter_hash').notNull(),
  category: text('category').notNull(),
  urgency: integer('urgency').notNull(),
  summary: text('summary').notNull(),
  requiredAction: text('required_action'),
  constituency: text('constituency'),
  latitude: text('latitude'),
  longitude: text('longitude'),
  status: text('status').default('OPEN'),     // OPEN | ASSIGNED | RESOLVED
  assignedSquad: text('assigned_squad'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Misinfo checks (anonymised) ─────────────────────────────────
export const misinfoChecks = pgTable('misinfo_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageHash: text('message_hash').notNull(),
  verdict: text('verdict').notNull(),
  explanation: text('explanation'),
  sources: jsonb('sources'),
  language: text('language'),
  responseMs: integer('response_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Voter roll diff snapshots ───────────────────────────────────
export const rollSnapshots = pgTable('roll_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  constituencyCode: text('constituency_code').notNull(),
  snapshotHash: text('snapshot_hash').notNull(),
  voterCount: integer('voter_count'),
  changesCount: integer('changes_count'),
  takenAt: timestamp('taken_at', { withTimezone: true }).defaultNow(),
});

// ─── Type exports ────────────────────────────────────────────────
export type Voter = typeof voters.$inferSelect;
export type NewVoter = typeof voters.$inferInsert;
export type VoterAlert = typeof voterAlerts.$inferSelect;
export type NewVoterAlert = typeof voterAlerts.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type MisinfoCheck = typeof misinfoChecks.$inferSelect;
export type NewMisinfoCheck = typeof misinfoChecks.$inferInsert;
export type RollSnapshot = typeof rollSnapshots.$inferSelect;
export type NewRollSnapshot = typeof rollSnapshots.$inferInsert;
