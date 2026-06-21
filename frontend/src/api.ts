import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  config.headers["X-Init-Data"] = window.Telegram?.WebApp?.initData ?? "";
  return config;
});

// ── User ────────────────────────────────────────────────────────────────────
export const getMe = () => api.post("/users/me").then((r) => r.data);
export const getOrders = () => api.get("/users/orders").then((r) => r.data);
export const getMyTopups = () => api.get("/users/topups").then((r) => r.data);
export const saveEmail = (email: string) => api.post("/users/email", { email }).then((r) => r.data);

// ── Support ─────────────────────────────────────────────────────────────────
export const createTicket = (data: { category: string; message: string }) =>
  api.post("/support/ticket", data).then((r) => r.data);
export const getMyTickets = () => api.get("/support/tickets").then((r) => r.data);

// ── Catalog ──────────────────────────────────────────────────────────────────
export const getGames = () => api.get("/catalog/games").then((r) => r.data);
export const getProducts = (gameId: string) => api.get(`/catalog/games/${gameId}/products`).then((r) => r.data);
export const getProduct = (id: string) => api.get(`/catalog/products/${id}`).then((r) => r.data);
export const getReviews = (id: string) => api.get(`/catalog/products/${id}/reviews`).then((r) => r.data);

// ── Topup ────────────────────────────────────────────────────────────────────
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

// Products
export const adminGetProducts = (gameId: string) => api.get(`/admin/games/${gameId}/products`).then((r) => r.data);
export const adminCreateProduct = (data: { game_id: string; name: string; description: string; price: number; icon_url?: string }) =>
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
