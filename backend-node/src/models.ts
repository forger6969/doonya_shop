import mongoose, { Schema, Document } from 'mongoose';

// Общие настройки для всех схем (включаем строгий режим и авто-таймстампы, где нужно)
const opts = {
  strict: true,      // Теперь Mongoose будет строго следить за полями
  versionKey: false  // TypeScript доволен благодаря as const ниже
} as const;

// ── 1. Users Schema ─────────────────────────────────────────────────────────
const userSchema = new Schema(
  {
    user_id: { type: Number, required: true, unique: true, index: true },
    username: { type: String, default: "" },
    first_name: { type: String, required: true },
    balance: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now },
  },
  { ...opts, collection: 'users' },
);

// ── 2. Games Schema ─────────────────────────────────────────────────────────
const gameSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    photo_id: { type: String, default: "" },
    icon_url: { type: String, default: "" },
    is_active: { type: Boolean, default: true },
    order: { type: Number, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { ...opts, collection: 'games' },
);

// ── 3. Categories Schema ────────────────────────────────────────────────────
const categorySchema = new Schema(
  {
    game_id: { type: String, required: true, index: true }, // Ссылка на ID игры
    name: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    order: { type: Number, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { ...opts, collection: 'categories' },
);

// ── 4. Products Schema ──────────────────────────────────────────────────────
const productSchema = new Schema(
  {
    game_id: { type: String, required: true, index: true },
    category_id: { type: String, default: "", index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    photo_id: { type: String, default: "" },
    icon_url: { type: String, default: "" },
    is_active: { type: Boolean, default: true },
    order: { type: Number, required: true },

    // Поля скидок
    discount_percent: { type: Number, default: 0 },
    discount_enabled: { type: Boolean, default: false },
    discount_until: { type: Date, default: null },

    // Дополнительные динамические структуры
    variants: { type: [Schema.Types.Mixed], default: [] },       // Массив вариантов товара
    purchase_fields: { type: [Schema.Types.Mixed], default: [] }, // Кастомные поля для покупки
  },
  { ...opts, collection: 'products' },
);

// ── 5. Topups Schema ────────────────────────────────────────────────────────
const topupSchema = new Schema(
  {
    user_id: { type: Number, required: true, index: true },
    amount: { type: Number, required: true },
    unique_amount: { type: Number, required: true },
    method: { type: String, required: true },
    receipt_file_id: { type: String, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending', index: true },
    confirmed_at: { type: Date, default: null },
    rejected_at: { type: Date, default: null },
    created_at: { type: Date, default: Date.now },
  },
  { ...opts, collection: 'topups' },
);

// ── 6. Orders Schema ────────────────────────────────────────────────────────
const orderSchema = new Schema(
  {
    user_id: { type: Number, required: true, index: true },
    product_id: { type: String, required: true, index: true },
    game_id: { type: String, required: true },
    amount: { type: Number, required: true },
    original_price: { type: Number, required: true },
    promo_code: { type: String, default: "" },
    variant_label: { type: String, default: "" },
    field_answers: { type: Schema.Types.Mixed, default: {} }, // Ответы пользователя на вопросы формы
    status: { type: String, enum: ['pending', 'completed', 'refunded'], default: 'pending', index: true },
    completed_at: { type: Date, default: null },
    created_at: { type: Date, default: Date.now },
  },
  { ...opts, collection: 'orders' },
);

// ── 7. Reviews Schema (С правильной связью populate) ────────────────────────
const reviewSchema = new Schema(
  {
    db_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // ObjectId для связи с коллекцией Users
    user_id: { type: Number, required: true }, // Telegram ID
    order_id: { type: String, required: true, unique: true },
    product_id: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: "" },
    photo_url: { type: String, default: "" },
    created_at: { type: Date, default: Date.now },
  },
  { ...opts, collection: 'reviews' },
);

// ── 8. Promos Schema ────────────────────────────────────────────────────────
const promoSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    discount_pct: { type: Number, required: true },
    min_order_amount: { type: Number, default: 0 },
    max_uses: { type: Number, default: 0 },
    uses: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
  },
  { ...opts, collection: 'promos' },
);

// ── 9. Notifications Schema ─────────────────────────────────────────────────
const notificationSchema = new Schema(
  {
    user_id: { type: Number, required: true, index: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
    created_at: { type: Date, default: Date.now },
  },
  { ...opts, collection: 'notifications' },
);

// ── 10. Support Chats Schema ────────────────────────────────────────────────
const chatMessageSchema = new Schema({
  id: { type: String, required: true },
  from: { type: String, enum: ['user', 'agent'], required: true },
  text: { type: String, required: true },
  ts: { type: String, required: true },
  agent_id: { type: Number, default: null }
}, { _id: false });

const supportChatSchema = new Schema(
  {
    user_id: { type: Number, required: true, unique: true, index: true },
    user_name: { type: String, default: "" },
    first_name: { type: String, default: "" },
    messages: { type: [chatMessageSchema], default: [] },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    unread_by_agent: { type: Number, default: 0 },
    last_ts: { type: Date, default: Date.now },
    created_at: { type: Date, default: Date.now },
  },
  { ...opts, collection: 'support_chats' },
);

// ── 11. Order Chats Schema ──────────────────────────────────────────────────
const orderChatSchema = new Schema(
  {
    order_id: { type: String, required: true, unique: true, index: true },
    user_id: { type: Number, required: true, index: true },
    username: { type: String, default: "" },
    first_name: { type: String, default: "" },
    product_id: { type: String, required: true },
    game_id: { type: String, required: true },
    product_name: { type: String, default: "" },
    game_name: { type: String, default: "" },
    messages: { type: [chatMessageSchema], default: [] },
    unread_by_admin: { type: Number, default: 0 },
    unread_by_user: { type: Number, default: 0 },
    last_ts: { type: Date, default: Date.now },
    created_at: { type: Date, default: Date.now },
  },
  { ...opts, collection: 'order_chats' },
);

// ── 12. Banners Schema ──────────────────────────────────────────────────────
const bannerSchema = new Schema(
  {
    name: { type: String, required: true },
    photo_id: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
  },
  { ...opts, collection: 'banners' },
);

// Экспорт моделей
export const Users = mongoose.model('User', userSchema);
export const Games = mongoose.model('Game', gameSchema);
export const Categories = mongoose.model('Category', categorySchema);
export const Products = mongoose.model('Product', productSchema);
export const Topups = mongoose.model('Topup', topupSchema);
export const Orders = mongoose.model('Order', orderSchema);
export const Reviews = mongoose.model('Review', reviewSchema);
export const Promos = mongoose.model('Promo', promoSchema);
export const Notifications = mongoose.model('Notification', notificationSchema);
export const SupportChats = mongoose.model('SupportChat', supportChatSchema);
export const OrderChats = mongoose.model('OrderChat', orderChatSchema);
export const Banners = mongoose.model('Banner', bannerSchema);

// Снова добавляем тип Doc, который ищут все ваши роутеры и репозиторий
export type Doc = Record<string, any>;

// Добавляем функцию createIndexes для сервера, чтобы не падало при запуске
export async function createIndexes(): Promise<void> {
  await Promise.all([
    Users.collection.createIndex({ user_id: 1 }, { unique: true, background: true }),
    Orders.collection.createIndex({ user_id: 1 }, { background: true }),
    Orders.collection.createIndex({ status: 1 }, { background: true }),
    Orders.collection.createIndex({ product_id: 1 }, { background: true }),
    Topups.collection.createIndex({ user_id: 1 }, { background: true }),
    Topups.collection.createIndex({ status: 1 }, { background: true }),
    OrderChats.collection.createIndex({ order_id: 1 }, { unique: true, background: true }),
    OrderChats.collection.createIndex({ user_id: 1 }, { background: true }),
    SupportChats.collection.createIndex({ user_id: 1 }, { unique: true, background: true }),
    Notifications.collection.createIndex({ user_id: 1, read: 1 }, { background: true }),
  ]);
}

export { mongoose };