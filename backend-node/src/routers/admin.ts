import { Router, RequestHandler } from 'express';
import multer from 'multer';
import { asyncHandler, HttpError } from '../http';
import { requireUser } from '../auth';
import { ADMIN_IDS } from '../config';
import { cacheInvalidate } from '../cache';
import { uploadImage } from '../cloudinary';
import { notifyUserTopupConfirmed, notifyUserTopupRejected, notifyUserOrderReady, broadcastDiscount } from '../notify';
import { notifyManager, orderChatManager } from '../realtime';
import { mongoose, Topups, Orders, Games, Products, Users, Banners, PaymentMethods, Doc } from '../models';
import {
  confirmTopup, rejectTopup, completeOrder, addOrderChatMsg,
  createGame, deleteGame, updateGame, getGames, getProducts,
  getCategories, createCategory, updateCategory, deleteCategory,
  createProduct, deleteProduct, updateProduct,
  createPromo, listPromos, deletePromo, togglePromo,
  getSalesByDay, getTopProducts, getTopUsers, getAllProductStats, setDiscount,
} from '../repo';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const oid = (id: string) => new mongoose.Types.ObjectId(id);

// Admin guard: valid initData + sender in ADMIN_IDS.
const assertAdmin: RequestHandler = (req, _res, next) => {
  if (!ADMIN_IDS.has(req.tgUser.id)) return next(new HttpError(403, 'Forbidden'));
  next();
};
const admin = [requireUser, assertAdmin];

