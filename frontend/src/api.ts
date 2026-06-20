import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const initData = window.Telegram?.WebApp?.initData ?? "";
  config.headers["X-Init-Data"] = initData;
  return config;
});

export const getMe = () => api.post("/users/me").then((r) => r.data);
export const getOrders = () => api.get("/users/orders").then((r) => r.data);

export const getGames = () => api.get("/catalog/games").then((r) => r.data);
export const getProducts = (gameId: string) =>
  api.get(`/catalog/games/${gameId}/products`).then((r) => r.data);
export const getProduct = (productId: string) =>
  api.get(`/catalog/products/${productId}`).then((r) => r.data);
export const getReviews = (productId: string) =>
  api.get(`/catalog/products/${productId}/reviews`).then((r) => r.data);

export const getTopupInfo = (amount: number, method: string) =>
  api.get("/topup/methods", { params: { amount, method } }).then((r) => r.data);

export const submitTopup = (formData: FormData) =>
  api.post("/topup/submit", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);

export const buyProduct = (productId: string) =>
  api.post("/orders/buy", { product_id: productId }).then((r) => r.data);

export const leaveReview = (data: {
  order_id: string;
  product_id: string;
  rating: number;
  text: string;
}) => api.post("/orders/review", data).then((r) => r.data);

export const getMyTopups = () => api.get("/users/topups").then((r) => r.data);

// Admin
export const adminGetTopups = (status = "pending") =>
  api.get(`/admin/topups?status=${status}`).then((r) => r.data);
export const adminGetOrders = (status = "pending") =>
  api.get(`/admin/orders?status=${status}`).then((r) => r.data);
export const adminConfirmTopup = (id: string) =>
  api.post(`/admin/topup/${id}/confirm`).then((r) => r.data);
export const adminRejectTopup = (id: string) =>
  api.post(`/admin/topup/${id}/reject`).then((r) => r.data);
export const adminCompleteOrder = (id: string) =>
  api.post(`/admin/order/${id}/complete`).then((r) => r.data);
