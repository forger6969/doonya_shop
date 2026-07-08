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
const SURCHARGE_MAX = 100; // uniqueAmount adds a random 1..SURCHARGE_MAX for payment ID
const uniqueAmount = (base: number): number => base + Math.floor(Math.random() * SURCHARGE_MAX) + 1;
const TOPUP_MIN = 1_000;
const TOPUP_MAX = 100_000_000;

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

  // Both amount and unique_amount arrive from the client. The credited value is
  // `amount`, while the admin verifies the receipt against `unique_amount`. Bind
  // them so a client can't submit unique_amount=<real receipt> with a hugely
  // inflated amount: the surcharge must be within the range /methods can add.
  if (!Number.isInteger(amount) || amount < TOPUP_MIN || amount > TOPUP_MAX) {
    throw new HttpError(422, 'Invalid amount');
  }
  const surcharge = uniqAmount - amount;
  if (!Number.isInteger(uniqAmount) || surcharge < 1 || surcharge > SURCHARGE_MAX) {
    throw new HttpError(422, 'Invalid payment amount');
  }

  await getOrCreateUser(u.id, u.username ?? '', u.first_name ?? '');
  const receiptUrl = await uploadImage(req.file.buffer, 'doonya_shop/receipts', `${u.id}_${uniqAmount}`);
  const topupId = await createTopup(u.id, amount, uniqAmount, method, receiptUrl);

  try {
    // `method` here is the payment method's _id (client sends the id, not the label) — resolve
    // it to the human label so the admin notification reads "Uzcard"/"Humo", not a raw ObjectId.
    const methodId = oid(method);
    const methodDoc = methodId ? await PaymentMethods.findOne({ _id: methodId }).lean<Doc>() : null;
    await notifyAdminTopup({
      topupId, userId: u.id, amount: uniqAmount, method: methodDoc?.label ?? method, receiptUrl,
      firstName: u.first_name ?? '', username: u.username ?? '',
    });
  } catch {
    /* ignore */
  }

  res.json({ ok: true, topup_id: topupId });
}));

export default router;
