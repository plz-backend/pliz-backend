import { Request, Response } from 'express';
import logger from '../../../config/logger';
import { DonationService } from '../services/donation.service';
import { PaymentService } from '../services/payment.service';

function pickReference(req: Request): string {
  const r = req.query.reference;
  const t = req.query.trxref;
  const ref = typeof r === 'string' ? r : Array.isArray(r) ? r[0] : '';
  const trx = typeof t === 'string' ? t : Array.isArray(t) ? t[0] : '';
  return (ref || trx || '').toString().trim();
}

export const verifyDonationCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const reference = pickReference(req);
    if (!reference) {
      res.status(400).json({
        success: false,
        message: 'Missing payment reference. Expected query params: reference or trxref.',
      });
      return;
    }

    const verified = await PaymentService.verifyPayment(reference);

    if (verified.status !== 'success') {
      res.status(200).json({
        success: false,
        message: 'Payment was not completed successfully.',
        data: { status: verified.status, reference },
      });
      return;
    }

    if (!verified.begId) {
      res.status(422).json({
        success: false,
        message: 'Transaction is missing beg metadata. Cannot record donation.',
        data: { reference },
      });
      return;
    }

    await DonationService.processDonation({
      begId: verified.begId,
      donorId: verified.donorId ?? null,
      amount: verified.amount,
      isAnonymous: Boolean(verified.isAnonymous),
      paymentReference: reference,
      paymentMethod: verified.paymentMethod || 'card',
    });

    res.status(200).json({
      success: true,
      message: 'Donation confirmed.',
      data: { begId: verified.begId, amount: verified.amount, reference },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Verification failed.';
    logger.error('Verify donation failed', { error: msg });
    res.status(500).json({ success: false, message: msg });
  }
};