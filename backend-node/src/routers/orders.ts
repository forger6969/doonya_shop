import { Router } from 'express';
import multer from 'multer';
import { asyncHandler, HttpError } from '../http';
import { requireUser } from '../auth';
import { checkRateLimit } from '../rateLimit';
import { uploadImage } from '../cloudinary';
import { notifyAdminOrder } from '../notify';
import { mongoose, Orders, Reviews, Games, Doc, Users } from '../models';
import {
  getOrCreateUser, getProduct, createOrder, createReview,
  getPromoByCode, applyPromo, usePromo, getOrCreateOrderChat, addOrderChatMsg,
  getUser,
} from '../repo';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 + 1 } });

const STARS_PRICE_PER_STAR = 225;
const STARS_MIN_COUNT = 50;
const STARS_MAX_COUNT = 10_000;

// ── Buy Telegram Stars ────────────────────────────────────────────────────────
router.post('/buy-stars', requireUser, asyncHandler(async (req, res) => {
  const u = req.tgUser;
  const body = req.body as { telegram_username?: string; stars_count?: number };

  let username = String(body.telegram_username ?? '').trim().replace(/^@+/, '');
  if (!username || username.length > 32) throw new HttpError(422, 'Invalid Telegram username');
  const starsCount = Number(body.stars_count);
  if (!Number.isInteger(starsCount) || starsCount < STARS_MIN_COUNT) throw new HttpError(422, `Minimum ${STARS_MIN_COUNT} stars`);
  if (starsCount > STARS_MAX_COUNT) throw new HttpError(422, `Maximum ${STARS_MAX_COUNT} stars`);

  checkRateLimit(`buy_stars:${u.id}`, 5, 60);
  const user = await getOrCreateUser(u.id, u.username ?? '', u.first_name ?? '');

  const totalPrice = starsCount * STARS_PRICE_PER_STAR;
  if ((user.balance as number) < totalPrice) throw new HttpError(402, 'Insufficient balance');

  const fieldAnswers = { 'Telegram логин': `@${username}`, 'Кол-во звёзд': String(starsCount) };
  const orderId = await createOrder({
    userId: u.id, productId: 'stars', gameId: 'telegram', amount: totalPrice,
    originalPrice: totalPrice, variantLabel: `${starsCount} ⭐`, fieldAnswers,
  });
  // createOrder debits atomically; null means the balance didn't actually cover
  // it (lost the race against a concurrent purchase) — nothing was charged.
  if (!orderId) throw new HttpError(402, 'Insufficient balance');

  try {
    await getOrCreateOrderChat({
      orderId, userId: u.id, productId: 'stars', gameId: 'telegram',
      productName: `Telegram Stars × ${starsCount}`, gameName: 'Telegram',
      username: u.username ?? '', firstName: u.first_name ?? '',
    });
  } catch { /* ignore */ }

  try {
    await notifyAdminOrder({
      orderId, userId: u.id, productName: '⭐ Telegram Stars', price: totalPrice,
      variantLabel: `${starsCount} ⭐ → @${username}`, fieldAnswers,
      username: u.username ?? '', firstName: u.first_name ?? '',
    });
  } catch { /* ignore */ }

  res.json({ ok: true, order_id: orderId, amount: totalPrice, open_chat: true });
}));

