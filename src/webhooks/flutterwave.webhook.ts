import { Request, Response, Router } from 'express';
import prisma from '../config/database';
import { DonationService } from '../modules/Donor/services/donation.service';
import { PaymentService } from '../modules/Donor/services/payment.service';
import logger from '../config/logger';

function parseMeta(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

async function handleFlutterwaveWebhook(req: Request, res: Response) {
  try {
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

    if (event === 'charge.completed') {
      if (!data) {
        return res.status(200).json({ status: 'ignored' });
      }

      const { tx_ref, id: transactionId, status, currency } = data;

      if (!tx_ref || !transactionId) {
        logger.warn('Webhook ignored — missing transaction reference or id');
        return res.status(200).json({ status: 'ignored' });
      }

      if (status !== 'successful' || currency !== 'NGN') {
        logger.info('Webhook ignored — not successful or not NGN', {
          status,
          currency,
          txRef: tx_ref,
        });
        return res.status(200).json({ status: 'ignored' });
      }

      const verification = await PaymentService.verifyTransaction(
        transactionId.toString()
      );

      if (!verification.verified || !verification.data) {
        logger.warn('Webhook: verification failed', {
          txRef: tx_ref,
          transactionId,
        });
        return res.status(200).json({ status: 'ignored' });
      }

      const verifiedMeta = parseMeta(verification.data.meta);
      const webhookMeta = parseMeta(data.meta);
      const metadata = { ...webhookMeta, ...verifiedMeta };

      let begId = metadata.beg_id as string | undefined;
      let donorId = (metadata.donor_id as string | undefined) ?? '';
      let isAnonymous = Boolean(metadata.is_anonymous);
      let matchedLocalDonation = false;

      if (!begId && tx_ref) {
        const pending = await prisma.donation.findFirst({
          where: { paymentReference: tx_ref },
          select: { begId: true, donorId: true, isAnonymous: true, amount: true, status: true },
        });
        if (pending) {
          const expectedAmount = Number(pending.amount);
          const verifiedAmount = Number(verification.data.amount);
          if (
            pending.status !== 'pending' ||
            !Number.isFinite(expectedAmount) ||
            !Number.isFinite(verifiedAmount) ||
            expectedAmount !== verifiedAmount
          ) {
            logger.warn('Webhook ignored — local donation mismatch', {
              txRef: tx_ref,
              localStatus: pending.status,
              expectedAmount,
              verifiedAmount,
            });
            return res.status(200).json({ status: 'ignored' });
          }
          begId = pending.begId;
          donorId = pending.donorId ?? '';
          isAnonymous = pending.isAnonymous;
          matchedLocalDonation = true;
        }
      }

      if (!begId || !matchedLocalDonation) {
        logger.error('Webhook: missing matching local pending donation', { txRef: tx_ref });
        return res.status(200).json({ status: 'ignored' });
      }

      try {
        await DonationService.processDonation({
          begId,
          donorId,
          amount: verification.data.amount,
          isAnonymous,
          paymentReference: tx_ref,
          paymentMethod: verification.data.paymentMethod || 'card',
        });
        logger.info('Webhook: donation processed', { txRef: tx_ref });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Processing failed';
        logger.error('Webhook: donation processing failed', {
          txRef: tx_ref,
          error: message,
        });
        return res.status(500).json({ status: 'error' });
      }
    }

    if (event === 'transfer.completed' || event === 'transfer.failed') {
      const reference = data?.reference as string | undefined;
      const transferStatus = String(data?.status ?? '').toUpperCase();

      if (!reference) {
        return res.status(200).json({ status: 'ignored' });
      }

      const withdrawal = await prisma.withdrawal.findFirst({
        where: { transferReference: reference },
      });

      if (!withdrawal) {
        logger.warn('Webhook: withdrawal not found for transfer', { reference });
        return res.status(200).json({ status: 'ignored' });
      }

      if (transferStatus === 'FAILED' || event === 'transfer.failed') {
        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'failed',
            failureReason: data?.complete_message || data?.reason || 'Transfer failed',
          },
        });
        logger.warn('Webhook: withdrawal transfer failed', { reference, withdrawalId: withdrawal.id });
      } else if (transferStatus === 'SUCCESSFUL' && withdrawal.status !== 'completed') {
        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'completed',
            processedAt: new Date(),
          },
        });
        logger.info('Webhook: withdrawal marked completed', { reference, withdrawalId: withdrawal.id });
      }
    }

    return res.status(200).json({ status: 'success' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook error';
    logger.error('Flutterwave webhook error', { error: message });
    return res.status(500).json({ status: 'error' });
  }
}

const router = Router();
router.post('/', handleFlutterwaveWebhook);
export default router;
