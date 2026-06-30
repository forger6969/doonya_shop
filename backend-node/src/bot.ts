import fs from 'fs';
import path from 'path';
import { Context } from 'telegraf';
import { bot } from './telegram';
import { config, ADMIN_IDS, SUPPORT_AGENT_IDS } from './config';
import { confirmTopup, rejectTopup, completeOrder, getProduct, addChatMessage } from './repo';
import {
  notifyUserTopupConfirmed, notifyUserTopupRejected, notifyUserOrderReady,
} from './notify';
import { supportManager } from './realtime';

const BANNER_PATH = process.env.BANNER_PATH ?? path.join(__dirname, '..', 'welcome_banner.png');

// ── /start ────────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const caption =
    '👋 Добро пожаловать в <b>Doonya Shop</b>!\n\n' +
    'Здесь вы можете купить внутриигровую валюту, донаты и товары для ваших игр.';
  const reply_markup = { inline_keyboard: [[{ text: '🎮 Открыть магазин', web_app: { url: config.miniAppUrl } }]] };
  try {
    if (fs.existsSync(BANNER_PATH)) {
      await ctx.replyWithPhoto({ source: BANNER_PATH }, { caption, parse_mode: 'HTML', reply_markup });
    } else {
      await ctx.reply(caption, { parse_mode: 'HTML', reply_markup });
    }
  } catch {
    await ctx.reply(caption, { parse_mode: 'HTML', reply_markup });
  }
});

// Edit the admin message to prepend a status line and drop the inline buttons.
async function editStatus(ctx: Context, statusLine: string): Promise<void> {
  const msg = ctx.callbackQuery?.message as { photo?: unknown; caption?: string; text?: string } | undefined;
  try {
    if (msg?.photo) {
      await ctx.editMessageCaption(`${statusLine}\n\n${msg.caption ?? ''}`, { parse_mode: 'HTML' });
    } else {
      await ctx.editMessageText(`${statusLine}\n\n${msg?.text ?? ''}`, { parse_mode: 'HTML' });
    }
  } catch {
    try {
      await ctx.editMessageReplyMarkup(undefined);
    } catch {
      /* ignore */
    }
  }
}

const fmt = (n: number): string => n.toLocaleString('en-US');

// ── Callback handlers ─────────────────────────────────────────────────────────
bot.action(/^confirm_topup:(.+)$/, async (ctx) => {
  if (!ADMIN_IDS.has(ctx.from.id)) return ctx.answerCbQuery('Нет доступа', { show_alert: true });
  const result = await confirmTopup(ctx.match[1]);
  if (result) {
    await notifyUserTopupConfirmed(result.user_id as number, result.amount as number);
    await editStatus(ctx, `✅ <b>ПОДТВЕРЖДЕНО</b> — баланс +${fmt(result.amount as number)} сум`);
    return ctx.answerCbQuery('✅ Подтверждено! Баланс пополнен.');
  }
  return ctx.answerCbQuery('Уже обработано', { show_alert: true });
});

bot.action(/^reject_topup:(.+)$/, async (ctx) => {
  if (!ADMIN_IDS.has(ctx.from.id)) return ctx.answerCbQuery('Нет доступа', { show_alert: true });
  const result = await rejectTopup(ctx.match[1]);
  if (result) {
    await notifyUserTopupRejected(result.user_id as number);
    await editStatus(ctx, '❌ <b>ОТКЛОНЕНО</b>');
    return ctx.answerCbQuery('❌ Отклонено.');
  }
  return ctx.answerCbQuery('Уже обработано', { show_alert: true });
});

bot.action(/^done_order:(.+)$/, async (ctx) => {
  if (!ADMIN_IDS.has(ctx.from.id)) return ctx.answerCbQuery('Нет доступа', { show_alert: true });
  const order = await completeOrder(ctx.match[1]);
  if (order) {
    let productName = '';
    try {
      const p = await getProduct(order.product_id as string);
      productName = p ? (p.name as string) : '';
    } catch {
      /* ignore */
    }
    await notifyUserOrderReady(order.user_id as number, ctx.match[1], productName);
    await editStatus(ctx, '✅ <b>ВЫПОЛНЕН</b> — пользователь уведомлён');
    return ctx.answerCbQuery('✅ Заказ выполнен, пользователь уведомлён.');
  }
  return ctx.answerCbQuery('Заказ не найден', { show_alert: true });
});

// ── Legacy text command fallbacks ─────────────────────────────────────────────
bot.hears(/^\/confirm_(.+)$/, async (ctx) => {
  if (ctx.from.id !== config.adminId) return;
  const result = await confirmTopup(ctx.match[1].trim());
  if (result) {
    await notifyUserTopupConfirmed(result.user_id as number, result.amount as number);
    await ctx.reply('✅ Пополнение подтверждено, баланс обновлён.');
  } else {
    await ctx.reply('❌ Не найдено или уже обработано.');
  }
});

bot.hears(/^\/reject_(.+)$/, async (ctx) => {
  if (ctx.from.id !== config.adminId) return;
  const result = await rejectTopup(ctx.match[1].trim());
  if (result) {
    await notifyUserTopupRejected(result.user_id as number);
    await ctx.reply('✅ Отклонено, пользователь уведомлён.');
  } else {
    await ctx.reply('❌ Не найдено или уже обработано.');
  }
});

bot.hears(/^\/done_(.+)$/, async (ctx) => {
  if (ctx.from.id !== config.adminId) return;
  const order = await completeOrder(ctx.match[1].trim());
  if (order) {
    await notifyUserOrderReady(order.user_id as number, ctx.match[1].trim());
    await ctx.reply('✅ Заказ выполнен, пользователь уведомлён.');
  } else {
    await ctx.reply('❌ Заказ не найден.');
  }
});

// ── Support: agent reply via bot — /sreply <user_id> <text> ───────────────────
bot.hears(/^\/sreply\s+([\s\S]+)$/, async (ctx) => {
  if (!SUPPORT_AGENT_IDS.has(ctx.from.id)) return;
  const rest = ctx.match[1].trim();
  const spaceIdx = rest.indexOf(' ');
  if (spaceIdx < 0) {
    await ctx.reply('Usage: /sreply <user_id> <text>');
    return;
  }
  const targetUserId = parseInt(rest.slice(0, spaceIdx), 10);
  if (!Number.isFinite(targetUserId)) {
    await ctx.reply('❌ Invalid user_id');
    return;
  }
  const text = rest.slice(spaceIdx + 1).trim();
  if (!text) {
    await ctx.reply('❌ Empty message');
    return;
  }

  const msg = await addChatMessage(targetUserId, 'agent', text, ctx.from.id);

  // Push to user via WebSocket if online + echo to other agents.
  try {
    supportManager.sendToUser(targetUserId, { type: 'message', ...msg });
    supportManager.broadcastToAgents({ type: 'message', user_id: targetUserId, ...msg });
  } catch {
    /* ignore */
  }

  // Notify user via bot in case they're not in the mini-app.
  try {
    await ctx.telegram.sendMessage(
      targetUserId,
      `💬 <b>Поддержка:</b>\n${text}\n\n<i>Открой магазин чтобы ответить</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '💬 Открыть чат', web_app: { url: config.miniAppUrl } }]] },
      },
    );
  } catch {
    /* ignore */
  }

  await ctx.reply('✅ Отправлено');
});

export { bot };
