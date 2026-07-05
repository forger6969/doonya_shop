import { bot } from './telegram';
import { config } from './config';
import { getAllUserIds } from './repo';

// Python used "{n:,}" → comma thousands separator.
const fmt = (n: number): string => n.toLocaleString('en-US');

type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } };

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function notifyAdminTopup(args: {
  topupId: string; userId: number; amount: number; method: string;
  receiptUrl?: string; firstName?: string;
}): Promise<void> {
  const userLabel = args.firstName
    ? `<b>${args.firstName}</b> (ID: <code>${args.userId}</code>)`
    : `ID: <code>${args.userId}</code>`;
  const text =
    `💰 <b>Новое пополнение</b>\n` +
    `От: ${userLabel}\n` +
    `Сумма: <b>${fmt(args.amount)} сум</b>\n` +
    `Метод: ${args.method}\n` +
    `ID: <code>${args.topupId}</code>`;
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
  if (args.receiptUrl) {
    await bot.telegram.sendPhoto(config.adminId, args.receiptUrl, { caption: text, ...extra });
  } else {
    await bot.telegram.sendMessage(config.adminId, text, extra);
  }
}

export async function notifyAdminOrder(args: {
  orderId: string; userId: number; productName: string; price: number;
  variantLabel?: string; fieldAnswers?: Record<string, unknown>;
  username?: string; firstName?: string;
}): Promise<void> {
  let userLabel: string;
  if (args.username) {
    userLabel = args.firstName
      ? `<b>${args.firstName}</b> @${args.username} (<code>${args.userId}</code>)`
      : `@${args.username} (<code>${args.userId}</code>)`;
  } else if (args.firstName) {
    userLabel = `<b>${args.firstName}</b> (<code>${args.userId}</code>)`;
  } else {
    userLabel = `<code>${args.userId}</code>`;
  }
  let text = `🛒 <b>Новый заказ</b>\nОт: ${userLabel}\nТовар: <b>${args.productName}</b>`;
  if (args.variantLabel) text += ` — ${args.variantLabel}`;
  text += `\nЦена: ${fmt(args.price)} сум\nOrder ID: <code>${args.orderId}</code>`;
  if (args.fieldAnswers && Object.keys(args.fieldAnswers).length) {
    text += '\n';
    for (const [k, v] of Object.entries(args.fieldAnswers)) text += `\n${k}: <code>${v}</code>`;
  }
  const contactUrl = args.username ? `https://t.me/${args.username}` : `tg://user?id=${args.userId}`;
  const rows: InlineButton[][] = [
    [
      { text: '✅ Выполнен', callback_data: `done_order:${args.orderId}` },
      { text: '✍️ Написать', url: contactUrl },
    ],
  ];
  await bot.telegram.sendMessage(config.adminId, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: rows },
  });
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

export async function broadcastDiscount(args: {
  productName: string; discountPercent: number; photoUrl?: string; gameName?: string;
}): Promise<number> {
  const userIds = await getAllUserIds();
  const gameLine = args.gameName ? `🎮 <b>${args.gameName}</b>\n` : '';
  const text =
    `🔥 <b>СКИДКА В DOONYA SHOP!</b>\n\n` +
    `${gameLine}` +
    `Товар: <b>${args.productName}</b>\n` +
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
  const label = productName ? `<b>${productName}</b>` : 'Ваш заказ';
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
    const caption = `💬 <b>Сообщение по заказу «${product}»</b>\n\n${text}`;
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
    const caption = `💬 <b>Ответ поддержки</b>\n\n${text}`;
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
  const name = tgUser.first_name ?? '';
  const username = tgUser.username || '—';
  const header = `💬 <b>${name}</b> (@${username}) написал в поддержку:\n\n${text}`;
  for (const agentId of agentIds) {
    try {
      await bot.telegram.sendMessage(agentId, header, { parse_mode: 'HTML' });
    } catch {
      /* ignore */
    }
  }
}