// ── Stats ──────────────────────────────────────────────────────────────────────
router.get('/stats', ...admin, asyncHandler(async (_req, res) => {
  const [pendingTopups, pendingOrders, totalGames, totalProducts, revenueAgg] = await Promise.all([
    Topups.countDocuments({ status: 'pending' }),
    Orders.countDocuments({ status: 'pending' }),
    Games.countDocuments({ is_active: true }),
    Products.countDocuments({ is_active: true }),
    Orders.aggregate([
      { $match: { status: { $ne: 'refunded' } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  res.json({
    pending_topups: pendingTopups,
    pending_orders: pendingOrders,
    total_games: totalGames,
    total_products: totalProducts,
    total_revenue: revenueAgg.length ? revenueAgg[0].total : 0,
  });
}));

// ── Image upload ────────────────────────────────────────────────────────────────
router.post('/upload', ...admin, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file');
  const url = await uploadImage(req.file.buffer, 'doonya_shop/catalog');
  res.json({ url });
}));

// ── Games ─────────────────────────────────────────────────────────────────────
router.get('/games', ...admin, asyncHandler(async (_req, res) => {
  const games = await getGames();
  res.json(games.map((g) => ({
    id: String(g._id),
    name: g.name,
    description: g.description ?? '',
    icon_url: (g.icon_url as string) || (g.photo_id as string) || '',
    banner_url: g.banner_url ?? '',
  })));
}));

router.post('/games', ...admin, asyncHandler(async (req, res) => {
  const b = req.body as { name: string; description?: string; icon_url?: string };
  const gameId = await createGame(b.name, b.description ?? '', b.icon_url ?? '');
  cacheInvalidate('catalog:games');
  res.json({ ok: true, game_id: gameId });
}));

router.patch('/games/:gameId', ...admin, asyncHandler(async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const fields: Doc = {};
  for (const k of ['name', 'description', 'icon_url', 'banner_url']) {
    if (b[k] != null) fields[k] = b[k];
  }
  if ('icon_url' in fields) fields.photo_id = fields.icon_url;
  if (Object.keys(fields).length) await updateGame(req.params.gameId, fields);
  cacheInvalidate('catalog:games');
  cacheInvalidate(`catalog:products:${req.params.gameId}`);
  res.json({ ok: true });
}));

router.delete('/games/:gameId', ...admin, asyncHandler(async (req, res) => {
  await deleteGame(req.params.gameId);
  cacheInvalidate('catalog:');
  res.json({ ok: true });
}));

// ── Categories ────────────────────────────────────────────────────────────────
router.get('/games/:gameId/categories', ...admin, asyncHandler(async (req, res) => {
  const cats = await getCategories(req.params.gameId);
  res.json(cats.map((c) => ({ id: String(c._id), game_id: c.game_id, name: c.name })));
}));

router.post('/categories', ...admin, asyncHandler(async (req, res) => {
  const b = req.body as { game_id: string; name: string };
  const catId = await createCategory(b.game_id, b.name);
  res.json({ ok: true, category_id: catId });
}));

router.patch('/categories/:catId', ...admin, asyncHandler(async (req, res) => {
  const b = req.body as { name?: string };
  if (b.name != null) await updateCategory(req.params.catId, { name: b.name });
  res.json({ ok: true });
}));

router.delete('/categories/:catId', ...admin, asyncHandler(async (req, res) => {
  await deleteCategory(req.params.catId);
  res.json({ ok: true });
}));

// ── Products ──────────────────────────────────────────────────────────────────
router.get('/games/:gameId/products', ...admin, asyncHandler(async (req, res) => {
  const products = await getProducts(req.params.gameId, String(req.query.category_id ?? ''));
  const cats = await getCategories(req.params.gameId);
  const catMap = new Map(cats.map((c) => [String(c._id), c.name as string]));
  const productIds = products.map((p) => String(p._id));
  const statsMap = await getAllProductStats(productIds);
  res.json(products.map((p) => {
    const id = String(p._id);
    const until = p.discount_until as Date | null | undefined;
    return {
      id,
      category_id: p.category_id ?? '',
      category_name: catMap.get((p.category_id as string) ?? '') ?? '',
      name: p.name,
      description: p.description ?? '',
      price: p.price,
      icon_url: (p.icon_url as string) || (p.photo_id as string) || '',
      sales_count: statsMap[id].count,
      revenue: statsMap[id].revenue,
      variants: p.variants ?? [],
      purchase_fields: p.purchase_fields ?? [],
      redirect_to_chat: p.redirect_to_chat ?? false,
      chat_message: p.chat_message ?? '',
      badge_emoji: p.badge_emoji ?? '',
      discount_percent: p.discount_percent ?? 0,
      discount_enabled: p.discount_enabled ?? false,
      discount_until: until ? new Date(until).toISOString() : null,
    };
  }));
}));

router.post('/products', ...admin, asyncHandler(async (req, res) => {
  const b = req.body as { game_id: string; category_id?: string; name: string; description?: string; price: number; icon_url?: string; redirect_to_chat?: boolean; chat_message?: string; badge_emoji?: string };
  const pid = await createProduct(
    b.game_id, b.name, b.description ?? '', b.price, b.icon_url ?? '', b.category_id ?? '',
    Boolean(b.redirect_to_chat), String(b.chat_message ?? ''), String(b.badge_emoji ?? ''),
  );
  cacheInvalidate(`catalog:products:${b.game_id}`);
  cacheInvalidate('catalog:top');
  res.json({ ok: true, product_id: pid });
}));

router.patch('/products/:productId', ...admin, asyncHandler(async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const fields: Doc = {};
  for (const [k, v] of Object.entries(b)) {
    if (v == null) continue;
    if (k === 'icon_url') {
      fields.icon_url = v;
      fields.photo_id = v;
    } else if (['name', 'description', 'price', 'variants', 'purchase_fields', 'redirect_to_chat', 'chat_message', 'badge_emoji'].includes(k)) {
      fields[k] = v;
    }
  }
  if (Object.keys(fields).length) await updateProduct(req.params.productId, fields);
  cacheInvalidate('catalog:products:');
  cacheInvalidate('catalog:top');
  res.json({ ok: true });
}));

router.delete('/products/:productId', ...admin, asyncHandler(async (req, res) => {
  await deleteProduct(req.params.productId);
  cacheInvalidate('catalog:products:');
  cacheInvalidate('catalog:top');
  res.json({ ok: true });
}));

router.patch('/products/:productId/discount', ...admin, asyncHandler(async (req, res) => {
  const b = req.body as { discount_percent?: number; discount_enabled?: boolean; discount_until?: string | null; broadcast?: boolean };
  const discountPercent = b.discount_percent ?? 0;
  const discountEnabled = b.discount_enabled ?? true;
  let until: Date | null = null;
  if (b.discount_until) {
    const parsed = new Date(b.discount_until);
    if (Number.isNaN(parsed.getTime())) throw new HttpError(400, 'Invalid discount_until format');
    until = parsed;
  }
  await setDiscount(req.params.productId, discountPercent, discountEnabled, until);

  if (b.broadcast && discountEnabled && discountPercent > 0) {
    try {
      const product = await Products.findOne({ _id: oid(req.params.productId) }).lean<Doc>();
      if (product) {
        let gameName = '';
        if (product.game_id) {
          const game = await Games.findOne({ _id: oid(product.game_id as string) }).lean<Doc>().catch(() => null);
          gameName = game ? (game.name as string) : '';
        }
        // Fire-and-forget (mirrors asyncio.create_task)
        void broadcastDiscount({
          productName: product.name as string,
          discountPercent,
          photoUrl: (product.icon_url as string) || (product.photo_id as string) || '',
          gameName,
        }).catch(() => undefined);
      }
    } catch { /* ignore */ }
  }
  res.json({ ok: true });
}));

// ── Top-ups ───────────────────────────────────────────────────────────────────
router.get('/topups', ...admin, asyncHandler(async (req, res) => {
  const status = String(req.query.status ?? 'pending');
  const topups = await Topups.find({ status }).sort({ created_at: -1 }).limit(50).lean<Doc[]>();
  res.json(topups.map((t) => ({
    id: String(t._id),
    user_id: t.user_id,
    amount: t.amount,
    unique_amount: t.unique_amount,
    method: t.method,
    receipt_url: t.receipt_file_id ?? '',
    status: t.status,
    created_at: (t.created_at as Date).toISOString(),
  })));
}));

router.post('/topup/:topupId/confirm', ...admin, asyncHandler(async (req, res) => {
  const result = await confirmTopup(req.params.topupId);
  if (!result) throw new HttpError(404, 'Topup not found or already processed');
  try { await notifyUserTopupConfirmed(result.user_id as number, result.amount as number); } catch { /* ignore */ }
  try { await notifyManager.send(result.user_id as number, 'topup_confirmed', { amount: result.amount }); } catch { /* ignore */ }
  res.json({ ok: true });
}));

router.post('/topup/:topupId/reject', ...admin, asyncHandler(async (req, res) => {
  const result = await rejectTopup(req.params.topupId);
  if (!result) throw new HttpError(404, 'Topup not found or already processed');
  try { await notifyUserTopupRejected(result.user_id as number); } catch { /* ignore */ }
  try { await notifyManager.send(result.user_id as number, 'topup_rejected', {}); } catch { /* ignore */ }
  res.json({ ok: true });
}));

// ── Orders ────────────────────────────────────────────────────────────────────
router.get('/orders', ...admin, asyncHandler(async (req, res) => {
  const status = String(req.query.status ?? 'pending');
  const orders = await Orders.find({ status }).sort({ created_at: -1 }).limit(50).lean<Doc[]>();
  const userIds = [...new Set(orders.map((o) => o.user_id as number))];
  const usersRaw = await Users.find({ user_id: { $in: userIds } }, { user_id: 1, username: 1, first_name: 1 }).lean<Doc[]>();
  const usersMap = new Map(usersRaw.map((u) => [u.user_id as number, u]));
  res.json(orders.map((o) => {
    const u = usersMap.get(o.user_id as number);
    return {
      id: String(o._id),
      user_id: o.user_id,
      username: u?.username ?? '',
      first_name: u?.first_name ?? '',
      product_id: o.product_id,
      amount: o.amount,
      status: o.status,
      promo_code: o.promo_code ?? '',
      variant_label: o.variant_label ?? '',
      field_answers: o.field_answers ?? {},
      created_at: (o.created_at as Date).toISOString(),
    };
  }));
}));

router.post('/order/:orderId/complete', ...admin, asyncHandler(async (req, res) => {
  const order = await completeOrder(req.params.orderId);
  if (!order) throw new HttpError(404, 'Order not found');
  let productName = '';
  try {
    const product = await Products.findOne({ _id: oid(order.product_id as string) }).lean<Doc>();
    productName = product ? (product.name as string) : '';
  } catch { /* ignore */ }
  try { await notifyUserOrderReady(order.user_id as number, req.params.orderId, productName); } catch { /* ignore */ }
  try {
    await notifyManager.send(order.user_id as number, 'order_ready', { order_id: req.params.orderId, product_name: productName });
  } catch { /* ignore */ }
  // Live-close the order chat on the client: post a confirmation line, then signal
  // order_completed so the buyer is prompted to leave a review.
  try {
    const doneMsg = await addOrderChatMsg(req.params.orderId, 'admin', 'Заказ подтверждён ✅');
    orderChatManager.sendToUser(req.params.orderId, { type: 'message', order_id: req.params.orderId, ...doneMsg });
    orderChatManager.sendToUser(req.params.orderId, { type: 'order_completed', order_id: req.params.orderId });
  } catch { /* ignore */ }
  res.json({ ok: true });
}));

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics/sales', ...admin, asyncHandler(async (req, res) => {
  res.json(await getSalesByDay(parseInt(String(req.query.days ?? '7'), 10)));
}));
router.get('/analytics/products', ...admin, asyncHandler(async (_req, res) => {
  res.json(await getTopProducts(15));
}));
router.get('/analytics/users', ...admin, asyncHandler(async (_req, res) => {
  res.json(await getTopUsers(20));
}));

