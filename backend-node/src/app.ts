import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './http';
import { config } from './config';
import { bot } from './bot'; // side-effect: registers Telegraf handlers
import usersRouter from './routers/users';
import catalogRouter from './routers/catalog';
import topupRouter from './routers/topup';
import ordersRouter from './routers/orders';
import adminRouter from './routers/admin';
import supportRouter from './routers/support';
import notificationsRouter from './routers/notifications';
import orderChatRouter from './routers/orderChat';

export const app = express();

// Restrict CORS to the mini-app origin when configured; only fall back to open
// CORS if MINI_APP_URL is unset (dev). Auth is via the X-Init-Data header, but
// there's no reason to let arbitrary origins drive the API.
const corsOrigin = (() => {
  try {
    return config.miniAppUrl ? new URL(config.miniAppUrl).origin : '*';
  } catch {
    return '*';
  }
})();

app.use(helmet());
app.use(compression({ threshold: 500 }));
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '2mb' }));

app.use('/users', usersRouter);
app.use('/catalog', catalogRouter);
app.use('/topup', topupRouter);
app.use('/orders', ordersRouter);
app.use('/admin', adminRouter);
app.use('/support', supportRouter);
app.use('/notify', notificationsRouter);
app.use('/order-chat', orderChatRouter);

// Telegram webhook — feed updates to Telegraf. Reject forged requests: only
// Telegram knows the secret set via setWebhook({ secret_token }). Without this
// anyone could POST a fake callback_query (e.g. from a known admin id) and drive
// admin actions like confirming top-ups.
app.post('/webhook', (req, res) => {
  if (config.webhookSecret) {
    const provided = req.header('X-Telegram-Bot-Api-Secret-Token');
    if (provided !== config.webhookSecret) {
      res.status(403).json({ detail: 'Forbidden' });
      return;
    }
  }
  bot.handleUpdate(req.body).catch((e) => console.error('webhook handleUpdate error:', e));
  res.json({ ok: true });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use(errorHandler);
