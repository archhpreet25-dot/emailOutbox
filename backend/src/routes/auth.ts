import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db.js";
import { env } from "../config/env.js";
const router = Router();
if (env.googleClientId && env.googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL: env.googleCallbackUrl,
      },
      async (_a, _r, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email)
            return done(new Error("Google account did not provide an email"));
          const id = profile.id;
          const name = profile.displayName || email;
          const avatar = profile.photos?.[0]?.value || null;
          await db.query(
            "INSERT INTO users(id,email,name,avatar) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,avatar=EXCLUDED.avatar",
            [id, email, name, avatar],
          );
          await db.query(
            "INSERT INTO senders(id,user_id,email) VALUES($1,$2,$3) ON CONFLICT(user_id,email) DO NOTHING",
            [randomUUID(), id, email],
          );
          return done(null, { id, email, name, avatar });
        } catch (e) {
          done(e as Error);
        }
      },
    ),
  );
  passport.serializeUser((user: any, done) => done(null, user));
  passport.deserializeUser((user: any, done) => done(null, user));
}
router.get(
  "/google",
  (_req, res, next) => {
    if (!env.googleClientId)
      return res
        .status(503)
        .send("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend .env");
    next();
  },
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/error" }),
  (req, res) => res.redirect(env.frontendUrl),
);
router.get("/error", (_req, res) =>
  res.status(401).send("Google login failed. Please retry."),
);
router.get("/me", (req, res) => res.json({ user: req.user ?? null }));
router.post("/logout", (req, res) =>
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    req.session.destroy(() => res.json({ ok: true }));
  }),
);
router.get("/slack", (req, res) => {
  if (!env.slackClientId)
    return res
      .status(503)
      .send("Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in backend .env");
  const state = String((req.user && (req.user as any).id) || "");
  if (!state) return res.status(401).send("Login first");
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", env.slackClientId);
  url.searchParams.set("scope", "chat:write,im:write");
  url.searchParams.set("redirect_uri", env.slackRedirectUri);
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});
router.get("/slack/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const userId = String(req.query.state || "");
    if (!code || !userId)
      return res.status(400).send("Missing Slack OAuth parameters");
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.slackClientId,
        client_secret: env.slackClientSecret,
        redirect_uri: env.slackRedirectUri,
      }),
    });
    const data = (await tokenRes.json()) as any;
    if (!data.ok || !data.access_token)
      return res.status(400).send("Slack OAuth failed");
    await db.query(
      "UPDATE users SET slack_access_token=$2,slack_user_id=$3,slack_team_name=$4 WHERE id=$1",
      [
        userId,
        data.access_token,
        data.authed_user?.id || null,
        data.team?.name || null,
      ],
    );
    res.redirect(`${env.frontendUrl}?slack=connected`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Slack connection failed");
  }
});
export default router;
