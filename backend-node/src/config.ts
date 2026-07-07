import dotenv from 'dotenv';

dotenv.config();

const parseIds = (raw: string): Set<number> =>
  new Set(
    raw
      .split(',')
      .map((x) => parseInt(x.trim(), 10))
      .filter((x) => Number.isFinite(x) && x !== 0),
  );

export const config = {
  botToken: process.env.BOT_TOKEN ?? '',
  adminId: parseInt(process.env.ADMIN_ID ?? '0', 10),
  mongodbUri: process.env.MONGODB_URI ?? '',
  dbName: process.env.DB_NAME ?? 'nyx_shop',
  miniAppUrl: process.env.MINI_APP_URL ?? '',
  port: parseInt(process.env.PORT ?? '8000', 10),
  webhookUrl: process.env.WEBHOOK_URL ?? '',
  // Secret shared with Telegram (setWebhook secret_token). Requests to /webhook
  // must echo it in the X-Telegram-Bot-Api-Secret-Token header, else they are
  // forged and rejected. MUST be set in prod, otherwise the webhook is open.
  webhookSecret: process.env.WEBHOOK_SECRET ?? '',

  // Payment requisites are seeded into the DB (payment_methods) from env on first
  // boot only. No real card numbers in source — set via env or the admin panel.
  cardRequisites: process.env.CARD_REQUISITES ?? '',
  cardHolder: process.env.CARD_HOLDER ?? '',
  uzcardRequisites: process.env.UZCARD_REQUISITES ?? '',
  uzcardHolder: process.env.UZCARD_HOLDER ?? '',
  visaRequisites: process.env.VISA_REQUISITES ?? '',
  visaHolder: process.env.VISA_HOLDER ?? '',

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
};

// Multi-admin: ADMIN_ID + EXTRA_ADMIN_IDS. No IDs are hardcoded — configure via
// env. Empty by default so a misconfigured deploy grants nobody admin (fail-safe).
export const ADMIN_IDS: Set<number> = (() => {
  const ids = parseIds(process.env.EXTRA_ADMIN_IDS ?? '');
  if (config.adminId !== 0) ids.add(config.adminId);
  return ids;
})();

// Support agents — can reply to users in support/order chats. Env-only.
export const SUPPORT_AGENT_IDS: Set<number> = parseIds(process.env.SUPPORT_AGENT_IDS ?? '');

// Anyone who can act as a chat agent (admins + support agents)
export const AGENT_IDS: Set<number> = new Set([...ADMIN_IDS, ...SUPPORT_AGENT_IDS]);
