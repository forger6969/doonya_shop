import { Router } from 'express';
import { WebSocket } from 'ws';
import { asyncHandler, HttpError } from '../http';
import { requireUser, TgUser } from '../auth';
import { SUPPORT_AGENT_IDS, ADMIN_IDS } from '../config';
import {
  getOrCreateChat, addChatMessage, getChat, listActiveChats, markChatRead, listAllUsers,
} from '../repo';
import { supportManager, sendJson } from '../realtime';
import { notifyAgentsBot } from '../notify';
import { Doc } from '../models';

const router = Router();

function fmtChat(chat: Doc): Doc {
  const messages = (chat.messages as Doc[]) ?? [];
  const lastTs = chat.last_ts;
  return {
    user_id: chat.user_id,
    user_name: chat.user_name ?? '',
    first_name: chat.first_name ?? '',
    unread: chat.unread_by_agent ?? 0,
    last_ts: lastTs instanceof Date ? lastTs.toISOString() : lastTs,
    last_message: messages.length ? messages[messages.length - 1].text : '',
  };
}

// ── WebSocket handler (raw ws — keeps the frontend's new WebSocket() working) ──
export async function handleSupportConnection(ws: WebSocket, tgUser: TgUser): Promise<void> {
  const userId = tgUser.id;
  const isAgent = SUPPORT_AGENT_IDS.has(userId) || ADMIN_IDS.has(userId);

  if (isAgent) {
    supportManager.connectAgent(userId, ws);
    const chats = await listActiveChats();
    sendJson(ws, { type: 'chats', chats: chats.map(fmtChat) });
  } else {
    supportManager.connectUser(userId, ws);
    const chat = await getOrCreateChat(userId, tgUser.username ?? '', tgUser.first_name ?? '');
    sendJson(ws, { type: 'history', messages: (chat.messages as Doc[]) ?? [] });
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

      if (isAgent) {
        const toUserId = data.to_user_id as number | undefined;
        if (!toUserId) return;
        const msg = await addChatMessage(toUserId, 'agent', text, userId);
        supportManager.sendToUser(toUserId, { type: 'message', ...msg });
        supportManager.broadcastToAgents({ type: 'message', user_id: toUserId, ...msg });
      } else {
        const msg = await addChatMessage(userId, 'user', text);
        sendJson(ws, { type: 'message', ...msg });
        supportManager.broadcastToAgents({
          type: 'message', user_id: userId,
          user_name: tgUser.username ?? '', first_name: tgUser.first_name ?? '', ...msg,
        });
        if (!supportManager.hasAgents) {
          try {
            await notifyAgentsBot(tgUser, text, [...SUPPORT_AGENT_IDS]);
          } catch { /* ignore */ }
        }
      }
    } else if (msgType === 'select_chat' && isAgent) {
      const targetId = data.user_id as number | undefined;
      if (targetId) {
        const chat = await getOrCreateChat(Number(targetId), String(data.user_name ?? ''), String(data.first_name ?? ''));
        await markChatRead(Number(targetId));
        sendJson(ws, { type: 'chat_history', user_id: targetId, messages: (chat.messages as Doc[]) ?? [] });
      }
    }
  });

  ws.on('close', () => {
    if (isAgent) supportManager.disconnectAgent(userId);
    else supportManager.disconnectUser(userId);
  });
}

// ── REST ──────────────────────────────────────────────────────────────────────
router.get('/chat', requireUser, asyncHandler(async (req, res) => {
  const chat = await getChat(req.tgUser.id);
  if (!chat) return res.json({ messages: [] });
  res.json({ messages: (chat.messages as Doc[]) ?? [] });
}));

function requireAgent(req: { tgUser: TgUser }): void {
  if (!SUPPORT_AGENT_IDS.has(req.tgUser.id)) throw new HttpError(403, 'Forbidden');
}

router.get('/agent/chats', requireUser, asyncHandler(async (req, res) => {
  requireAgent(req);
  const chats = await listActiveChats();
  res.json(chats.map(fmtChat));
}));

router.get('/agent/chats/:userId', requireUser, asyncHandler(async (req, res) => {
  requireAgent(req);
  const userId = parseInt(req.params.userId, 10);
  const chat = await getOrCreateChat(userId, '', '');
  await markChatRead(userId);
  res.json({ messages: (chat.messages as Doc[]) ?? [], ...fmtChat(chat) });
}));

router.get('/agent/users', requireUser, asyncHandler(async (req, res) => {
  requireAgent(req);
  const users = await listAllUsers(200, String(req.query.search ?? ''));
  res.json(users);
}));

export default router;
