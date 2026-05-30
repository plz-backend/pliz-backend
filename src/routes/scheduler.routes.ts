import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { BegService } from '../modules/Beg/services/beg.service';
import { BegNotificationService } from '../modules/Beg/beg_extend_notification/beg-notification.service';
import logger from '../config/logger';

const router = Router();

function verifySchedulerSecret(req: Request): boolean {
  const expected = process.env.SCHEDULER_SECRET?.trim();
  if (!expected) {
    logger.warn('Scheduler endpoint called but SCHEDULER_SECRET is not configured');
    return false;
  }

  const provided = req.header('x-scheduler-secret')?.trim();
  if (!provided) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

async function runBegMaintenance(_req: Request, res: Response): Promise<void> {
  if (!verifySchedulerSecret(_req)) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  try {
    logger.info('Cloud Scheduler: running beg maintenance');
    await BegService.expireOldBegs();
    await BegNotificationService.notifyExpiringBegs();
    res.json({ success: true, message: 'Beg maintenance completed' });
  } catch (error: any) {
    logger.error('Cloud Scheduler: beg maintenance failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Beg maintenance failed' });
  }
}

router.post('/beg-maintenance', runBegMaintenance);

export default router;
