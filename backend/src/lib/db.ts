import pg from "pg";
import { env } from "../config/env.js";
const { Pool } = pg;
export const db = new Pool({ connectionString: env.databaseUrl });
export async function initDb() {
  await db.query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, avatar TEXT, slack_access_token TEXT, slack_user_id TEXT, slack_team_name TEXT, created_at TIMESTAMPTZ DEFAULT now());
 ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_user_id TEXT; CREATE TABLE IF NOT EXISTS senders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, email TEXT NOT NULL, hourly_limit INTEGER NOT NULL DEFAULT 100, created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id,email));
 ALTER TABLE senders ADD COLUMN IF NOT EXISTS hourly_limit INTEGER NOT NULL DEFAULT 100; CREATE TABLE IF NOT EXISTS emails (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, sender_id TEXT NOT NULL REFERENCES senders(id), recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, scheduled_at TIMESTAMPTZ NOT NULL, sent_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','processing','sent','failed')), error TEXT, created_at TIMESTAMPTZ DEFAULT now(), idempotency_key TEXT UNIQUE NOT NULL);`);
}
