import cron from 'node-cron';
import { BegService } from '../../Beg/services/beg.service';
import { BegNotificationService } from '../beg_extend_notification/beg-notification.service';
import logger from '../../../../src/config/logger';

// Run every hour
cron.schedule('0 * * * *', async () => {
  logger.info('Running hourly cron jobs');

  // Expire old begs
  await BegService.expireOldBegs();

  // Notify users with begs expiring within 1 hour
  await BegNotificationService.notifyExpiringBegs();
});