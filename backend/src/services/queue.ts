import { Queue } from "bullmq";
import { redis } from "../lib/redis.js";
export const emailQueue = new Queue("email-scheduler", {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { age: 86400, count: 10000 },
    removeOnFail: false,
  },
});
