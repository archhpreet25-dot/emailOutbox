import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { env } from "./config/env.js";
import { initDb } from "./lib/db.js";
import { emailQueue } from "./services/queue.js";
import authRoutes from "./routes/auth.js";
import emailRoutes from "./routes/emails.js";
import { startEmailWorker } from "./workers/emailWorker.js";
const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 3600000,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());
const boardAdapter = new ExpressAdapter();
boardAdapter.setBasePath("/admin/queues");
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: boardAdapter,
});
app.use("/admin/queues", boardAdapter.getRouter());
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "reachinbox-scheduler" }),
);
app.use("/auth", authRoutes);
app.use("/api/emails", emailRoutes);
await initDb();
startEmailWorker();
app.listen(env.port, () =>
  console.log(`API ready on http://localhost:${env.port}`),
);
