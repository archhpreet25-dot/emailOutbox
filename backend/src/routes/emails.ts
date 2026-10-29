import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../lib/db.js";
import { emailQueue } from "../services/queue.js";
import { indexEmail, searchClient } from "../lib/search.js";
const router = Router();
function auth(req: any, res: any, next: any) {
  if (!req.user?.id)
    return res.status(401).json({ error: "Please log in to continue." });
  next();
}
router.use(auth);
const scheduleSchema = z.object({
  recipients: z.array(z.string().email()).min(1).max(5000),
  subject: z.string().min(1).max(998),
  body: z.string().min(1),
  startAt: z.string().datetime(),
  delayMs: z.number().int().min(0).max(86400000).optional(),
  hourlyLimit: z.number().int().min(1).max(10000).optional(),
  senderEmail: z.string().email().optional(),
});
router.post("/schedule", async (req: any, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
  const userId = req.user.id;
  const {
    recipients,
    subject,
    body,
    startAt,
    delayMs = 2000,
    hourlyLimit = 100,
    senderEmail,
  } = parsed.data;
  const senderResult = senderEmail
    ? await db.query(
        "SELECT id,email FROM senders WHERE user_id=$1 AND email=$2",
        [userId, senderEmail],
      )
    : await db.query(
        "SELECT id,email FROM senders WHERE user_id=$1 ORDER BY created_at LIMIT 1",
        [userId],
      );
  let sender = senderResult.rows[0];
  if (!sender) {
    const email = req.user.email;
    const id = randomUUID();
    const r = await db.query(
      "INSERT INTO senders(id,user_id,email,hourly_limit) VALUES($1,$2,$3,$4) RETURNING id,email",
      [id, userId, email, hourlyLimit],
    );
    sender = r.rows[0];
  } else {
    await db.query("UPDATE senders SET hourly_limit=$2 WHERE id=$1", [
      sender.id,
      hourlyLimit,
    ]);
  }
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 1000)
    return res.status(400).json({ error: "startAt must be in the future" });
  const created = [];
  try {
    for (let i = 0; i < recipients.length; i++) {
      const id = randomUUID();
      const scheduledAt = new Date(start.getTime() + i * Math.max(delayMs, 0));
      const idem = `${userId}:${sender.id}:${id}`;
      const r = await db.query(
        "INSERT INTO emails(id,user_id,sender_id,recipient,subject,body,scheduled_at,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(idempotency_key) DO NOTHING RETURNING *",
        [
          id,
          userId,
          sender.id,
          recipients[i],
          subject,
          body,
          scheduledAt,
          idem,
        ],
      );
      if (!r.rows[0]) continue;
      const email = r.rows[0];
      await emailQueue.add(
        "send-email",
        { emailId: id, userId, senderId: sender.id },
        { jobId: id, delay: Math.max(0, scheduledAt.getTime() - Date.now()) },
      );
      await indexEmail({
        ...email,
        userId,
        scheduledAt: email.scheduled_at,
        sentAt: email.sent_at,
      });
      created.push(email);
    }
  } catch (e) {
    console.error("Scheduling failed", e);
    return res
      .status(500)
      .json({
        error:
          "Could not schedule all emails. Review scheduled list before retrying.",
      });
  }
  res.status(201).json({ created: created.length, emails: created });
});
router.get("/", async (req: any, res) => {
  const status = String(req.query.status || "");
  const params: any[] = [req.user.id];
  let sql =
    "SELECT e.*,s.email AS sender_email FROM emails e JOIN senders s ON s.id=e.sender_id WHERE e.user_id=$1";
  if (["scheduled", "processing", "sent", "failed"].includes(status)) {
    params.push(status);
    sql += " AND e.status=$2";
  }
  sql += " ORDER BY e.scheduled_at DESC LIMIT 1000";
  const result = await db.query(sql, params);
  res.json({ emails: result.rows });
});
router.get("/search", async (req: any, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ emails: [] });
  try {
    const result = await searchClient.search({
      index: "emails",
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: q,
                fields: ["recipient", "subject", "body"],
              },
            },
          ],
          filter: [{ term: { userId: String(req.user.id) } }],
        },
      },
      size: 100,
    });
    res.json({ emails: result.hits.hits.map((h: any) => h._source) });
  } catch {
    res
      .status(503)
      .json({ error: "Search is unavailable. Check Elasticsearch." });
  }
});
router.get("/senders", async (req: any, res) => {
  const result = await db.query(
    "SELECT id,email FROM senders WHERE user_id=$1 ORDER BY created_at",
    [req.user.id],
  );
  res.json({ senders: result.rows });
});
router.get("/queue", async (_req, res) => {
  const counts = await emailQueue.getJobCounts(
    "waiting",
    "active",
    "delayed",
    "completed",
    "failed",
    "paused",
  );
  res.json({ queue: "email-scheduler", counts });
});
export default router;
