import 'dotenv/config';
export const env = {
 port: Number(process.env.PORT ?? 4000), frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
 backendUrl: process.env.BACKEND_URL ?? 'http://localhost:4000', databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/reachinbox',
 redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379', elasticUrl: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
 sessionSecret: process.env.SESSION_SECRET ?? 'dev-only-change-me', googleClientId: process.env.GOOGLE_CLIENT_ID ?? '', googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
 googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:4000/auth/google/callback',
 concurrency: Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 10)), minDelayMs: Math.max(0, Number(process.env.MIN_DELAY_MS ?? 2000)),
 hourlyLimit: Math.max(1, Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? 100)),
 slackClientId: process.env.SLACK_CLIENT_ID ?? '', slackClientSecret: process.env.SLACK_CLIENT_SECRET ?? '', slackRedirectUri: process.env.SLACK_REDIRECT_URI ?? 'http://localhost:4000/auth/slack/callback'
};
