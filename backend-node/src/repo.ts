import crypto from 'crypto';
import {
  mongoose, Doc,
  Users, Games, Categories, Products, Topups, Orders, Reviews, Promos,
  Notifications, SupportChats, OrderChats, PaymentMethods,
} from './models';
import { config } from './config';

const { ObjectId } = mongoose.Types;

function oid(id: string): InstanceType<typeof ObjectId> | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

// ── Users ───────────────────────────────────────────────────────────────────
export async function getOrCreateUser(userId: number, _username: string, firstName: string): Promise<Doc> {
  let user = await Users.findOne({ user_id: userId }).lean<Doc>();
  if (!user) {
    // Register with an empty username so the mini-app prompts EVERY new user to
    // pick a permanent nick (locked once set via POST /username). We intentionally
    // do NOT seed from the Telegram @username — the nick must be an explicit,
    // user-chosen value, otherwise users who have a @username skip the prompt.
    const doc = { user_id: userId, username: '', first_name: firstName, balance: 0, created_at: new Date() };
    await Users.create(doc);
    user = doc as Doc;
  }
  return user;
}

export async function getUser(userId: number): Promise<Doc | null> {
  return Users.findOne({ user_id: userId }).lean<Doc>();
}

export async function updateBalance(userId: number, amount: number): Promise<void> {
  await Users.updateOne({ user_id: userId }, { $inc: { balance: amount } });
}

// Atomically debit `amount` only if the balance covers it. Returns true on
// success, false if funds were insufficient. This is the single guard against
// the check-then-act race that let concurrent /buy requests overspend.
export async function deductBalanceIfEnough(userId: number, amount: number): Promise<boolean> {
  const res = await Users.updateOne(
    { user_id: userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
  );
  return res.modifiedCount === 1;
}

export async function getAllUserIds(): Promise<number[]> {
  const users = await Users.find({}, { user_id: 1 }).lean<Doc[]>();
  return users.map((u) => u.user_id as number).filter((id) => id != null);
}

export async function listAllUsers(limit = 200, search = ''): Promise<Doc[]> {
  const query: Doc = {};
  if (search) {
    const safe = search.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { first_name: { $regex: safe, $options: 'i' } },
      { username: { $regex: safe, $options: 'i' } },
    ];
  }
  const users = await Users.find(query, { user_id: 1, username: 1, first_name: 1, balance: 1, created_at: 1 })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean<Doc[]>();
  return users.map((u) => ({
    user_id: u.user_id,
    username: u.username ?? '',
    first_name: u.first_name ?? '',
    balance: u.balance ?? 0,
  }));
}

// ── Games ────────────────────────────────────────────────────────────────────
export async function getGames(): Promise<Doc[]> {
  return Games.find({ is_active: true }).sort({ order: 1 }).lean<Doc[]>();
}

export async function getGame(gameId: string): Promise<Doc | null> {
  const id = oid(gameId);
  if (!id) return null;
  return Games.findOne({ _id: id, is_active: true }).lean<Doc>();
}

export async function createGame(name: string, description = '', photoId = ''): Promise<string> {
  const count = await Games.countDocuments({});
  const doc = await Games.create({
    name, description, photo_id: photoId, icon_url: photoId,
    is_active: true, order: count, created_at: new Date(),
  });
  return String(doc._id);
}

export async function updateGame(gameId: string, fields: Doc): Promise<void> {
  const id = oid(gameId);
  if (id) await Games.updateOne({ _id: id }, { $set: fields });
}

export async function deleteGame(gameId: string): Promise<void> {
  const id = oid(gameId);
  if (id) await Games.updateOne({ _id: id }, { $set: { is_active: false } });
}

// ── Categories ────────────────────────────────────────────────────────────────
export async function getCategories(gameId: string): Promise<Doc[]> {
  return Categories.find({ game_id: gameId, is_active: true }).sort({ order: 1 }).lean<Doc[]>();
}

export async function getCategory(catId: string): Promise<Doc | null> {
  const id = oid(catId);
  if (!id) return null;
  return Categories.findOne({ _id: id, is_active: true }).lean<Doc>();
}

export async function createCategory(gameId: string, name: string): Promise<string> {
  const count = await Categories.countDocuments({ game_id: gameId });
  const doc = await Categories.create({
    game_id: gameId, name, is_active: true, order: count, created_at: new Date(),
  });
  return String(doc._id);
}

