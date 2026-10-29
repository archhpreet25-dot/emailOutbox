import { Worker, Job, DelayedError } from "bullmq";
import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import { redis } from "../lib/redis.js";
import { db } from "../lib/db.js";
import { env } from "../config/env.js";
import { indexEmail } from "../lib/search.js";
import { notifyRateLimit } from "../services/slack.js";

async function send(
  job: Job<{ emailId: string; userId: string; senderId: string }>,
  token?: string,
) {
  const { emailId, userId, senderId } = job.data;
  const r = await db.query(
    "SELECT e.*,s.email AS sender_email,s.hourly_limit AS sender_hourly_limit FROM emails e JOIN senders s ON s.id=e.sender_id WHERE e.id=$1",
    [emailId],
  );
  const email = r.rows[0];
  if (!email || email.status === "sent") return { skipped: true };
  const hour = Math.floor(Date.now() / 3600000);
  const key = `email-limit:${senderId}:${hour}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 3700);
  if (count > Number(email.sender_hourly_limit || env.hourlyLimit)) {
    await redis.decr(key);
    const nextHour = new Date((hour + 1) * 3600000);
    await notifyRateLimit(userId, email.sender_email, nextHour);
    await job.moveToDelayed(nextHour.getTime(), token!);
    throw new DelayedError();
  }
  // Per-sender serialized spacing across worker processes. The Redis lock avoids concurrent sends from the same sender.
  const lockKey = `sender-lock:${senderId}`;
  const lock = await redis.set(
    lockKey,
    job.id ?? randomUUID(),
    "PX",
    Math.max(env.minDelayMs + 30000, 60000),
    "NX",
  );
  if (!lock) {
    await redis.decr(key);
    await job.moveToDelayed(Date.now() + env.minDelayMs, token!);
    throw new DelayedError();
  }
  try {
    await db.query(
      "UPDATE emails SET status='processing', error=NULL WHERE id=$1 AND status <> 'sent'",
      [emailId],
    );
    const account = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: account.user, pass: account.pass },
    });
    const info = await transporter.sendMail({
      from: `ReachInbox Demo <${account.user}>`,
      to: email.recipient,
      subject: email.subject,
      text: email.body,
    });
    const updated = await db.query(
      "UPDATE emails SET status='sent', sent_at=now(), error=$2 WHERE id=$1 RETURNING *",
      [
        emailId,
        `Ethereal preview: ${nodemailer.getTestMessageUrl(info) ?? ""}`,
      ],
    );
    await indexEmail({
      ...updated.rows[0],
      userId,
      scheduledAt: updated.rows[0].scheduled_at,
      sentAt: updated.rows[0].sent_at,
    });
    return {
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown SMTP error";
    const attempts = job.attemptsMade + 1;
    if (attempts >= Number(job.opts.attempts ?? 1)) {
      const failed = await db.query(
        "UPDATE emails SET status='failed', error=$2 WHERE id=$1 RETURNING *",
        [emailId, message],
      );
      await indexEmail({
        ...failed.rows[0],
        userId,
        scheduledAt: failed.rows[0].scheduled_at,
        sentAt: failed.rows[0].sent_at,
      });
    } else
      await db.query(
        "UPDATE emails SET status='scheduled', error=$2 WHERE id=$1 AND status <> 'sent'",
        [emailId, message],
      );
    throw error;
  } finally {
    await new Promise((resolve) => setTimeout(resolve, env.minDelayMs));
    const current = await redis.get(lockKey);
    if (current === (job.id ?? "")) await redis.del(lockKey);
  }
}
export function startEmailWorker() {
  const worker = new Worker("email-scheduler", send, {
    connection: redis,
    concurrency: env.concurrency,
  });
  worker.on("failed", (job, err) =>
    console.error(`Job ${job?.id} failed:`, err.message),
  );
  worker.on("error", (err) => console.error("Worker error:", err));
  console.log(
    `Email worker started (concurrency=${env.concurrency}, minDelay=${env.minDelayMs}ms, hourlyLimit=${env.hourlyLimit}/sender)`,
  );
  return worker;
}
