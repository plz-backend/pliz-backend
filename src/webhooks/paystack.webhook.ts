import { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { DonationService } from '../modules/Donor/services/donation.service';
import logger from '../config/logger';

function verifySignature(rawBody: Buffer, signature: string): boolean {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody) // Use Buffer directly
    .digest('hex');
  return hash === signature;
}

async function handleWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    const rawBody = req.body as Buffer; // req.body is a Buffer from express.raw()

    if (!verifySignature(rawBody, signature)) {
      logger.warn('Invalid Paystack webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // ✅ Parse JSON after signature verification
    const payload = JSON.parse(rawBody.toString());
    const { event, data } = payload;

    logger.info('Paystack webhook received', { event, reference: data?.reference });

    if (event === 'charge.success') {
      const reference = data?.reference;

      if (reference) {
        // processDonation runs all 16 steps:
        // DB updates + cache invalidation + trust recalc + notifications
        await DonationService.processDonation({
          begId: data.metadata.beg_id,
          donorId: data.metadata.donor_id,
          amount: data.amount / 100,            // kobo to Naira
          isAnonymous: data.metadata.is_anonymous || false,
          paymentReference: reference,
          paymentMethod: data.channel,
        });

        logger.info('Webhook: donation processed successfully', { reference });
      }
    }

    // Always return 200 so Paystack stops retrying
    return res.status(200).json({ status: 'success' });

  } catch (error: any) {
    logger.error('Paystack webhook error', { error: error.message, stack: error.stack });
    return res.status(200).json({ status: 'error' }); // Still 200 to stop retries
  }
}

const router = Router();
router.post('/', handleWebhook); // Route is /

export default router;