export async function updateCategory(catId: string, fields: Doc): Promise<void> {
  const id = oid(catId);
  if (id) await Categories.updateOne({ _id: id }, { $set: fields });
}

export async function deleteCategory(catId: string): Promise<void> {
  const id = oid(catId);
  if (id) await Categories.updateOne({ _id: id }, { $set: { is_active: false } });
}

// ── Products ─────────────────────────────────────────────────────────────────
export async function getProducts(gameId: string, categoryId = ''): Promise<Doc[]> {
  const query: Doc = { game_id: gameId, is_active: true };
  if (categoryId) query.category_id = categoryId;
  return Products.find(query).sort({ order: 1 }).lean<Doc[]>();
}

export async function getProduct(productId: string): Promise<Doc | null> {
  const id = oid(productId);
  if (!id) return null;
  return Products.findOne({ _id: id, is_active: true }).lean<Doc>();
}

export async function createProduct(
  gameId: string, name: string, description: string, price: number, photoId = '', categoryId = '',
  redirectToChat = false, chatMessage = '', badgeEmoji = '',
): Promise<string> {
  const count = await Products.countDocuments({ game_id: gameId });
  const doc = await Products.create({
    game_id: gameId, category_id: categoryId, name, description, price,
    photo_id: photoId, icon_url: photoId, is_active: true, order: count, created_at: new Date(),
    redirect_to_chat: redirectToChat, chat_message: chatMessage, badge_emoji: badgeEmoji,
  });
  return String(doc._id);
}

export async function updateProduct(productId: string, fields: Doc): Promise<void> {
  const id = oid(productId);
  if (id) await Products.updateOne({ _id: id }, { $set: fields });
}

export async function deleteProduct(productId: string): Promise<void> {
  const id = oid(productId);
  if (id) await Products.updateOne({ _id: id }, { $set: { is_active: false } });
}

// ── Payment methods seed ──────────────────────────────────────────────────────
// Payment methods used to be hardcoded (uzcard/visa in config). They're now
// admin-managed rows in `payment_methods`. On first boot, if the collection is
// empty, seed the existing Uzcard + Visa from config so behaviour is unchanged;
// the admin then adds/toggles methods (e.g. Humo) from the panel.
export async function seedPaymentMethods(): Promise<void> {
  const count = await PaymentMethods.countDocuments();
  if (count > 0) return;
  await PaymentMethods.create([
    {
      label: 'Uzcard', icon: '🏦',
      requisites: config.uzcardRequisites, holder: config.uzcardHolder,
      note: '', is_active: true, order: 0, created_at: new Date(),
    },
    {
      label: 'Visa', icon: '💠',
      requisites: config.visaRequisites, holder: config.visaHolder,
      note: '', is_active: true, order: 1, created_at: new Date(),
    },
  ]);
  console.log('✅ Seeded default payment methods (Uzcard, Visa)');
}

// ── Top-ups ──────────────────────────────────────────────────────────────────
export async function createTopup(
  userId: number, amount: number, uniqueAmount: number, method: string, receiptFileId: string,
): Promise<string> {
  const doc = await Topups.create({
    user_id: userId, amount, unique_amount: uniqueAmount, method,
    receipt_file_id: receiptFileId, status: 'pending', created_at: new Date(),
  });
  return String(doc._id);
}

export async function confirmTopup(topupId: string): Promise<Doc | null> {
  const id = oid(topupId);
  if (!id) return null;
  // Atomically flip pending→confirmed. Only the call that actually wins the
  // transition credits the balance — a double-click or duplicate webhook can't
  // credit twice (idempotency race).
  const topup = await Topups.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: 'confirmed', confirmed_at: new Date() } },
  ).lean<Doc>();
  if (!topup) return null;
  await updateBalance(topup.user_id as number, topup.amount as number);
  return topup;
}

export async function rejectTopup(topupId: string): Promise<Doc | null> {
  const id = oid(topupId);
  if (!id) return null;
  return Topups.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: 'rejected', rejected_at: new Date() } },
  ).lean<Doc>();
}

