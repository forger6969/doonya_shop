import { Router } from 'express';
import { asyncHandler } from '../http';
import { verifyTelegramInitData } from '../auth';
import { markNotificationsRead } from '../repo';

const router = Router();

// Mark all notifications read. initData comes via query/body (Python read it as a plain arg).
router.post('/read', asyncHandler(async (req, res) => {
  try {
    const initData = String(req.query.initData ?? (req.body as { initData?: string })?.initData ?? '');
    const tgUser = verifyTelegramInitData(initData);
    await markNotificationsRead(tgUser.id);
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
}));

export default router;
