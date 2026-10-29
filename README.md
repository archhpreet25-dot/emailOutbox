# ReachInbox — Full-stack Email Scheduler

A TypeScript monorepo starter implementing a React dashboard, Express API, PostgreSQL persistence, BullMQ delayed jobs on Redis, Ethereal SMTP, Elasticsearch indexing, Google OAuth, Slack OAuth notification flow, and Bull Board queue visibility.

> **Honest demo note:** This is an implementation starter, not a claim that third-party OAuth credentials have been configured or that the system has been load-tested. Add your own Google and Slack app credentials before demoing those integrations. Ethereal messages are fake/test messages; they do not reach real recipients.

## Stack
- Backend: Node.js, TypeScript, Express, Passport Google OAuth, PostgreSQL, BullMQ, Redis, Nodemailer/Ethereal, Elasticsearch
- Frontend: React + TypeScript + Vite + Tailwind CSS (custom responsive UI)
- Queue dashboard: Bull Board at `/admin/queues`

## Run locally

Requirements: Node 20+, Docker + Docker Compose, Google OAuth credentials for login, and Slack app credentials to verify Slack notifications.

1. Copy `.env.example` to `backend/.env` and fill credentials. The example file is at repository root; the backend reads `backend/.env` when run from the backend workspace. You can also copy it to the root and run commands from root with `dotenv` configured accordingly. Recommended:
   ```bash
   cp .env.example backend/.env
   ```
2. Start infrastructure:
   ```bash
   docker compose up -d
   ```
3. Install packages from the repository root:
   ```bash
   npm install
   ```
4. Start API and frontend in two terminals:
   ```bash
   npm run dev -w backend
   npm run dev -w frontend
   ```
5. Open `http://localhost:5173`. API health: `http://localhost:4000/health`. Bull Board: `http://localhost:4000/admin/queues`.

The API process starts a worker too for the simplest local experience. For separate worker deployment, remove `startEmailWorker()` from `src/index.ts` and run `npm run worker -w backend`; avoid running both configurations simultaneously unless you intend to run multiple workers.

## OAuth setup

### Google login
In Google Cloud Console, create an OAuth 2.0 Web application. Add `http://localhost:4000/auth/google/callback` as an authorized redirect URI. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in `backend/.env`. The app uses an Express session cookie; use HTTPS and secure cookies in production, and configure a persistent session store before deploying.

