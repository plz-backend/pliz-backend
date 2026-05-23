import { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { DonationService } from '../modules/Donor/services/donation.service';
import logger from '../config/logger';

function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;

  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const hashBuf = Buffer.from(hash);
  const sigBuf = Buffer.from(signature);

  if (hashBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, sigBuf);
}

async function handleWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers['x-paystack-signature'] as string | undefined;
    const rawBody = req.body as Buffer;

    if (!verifySignature(rawBody, signature)) {
      logger.warn('Invalid Paystack webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody.toString());
    const { event, data } = payload;

    logger.info('Paystack webhook received', { event, reference: data?.reference });

    if (event === 'charge.success') {
      const reference = data?.reference;

      if (reference) {
        const metadata = data.metadata ?? {};
        const donationData = {
          begId: metadata.beg_id,
          donorId: metadata.donor_id ?? '',
          amount: data.amount / 100,
          isAnonymous: Boolean(metadata.is_anonymous),
          paymentReference: reference,
          paymentMethod: data.channel || 'card',
        };

        if (!donationData.begId) {
          logger.error('Webhook: missing beg_id in metadata', { reference });
          return res.status(200).json({ status: 'ignored' });
        }

        try {
          await DonationService.processDonation(donationData);
          logger.info('Webhook: donation processed', { reference });
        } catch (directError: any) {
          logger.error('Webhook: donation processing failed', {
            reference,
            error: directError.message,
          });
          return res.status(500).json({ status: 'error' });
        }
      }
    }

    return res.status(200).json({ status: 'success' });
  } catch (error: any) {
    logger.error('Paystack webhook error', { error: error.message });
    return res.status(500).json({ status: 'error' });
  }
}

const router = Router();
router.post('/', handleWebhook);
export default router;
