import { Request, Response } from 'express';
import prisma from '../../../config/database';
import { PaymentService } from '../services/payment.service';
import { DonationService } from '../services/donation.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/donations/verify
 * @desc    Verify payment after user returns from Flutterwave
 * @access  Private
 * @body    { transaction_id, tx_ref, status }
 */
export const verifyDonation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { transaction_id, tx_ref, status } = req.body;

    if (!transaction_id && !tx_ref) {
      sendResponse(res, 400, {
        success: false,
        message: 'transaction_id or tx_ref is required',
      });
      return;
    }

    if (status === 'cancelled') {
      sendResponse(res, 400, {
        success: false,
        message: 'Payment was cancelled',
      });
      return;
    }

    // ── VERIFY WITH FLUTTERWAVE ────────────────
    let verificationResult;

    if (transaction_id) {
      verificationResult = await PaymentService.verifyTransaction(
        transaction_id.toString()
      );
    } else {
      const txResult = await PaymentService.getTransactionByRef(tx_ref);
      if (!txResult.success || !txResult.data?.id) {
        sendResponse(res, 400, {
          success: false,
          message: 'Transaction not found',
        });
        return;
      }
      verificationResult = await PaymentService.verifyTransaction(
        txResult.data.id.toString()
      );
    }

    if (!verificationResult.success || !verificationResult.verified) {
      sendResponse(res, 400, {
        success: false,
        message: verificationResult.error || 'Payment verification failed',
      });
      return;
    }

    const txData = verificationResult.data!;

    // ── GET PENDING DONATION ───────────────────
    const donation = await prisma.donation.findFirst({
      where: { paymentReference: txData.txRef },
      select: {
        id: true,
        begId: true,
        donorId: true,
        amount: true,
        isAnonymous: true,
        paymentMethod: true,
        status: true,
      },
    });

    if (!donation) {
      sendResponse(res, 404, {
        success: false,
        message: 'Donation record not found',
      });
      return;
    }

    // Already processed
    if (donation.status === 'success') {
      const existing = await DonationService.getDonationWithDetails(
        donation.id
      );
      sendResponse(res, 200, {
        success: true,
        message: 'Payment already processed',
        data: existing,
      });
      return;
    }

    // ── VERIFY AMOUNT ──────────────────────────
    const paidAmount = txData.amount;
    const expectedAmount = parseFloat(donation.amount.toString());

    if (paidAmount < expectedAmount) {
      sendResponse(res, 400, {
        success: false,
        message: `Payment amount mismatch. Expected ₦${expectedAmount} but received ₦${paidAmount}`,
      });
      return;
    }

    // ── PROCESS DONATION ──────────────────────
    const result = await DonationService.processDonation({
      begId: donation.begId,
      donorId: donation.donorId!,
      amount: paidAmount,
      isAnonymous: donation.isAnonymous,
      paymentReference: txData.txRef,
      paymentMethod: txData.paymentMethod || 'card',
    });

    logger.info('Donation verified and processed', {
      donationId: donation.id,
      txRef: txData.txRef,
      amount: paidAmount,
    });

    sendResponse(res, 200, {
      success: true,
      message: '🎉 Payment successful! Thank you for your donation.',
      data: result,
    });
  } catch (error: any) {
    logger.error('Verify donation error', {
      error: error.message,
      stack: error.stack,
    });
    sendResponse(res, 500, {
      success: false,
      message: 'An error occurred while verifying your payment',
    });
  }
};