import cron from 'node-cron';
import { BegService } from '../../Beg/services/beg.service';
import { BegNotificationService } from '../beg_extend_notification/beg-notification.service';
import logger from '../../../config/logger';

let taskStarted = false;

export const startBegMaintenanceCron = (): void => {
  if (taskStarted) return;

  cron.schedule('0 * * * *', async () => {
    logger.info('Running hourly beg maintenance cron');

    await BegService.expireOldBegs();
    await BegNotificationService.notifyExpiringBegs();
  });

  taskStarted = true;
  logger.info('Beg maintenance cron scheduled');
};
