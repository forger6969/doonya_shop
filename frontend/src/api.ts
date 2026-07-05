import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  config.headers["X-Init-Data"] = window.Telegram?.WebApp?.initData ?? "";
  return config;
});

// ── Client-side TTL cache ───────────────────────────────────────────────────
const _cache = new Map<string, { data: unknown; exp: number }>();

function withCache<T>(key: string, fn: () => Promise<T>, ttlMs = 30_000): Promise<T> {
  const hit = _cache.get(key);
  if (hit && Date.now() < hit.exp) return Promise.resolve(hit.data as T);
  return fn().then((data) => { _cache.set(key, { data, exp: Date.now() + ttlMs }); return data; });
}

export function invalidateCatalogCache() { _cache.clear(); }

// ── User ────────────────────────────────────────────────────────────────────
export const getMe = () => api.post("/users/me").then((r) => r.data);
export const saveUsername = (username: string) => api.post("/users/username", { username }).then((r) => r.data as { ok: boolean; username: string; locked: boolean });
export const buyStars = (telegram_username: string, stars_count: number) =>
  api.post("/orders/buy-stars", { telegram_username, stars_count }).then((r) => r.data);
export const getOrders = () => api.get("/users/orders").then((r) => r.data);
export const getMyTopups = () => api.get("/users/topups").then((r) => r.data);
export const saveEmail = (email: string) => api.post("/users/email", { email }).then((r) => r.data);
export const uploadAvatar = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/users/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data as { url: string });
};

// ── Support ─────────────────────────────────────────────────────────────────
export const getSupportHistory = () => api.get("/support/chat").then((r) => r.data);
export const agentGetChats = () => api.get("/support/agent/chats").then((r) => r.data);
export const agentGetChat = (userId: number) => api.get(`/support/agent/chats/${userId}`).then((r) => r.data);
export const agentGetAllUsers = (search = "") => api.get("/support/agent/users", { params: search ? { search } : {} }).then((r) => r.data as { user_id: number; username: string; first_name: string; balance: number }[]);

// ── Catalog (cached) ──────────────────────────────────────────────────────────
export const getGames    = () => withCache("games", () => api.get("/catalog/games").then((r) => r.data), 60_000);
export const getCategories = (gameId: string) => withCache(`cats:${gameId}`, () => api.get(`/catalog/games/${gameId}/categories`).then((r) => r.data), 60_000);
export const getProducts = (gameId: string) => withCache(`prods:${gameId}`, () => api.get(`/catalog/games/${gameId}/products`).then((r) => r.data), 30_000);
export const getProduct  = (id: string) => withCache(`prod:${id}`, () => api.get(`/catalog/products/${id}`).then((r) => r.data), 30_000);
export const getReviews  = (id: string) => api.get(`/catalog/products/${id}/reviews`).then((r) => r.data);
export const getTopProducts = () => api.get("/catalog/top").then((r) => r.data);
export const getOnSaleProducts = () => api.get("/catalog/on-sale").then((r) => r.data);
export const searchCatalog = (q: string) => api.get("/catalog/search", { params: { q } }).then((r) => r.data);

// ── Topup ────────────────────────────────────────────────────────────────────
export interface PayMethodOption { id: string; label: string; icon: string }
export const getPaymentMethodsList = () =>
  api.get("/topup/methods/list").then((r) => r.data as PayMethodOption[]);
export const getTopupInfo = (amount: number, method: string) =>
  api.get("/topup/methods", { params: { amount, method } }).then((r) => r.data);
export const submitTopup = (formData: FormData) =>
  api.post("/topup/submit", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);

// ── Orders ───────────────────────────────────────────────────────────────────
export const buyProduct = (
  productId: string,
  promoCode = "",
  variantLabel = "",
  fieldAnswers: Record<string, string> = {},
) =>
  api.post("/orders/buy", {
    product_id: productId,
    promo_code: promoCode,
    variant_label: variantLabel,
    field_answers: fieldAnswers,
  }).then((r) => r.data);
export const validatePromo = (productId: string, promoCode: string) =>
  api.post("/orders/validate-promo", null, { params: { product_id: productId, promo_code: promoCode } }).then((r) => r.data);
export const leaveReview = (data: { order_id: string; rating: number; text?: string; photo_url?: string }) =>
  api.post("/orders/review", data).then((r) => r.data);
export const uploadReviewPhoto = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/orders/upload-photo", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data as { url: string });
};

// ── Admin ────────────────────────────────────────────────────────────────────
export const adminGetStats = () => api.get("/admin/stats").then((r) => r.data);
export const adminUpload = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data as { url: string });
};

// Games
export const adminGetGames = () => api.get("/admin/games").then((r) => r.data);
export const adminCreateGame = (name: string, description: string, icon_url = "") =>
  api.post("/admin/games", { name, description, icon_url }).then((r) => r.data);
export const adminPatchGame = (id: string, data: object) => api.patch(`/admin/games/${id}`, data).then((r) => r.data);
export const adminDeleteGame = (id: string) => api.delete(`/admin/games/${id}`).then((r) => r.data);

// Categories
export const adminGetCategories = (gameId: string) => api.get(`/admin/games/${gameId}/categories`).then((r) => r.data);
export const adminCreateCategory = (game_id: string, name: string) => api.post("/admin/categories", { game_id, name }).then((r) => r.data);
export const adminPatchCategory = (id: string, name: string) => api.patch(`/admin/categories/${id}`, { name }).then((r) => r.data);
export const adminDeleteCategory = (id: string) => api.delete(`/admin/categories/${id}`).then((r) => r.data);

// Products
export const adminGetProducts = (gameId: string, categoryId = "") =>
  api.get(`/admin/games/${gameId}/products`, { params: categoryId ? { category_id: categoryId } : {} }).then((r) => r.data);
