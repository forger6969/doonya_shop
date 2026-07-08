import { bot } from './telegram';
import { config, ADMIN_IDS } from './config';
import { getAllUserIds } from './repo';

// Python used "{n:,}" → comma thousands separator.
const fmt = (n: number): string => n.toLocaleString('en-US');

// Escape user-controlled text before embedding it in parse_mode:'HTML' messages.
// Without this, a name/field-answer containing <, > or & makes Telegram reject
// the whole message (invalid HTML) → the admin silently never gets the order,
// and opens an HTML-injection hole.
const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } };

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Fan out an admin notification (topup/order) to every current admin — env super-admins AND
// dynamic staff admins (config.ADMIN_IDS is kept live by reloadStaff()). Previously these only
// reached config.adminId (the single owner), so admins added later via the panel never saw new
// topups/orders. One admin's chat being unreachable (e.g. never opened /start) must not stop the
// notification from reaching the others.
async function notifyAllAdmins(send: (chatId: number) => Promise<unknown>): Promise<void> {
  await Promise.all(
    [...ADMIN_IDS].map((id) => send(id).catch((err) => console.error('notifyAllAdmins failed for', id, err))),
  );
}

export async function notifyAdminTopup(args: {
  topupId: string; userId: number; amount: number; method: string;
  receiptUrl?: string; firstName?: string; username?: string;
}): Promise<void> {
  let userLabel: string;
  if (args.username) {
    userLabel = args.firstName
      ? `<b>${esc(args.firstName)}</b> @${esc(args.username)} (ID: <code>${args.userId}</code>)`
      : `@${esc(args.username)} (ID: <code>${args.userId}</code>)`;
  } else if (args.firstName) {
    userLabel = `<b>${esc(args.firstName)}</b> (ID: <code>${args.userId}</code>)`;
  } else {
    userLabel = `ID: <code>${args.userId}</code>`;
  }
  const text =
    `💰 <b>Новое пополнение</b>\n` +
    `От: ${userLabel}\n` +
    `Сумма: <b>${fmt(args.amount)} сум</b>\n` +
    `Метод: ${esc(args.method)}\n` +
    `ID: <code>${esc(args.topupId)}</code>`;
  const rows: InlineButton[][] = [
    [
      { text: '✅ Подтвердить', callback_data: `confirm_topup:${args.topupId}` },
      { text: '❌ Отклонить', callback_data: `reject_topup:${args.topupId}` },
    ],
  ];
  if (config.miniAppUrl) {
    rows.push([{ text: '📱 Открыть приложение', web_app: { url: `${config.miniAppUrl}?section=payments` } }]);
  }
  const extra = { parse_mode: 'HTML' as const, reply_markup: { inline_keyboard: rows } };
  // Cloudinary receipts can come out as huge/16-bit PNGs (some phone screenshot pipelines produce
  // these) — Telegram's sendPhoto-by-URL silently rejects anything it can't fetch/decode as a
  // normal photo ("failed to get HTTP URL content"), and that used to kill the ENTIRE notification
  // for every admin, not just the photo. Ask Cloudinary to deliver a safe, always-decodable copy
  // for the Telegram call specifically (resize + force 8-bit JPEG) — the original stays untouched
  // in the DB/receipt record.
  const telegramSafeReceiptUrl = args.receiptUrl?.replace('/upload/', '/upload/w_1280,f_jpg,q_auto/');
  await notifyAllAdmins(async (chatId) => {
    if (!telegramSafeReceiptUrl) {
      await bot.telegram.sendMessage(chatId, text, extra);
      return;
    }
    try {
      await bot.telegram.sendPhoto(chatId, telegramSafeReceiptUrl, { caption: text, ...extra });
    } catch (err) {
      // Belt-and-suspenders: even the transformed URL can fail (Cloudinary hiccup, huge original,
      // etc). Never let a photo-delivery failure mean the admin hears NOTHING about the topup —
      // fall back to a text message with a clickable link to the receipt.
      console.error('notifyAdminTopup: sendPhoto failed, falling back to text', chatId, err);
      await bot.telegram.sendMessage(chatId, `${text}\nЧек: ${args.receiptUrl}`, extra);
    }
  });
}

