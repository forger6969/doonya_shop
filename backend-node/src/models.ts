import mongoose, { Schema } from 'mongoose';

// Flexible schemas (strict:false) so existing ad-hoc fields (variants, discount_*,
// purchase_fields, email, avatar_url, ...) are preserved exactly as the Python backend
// wrote them. Collection names are pinned to match the live database.

const opts = { strict: false as const, versionKey: false };

const userSchema = new Schema(
  {
    user_id: { type: Number, index: true, unique: true },
    username: String,
    first_name: String,
    balance: { type: Number, default: 0 },
    email: String,
    avatar_url: String,
    created_at: Date,
  },
  { ...opts, collection: 'users' },
);

const gameSchema = new Schema({}, { ...opts, collection: 'games' });
const categorySchema = new Schema({}, { ...opts, collection: 'categories' });
const productSchema = new Schema({}, { ...opts, collection: 'products' });
const topupSchema = new Schema({}, { ...opts, collection: 'topups' });
const orderSchema = new Schema({}, { ...opts, collection: 'orders' });
const reviewSchema = new Schema({}, { ...opts, collection: 'reviews' });
const promoSchema = new Schema({}, { ...opts, collection: 'promos' });
const notificationSchema = new Schema({}, { ...opts, collection: 'notifications' });
const supportChatSchema = new Schema({}, { ...opts, collection: 'support_chats' });
const orderChatSchema = new Schema({}, { ...opts, collection: 'order_chats' });
const bannerSchema = new Schema({}, { ...opts, collection: 'banners' });

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

// Generic document shape — these collections are schemaless on purpose.
export type Doc = Record<string, unknown>;

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