// ── Promos ────────────────────────────────────────────────────────────────────
router.get('/promos', ...admin, asyncHandler(async (_req, res) => {
  const promos = await listPromos();
  res.json(promos.map((p) => ({
    id: String(p._id),
    code: p.code,
    discount_pct: p.discount_pct,
    min_order_amount: p.min_order_amount,
    max_uses: p.max_uses,
    uses: p.uses,
    is_active: p.is_active,
    created_at: (p.created_at as Date).toISOString(),
  })));
}));

router.post('/promos', ...admin, asyncHandler(async (req, res) => {
  const b = req.body as { code: string; discount_pct: number; min_order_amount?: number; max_uses?: number };
  if (!(b.discount_pct >= 1 && b.discount_pct <= 100)) throw new HttpError(400, 'discount_pct must be 1-100');
  try {
    const pid = await createPromo(b.code, b.discount_pct, b.min_order_amount ?? 0, b.max_uses ?? 0);
    res.json({ ok: true, promo_id: pid });
  } catch (e) {
    throw new HttpError(409, (e as Error).message);
  }
}));

router.delete('/promos/:promoId', ...admin, asyncHandler(async (req, res) => {
  await deletePromo(req.params.promoId);
  res.json({ ok: true });
}));

router.patch('/promos/:promoId/toggle', ...admin, asyncHandler(async (req, res) => {
  await togglePromo(req.params.promoId);
  res.json({ ok: true });
}));

