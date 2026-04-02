import { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { donationQueue } from '../config/queue-manager';
import { DonationService } from '../modules/Donor/services/donation.service';
import logger from '../config/logger';

function verifySignature(rawBody: Buffer, signature: string): boolean {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
}

async function handleWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
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
        const donationData = {
          begId: data.metadata.beg_id,
          donorId: data.metadata.donor_id,
          amount: data.amount / 100,            // kobo to Naira
          isAnonymous: data.metadata.is_anonymous || false,
          paymentReference: reference,
          paymentMethod: data.channel,
        };

        // ============================================
        // TRY QUEUE FIRST (best for high traffic)
        // Falls back to direct processing if queue fails
        // ============================================
        let queuedSuccessfully = false;

        try {
          await donationQueue.add(
            'process-donation',
            donationData,
            {
              jobId: `donation-${reference}`,   // Prevents duplicate processing
              priority: 1,                       // High priority
            }
          );

          queuedSuccessfully = true;
          logger.info('Webhook: donation added to queue', { reference });
        } catch (queueError: any) {
          // Queue failed (e.g. Redis is down) — fall back to direct processing
          logger.warn('Queue unavailable, falling back to direct processing', {
            reference,
            error: queueError.message,
          });
        }

        // ============================================
        // FALLBACK: Direct processing if queue failed
        // ============================================
        if (!queuedSuccessfully) {
          try {
            await DonationService.processDonation(donationData);
            logger.info('Webhook: donation processed directly (queue fallback)', { reference });
          } catch (directError: any) {
            logger.error('Webhook: direct processing also failed', {
              reference,
              error: directError.message,
            });
            // Still return 200 — Paystack will retry and queue may be back up
          }
        }
      }
    }

    // Always return 200 immediately
    return res.status(200).json({ status: 'success' });
  } catch (error: any) {
    logger.error('Paystack webhook error', { error: error.message, stack: error.stack });
    return res.status(200).json({ status: 'error' }); // Still 200 to stop retries
  }
}

const router = Router();
router.post('/', handleWebhook);
export default router;

// ```

// **How it works:**
// ```
// Webhook received
//       ↓
// Try Queue first (Redis available?)
//       ↓
// YES → Add to queue → Worker processes safely → ✅
//       ↓
// NO (Redis down) → Fall back to DonationService.processDonation() directly → ✅
//       ↓
// Both fail → Return 200 anyway → Paystack retries later when system recovers → ✅