### Slack notification
Create a Slack app, enable OAuth, set the redirect URL to `http://localhost:4000/auth/slack/callback`, and add bot scopes `chat:write` and `im:write`. Set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_REDIRECT_URI`. From the signed-in dashboard, click **Connect Slack**. OAuth access token is stored per user in PostgreSQL. The OAuth response stores the Slack user ID and bot token. On a limit hit, the service calls `conversations.open` to open a DM with the connected user and then calls `chat.postMessage`. This is a real Slack API path when the app is installed with the required scopes and the workspace permits it; test it in your workspace before recording the demo.

## Ethereal SMTP
The worker creates a test Ethereal account using `nodemailer.createTestAccount()` and sends using `smtp.ethereal.email`. Message content is captured by Ethereal, not delivered to real inboxes. The preview URL is saved in the `error` field for demo convenience; in a production schema this should be a dedicated `preview_url` column.

## API overview
All email endpoints require a Google-authenticated session cookie.

- `GET /auth/google` — start Google OAuth
- `GET /auth/me` — current user
- `POST /auth/logout` — end session
- `GET /auth/slack` — start Slack OAuth
- `POST /api/emails/schedule` — schedule a batch
  ```json
  {
    "recipients": ["person@example.com", "other@example.com"],
    "subject": "A quick hello",
    "body": "Hello from the demo",
    "startAt": "2026-12-01T10:00:00.000Z",
    "delayMs": 2000,
    "hourlyLimit": 100
  }
  ```
- `GET /api/emails?status=scheduled|processing|sent|failed` — list emails
- `GET /api/emails/search?q=hello` — Elasticsearch full-text search
- `GET /api/emails/queue` — queue counts
- `GET /admin/queues` — Bull Board live queue dashboard

## Architecture & trade-offs

1. **Persistence / restart:** PostgreSQL is the source of truth for email records; Redis uses AOF persistence in Docker; BullMQ stores delayed jobs in Redis. `jobId` is the email UUID, so queue retries/repeated add attempts using the same ID are idempotent while the job remains in BullMQ. Keep Redis persistence enabled and use managed durable storage in production. On startup, a robust production implementation should reconcile `scheduled` DB records against queue jobs; this starter does not yet implement a full reconciliation sweeper, so don't claim recovery from simultaneous DB/Redis loss.
2. **No cron:** Delivery timing is handled by BullMQ delayed jobs. No cron packages or OS cron are used.
3. **Concurrency:** `WORKER_CONCURRENCY` controls BullMQ worker concurrency (default 10). PostgreSQL state and stable job IDs prevent normal duplicate enqueue paths. SMTP is not a transactional system; exactly-once external delivery cannot be guaranteed if a worker crashes after SMTP accepts a message but before the DB status update. A production design should use an outbox/reconciliation pattern and provider idempotency where available.
4. **Spacing:** `MIN_DELAY_MS=2000` is the default minimum spacing configured in worker logic. The demo uses a sender lock; for a production-grade distributed lock, use a renewable lock with fencing tokens and ensure the lock is released safely on all move-to-delayed paths. Current simple lock is a demonstration and needs hardening for worker crashes.
5. **Hourly rate limit:** `MAX_EMAILS_PER_HOUR_PER_SENDER=100` is the default Redis-backed per-sender hourly counter. If the counter is exhausted, the job is moved to the next hour window instead of being dropped. `hourlyLimit` from the compose UI is stored on the sender record and applied by the worker; `MAX_EMAILS_PER_HOUR_PER_SENDER` is the default for new senders. In this demo, users can change their own sender limit via the compose form; production should enforce tenant/admin policy and reserve quota atomically with Lua (to avoid edge races across concurrent workers).
6. **Slack:** Rate-limit hits invoke Slack's `chat.postMessage` API if a token is present. If no Slack connection exists, the worker skips notification without crashing. Configure and verify a concrete Slack channel as noted above.
7. **Search:** Each email is indexed to Elasticsearch. Search failures don't stop email scheduling; the endpoint returns 503 if Elasticsearch is unavailable. For production, add an indexing retry/outbox and an explicit index bootstrap/migration.
8. **Load (1000+ jobs):** Batch API accepts up to 5000 recipients, inserts records and enqueues delayed jobs. BullMQ/Redis handle delayed-job persistence and workers consume with configured concurrency. For larger batches, use chunked DB transactions, queue bulk add, bounded API payloads, and a global sender reservation Lua script. This starter is not benchmarked for 1000+ simultaneous emails.
9. **Security gaps to close before production:** CSRF protection, persistent session store, Slack OAuth state nonce/session binding, secrets manager, input-size/rate controls, audit logs, encrypted token storage, sender verification, retention policies, and integration tests.

## Feature checklist

- [x] Express + TypeScript API
- [x] PostgreSQL email/user/sender records
- [x] BullMQ delayed jobs + Redis persistence configuration
- [x] Worker concurrency setting
- [x] Configurable minimum send spacing
- [x] Redis-backed hourly sender counter + delayed reschedule
- [x] Google OAuth route and user profile display (requires credentials)
- [x] Slack OAuth flow and rate-limit notification call (requires credentials and channel setup/testing)
- [x] Ethereal fake SMTP
- [x] Elasticsearch indexing/search endpoint
- [x] Bull Board queue dashboard
- [x] React responsive dashboard, scheduled/sent tabs, search, empty/loading states, CSV/TXT email parsing, compose modal
- [ ] Full DB↔queue reconciliation on restart
- [ ] Production-grade exactly-once SMTP delivery / distributed quota reservation
- [ ] Verified real Slack workspace demo and load test

## Suggested demo recording (under 5 minutes)
1. Sign in using your configured Google OAuth app.
2. Upload a small CSV/TXT containing test addresses, compose an email, and schedule it 1–2 minutes in the future.
3. Show the Scheduled emails tab and Bull Board delayed job.
4. Wait for the worker; show Sent emails and the Ethereal preview link in the record/error field.
5. Schedule another email for later, restart API/worker (keep Redis and Postgres running), and show the delayed job remains.
6. For the rate-limit demo, temporarily lower `MAX_EMAILS_PER_HOUR_PER_SENDER` to `1`, restart the worker, queue two emails for the same sender, and show the second being rescheduled. Verify Slack in a configured channel only after fixing/selecting the channel as described above.

## Submission
Create a private GitHub repo, push this project, invite the assignment reviewers by their exact GitHub usernames, record the demo, then submit repository and video links in the assignment form.