// ── Buy product ───────────────────────────────────────────────────────────────
router.post('/buy', requireUser, asyncHandler(async (req, res) => {
  const u = req.tgUser;
  const body = req.body as { product_id?: string; promo_code?: string; variant_label?: string; field_answers?: Record<string, string> };
  const productId = String(body.product_id ?? '');
  if (productId.length > 100) throw new HttpError(422, 'product_id too long');
  const promoCode = String(body.promo_code ?? '').slice(0, 50);
  const variantLabel = String(body.variant_label ?? '').slice(0, 200);
  const rawAnswers = body.field_answers ?? {};
  if (Object.keys(rawAnswers).length > 20) throw new HttpError(422, 'Too many field_answers');
  const fieldAnswers: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawAnswers)) fieldAnswers[String(k).slice(0, 100)] = String(v).slice(0, 500);

  checkRateLimit(`buy:${u.id}`, 5, 60);
  const user = await getOrCreateUser(u.id, u.username ?? '', u.first_name ?? '');

  const product = await getProduct(productId);
  if (!product) throw new HttpError(404, 'Product not found');

  // Variant price overrides product price
  const variants = (product.variants as { label: string; price: number }[]) ?? [];
  let originalPrice: number;
  if (variants.length) {
    if (!variantLabel) throw new HttpError(400, 'Please select a variant');
    const variant = variants.find((v) => v.label === variantLabel);
    if (!variant) throw new HttpError(400, 'Invalid variant selected');
    originalPrice = variant.price;
  } else {
    originalPrice = product.price as number;
  }

  // Required purchase fields
  const purchaseFields = (product.purchase_fields as { label: string; required?: boolean }[]) ?? [];
  for (const f of purchaseFields) {
    if (f.required && !(fieldAnswers[f.label] ?? '').trim()) throw new HttpError(400, `Field required: ${f.label}`);
  }

  let finalPrice = originalPrice;
  let promo: Doc | null = null;
  if (promoCode) {
    promo = await getPromoByCode(promoCode);
    if (promo) finalPrice = applyPromo(originalPrice, promo);
  }
  const promoApplied = promo != null && finalPrice < originalPrice;

  if ((user.balance as number) < finalPrice) throw new HttpError(402, 'Insufficient balance');

  const orderId = await createOrder({
    userId: u.id, productId, gameId: product.game_id as string, amount: finalPrice,
    originalPrice, promoCode: promoApplied ? promoCode.toUpperCase() : '', variantLabel, fieldAnswers,
  });
  if (!orderId) throw new HttpError(402, 'Insufficient balance');

  // Only count a promo use when a discount was actually granted (min_order /
  // max_uses gates in applyPromo can leave the price unchanged).
  if (promoApplied && promo) await usePromo(String(promo._id));

  // Chat redirect is opt-in per product (redirect_to_chat). Only then do we open
  // an order chat and drop the configured auto-message into it.
  const openChat = Boolean(product.redirect_to_chat);
  if (openChat) {
    try {
      let gameName = '';
      if (product.game_id) {
        try {
          const game = await Games.findOne({ _id: new mongoose.Types.ObjectId(product.game_id as string) }).lean<Doc>();
          gameName = game ? (game.name as string) : '';
        } catch { /* invalid id */ }
      }
      await getOrCreateOrderChat({
        orderId, userId: u.id, productId, gameId: (product.game_id as string) ?? '',
        productName: (product.name as string) ?? '', gameName,
        username: u.username ?? '', firstName: u.first_name ?? '',
      });
      const chatMsg = String(product.chat_message ?? '').trim();
      if (chatMsg) await addOrderChatMsg(orderId, 'admin', chatMsg);
    } catch { /* ignore */ }
  }

  try {
    await notifyAdminOrder({
      orderId, userId: u.id, productName: product.name as string, price: finalPrice,
      variantLabel, fieldAnswers, username: u.username ?? '', firstName: u.first_name ?? '',
    });
  } catch { /* ignore */ }

  res.json({ ok: true, order_id: orderId, open_chat: openChat, original_price: originalPrice, final_price: finalPrice, discount: originalPrice - finalPrice });
}));

// ── Validate promo (query params, mirrors FastAPI plain-arg behaviour) ─────────
router.post('/validate-promo', requireUser, asyncHandler(async (req, res) => {
  const productId = String(req.query.product_id ?? req.body?.product_id ?? '');
  const promoCode = String(req.query.promo_code ?? req.body?.promo_code ?? '');
  const variantLabel = String(req.query.variant_label ?? req.body?.variant_label ?? '');
  const product = await getProduct(productId);
  if (!product) throw new HttpError(404, 'Product not found');
  const promo = await getPromoByCode(promoCode);
  if (!promo) throw new HttpError(404, 'Promo code not found or inactive');
  // Match /buy: a variant's price overrides the base price, otherwise the
  // preview discount is wrong for variant products.
  const variants = (product.variants as { label: string; price: number }[]) ?? [];
  const variant = variantLabel ? variants.find((v) => v.label === variantLabel) : undefined;
  const original = variant ? variant.price : (product.price as number);
  const final = applyPromo(original, promo);
  res.json({
    valid: true, original_price: original, final_price: final,
    discount_pct: promo.discount_pct, discount: original - final,
  });
}));

// ── Leave review ──────────────────────────────────────────────────────────────
router.post('/review', requireUser, asyncHandler(async (req, res) => {
  const body = req.body as { order_id?: string; rating?: number; text?: string; photo_url?: string };
  const rating = Number(body.rating);
  if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, 'Rating must be 1-5');
  let orderObjId: mongoose.Types.ObjectId;
  try {
    orderObjId = new mongoose.Types.ObjectId(String(body.order_id));
  } catch {
    throw new HttpError(404, 'Order not found');
  }
  const order = await Orders.findOne({ _id: orderObjId }).lean<Doc>();
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.user_id !== req.tgUser.id) throw new HttpError(403, 'Not your order');
  const existing = await Reviews.findOne({ order_id: body.order_id, user_id: req.tgUser.id }).lean<Doc>();
  if (existing) throw new HttpError(409, 'Review already submitted');

  const user = await Users.findOne({ user_id: order.user_id });
  if (!user) throw new HttpError(404, 'User not found in database');

  await createReview(
    String(user._id),
    req.tgUser.id,
    String(body.order_id),
    order.product_id as string,
    rating,
    body.text ?? '',
    body.photo_url ?? '',
  );
  res.json({ ok: true });
}));

// ── Upload review photo ───────────────────────────────────────────────────────
router.post('/upload-photo', requireUser, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file');
  if (req.file.size > 10 * 1024 * 1024) throw new HttpError(413, 'Photo file too large (max 10 MB)');
  const url = await uploadImage(req.file.buffer, 'doonya_shop/reviews');
  res.json({ url });
}));

export default router;