// ── Orders ───────────────────────────────────────────────────────────────────
// Debits the balance atomically FIRST, then records the order. Returns null if
// funds were insufficient (nothing is charged, no order created). If the order
// insert somehow fails after the debit, the amount is refunded so money can't
// vanish.
export async function createOrder(args: {
  userId: number; productId: string; gameId: string; amount: number;
  originalPrice?: number; promoCode?: string; variantLabel?: string; fieldAnswers?: Doc;
}): Promise<string | null> {
  const charged = await deductBalanceIfEnough(args.userId, args.amount);
  if (!charged) return null;
  try {
    const doc = await Orders.create({
      user_id: args.userId, product_id: args.productId, game_id: args.gameId, amount: args.amount,
      original_price: args.originalPrice || args.amount, promo_code: args.promoCode ?? '',
      variant_label: args.variantLabel ?? '', field_answers: args.fieldAnswers ?? {},
      status: 'pending', created_at: new Date(),
    });
    return String(doc._id);
  } catch (e) {
    await updateBalance(args.userId, args.amount); // refund — the charge went through but the order didn't
    throw e;
  }
}

export async function completeOrder(orderId: string): Promise<Doc | null> {
  const id = oid(orderId);
  if (!id) return null;
  // Only the pending→completed transition returns the order, so an already
  // completed/refunded order isn't re-processed (re-notified).
  return Orders.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: 'completed', completed_at: new Date() } },
  ).lean<Doc>();
}

// Refund a pending order: flip pending→refunded atomically and credit the buyer
// back. Idempotent — a second call finds no pending order and is a no-op.
export async function refundOrder(orderId: string): Promise<Doc | null> {
  const id = oid(orderId);
  if (!id) return null;
  const order = await Orders.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: 'refunded', refunded_at: new Date() } },
  ).lean<Doc>();
  if (!order) return null;
  await updateBalance(order.user_id as number, order.amount as number);
  return order;
}

export async function getUserOrders(userId: number): Promise<Doc[]> {
  return Orders.find({ user_id: userId }).sort({ created_at: -1 }).limit(10).lean<Doc[]>();
}

// ── Reviews ──────────────────────────────────────────────────────────────────
type ProductReviewResponse = {
  _id: string;
  user_id: number;
  order_id: string;
  product_id: string;
  rating: number;
  text: string;
  photo_url: string;
  created_at: Date;
  user: {
    _id: string;
    user_id: number;
    username: string;
    first_name: string;
  };
};

export async function createReview(
  db_user_id: string, userId: number, orderId: string, productId: string, rating: number, text: string, photoUrl = '',
): Promise<string> {
  const doc = await Reviews.create({
    db_user_id, user_id: userId, order_id: orderId, product_id: productId, rating, text, photo_url: photoUrl,
    created_at: new Date(),
  });
  return String(doc._id);
}

export async function getProductReviews(productId: string): Promise<ProductReviewResponse[]> {
  const reviews = await Reviews.find({ product_id: productId })
    .sort({ created_at: -1 })
    .limit(5)
    .populate({ path: 'db_user_id', select: '_id user_id username first_name' })
    .lean<Doc[]>();

  return reviews.map((r) => {
    const populatedUser = (r.db_user_id as Doc | null | undefined) ?? null;

    return {
      _id: String(r._id),
      user_id: Number(r.user_id ?? 0),
      order_id: String(r.order_id ?? ''),
      product_id: String(r.product_id ?? ''),
      rating: Number(r.rating ?? 0),
      text: typeof r.text === 'string' ? r.text : '',
      photo_url: typeof r.photo_url === 'string' ? r.photo_url : '',
      created_at: r.created_at instanceof Date ? r.created_at : new Date(r.created_at as string),
      user: {
        _id: populatedUser ? String(populatedUser._id) : '',
        user_id: populatedUser && typeof populatedUser.user_id === 'number' ? populatedUser.user_id : 0,
        username: populatedUser && typeof populatedUser.username === 'string' ? populatedUser.username : '',
        first_name: populatedUser && typeof populatedUser.first_name === 'string' ? populatedUser.first_name : '',
      },
    };
  });
}

