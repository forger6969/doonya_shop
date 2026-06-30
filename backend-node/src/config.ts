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

  cardRequisites: process.env.CARD_REQUISITES ?? '8600 1234 5678 9012',
  cardHolder: process.env.CARD_HOLDER ?? 'NYX SHOP',
  uzcardRequisites: process.env.UZCARD_REQUISITES ?? '5614 6868 1494 1939',
  uzcardHolder: process.env.UZCARD_HOLDER ?? 'H.D',
  visaRequisites: process.env.VISA_REQUISITES ?? '4413 5976 0450 1484',
  visaHolder: process.env.VISA_HOLDER ?? 'H.D',

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
};

// Multi-admin: ADMIN_ID + EXTRA_ADMIN_IDS (default mirrors the Python backend)
export const ADMIN_IDS: Set<number> = (() => {
  const ids = parseIds(process.env.EXTRA_ADMIN_IDS ?? '7004667100');
  if (config.adminId !== 0) ids.add(config.adminId);
  return ids;
})();

// Support agents — can reply to users in support/order chats
export const SUPPORT_AGENT_IDS: Set<number> = parseIds(
  process.env.SUPPORT_AGENT_IDS ?? '1771984046,8235243143',
);

// Anyone who can act as a chat agent (admins + support agents)
export const AGENT_IDS: Set<number> = new Set([...ADMIN_IDS, ...SUPPORT_AGENT_IDS]);
