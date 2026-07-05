import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { app } from './app';
import { config } from './config';
import { connectDb } from './db';
import { createIndexes } from './models';
import { bot } from './bot';
import { verifyTelegramInitData, TgUser } from './auth';
import { handleSupportConnection } from './routers/support';
import { handleOrderChatConnection } from './routers/orderChat';
import { notifyManager, sendJson } from './realtime';
import { getUnreadNotifications, seedPaymentMethods } from './repo';

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Notify WS handler (mirrors notifications.py) — persisted unread flush + keepalive.
async function handleNotifyConnection(ws: WebSocket, tgUser: TgUser): Promise<void> {
  const userId = tgUser.id;
  notifyManager.connect(userId, ws);
  const unread = await getUnreadNotifications(userId);
  for (const n of [...unread].reverse()) {
    sendJson(ws, { type: n.type, ...(n.payload as Record<string, unknown>) });
  }
  ws.on('close', () => notifyManager.disconnect(userId));
}

// Route WebSocket upgrades by path; auth via initData query param.
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '', 'http://localhost');
  const path = url.pathname;
  if (!['/support/ws', '/order-chat/ws', '/notify/ws'].includes(path)) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    let tgUser: TgUser;
    try {
      tgUser = verifyTelegramInitData(url.searchParams.get('initData') ?? '');
    } catch {
      ws.close(4001);
      return;
    }
    if (path === '/support/ws') void handleSupportConnection(ws, tgUser);
    else if (path === '/order-chat/ws') void handleOrderChatConnection(ws, tgUser, url.searchParams.get('order_id') ?? '');
    else void handleNotifyConnection(ws, tgUser);
  });
});

async function start(): Promise<void> {
  await connectDb();
  await createIndexes();
  await seedPaymentMethods();

  if (config.webhookUrl) {
    try {
      await bot.telegram.setWebhook(config.webhookUrl, {
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: true,
      });
      console.log(`✅ Webhook set: ${config.webhookUrl}`);
    } catch (e) {
      console.error('setWebhook failed:', e);
    }
  } else {
    console.warn('⚠️  WEBHOOK_URL not set — Telegram updates will not be received');
  }

  server.listen(config.port, () => console.log(`🚀 Doonya Shop API on :${config.port}`));
}

start().catch((e) => {
  console.error('Fatal startup error:', e);
  process.exit(1);
});
