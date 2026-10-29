import { Client } from "@elastic/elasticsearch";
import { env } from "../config/env.js";
export const searchClient = new Client({ node: env.elasticUrl });
export async function indexEmail(email: Record<string, unknown>) {
  try {
    const exists = await searchClient.indices.exists({ index: "emails" });
    if (!exists)
      await searchClient.indices.create({
        index: "emails",
        mappings: {
          properties: {
            recipient: { type: "text" },
            subject: { type: "text" },
            body: { type: "text" },
            status: { type: "keyword" },
            userId: { type: "keyword" },
            scheduledAt: { type: "date" },
            sentAt: { type: "date" },
          },
        },
      });
    await searchClient.index({
      index: "emails",
      id: String(email.id),
      document: email,
      refresh: "wait_for",
    });
  } catch (e) {
    console.error(
      "Elasticsearch indexing failed:",
      e instanceof Error ? e.message : e,
    );
  }
}
