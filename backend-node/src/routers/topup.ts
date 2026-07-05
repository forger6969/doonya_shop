import { Router } from 'express';
import multer from 'multer';
import { asyncHandler, HttpError } from '../http';
import { requireUser } from '../auth';
import { getOrCreateUser, createTopup } from '../repo';
import { uploadImage } from '../cloudinary';
import { notifyAdminTopup } from '../notify';
import { PaymentMethods, mongoose, Doc } from '../models';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 + 1 } });

const fmt = (n: number): string => n.toLocaleString('en-US');
const uniqueAmount = (base: number): number => base + Math.floor(Math.random() * 100) + 1;

const oid = (id: string): mongoose.Types.ObjectId | null => {
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
};

// Active payment methods for the top-up picker (admin-managed).
router.get('/methods/list', asyncHandler(async (_req, res) => {
  const methods = await PaymentMethods.find({ is_active: true })
    .sort({ order: 1, created_at: 1 }).lean<Doc[]>();
  res.json(methods.map((m) => ({
    id: String(m._id), label: m.label, icon: m.icon ?? '💳',
  })));
}));

// Requisites for a chosen method (method = the payment method's _id).
router.get('/methods', asyncHandler(async (req, res) => {
  const amount = parseInt(String(req.query.amount ?? '0'), 10);
  const methodId = String(req.query.method ?? '');
  const id = oid(methodId);
  if (!id) throw new HttpError(400, 'Unknown method');

  const m = await PaymentMethods.findOne({ _id: id, is_active: true }).lean<Doc>();
  if (!m) throw new HttpError(400, 'Unknown method');

  const exact = uniqueAmount(amount);
  const note = (m.note as string)?.trim()
    || `Переведите ровно ${fmt(exact)} сум на ${m.label}. По этой сумме мы идентифицируем ваш платёж.`;
  res.json({
    method: String(m._id), label: m.label, icon: m.icon ?? '💳',
    requisites: m.requisites, holder: m.holder ?? '', amount: exact, note,
  });
}));

router.post('/submit', requireUser, upload.single('receipt'), asyncHandler(async (req, res) => {
  const u = req.tgUser;
  const body = req.body as { amount?: string; unique_amount?: string; method?: string };
  const amount = parseInt(body.amount ?? '0', 10);
  const uniqAmount = parseInt(body.unique_amount ?? '0', 10);
  const method = body.method ?? '';
  if (!req.file) throw new HttpError(400, 'No receipt');
  if (req.file.size > 10 * 1024 * 1024) throw new HttpError(413, 'Receipt file too large (max 10 MB)');

  await getOrCreateUser(u.id, u.username ?? '', u.first_name ?? '');
  const receiptUrl = await uploadImage(req.file.buffer, 'doonya_shop/receipts', `${u.id}_${uniqAmount}`);
  const topupId = await createTopup(u.id, amount, uniqAmount, method, receiptUrl);

  try {
    await notifyAdminTopup({
      topupId, userId: u.id, amount: uniqAmount, method, receiptUrl, firstName: u.first_name ?? '',
    });
  } catch {
    /* ignore */
  }

  res.json({ ok: true, topup_id: topupId });
}));

export default router;
