import { Request, Response } from 'express';
import prisma from '../../../config/database';
import { PaymentService } from '../services/payment.service';
import { PaymentMethodService } from '../../Payment/services/payment_method.service';
import { trustEngine } from '../../../services/trust-engine';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

const QUICK_DONATION_AMOUNTS = [1000, 2000, 3000, 5000];

/**
 * @route   POST /api/donations/initialize
 * @desc    Start a donation — returns Flutterwave payment URL
 * @access  Private
 */
export const initializeDonation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const donorId = (req as any).user?.userId;
    const { begId, amount, isAnonymous, savedCardId, redirectUrl, callbackUrl } = req.body;
    const checkoutRedirectUrl = (redirectUrl || callbackUrl)?.trim();
    const ip =
      req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';

    // ============================================
    // BASIC VALIDATION
    // ============================================
    if (!begId) {
      sendResponse(res, 400, { success: false, message: 'begId is required' });
      return;
    }
    if (!amount || typeof amount !== 'number') {
      sendResponse(res, 400, { success: false, message: 'amount must be a number' });
      return;
    }
    if (amount < 100) {
      sendResponse(res, 400, { success: false, message: 'Minimum donation is ₦100' });
      return;
    }
    if (amount > 100000) {
      sendResponse(res, 400, { success: false, message: 'Maximum donation is ₦100,000' });
      return;
    }

    // ============================================
    // TRUST ENGINE CHECK
    // ============================================
    const trustCheck = await trustEngine.canDonate({
      userId: donorId,
      amount,
      requestId: begId,
      ip,
    });

    if (!trustCheck.allowed) {
      logger.warn('Donation blocked by trust engine', {
        donorId, begId, amount, reason: trustCheck.reason,
      });
      sendResponse(res, 403, {
        success: false,
        message: trustCheck.reason || 'Donation not allowed',
      });
      return;
    }

    // ============================================
    // BEG VALIDATION
    // ============================================
    const beg = await prisma.beg.findUnique({
      where: { id: begId },
      select: {
        id: true,
        userId: true,
        status: true,
        approved: true,
        expiresAt: true,
        amountRequested: true,
        amountRaised: true,
      },
    });

    if (!beg) {
      sendResponse(res, 404, { success: false, message: 'Beg not found' });
      return;
    }
    if (beg.status !== 'active' || !beg.approved) {
      sendResponse(res, 400, { success: false, message: 'This beg is no longer active' });
      return;
    }
    if (new Date() > beg.expiresAt) {
      sendResponse(res, 400, { success: false, message: 'This beg has expired' });
      return;
    }

    const remaining =
      parseFloat(beg.amountRequested.toString()) -
      parseFloat(beg.amountRaised.toString());

    if (remaining <= 0) {
      sendResponse(res, 400, { success: false, message: 'This beg is already fully funded' });
      return;
    }

    const actualAmount = Math.min(amount, remaining);

    // ============================================
    // PREVIOUS DONATION WARNING
    // ============================================
    let previousDonationWarning: string | null = null;
    if (donorId) {
      const previousDonation = await prisma.donation.findFirst({
        where: { begId, donorId, status: 'success' },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      if (previousDonation) {
        previousDonationWarning = `You have donated ₦${parseFloat(
          previousDonation.amount.toString()
        ).toLocaleString()} to this beg before on ${previousDonation.createdAt.toLocaleDateString()}. Thank you for your continued generosity!`;
      }
    }

    // ============================================
    // GET DONOR EMAIL
    // ============================================
    let donorEmail = 'guest@plz.app';
    let profileAnonymousMode = false;

    if (donorId) {
      const donor = await prisma.user.findUnique({
        where: { id: donorId },
        select: {
          email: true,
          profile: { select: { isAnonymous: true } },
        },
      });
      if (donor) {
        donorEmail = donor.email;
        profileAnonymousMode = donor.profile?.isAnonymous ?? false;
      }
    }

    const effectiveIsAnonymous = Boolean(profileAnonymousMode || isAnonymous);

    const txRef = `PLZ-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)
      .toUpperCase()}`;

    // ============================================
    // SAVED CARD PAYMENT
    // ============================================
    if (savedCardId && donorId) {
      const chargeResult = await PaymentMethodService.chargeSavedCard({
        userId: donorId,
        cardId: savedCardId,
        amount: actualAmount,
        email: donorEmail,
        reference: txRef,
        metadata: {
          beg_id: begId,
          donor_id: donorId,
          is_anonymous: effectiveIsAnonymous,
        },
      });

      if (!chargeResult.success) {
        sendResponse(res, 500, {
          success: false,
          message: chargeResult.error || 'Failed to charge saved card',
        });
        return;
      }

      const donation = await prisma.donation.create({
        data: {
          begId,
          donorId,
          amount: actualAmount,
          isAnonymous: effectiveIsAnonymous,
          paymentMethod: 'saved_card',
          paymentReference: txRef,
          status: 'pending',
          ipAddress: ip,
        },
      });

      sendResponse(res, 201, {
        success: true,
        message: 'Payment processing with saved card',
        data: {
          donation_id: donation.id,
          amount: actualAmount,
          tx_ref: txRef,
          payment_reference: txRef,
          payment_method: 'saved_card',
          status: chargeResult.status,
          previous_donation_warning: previousDonationWarning,
        },
      });
      return;
    }

    // ============================================
    // FLUTTERWAVE CHECKOUT
    // ============================================
    const payment = await PaymentService.initializePayment({
      email: donorEmail,
      amount: actualAmount,
      reference: txRef,
      begId,
      donorId,
      isAnonymous: effectiveIsAnonymous,
      redirectUrl: checkoutRedirectUrl,
    });

    if (!payment.success) {
      sendResponse(res, 500, { success: false, message: payment.error! });
      return;
    }

    const donation = await prisma.donation.create({
      data: {
        begId,
        donorId: donorId || null,
        amount: actualAmount,
        isAnonymous: effectiveIsAnonymous,
        paymentMethod: 'card',
        paymentReference: txRef,
        status: 'pending',
        ipAddress: ip,
      },
    });

    logger.info('Donation initialized via Flutterwave', {
      donationId: donation.id,
      amount: actualAmount,
      txRef,
      donorId: donorId || 'guest',
    });

    sendResponse(res, 201, {
      success: true,
      message: 'Please complete your payment',
      data: {
        donation_id: donation.id,
        amount: actualAmount,
        tx_ref: txRef,
        payment_reference: txRef,
        payment_url: payment.paymentUrl,
        quick_amounts: QUICK_DONATION_AMOUNTS,
        previous_donation_warning: previousDonationWarning,
      },
    });
  } catch (error: any) {
    logger.error('Initialize donation error', {
      error: error.message,
      stack: error.stack,
    });
    sendResponse(res, 500, {
      success: false,
      message: 'An error occurred while processing your donation',
    });
  }
};