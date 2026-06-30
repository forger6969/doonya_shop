import { Router } from 'express';
import multer from 'multer';
import { asyncHandler, HttpError } from '../http';
import { requireUser } from '../auth';
import { config } from '../config';
import { getOrCreateUser, createTopup } from '../repo';
import { uploadImage } from '../cloudinary';
import { notifyAdminTopup } from '../notify';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 + 1 } });

const fmt = (n: number): string => n.toLocaleString('en-US');
const uniqueAmount = (base: number): number => base + Math.floor(Math.random() * 100) + 1;
const roundAmount = (base: number): number => Math.round(base / 1000) * 1000;

router.get('/methods', asyncHandler(async (req, res) => {
  const amount = parseInt(String(req.query.amount ?? '0'), 10);
  const method = String(req.query.method ?? '');

  if (method === 'uzcard') {
    const exact = uniqueAmount(amount);
    return res.json({
      method: 'uzcard', requisites: config.uzcardRequisites, holder: config.uzcardHolder, amount: exact,
      note: `Переведите ровно ${fmt(exact)} сум на Uzcard. По этой сумме мы идентифицируем ваш платёж.`,
    });
  }
  if (method === 'visa') {
    const exact = uniqueAmount(amount);
    return res.json({
      method: 'visa', requisites: config.visaRequisites, holder: config.visaHolder, amount: exact,
      note: `Переведите ровно ${fmt(exact)} сум на Visa. По этой сумме мы идентифицируем ваш платёж.`,
    });
  }
  if (method === 'atm') {
    const exact = roundAmount(amount);
    return res.json({
      method: 'atm', amount: exact,
      cards: [
        { requisites: config.uzcardRequisites, holder: config.uzcardHolder, type: 'Uzcard' },
        { requisites: config.visaRequisites, holder: config.visaHolder, type: 'Visa' },
      ],
      note: `Внесите ровно ${fmt(exact)} сум через банкомат и прикрепите чек.`,
    });
  }
  throw new HttpError(400, 'Unknown method');
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
