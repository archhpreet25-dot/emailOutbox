import { initDb } from "./lib/db.js";
import { startEmailWorker } from "./workers/emailWorker.js";
await initDb();
const worker = startEmailWorker();
const shutdown = async () => {
  await worker.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
