import { Router } from 'express';
import { asyncHandler, HttpError } from '../http';
import { cacheGet, cacheSet } from '../cache';
import { Games, Categories, Products, Banners, Doc } from '../models';
import {
  getGames, getGame, getCategories, getProducts, getProduct, getProductReviews,
  isDiscountActive, calcDiscountedPrice, getActiveDiscounts, getTopCatalogProducts,
  getAllProductStats, getAllProductRatings,
} from '../repo';

const router = Router();

const GAMES_TTL = 60;
const PRODUCTS_TTL = 30;
const BANNERS_TTL = 60;

function fmtProduct(p: Doc, categoryName = ''): Doc {
  const price = p.price as number;
  const discounted = calcDiscountedPrice(price, p);
  return {
    id: String(p._id),
    game_id: p.game_id,
    category_id: p.category_id ?? '',
    category_name: categoryName,
    name: p.name,
    description: p.description ?? '',
    price,
    discounted_price: discounted,
    discount_percent: isDiscountActive(p) ? p.discount_percent ?? 0 : 0,
    photo_id: p.photo_id ?? '',
    badge_emoji: p.badge_emoji ?? '',
    variants: p.variants ?? [],
    purchase_fields: p.purchase_fields ?? [],
    avg_rating: null as number | null,
    reviews_count: 0,
    sales_count: p._sales_count ?? 0,
  };
}

async function enrichSocial(results: Doc[]): Promise<Doc[]> {
  const ids = results.map((r) => r.id as string);
  if (!ids.length) return results;
  const [stats, ratings] = await Promise.all([getAllProductStats(ids), getAllProductRatings(ids)]);
  for (const r of results) {
    const st = stats[r.id as string];
    const rt = ratings[r.id as string];
    if (st) r.sales_count = st.count ?? r.sales_count;
    if (rt) {
      r.avg_rating = rt.avg;
      r.reviews_count = rt.count ?? 0;
    }
  }
  return results;
}

router.get('/games', asyncHandler(async (_req, res) => {
  const cached = cacheGet('catalog:games');
  if (cached !== null) return res.json(cached);
  const games = await getGames();
  const result = games.map((g) => ({
    id: String(g._id),
    name: g.name,
    description: g.description ?? '',
    photo_id: (g.photo_id as string) || (g.icon_url as string) || '',
    banner_url: g.banner_url ?? '',
  }));
  cacheSet('catalog:games', result, GAMES_TTL);
  res.json(result);
}));

router.get('/games/:gameId/categories', asyncHandler(async (req, res) => {
  const game = await getGame(req.params.gameId);
  if (!game) throw new HttpError(404, 'Game not found');
  const cats = await getCategories(req.params.gameId);
  res.json(cats.map((c) => ({ id: String(c._id), name: c.name })));
}));

router.get('/games/:gameId/products', asyncHandler(async (req, res) => {
  const key = `catalog:products:${req.params.gameId}`;
  const cached = cacheGet(key);
  if (cached !== null) return res.json(cached);
  const game = await getGame(req.params.gameId);
  if (!game) throw new HttpError(404, 'Game not found');
  const [cats, products] = await Promise.all([getCategories(req.params.gameId), getProducts(req.params.gameId)]);
  const catMap = new Map(cats.map((c) => [String(c._id), c.name as string]));
  const result = products.map((p) => fmtProduct(p, catMap.get((p.category_id as string) ?? '') ?? ''));
  await enrichSocial(result);
  cacheSet(key, result, PRODUCTS_TTL);
  res.json(result);
}));

router.get('/products/:productId', asyncHandler(async (req, res) => {
  const p = await getProduct(req.params.productId);
  if (!p) throw new HttpError(404, 'Product not found');
  const reviews = await getProductReviews(req.params.productId);
  const avgRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + (r.rating as number), 0) / reviews.length) * 10) / 10
    : null;
  const result = fmtProduct(p);
  result.avg_rating = avgRating;
  result.reviews_count = reviews.length;
  res.json(result);
}));

router.get('/products/:productId/reviews', asyncHandler(async (req, res) => {
  const reviews = await getProductReviews(req.params.productId);
  res.json(reviews.map((r) => {
    const createdAt = r.created_at instanceof Date ? r.created_at : new Date(r.created_at as string);
    return {
      _id: r._id,
      user_id: r.user_id,
      order_id: r.order_id,
      product_id: r.product_id,
      rating: r.rating,
      text: r.text ?? '',
      photo_url: r.photo_url ?? '',
      created_at: createdAt.toISOString(),
      user: r.user,
      db_user_id: r.user ? { ...r.user } : null,
    };
  }));
}));

router.get('/top', asyncHandler(async (_req, res) => {
  const cached = cacheGet('catalog:top');
  if (cached !== null) return res.json(cached);
  const products = await getTopCatalogProducts(6);
  const result = products.map((p) => fmtProduct(p));
  await enrichSocial(result);
  cacheSet('catalog:top', result, PRODUCTS_TTL);
  res.json(result);
}));

router.get('/on-sale', asyncHandler(async (_req, res) => {
  const cached = cacheGet('catalog:on_sale');
  if (cached !== null) return res.json(cached);
  const products = await getActiveDiscounts(20);
  const result = products.map((p) => fmtProduct(p));
  await enrichSocial(result);
  cacheSet('catalog:on_sale', result, PRODUCTS_TTL);
  res.json(result);
}));

router.get('/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ games: [], categories: [], products: [] });
  const regex = { $regex: q, $options: 'i' };
  const [rawGames, rawCats, rawProducts] = await Promise.all([
    Games.find({ is_active: true, name: regex }).limit(10).lean<Doc[]>(),
    Categories.find({ is_active: true, name: regex }).limit(10).lean<Doc[]>(),
    Products.find({ is_active: true, name: regex }).limit(20).lean<Doc[]>(),
  ]);
  const games = rawGames.map((g) => ({
    id: String(g._id), name: g.name, photo_id: (g.photo_id as string) || (g.icon_url as string) || '',
  }));
  const categories = rawCats.map((c) => ({ id: String(c._id), game_id: c.game_id, name: c.name }));
  const products = rawProducts.map((p) => fmtProduct(p));
  await enrichSocial(products);
  res.json({ games, categories, products });
}));

router.get('/banners', asyncHandler(async (_req, res) => {
  const cached = cacheGet('catalog:banners');
  if (cached !== null) return res.json(cached);
  const banners = await Banners.find({ active: true }).sort({ created_at: -1 }).limit(10).lean<Doc[]>();
  const result = banners.map((b) => ({
    id: String(b._id),
    title: b.title,
    subtitle: b.subtitle ?? '',
    gradient: b.gradient ?? 'pink',
    emoji: b.emoji ?? '🎉',
  }));
  cacheSet('catalog:banners', result, BANNERS_TTL);
  res.json(result);
}));

export default router;
