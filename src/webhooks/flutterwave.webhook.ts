import { Request, Response, Router } from 'express';
import { DonationService } from '../modules/Donor/services/donation.service';
import { PaymentService } from '../modules/Donor/services/payment.service';
import logger from '../config/logger';

async function handleFlutterwaveWebhook(req: Request, res: Response) {
  try {
    // ── VERIFY WEBHOOK HASH ───────────────────
    const webhookHash = req.headers['verif-hash'] as string;

    if (!webhookHash || webhookHash !== process.env.FLW_WEBHOOK_HASH) {
      logger.warn('Invalid Flutterwave webhook hash');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = req.body;
    const { event, data } = payload;

    logger.info('Flutterwave webhook received', {
      event,
      txRef: data?.tx_ref,
      transactionId: data?.id,
    });

    // ── HANDLE CHARGE COMPLETED ───────────────
    if (event === 'charge.completed') {
      if (!data) {
        return res.status(200).json({ status: 'ignored' });
      }

      const { tx_ref, id: transactionId, status, currency } = data;

      // Only process successful NGN payments
      if (status !== 'successful' || currency !== 'NGN') {
        logger.info('Webhook ignored — not successful or not NGN', {
          status,
          currency,
          txRef: tx_ref,
        });
        return res.status(200).json({ status: 'ignored' });
      }

      const metadata = data.meta || {};
      const begId = metadata.beg_id;

      if (!begId) {
        logger.error('Webhook: missing beg_id', { txRef: tx_ref });
        return res.status(200).json({ status: 'ignored' });
      }

      // Verify with Flutterwave before processing
      const verification = await PaymentService.verifyTransaction(
        transactionId.toString()
      );

      if (!verification.verified) {
        logger.warn('Webhook: verification failed', {
          txRef: tx_ref,
          transactionId,
        });
        return res.status(200).json({ status: 'ignored' });
      }

      try {
        await DonationService.processDonation({
          begId,
          donorId: metadata.donor_id || '',
          amount: verification.data!.amount,
          isAnonymous: Boolean(metadata.is_anonymous),
          paymentReference: tx_ref,
          paymentMethod: verification.data!.paymentMethod || 'card',
        });
        logger.info('Webhook: donation processed', { txRef: tx_ref });
      } catch (error: any) {
        logger.error('Webhook: donation processing failed', {
          txRef: tx_ref,
          error: error.message,
        });
        return res.status(500).json({ status: 'error' });
      }
    }

    // ── HANDLE TRANSFER COMPLETED ─────────────
    if (event === 'transfer.completed') {
      logger.info('Flutterwave transfer completed', {
        reference: data?.reference,
        status: data?.status,
        amount: data?.amount,
      });
    }

    return res.status(200).json({ status: 'success' });
  } catch (error: any) {
    logger.error('Flutterwave webhook error', { error: error.message });
    return res.status(500).json({ status: 'error' });
  }
}

const router = Router();
router.post('/', handleFlutterwaveWebhook);
export default router;