export async function getAllProductRatings(productIds: string[]): Promise<Record<string, { avg: number | null; count: number }>> {
  if (!productIds.length) return {};
  const rows = await Reviews.aggregate([
    { $match: { product_id: { $in: productIds } } },
    { $group: { _id: '$product_id', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const result: Record<string, { avg: number | null; count: number }> = {};
  for (const row of rows) {
    result[row._id] = { avg: row.avg ? Math.round(row.avg * 10) / 10 : null, count: row.count };
  }
  return result;
}

// ── Promos ───────────────────────────────────────────────────────────────────
export async function createPromo(code: string, discountPct: number, minOrderAmount: number, maxUses: number): Promise<string> {
  const existing = await Promos.findOne({ code: code.toUpperCase() }).lean<Doc>();
  if (existing) throw new Error('Promo code already exists');
  const doc = await Promos.create({
    code: code.toUpperCase(), discount_pct: discountPct, min_order_amount: minOrderAmount,
    max_uses: maxUses, uses: 0, is_active: true, created_at: new Date(),
  });
  return String(doc._id);
}

export async function listPromos(): Promise<Doc[]> {
  return Promos.find({}).sort({ created_at: -1 }).lean<Doc[]>();
}

export async function getPromoByCode(code: string): Promise<Doc | null> {
  return Promos.findOne({ code: code.toUpperCase(), is_active: true }).lean<Doc>();
}

export async function deletePromo(promoId: string): Promise<void> {
  const id = oid(promoId);
  if (id) await Promos.deleteOne({ _id: id });
}

export async function togglePromo(promoId: string): Promise<Doc | null> {
  const id = oid(promoId);
  if (!id) return null;
  const promo = await Promos.findOne({ _id: id }).lean<Doc>();
  if (promo) await Promos.updateOne({ _id: id }, { $set: { is_active: !promo.is_active } });
  return promo;
}

export async function usePromo(promoId: string): Promise<void> {
  const id = oid(promoId);
  if (id) await Promos.updateOne({ _id: id }, { $inc: { uses: 1 } });
}

export function applyPromo(price: number, promo: Doc): number {
  const minOrder = (promo.min_order_amount as number) ?? 0;
  const maxUses = (promo.max_uses as number) ?? 0;
  const uses = (promo.uses as number) ?? 0;
  if (minOrder > 0 && price < minOrder) return price;
  if (maxUses > 0 && uses >= maxUses) return price;
  const discount = Math.floor((price * (promo.discount_pct as number)) / 100);
  return Math.max(0, price - discount);
}

// ── Analytics ────────────────────────────────────────────────────────────────
export async function getSalesByDay(days = 7): Promise<Doc[]> {
  const since = new Date(Date.now() - days * 86400_000);
  return Orders.aggregate([
    { $match: { created_at: { $gte: since }, status: { $ne: 'refunded' } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
        revenue: { $sum: '$amount' }, count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

export async function getTopProducts(limit = 10): Promise<Doc[]> {
  const rows = await Orders.aggregate([
    { $match: { status: { $ne: 'refunded' } } },
    { $group: { _id: '$product_id', revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]);
  for (const row of rows) {
    const id = oid(row._id);
    const p = id ? await Products.findOne({ _id: id }).lean<Doc>() : null;
    row.name = p ? p.name : 'Unknown';
    row.game_id = p ? p.game_id ?? '' : '';
  }
  return rows;
}

export async function getTopUsers(limit = 20): Promise<Doc[]> {
  const rows = await Orders.aggregate([
    { $match: { status: { $ne: 'refunded' } } },
    { $group: { _id: '$user_id', total_spent: { $sum: '$amount' }, order_count: { $sum: 1 } } },
    { $sort: { total_spent: -1 } },
    { $limit: limit },
  ]);
  for (const row of rows) {
    const u = await Users.findOne({ user_id: row._id }).lean<Doc>();
    row.first_name = u ? u.first_name : 'Unknown';
    row.username = u ? u.username ?? '' : '';
  }
  return rows;
}

// ── Discounts ────────────────────────────────────────────────────────────────
export function isDiscountActive(product: Doc): boolean {
  if (!product.discount_enabled) return false;
  const pct = (product.discount_percent as number) ?? 0;
  if (!pct) return false;
  const until = product.discount_until as Date | null | undefined;
  if (until && new Date() > new Date(until)) return false;
  return true;
}

export function calcDiscountedPrice(price: number, product: Doc): number | null {
  if (!isDiscountActive(product)) return null;
  const pct = (product.discount_percent as number) ?? 0;
  return Math.max(1, Math.floor((price * (100 - pct)) / 100));
}

export async function setDiscount(
  productId: string, discountPercent: number, discountEnabled: boolean, discountUntil: Date | null,
): Promise<void> {
  const id = oid(productId);
  if (id) {
    await Products.updateOne(
      { _id: id },
      { $set: { discount_percent: discountPercent, discount_enabled: discountEnabled, discount_until: discountUntil } },
    );
  }
}

export async function getActiveDiscounts(limit = 20): Promise<Doc[]> {
  const now = new Date();
  return Products.find({
    is_active: true, discount_enabled: true, discount_percent: { $gt: 0 },
    $or: [{ discount_until: null }, { discount_until: { $gt: now } }],
  }).sort({ discount_percent: -1 }).limit(limit).lean<Doc[]>();
}

export async function getTopCatalogProducts(limit = 6): Promise<Doc[]> {
  const rows = await Orders.aggregate([
    { $match: { status: { $ne: 'refunded' } } },
    { $group: { _id: '$product_id', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  const result: Doc[] = [];
  for (const row of rows) {
    const id = oid(row._id);
    const p = id ? await Products.findOne({ _id: id, is_active: true }).lean<Doc>() : null;
    if (p) {
      p._sales_count = row.count;
      result.push(p);
    }
  }
  return result;
}

// ── Notifications ────────────────────────────────────────────────────────────
export async function createNotification(userId: number, type: string, payload: Doc): Promise<Doc> {
  const doc = { user_id: userId, type, payload, read: false, created_at: new Date() };
  const created = await Notifications.create(doc);
  return { ...doc, _id: created._id };
}

export async function getUnreadNotifications(userId: number): Promise<Doc[]> {
  return Notifications.find({ user_id: userId, read: false }).sort({ created_at: -1 }).limit(50).lean<Doc[]>();
}

export async function markNotificationsRead(userId: number): Promise<void> {
  await Notifications.updateMany({ user_id: userId, read: false }, { $set: { read: true } });
}

// ── Support Chat ──────────────────────────────────────────────────────────────
export async function getOrCreateChat(userId: number, userName: string, firstName: string): Promise<Doc> {
  let chat = await SupportChats.findOne({ user_id: userId }).lean<Doc>();
  if (!chat) {
    const doc = {
      user_id: userId, user_name: userName, first_name: firstName, messages: [],
      status: 'open', unread_by_agent: 0, last_ts: new Date(), created_at: new Date(),
    };
    await SupportChats.create(doc);
    chat = doc as Doc;
  }
  return chat;
}

export async function addChatMessage(userId: number, from: string, text: string, agentId?: number): Promise<Doc> {
  const msg = {
    id: crypto.randomUUID(), from, text, ts: new Date().toISOString(), agent_id: agentId ?? null,
  };
  const now = new Date();
  const update: Doc = {
    $push: { messages: msg },
    $set: { last_ts: now } as Doc,
    $setOnInsert: { user_id: userId, user_name: '', first_name: '', status: 'open', created_at: now },
  };
  if (from === 'user') update.$inc = { unread_by_agent: 1 };
  else (update.$set as Doc).unread_by_agent = 0;
  await SupportChats.updateOne({ user_id: userId }, update, { upsert: true });
  return msg;
}

export async function getChat(userId: number): Promise<Doc | null> {
  return SupportChats.findOne({ user_id: userId }).lean<Doc>();
}

export async function listActiveChats(limit = 50): Promise<Doc[]> {
  return SupportChats.find({}, { messages: 0 }).sort({ last_ts: -1 }).limit(limit).lean<Doc[]>();
}

export async function markChatRead(userId: number): Promise<void> {
  await SupportChats.updateOne({ user_id: userId }, { $set: { unread_by_agent: 0 } });
}

// ── Order Chat ────────────────────────────────────────────────────────────────
export async function getOrCreateOrderChat(args: {
  orderId: string; userId: number; productId: string; gameId: string;
  productName?: string; gameName?: string; username?: string; firstName?: string;
}): Promise<Doc | null> {
  const now = new Date();
  await OrderChats.updateOne(
    { order_id: args.orderId },
    {
      $setOnInsert: {
        order_id: args.orderId, user_id: args.userId, username: args.username ?? '',
        first_name: args.firstName ?? '', product_id: args.productId, game_id: args.gameId,
        product_name: args.productName ?? '', game_name: args.gameName ?? '',
        messages: [], unread_by_admin: 0, unread_by_user: 0, last_ts: now, created_at: now,
      },
    },
    { upsert: true },
  );
  return OrderChats.findOne({ order_id: args.orderId }).lean<Doc>();
}

// Admin clicked "Написать клиенту" on an order that never got a chat — e.g. its product
// had `redirect_to_chat` off at purchase time (only /buy-stars creates one unconditionally;
// /buy is opt-in per product). Looks up the order + product/game/user and opens a chat for
// it now, instead of the button silently doing nothing when no chat exists yet.
export async function ensureOrderChat(orderId: string): Promise<Doc | null> {
  const existing = await OrderChats.findOne({ order_id: orderId }).lean<Doc>();
  if (existing) return existing;

  const id = oid(orderId);
  if (!id) return null;
  const order = await Orders.findById(id).lean<Doc>();
  if (!order) return null;

  // product_id/game_id are 'stars'/'telegram' literals (not ObjectIds) for Telegram Stars
  // orders — oid() returns null for those, so skip the lookup rather than querying with an
  // undefined filter (Mongoose would strip it and match an arbitrary first document).
  const productOid = oid(String(order.product_id));
  const gameOid = oid(String(order.game_id));
  const [product, game, user] = await Promise.all([
    productOid ? Products.findOne({ _id: productOid }).lean<Doc>() : null,
    gameOid ? Games.findOne({ _id: gameOid }).lean<Doc>() : null,
    Users.findOne({ user_id: order.user_id }).lean<Doc>(),
  ]);

  return getOrCreateOrderChat({
    orderId,
    userId: order.user_id as number,
    productId: String(order.product_id),
    gameId: String(order.game_id),
    productName: (product?.name as string) ?? (order.product_id === 'stars' ? 'Telegram Stars' : ''),
    gameName: (game?.name as string) ?? (order.game_id === 'telegram' ? 'Telegram' : ''),
    username: (user?.username as string) ?? '',
    firstName: (user?.first_name as string) ?? '',
  });
}

export async function getOrderChat(orderId: string): Promise<Doc | null> {
  return OrderChats.findOne({ order_id: orderId }).lean<Doc>();
}

export async function addOrderChatMsg(orderId: string, from: string, text: string, agentId?: number): Promise<Doc> {
  const msg: Doc = { id: crypto.randomUUID(), from, text, ts: new Date().toISOString() };
  if (agentId) msg.agent_id = agentId;
  const now = new Date();
  const update: Doc = { $push: { messages: msg }, $set: { last_ts: now } };
  if (from === 'user') update.$inc = { unread_by_admin: 1 };
  else update.$inc = { unread_by_user: 1 };
  await OrderChats.updateOne({ order_id: orderId }, update);
  return msg;
}

export async function listOrderChats(gameId = '', productId = '', limit = 100): Promise<Doc[]> {
  const query: Doc = {};
  if (gameId) query.game_id = gameId;
  if (productId) query.product_id = productId;
  return OrderChats.find(query, { messages: 0 }).sort({ last_ts: -1 }).limit(limit).lean<Doc[]>();
}

export async function markOrderChatReadAdmin(orderId: string): Promise<void> {
  await OrderChats.updateOne({ order_id: orderId }, { $set: { unread_by_admin: 0 } });
}

export async function markOrderChatReadUser(orderId: string): Promise<void> {
  await OrderChats.updateOne({ order_id: orderId }, { $set: { unread_by_user: 0 } });
}

export async function getUserOrderChats(userId: number): Promise<Doc[]> {
  return OrderChats.find({ user_id: userId }, { messages: 0 }).sort({ last_ts: -1 }).lean<Doc[]>();
}

// ── Product stats ─────────────────────────────────────────────────────────────
export async function getProductStats(productId: string): Promise<{ revenue: number; count: number }> {
  const rows = await Orders.aggregate([
    { $match: { product_id: productId } },
    { $group: { _id: null, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return rows.length ? { revenue: rows[0].revenue, count: rows[0].count } : { revenue: 0, count: 0 };
}

export async function getAllProductStats(productIds: string[]): Promise<Record<string, { revenue: number; count: number }>> {
  if (!productIds.length) return {};
  const rows = await Orders.aggregate([
    { $match: { product_id: { $in: productIds }, status: { $ne: 'refunded' } } },
    { $group: { _id: '$product_id', revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const result: Record<string, { revenue: number; count: number }> = {};
  for (const pid of productIds) result[pid] = { revenue: 0, count: 0 };
  for (const row of rows) result[row._id] = { revenue: row.revenue, count: row.count };
  return result;
}
