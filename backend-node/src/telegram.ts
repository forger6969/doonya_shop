import { Telegraf } from 'telegraf';
import { config } from './config';

// Single bot instance shared by notify.ts (sending) and bot.ts (handlers).
// Kept in its own module so those two don't form an import cycle.
export const bot = new Telegraf(config.botToken);