export async function notifyAdminOrder(args: {
  orderId: string; userId: number; productName: string; price: number;
  variantLabel?: string; fieldAnswers?: Record<string, unknown>;
  username?: string; firstName?: string;
}): Promise<void> {
  let userLabel: string;
  if (args.username) {
    userLabel = args.firstName
      ? `<b>${esc(args.firstName)}</b> @${esc(args.username)} (<code>${args.userId}</code>)`
      : `@${esc(args.username)} (<code>${args.userId}</code>)`;
  } else if (args.firstName) {
    userLabel = `<b>${esc(args.firstName)}</b> (<code>${args.userId}</code>)`;
  } else {
    userLabel = `<code>${args.userId}</code>`;
  }
  let text = `🛒 <b>Новый заказ</b>\nОт: ${userLabel}\nТовар: <b>${esc(args.productName)}</b>`;
  if (args.variantLabel) text += ` — ${esc(args.variantLabel)}`;
  text += `\nЦена: ${fmt(args.price)} сум\nOrder ID: <code>${esc(args.orderId)}</code>`;
  if (args.fieldAnswers && Object.keys(args.fieldAnswers).length) {
    text += '\n';
    for (const [k, v] of Object.entries(args.fieldAnswers)) text += `\n${esc(k)}: <code>${esc(v)}</code>`;
  }
  const contactUrl = args.username ? `https://t.me/${args.username}` : `tg://user?id=${args.userId}`;
  const rows: InlineButton[][] = [
    [
      { text: '✅ Выполнен', callback_data: `done_order:${args.orderId}` },
      { text: '✍️ Написать', url: contactUrl },
    ],
  ];
  await notifyAllAdmins((chatId) =>
    bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }),
  );
}

export async function notifyUserTopupConfirmed(userId: number, amount: number): Promise<void> {
  await bot.telegram.sendMessage(
    userId,
    `✅ Ваш баланс пополнен на <b>${fmt(amount)} сум</b>. Приятных покупок!`,
    { parse_mode: 'HTML' },
  );
}

export async function notifyUserTopupRejected(userId: number): Promise<void> {
  await bot.telegram.sendMessage(
    userId,
    '❌ Ваш запрос на пополнение отклонён. Напишите в поддержку если считаете это ошибкой.',
    { parse_mode: 'HTML' },
  );
}

export async function notifyUserOrderRefunded(userId: number, amount: number): Promise<void> {
  try {
    await bot.telegram.sendMessage(
      userId,
      `↩️ Ваш заказ отменён, <b>${fmt(amount)} сум</b> возвращены на баланс.`,
      { parse_mode: 'HTML' },
    );
  } catch (e) {
    console.warn(`notifyUserOrderRefunded failed for user ${userId}:`, e);
  }
}

export async function broadcastDiscount(args: {
  productName: string; discountPercent: number; photoUrl?: string; gameName?: string;
}): Promise<number> {
  const userIds = await getAllUserIds();
  const gameLine = args.gameName ? `🎮 <b>${esc(args.gameName)}</b>\n` : '';
  const text =
    `🔥 <b>СКИДКА В DOONYA SHOP!</b>\n\n` +
    `${gameLine}` +
    `Товар: <b>${esc(args.productName)}</b>\n` +
    `Скидка: <b>-${args.discountPercent}%</b> 🎉\n\n` +
    `Успей купить по выгодной цене!`;
  const reply_markup = config.miniAppUrl
    ? { inline_keyboard: [[{ text: '🛒 Открыть магазин', web_app: { url: config.miniAppUrl } }]] }
    : undefined;

  let sent = 0;
  for (const userId of userIds) {
    try {
      if (args.photoUrl) {
        await bot.telegram.sendPhoto(userId, args.photoUrl, { caption: text, parse_mode: 'HTML', reply_markup });
      } else {
        await bot.telegram.sendMessage(userId, text, { parse_mode: 'HTML', reply_markup });
      }
      sent += 1;
    } catch {
      /* user blocked bot / chat not found */
    }
    if (sent % 20 === 0) await sleep(1000); // ~20 msg/sec, stay under Telegram limits
  }
  return sent;
}

