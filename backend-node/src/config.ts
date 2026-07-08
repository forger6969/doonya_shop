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

// Env-defined super-roles: ADMIN_ID + EXTRA_ADMIN_IDS (admins) and SUPPORT_AGENT_IDS
// (agents). No IDs hardcoded — configure via env. These are IMMUTABLE: they cannot be
// removed from the admin panel (a misconfigured DB can never lock the owner out).
const ENV_ADMIN_IDS: Set<number> = (() => {
  const ids = parseIds(process.env.EXTRA_ADMIN_IDS ?? '');
  if (config.adminId !== 0) ids.add(config.adminId);
  return ids;
})();
const ENV_SUPPORT_AGENT_IDS: Set<number> = parseIds(process.env.SUPPORT_AGENT_IDS ?? '');

// Effective role sets = env super-roles + dynamic DB staff (collection `staff`).
// Populated on boot and after every staff change by reloadStaff(). IMPORTANT: these
// Set objects are mutated in place (never reassigned) so every module that imported
// the reference keeps seeing live updates.
export const ADMIN_IDS: Set<number> = new Set(ENV_ADMIN_IDS);
export const SUPPORT_AGENT_IDS: Set<number> = new Set(ENV_SUPPORT_AGENT_IDS);
export const AGENT_IDS: Set<number> = new Set([...ADMIN_IDS, ...SUPPORT_AGENT_IDS]);

// An env super-admin is immutable — protected from deletion via the panel.
export const isEnvAdmin = (id: number): boolean => ENV_ADMIN_IDS.has(id);

// Immutable env-defined roles (shown in the panel without a delete button).
export const listEnvRoles = (): { admins: number[]; moderators: number[] } => ({
  admins: [...ENV_ADMIN_IDS],
  moderators: [...ENV_SUPPORT_AGENT_IDS],
});

// Rebuild ADMIN_IDS / SUPPORT_AGENT_IDS / AGENT_IDS from env + the Staff collection.
// Call after DB connect on boot, and after any staff add/remove. Mutates in place.
export async function reloadStaff(): Promise<void> {
  const { Staff } = await import('./models');
  const rows = (await Staff.find({}, { user_id: 1, role: 1 }).lean()) as Array<{ user_id: number; role: string }>;
  const admins = new Set<number>(ENV_ADMIN_IDS);
  const mods = new Set<number>(ENV_SUPPORT_AGENT_IDS);
  for (const r of rows) {
    if (r.role === 'admin') admins.add(r.user_id);
    else if (r.role === 'moderator') mods.add(r.user_id);
  }
  ADMIN_IDS.clear(); admins.forEach((i) => ADMIN_IDS.add(i));
  SUPPORT_AGENT_IDS.clear(); mods.forEach((i) => SUPPORT_AGENT_IDS.add(i));
  AGENT_IDS.clear();
  ADMIN_IDS.forEach((i) => AGENT_IDS.add(i));
  SUPPORT_AGENT_IDS.forEach((i) => AGENT_IDS.add(i));
}
