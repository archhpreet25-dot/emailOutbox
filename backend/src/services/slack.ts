import { db } from "../lib/db.js";
export async function notifyRateLimit(
  userId: string,
  senderEmail: string,
  nextWindow: Date,
) {
  const result = await db.query(
    "SELECT slack_access_token, slack_user_id FROM users WHERE id=$1",
    [userId],
  );
  const token: string | undefined = result.rows[0]?.slack_access_token;
  const slackUserId: string | undefined = result.rows[0]?.slack_user_id;
  if (!token || !slackUserId) return;
  try {
    const dm = await fetch("https://slack.com/api/conversations.open", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ users: slackUserId }),
    });
    const dmData = (await dm.json()) as {
      ok?: boolean;
      channel?: { id?: string };
      error?: string;
    };
    if (!dmData.ok || !dmData.channel?.id) {
      console.error("Could not open Slack DM:", dmData.error);
      return;
    }
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: dmData.channel.id,
        text: `⚠️ ReachInbox rate limit reached for sender ${senderEmail}. Queued emails are being rescheduled; next available window starts ${nextWindow.toISOString()}.`,
      }),
    });
    const json = (await response.json()) as { ok?: boolean; error?: string };
    if (!json.ok) console.error("Slack notification rejected:", json.error);
  } catch (e) {
    console.error("Slack notification failed:", e);
  }
}
