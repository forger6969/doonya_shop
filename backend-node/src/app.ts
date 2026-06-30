import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { errorHandler } from './http';
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

app.use(compression({ threshold: 500 }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

app.use('/users', usersRouter);
app.use('/catalog', catalogRouter);
app.use('/topup', topupRouter);
app.use('/orders', ordersRouter);
app.use('/admin', adminRouter);
app.use('/support', supportRouter);
app.use('/notify', notificationsRouter);
app.use('/order-chat', orderChatRouter);

// Telegram webhook — feed updates to Telegraf.
app.post('/webhook', (req, res) => {
  bot.handleUpdate(req.body).catch((e) => console.error('webhook handleUpdate error:', e));
  res.json({ ok: true });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use(errorHandler);