// ── Banners ────────────────────────────────────────────────────────────────────
function fmtBanner(b: Doc): Doc {
  return {
    id: String(b._id),
    title: b.title,
    subtitle: b.subtitle ?? '',
    gradient: b.gradient ?? 'pink',
    emoji: b.emoji ?? '🎉',
    active: b.active ?? true,
    created_at: (b.created_at as Date).toISOString(),
  };
}

router.get('/banners', ...admin, asyncHandler(async (_req, res) => {
  const banners = await Banners.find().sort({ created_at: -1 }).limit(50).lean<Doc[]>();
  res.json(banners.map(fmtBanner));
}));

router.post('/banners', ...admin, asyncHandler(async (req, res) => {
  const b = req.body as { title: string; subtitle?: string; gradient?: string; emoji?: string };
  const doc = await Banners.create({
    title: b.title.trim(),
    subtitle: (b.subtitle ?? '').trim(),
    gradient: b.gradient ?? 'pink',
    emoji: b.emoji ?? '🎉',
    active: true,
    created_at: new Date(),
  });
  res.json({ ok: true, id: String(doc._id) });
}));

router.delete('/banners/:bannerId', ...admin, asyncHandler(async (req, res) => {
  await Banners.deleteOne({ _id: oid(req.params.bannerId) });
  res.json({ ok: true });
}));