export async function notifyUserOrderReady(userId: number, orderId: string, productName = ''): Promise<void> {
  const label = productName ? `<b>${esc(productName)}</b>` : 'Ваш заказ';
  let reply_markup;
  const reviewUrl =
    config.miniAppUrl && config.miniAppUrl.startsWith('https://') ? `${config.miniAppUrl}?review=${orderId}` : '';
  if (reviewUrl) {
    reply_markup = { inline_keyboard: [[{ text: '⭐ Оставить отзыв', web_app: { url: reviewUrl } }]] };
  }
  try {
    await bot.telegram.sendMessage(
      userId,
      `🎮 ${label} выполнен!\n\nОставьте отзыв — это помогает другим покупателям 🙏`,
      { parse_mode: 'HTML', reply_markup },
    );
  } catch (e) {
    console.error(`notifyUserOrderReady: send failed to ${userId}:`, e);
  }
}

// Notify an order's user that an admin replied (used by order-chat WS).
export async function notifyOrderChatUser(chat: Record<string, unknown>, text: string): Promise<void> {
  try {
    const product = (chat.product_name as string) || 'заказ';
    const orderId = chat.order_id as string;
    const caption = `💬 <b>Сообщение по заказу «${esc(product)}»</b>\n\n${esc(text)}`;
    let reply_markup;
    if (config.miniAppUrl && config.miniAppUrl.startsWith('https://')) {
      reply_markup = {
        inline_keyboard: [[{ text: '📱 Открыть чат', web_app: { url: `${config.miniAppUrl}?order_chat=${orderId}` } }]],
      };
    }
    await bot.telegram.sendMessage(chat.user_id as number, caption, { parse_mode: 'HTML', reply_markup });
  } catch (e) {
    console.warn(`notifyOrderChatUser failed for order ${chat.order_id}:`, e);
  }
}

// Notify a user that a support agent replied (used by support WS). Without this
// the reply only reached users who had the app open (WebSocket); users with the
// app closed got nothing — the "уведомление при ответе в чат не работает" bug.
export async function notifyUserSupportReply(userId: number, text: string): Promise<void> {
  try {
    const caption = `💬 <b>Ответ поддержки</b>\n\n${esc(text)}`;
    let reply_markup;
    if (config.miniAppUrl && config.miniAppUrl.startsWith('https://')) {
      reply_markup = {
        inline_keyboard: [[{ text: '📱 Открыть чат', web_app: { url: `${config.miniAppUrl}?section=support` } }]],
      };
    }
    await bot.telegram.sendMessage(userId, caption, { parse_mode: 'HTML', reply_markup });
  } catch (e) {
    console.warn(`notifyUserSupportReply failed for user ${userId}:`, e);
  }
}

// Notify support agents that a user wrote (used when no agent WS is online).
export async function notifyAgentsBot(tgUser: { first_name?: string; username?: string }, text: string, agentIds: number[]): Promise<void> {
  const name = esc(tgUser.first_name ?? '');
  const username = esc(tgUser.username || '—');
  const header = `💬 <b>${name}</b> (@${username}) написал в поддержку:\n\n${esc(text)}`;
  for (const agentId of agentIds) {
    try {
      await bot.telegram.sendMessage(agentId, header, { parse_mode: 'HTML' });
    } catch {
      /* ignore */
    }
  }
}
