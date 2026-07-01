import { Router } from 'express';
import multer from 'multer';
import { asyncHandler, HttpError } from '../http';
import { requireUser } from '../auth';
import { getOrCreateUser, getUserOrders } from '../repo';
import { Users, Topups, Doc } from '../models';
import { uploadImage } from '../cloudinary';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 + 1 } });

router.post('/me', requireUser, asyncHandler(async (req, res) => {
  const u = req.tgUser;
  const user = await getOrCreateUser(u.id, u.username ?? '', u.first_name ?? '');
  res.json({
    user_id: user.user_id,
    first_name: user.first_name,
    username: user.username ?? '',
    balance: user.balance,
    email: user.email ?? '',
    avatar_url: user.avatar_url ?? '',
  });
}));

router.post('/username', requireUser, asyncHandler(async (req, res) => {
  const body = req.body as { username?: string };
  const username = String(body.username ?? '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new HttpError(422, 'Invalid username');

  const user = await Users.findOne({ user_id: req.tgUser.id }).lean<Doc>();
  if (!user) throw new HttpError(404, 'User not found');
  if (typeof user.username === 'string' && user.username.trim()) {
    return res.json({ ok: true, username: user.username, locked: true });
  }

  await Users.updateOne({ user_id: req.tgUser.id }, { $set: { username } });
  res.json({ ok: true, username, locked: true });
}));

router.post('/avatar', requireUser, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file');
  if (req.file.size > 5 * 1024 * 1024) throw new HttpError(413, 'Avatar file too large (max 5 MB)');
  const url = await uploadImage(req.file.buffer, 'doonya_shop/avatars', `user_${req.tgUser.id}`);
  await Users.updateOne({ user_id: req.tgUser.id }, { $set: { avatar_url: url } });
  res.json({ url });
}));

router.post('/email', requireUser, asyncHandler(async (req, res) => {
  let email = String((req.body as { email?: string }).email ?? '').trim().slice(0, 254);
  if (email && !email.includes('@')) throw new HttpError(422, 'Invalid email address');
  await Users.updateOne({ user_id: req.tgUser.id }, { $set: { email } });
  res.json({ ok: true });
}));

router.get('/orders', requireUser, asyncHandler(async (req, res) => {
  const orders = await getUserOrders(req.tgUser.id);
  res.json(orders.map((o: Doc) => ({
    id: String(o._id),
    product_id: o.product_id,
    amount: o.amount,
    status: o.status,
    created_at: (o.created_at as Date).toISOString(),
  })));
}));

router.get('/topups', requireUser, asyncHandler(async (req, res) => {
  const topups = await Topups.find({ user_id: req.tgUser.id }).sort({ created_at: -1 }).limit(20).lean<Doc[]>();
  res.json(topups.map((t) => ({
    id: String(t._id),
    amount: t.amount,
    method: t.method,
    status: t.status,
    created_at: (t.created_at as Date).toISOString(),
  })));
}));

export default router;