router.patch('/banners/:bannerId/toggle', ...admin, asyncHandler(async (req, res) => {
  const b = await Banners.findOne({ _id: oid(req.params.bannerId) }).lean<Doc>();
  if (!b) throw new HttpError(404, 'Banner not found');
  await Banners.updateOne({ _id: oid(req.params.bannerId) }, { $set: { active: !(b.active ?? true) } });
  res.json({ ok: true });
}));

// ── Payment methods (admin-managed) ─────────────────────────────────────────────
function fmtPaymentMethod(m: Doc): Doc {
  return {
    id: String(m._id),
    label: m.label,
    icon: m.icon ?? '💳',
    requisites: m.requisites,
    holder: m.holder ?? '',
    note: m.note ?? '',
    is_active: m.is_active ?? true,
    order: m.order ?? 0,
  };
}

router.get('/payment-methods', ...admin, asyncHandler(async (_req, res) => {
  const methods = await PaymentMethods.find().sort({ order: 1, created_at: 1 }).lean<Doc[]>();
  res.json(methods.map(fmtPaymentMethod));
}));

router.post('/payment-methods', ...admin, asyncHandler(async (req, res) => {
  const b = req.body as { label?: string; icon?: string; requisites?: string; holder?: string; note?: string };
  const label = String(b.label ?? '').trim();
  const requisites = String(b.requisites ?? '').trim();
  if (!label) throw new HttpError(400, 'Label required');
  if (!requisites) throw new HttpError(400, 'Requisites required');
  const count = await PaymentMethods.countDocuments();
  const doc = await PaymentMethods.create({
    label, requisites,
    icon: String(b.icon ?? '💳').trim() || '💳',
    holder: String(b.holder ?? '').trim(),
    note: String(b.note ?? '').trim(),
    is_active: true, order: count, created_at: new Date(),
  });
  res.json({ ok: true, id: String(doc._id) });
}));

router.patch('/payment-methods/:id', ...admin, asyncHandler(async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const fields: Doc = {};
  for (const k of ['label', 'icon', 'requisites', 'holder', 'note', 'order']) {
    if (b[k] != null) fields[k] = k === 'order' ? Number(b[k]) : String(b[k]).trim();
  }
  if (typeof b.is_active === 'boolean') fields.is_active = b.is_active;
  if (Object.keys(fields).length) {
    await PaymentMethods.updateOne({ _id: oid(req.params.id) }, { $set: fields });
  }
  res.json({ ok: true });
}));

router.patch('/payment-methods/:id/toggle', ...admin, asyncHandler(async (req, res) => {
  const m = await PaymentMethods.findOne({ _id: oid(req.params.id) }).lean<Doc>();
  if (!m) throw new HttpError(404, 'Payment method not found');
  await PaymentMethods.updateOne({ _id: oid(req.params.id) }, { $set: { is_active: !(m.is_active ?? true) } });
  res.json({ ok: true });
}));

router.delete('/payment-methods/:id', ...admin, asyncHandler(async (req, res) => {
  await PaymentMethods.deleteOne({ _id: oid(req.params.id) });
  res.json({ ok: true });
}));

export default router;
