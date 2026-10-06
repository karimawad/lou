// Starts Lou's key server from environment settings (see .env.example and app.mjs). Listens on localhost only;
// the web server proxies /api/ to it.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHandler } from './app.mjs';
import { mailer } from './mail.mjs';
import { stripeClient } from './stripe.mjs';

const env = process.env;
const need = (name) => { if (!env[name]) { console.error(`Missing ${name}`); process.exit(1); } return env[name]; };

const handler = createHandler({
  stripe: stripeClient(need('STRIPE_SECRET_KEY')),
  mail: mailer(Object.fromEntries(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'REPLY_TO'].map((k) => [k, env[k]]))),
  privateKeyPem: readFileSync(need('LICENSE_PRIVATE_KEY_FILE'), 'utf8'),
  kid: env.LICENSE_KID ?? 'k1',
  priceYears: JSON.parse(need('LICENSE_PRICES')), // {"price_123":[2023,2024,2025]}
  webhookSecret: need('STRIPE_WEBHOOK_SECRET'),
  siteUrl: (env.SITE_URL ?? 'https://lou.bigtimedesign.ca').replace(/\/$/, ''),
  supportTo: env.SUPPORT_TO ?? 'karim@bigtimedesign.ca',
});

// A crash-looping service is worse than one logged error: report and carry on (systemd restarts it if it does die).
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e instanceof Error ? e.message : 'non-error'));
process.on('uncaughtException', (e) => console.error('uncaughtException', e.message));

const server = createServer(handler);
server.headersTimeout = 10_000;   // slow-loris style connections are cut off
server.requestTimeout = 20_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 50;
server.listen(Number(env.PORT ?? 3417), '127.0.0.1', () => console.log('lou-license listening'));
