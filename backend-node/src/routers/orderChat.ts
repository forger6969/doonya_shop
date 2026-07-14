import { Router } from 'express';
import { WebSocket } from 'ws';
import { asyncHandler, HttpError } from '../http';
import { requireUser, TgUser } from '../auth';
import { AGENT_IDS } from '../config';
import {
  getOrderChat, addOrderChatMsg, listOrderChats,
  markOrderChatReadAdmin, markOrderChatReadUser, getUserOrderChats, ensureOrderChat,
} from '../repo';
import { orderChatManager, sendJson } from '../realtime';
import { notifyOrderChatUser } from '../notify';
import { Users, OrderChats, Doc } from '../models';

const router = Router();

function fmt(chat: Doc): Doc {
  const messages = (chat.messages as Doc[]) ?? [];
  const lastTs = chat.last_ts;
  return {
    order_id: chat.order_id,
    user_id: chat.user_id,
    username: chat.username ?? '',
    first_name: chat.first_name ?? '',
    product_id: chat.product_id ?? '',
    product_name: chat.product_name ?? '',
    game_id: chat.game_id ?? '',
    game_name: chat.game_name ?? '',
    unread_by_admin: chat.unread_by_admin ?? 0,
    unread_by_user: chat.unread_by_user ?? 0,
    last_ts: lastTs instanceof Date ? lastTs.toISOString() : lastTs,
    last_message: messages.length ? messages[messages.length - 1].text : '',
  };
}

// Backfill username/first_name on old chat docs that lack both.
async function enrichUsernames(chats: Doc[]): Promise<void> {
  const missing = chats.filter((c) => !c.username && !c.first_name);
  if (!missing.length) return;
  const ids = [...new Set(missing.map((c) => c.user_id as number))];
  const users = await Users.find({ user_id: { $in: ids } }, { user_id: 1, username: 1, first_name: 1 }).lean<Doc[]>();
  const umap = new Map(users.map((u) => [u.user_id as number, u]));
  for (const c of missing) {
    const u = umap.get(c.user_id as number);
    if (u) {
      c.username = u.username ?? '';
      c.first_name = u.first_name ?? '';
      await OrderChats.updateOne({ order_id: c.order_id }, { $set: { username: c.username, first_name: c.first_name } });
    }
  }
}

// ── WebSocket handler ─────────────────────────────────────────────────────────
export async function handleOrderChatConnection(ws: WebSocket, tgUser: TgUser, orderId: string): Promise<void> {
  const userId = tgUser.id;
  const isAdmin = AGENT_IDS.has(userId);

  if (isAdmin) {
    orderChatManager.connectAdmin(userId, ws);
    const chats = await listOrderChats();
    sendJson(ws, { type: 'order_chats', chats: chats.map(fmt) });
  } else {
    if (!orderId) {
      ws.close(4002);
      return;
    }
    const chat = await getOrderChat(orderId);
    if (!chat || chat.user_id !== userId) {
      ws.close(4003);
      return;
    }
    orderChatManager.connectUser(orderId, userId, ws);
    await markOrderChatReadUser(orderId);
    sendJson(ws, { type: 'history', order_id: orderId, messages: (chat.messages as Doc[]) ?? [] });
  }

  ws.on('message', async (raw) => {
    let data: Doc;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const msgType = data.type;

    if (msgType === 'message') {
      const text = String(data.text ?? '').trim();
      if (!text) return;

      if (isAdmin) {
        const target = String(data.order_id ?? '');
        if (!target) return;
        const msg = await addOrderChatMsg(target, 'admin', text, userId);
        orderChatManager.sendToUser(target, { type: 'message', order_id: target, ...msg });
        orderChatManager.broadcastToAdmins({ type: 'message', order_id: target, ...msg });
        const chatDoc = await getOrderChat(target);
        if (chatDoc) await notifyOrderChatUser(chatDoc, text);
      } else {
        const msg = await addOrderChatMsg(orderId, 'user', text);
        sendJson(ws, { type: 'message', order_id: orderId, ...msg });
        orderChatManager.broadcastToAdmins({ type: 'message', order_id: orderId, user_id: userId, ...msg });
      }
    } else if (msgType === 'select_order' && isAdmin) {
      const target = String(data.order_id ?? '');
      if (target) {
        const chat = await ensureOrderChat(target);
        await markOrderChatReadAdmin(target);
        sendJson(ws, { type: 'order_history', order_id: target, messages: chat ? (chat.messages as Doc[]) ?? [] : [] });
      }
    }
  });

  ws.on('close', () => {
    if (isAdmin) orderChatManager.disconnectAdmin(userId);
    else orderChatManager.disconnectUser(orderId, userId);
  });
}

// ── REST ──────────────────────────────────────────────────────────────────────
router.get('/admin/chats', requireUser, asyncHandler(async (req, res) => {
  if (!AGENT_IDS.has(req.tgUser.id)) throw new HttpError(403, 'Forbidden');
  const chats = await listOrderChats(String(req.query.game_id ?? ''), String(req.query.product_id ?? ''));
  await enrichUsernames(chats);
  res.json(chats.map(fmt));
}));

// Admin taps "Написать клиенту" on an order that has no chat yet — e.g. its product had
// redirect_to_chat off at purchase time (only /buy-stars opens one unconditionally). Creates
// the chat on demand from the order's own data instead of leaving the button non-functional.
router.post('/admin/:orderId/open', requireUser, asyncHandler(async (req, res) => {
  if (!AGENT_IDS.has(req.tgUser.id)) throw new HttpError(403, 'Forbidden');
  const chat = await ensureOrderChat(req.params.orderId);
  if (!chat) throw new HttpError(404, 'Order not found');
  await enrichUsernames([chat]);
  res.json(fmt(chat));
}));

router.get('/my', requireUser, asyncHandler(async (req, res) => {
  const chats = await getUserOrderChats(req.tgUser.id);
  res.json(chats.map(fmt));
}));

router.get('/my/:orderId', requireUser, asyncHandler(async (req, res) => {
  const chat = await getOrderChat(req.params.orderId);
  if (!chat) return res.json({ messages: [], order_id: req.params.orderId, unread_by_user: 0 });
  if (chat.user_id !== req.tgUser.id) throw new HttpError(403, 'Not your order');
  await markOrderChatReadUser(req.params.orderId);
  res.json({ messages: (chat.messages as Doc[]) ?? [], ...fmt(chat) });
}));

export default router;
