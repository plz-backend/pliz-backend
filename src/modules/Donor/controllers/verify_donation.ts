import { Request, Response } from 'express';
import prisma from '../../../config/database';
import { PaymentService } from '../services/payment.service';
import { DonationService } from '../services/donation.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = unknown>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

type VerifyInput = {
  transactionId?: string;
  txRef?: string;
  status?: string;
};

function parseVerifyInput(req: Request): VerifyInput {
  const body = req.body as Record<string, unknown> | undefined;
  const query = req.query as Record<string, string | undefined>;

  const transactionId =
    (body?.transaction_id as string | undefined) ??
    (body?.transactionId as string | undefined) ??
    query.transaction_id ??
    query.transactionId;

  const txRef =
    (body?.tx_ref as string | undefined) ??
    (body?.txRef as string | undefined) ??
    query.tx_ref ??
    query.txRef ??
    query.reference ??
    query.trxref;

  const status =
    (body?.status as string | undefined) ?? query.status;

  return {
    transactionId: transactionId?.trim() || undefined,
    txRef: txRef?.trim() || undefined,
    status: status?.trim() || undefined,
  };
}

function normalizeVerifyData(result: Record<string, unknown>, txRef: string) {
  const beg = result.beg as { id?: string } | undefined;
  return {
    ...result,
    begId: beg?.id,
    reference: txRef,
    amount: result.amount,
    status: result.status ?? 'success',
  };
}

async function executeDonationVerification(
  input: VerifyInput
): Promise<{ statusCode: number; body: IApiResponse }> {
  const { transactionId, txRef, status } = input;

  if (!transactionId && !txRef) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: 'transaction_id or tx_ref (reference) is required',
      },
    };
  }

  if (status === 'cancelled' || status === 'canceled') {
    return {
      statusCode: 400,
      body: { success: false, message: 'Payment was cancelled' },
    };
  }

  const referenceHint = txRef ?? transactionId ?? '';

  if (referenceHint) {
    const alreadyDone = await prisma.donation.findFirst({
      where: {
        paymentReference: referenceHint,
        status: 'success',
      },
      select: { id: true },
    });
    if (alreadyDone) {
      const existing = await DonationService.getDonationWithDetails(alreadyDone.id);
      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Payment already processed',
          data: normalizeVerifyData(existing as Record<string, unknown>, referenceHint),
        },
      };
    }
  }

  const verificationResult = await PaymentService.verifyPayment({
    transactionId,
    txRef,
  });

  if (!verificationResult.success) {
    const err = (verificationResult.error ?? '').toLowerCase();
    const stillIndexing =
      err.includes('not found') || err.includes('no transaction was found');
    if (stillIndexing) {
      return {
        statusCode: 200,
        body: {
          success: false,
          message: 'Payment is still processing. Please wait a moment.',
        },
      };
    }
    return {
      statusCode: 400,
      body: {
        success: false,
        message: verificationResult.error || 'Payment verification failed',
      },
    };
  }

  if (verificationResult.pending) {
    return {
      statusCode: 200,
      body: {
        success: false,
        message: 'Payment is still processing. Please wait a moment.',
      },
    };
  }

  if (!verificationResult.verified || !verificationResult.data) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: verificationResult.error || 'Payment verification failed',
      },
    };
  }

  const txData = verificationResult.data;

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
    return {
      statusCode: 404,
      body: { success: false, message: 'Donation record not found' },
    };
  }

  if (donation.status === 'success') {
    const existing = await DonationService.getDonationWithDetails(donation.id);
    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Payment already processed',
        data: normalizeVerifyData(existing as Record<string, unknown>, txData.txRef),
      },
    };
  }

  const paidAmount = txData.amount;
  const expectedAmount = parseFloat(donation.amount.toString());

  if (paidAmount < expectedAmount) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: `Payment amount mismatch. Expected ₦${expectedAmount} but received ₦${paidAmount}`,
      },
    };
  }

  const result = await DonationService.processDonation({
    begId: donation.begId,
    donorId: donation.donorId ?? '',
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

  return {
    statusCode: 200,
    body: {
      success: true,
      message: '🎉 Payment successful! Thank you for your donation.',
      data: normalizeVerifyData(result as Record<string, unknown>, txData.txRef),
    },
  };
}

/**
 * GET /api/donations/verify?reference=... | tx_ref=... | transaction_id=...
 * Public — used by mobile app polling after hosted checkout.
 */
export const verifyDonationGet = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await executeDonationVerification(parseVerifyInput(req));
    sendResponse(res, result.statusCode, result.body);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verify failed';
    logger.error('Verify donation (GET) error', { error: message });
    sendResponse(res, 500, {
      success: false,
      message: 'An error occurred while verifying your payment',
    });
  }
};

/**
 * POST /api/donations/verify
 * Authenticated — Flutterwave redirect / client callback with body payload.
 */
export const verifyDonation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await executeDonationVerification(parseVerifyInput(req));
    sendResponse(res, result.statusCode, result.body);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verify failed';
    logger.error('Verify donation (POST) error', { error: message });
    sendResponse(res, 500, {
      success: false,
      message: 'An error occurred while verifying your payment',
    });
  }
};