export const adminCreateProduct = (data: { game_id: string; category_id?: string; name: string; description: string; price: number; icon_url?: string; redirect_to_chat?: boolean; chat_message?: string; badge_emoji?: string }) =>
  api.post("/admin/products", data).then((r) => r.data);
export const adminPatchProduct = (id: string, data: object) => api.patch(`/admin/products/${id}`, data).then((r) => r.data);
export const adminDeleteProduct = (id: string) => api.delete(`/admin/products/${id}`).then((r) => r.data);

// Topups & Orders
export const adminGetTopups = (status = "pending") => api.get(`/admin/topups?status=${status}`).then((r) => r.data);
export const adminGetOrders = (status = "pending") => api.get(`/admin/orders?status=${status}`).then((r) => r.data);
export const adminConfirmTopup = (id: string) => api.post(`/admin/topup/${id}/confirm`).then((r) => r.data);
export const adminRejectTopup = (id: string) => api.post(`/admin/topup/${id}/reject`).then((r) => r.data);
export const adminCompleteOrder = (id: string) => api.post(`/admin/order/${id}/complete`).then((r) => r.data);

// Analytics
export const adminSalesStats = (days: number) => api.get(`/admin/analytics/sales?days=${days}`).then((r) => r.data);
export const adminProductStats = () => api.get("/admin/analytics/products").then((r) => r.data);
export const adminUserStats = () => api.get("/admin/analytics/users").then((r) => r.data);

// Promos
export const adminGetPromos = () => api.get("/admin/promos").then((r) => r.data);
export const adminCreatePromo = (data: { code: string; discount_pct: number; min_order_amount: number; max_uses: number }) =>
  api.post("/admin/promos", data).then((r) => r.data);
export const adminDeletePromo = (id: string) => api.delete(`/admin/promos/${id}`).then((r) => r.data);
export const adminTogglePromo = (id: string) => api.patch(`/admin/promos/${id}/toggle`).then((r) => r.data);

// Banners
export interface Banner { id: string; title: string; subtitle: string; gradient: string; emoji: string; active: boolean; created_at: string }
export const getActiveBanners = () => api.get("/catalog/banners").then((r) => r.data as Banner[]);
export const adminGetBanners = () => api.get("/admin/banners").then((r) => r.data as Banner[]);
export const adminCreateBanner = (data: { title: string; subtitle: string; gradient: string; emoji: string }) =>
  api.post("/admin/banners", data).then((r) => r.data);
export const adminDeleteBanner = (id: string) => api.delete(`/admin/banners/${id}`).then((r) => r.data);
export const adminToggleBanner = (id: string) => api.patch(`/admin/banners/${id}/toggle`).then((r) => r.data);

// Payment methods (admin-managed)
export interface PaymentMethod { id: string; label: string; icon: string; requisites: string; holder: string; note: string; is_active: boolean; order: number }
export const adminGetPaymentMethods = () => api.get("/admin/payment-methods").then((r) => r.data as PaymentMethod[]);
export const adminCreatePaymentMethod = (data: { label: string; icon?: string; requisites: string; holder?: string; note?: string }) =>
  api.post("/admin/payment-methods", data).then((r) => r.data);
export const adminUpdatePaymentMethod = (id: string, data: Partial<{ label: string; icon: string; requisites: string; holder: string; note: string; order: number; is_active: boolean }>) =>
  api.patch(`/admin/payment-methods/${id}`, data).then((r) => r.data);
export const adminTogglePaymentMethod = (id: string) => api.patch(`/admin/payment-methods/${id}/toggle`).then((r) => r.data);
export const adminDeletePaymentMethod = (id: string) => api.delete(`/admin/payment-methods/${id}`).then((r) => r.data);

// Discount
export const adminSetDiscount = (
  productId: string,
  data: { discount_percent: number; discount_enabled: boolean; discount_until?: string | null; broadcast?: boolean }
) => api.patch(`/admin/products/${productId}/discount`, data).then((r) => r.data);

// Support WS URL helper
export const getSupportWsUrl = () => {
  const base = import.meta.env.VITE_API_URL || "http://localhost:8000";
  return base.replace(/^http/, "ws") + "/support/ws";
};

// Notify WS URL helper
export const getNotifyWsUrl = () => {
  const base = import.meta.env.VITE_API_URL || "http://localhost:8000";
  return base.replace(/^http/, "ws") + "/notify/ws";
};

// ── Order Chat ───────────────────────────────────────────────────────────────
export interface AdminOrderChat {
  order_id: string;
  user_id: number;
  username: string;
  first_name: string;
  product_id: string;
  product_name: string;
  game_id: string;
  game_name: string;
  unread_by_admin: number;
  unread_by_user: number;
  last_ts: string;
  last_message: string;
}

export const getOrderChatWsUrl = (order_id?: string) => {
  const base = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const url = base.replace(/^http/, "ws") + "/order-chat/ws";
  return order_id ? `${url}?order_id=${encodeURIComponent(order_id)}` : url;
};

export const getMyOrderChats = () => api.get("/order-chat/my").then((r) => r.data as AdminOrderChat[]);
export const getMyOrderChatHistory = (order_id: string) =>
  api.get(`/order-chat/my/${order_id}`).then((r) => r.data as { messages: { id: string; from: string; text: string; ts: string }[]; order_id: string; unread_by_user: number });
export const adminGetOrderChats = (game_id = "", product_id = "") =>
  api.get("/order-chat/admin/chats", { params: { ...(game_id && { game_id }), ...(product_id && { product_id }) } }).then((r) => r.data as AdminOrderChat[]);
