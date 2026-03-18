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
 * @desc    Start a donation - returns Paystack payment URL or charges saved card
 * @access  Private
 */
export const initializeDonation = async (req: Request, res: Response): Promise<void> => {
  try {
    const donorId = (req as any).user?.userId;
    const { begId, amount, isAnonymous, paymentMethod, savedCardId } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

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

    if (!paymentMethod || !['card', 'transfer', 'ussd'].includes(paymentMethod)) {
      sendResponse(res, 400, {
        success: false,
        message: 'paymentMethod must be card, transfer or ussd',
      });
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
        donorId,
        begId,
        amount,
        reason: trustCheck.reason,
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

    // Check remaining amount
    const remaining =
      parseFloat(beg.amountRequested.toString()) -
      parseFloat(beg.amountRaised.toString());

    if (remaining <= 0) {
      sendResponse(res, 400, { success: false, message: 'This beg is already fully funded' });
      return;
    }

    // Adjust amount if exceeds remaining
    const actualAmount = Math.min(amount, remaining);

    // ============================================
    // GET DONOR EMAIL
    // ============================================
    let donorEmail = 'guest@pliz.app';
    if (donorId) {
      const donor = await prisma.user.findUnique({
        where: { id: donorId },
        select: { email: true },
      });
      if (donor) donorEmail = donor.email;
    }

    // Generate unique reference
    const reference = `DON-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)
      .toUpperCase()}`;

    // ============================================
    // SAVED CARD PAYMENT (INSTANT)
    // ============================================
    if (savedCardId && donorId) {
      logger.info('Processing saved card payment', {
        donorId,
        begId,
        savedCardId,
        amount: actualAmount,
      });

      // Charge saved card directly
      const chargeResult = await PaymentMethodService.chargeSavedCard({
        userId: donorId,
        cardId: savedCardId,
        amount: actualAmount,
        email: donorEmail,
        reference,
        metadata: {
          beg_id: begId,
          donor_id: donorId,
          is_anonymous: isAnonymous || false,
        },
      });

      if (!chargeResult.success) {
        logger.error('Saved card charge failed', {
          error: chargeResult.error,
          donorId,
          savedCardId,
        });

        sendResponse(res, 500, {
          success: false,
          message: chargeResult.error || 'Failed to charge saved card',
        });
        return;
      }

      // Create donation record (pending - will be updated by webhook)
      const donation = await prisma.donation.create({
        data: {
          begId,
          donorId,
          amount: actualAmount,
          isAnonymous: isAnonymous || false,
          paymentMethod: 'saved_card',
          paymentReference: reference,
          status: 'pending', // Webhook will update to 'success'
          ipAddress: ip,
        },
      });

      logger.info('Saved card donation initialized', {
        donationId: donation.id,
        amount: actualAmount,
        reference,
        donorId,
      });

      sendResponse(res, 201, {
        success: true,
        message: 'Payment processing with saved card',
        data: {
          donation_id: donation.id,
          amount: actualAmount,
          payment_reference: reference,
          payment_method: 'saved_card',
          status: chargeResult.status,
        },
      });
      return;
    }

    // ============================================
    // REGULAR PAYSTACK CHECKOUT FLOW
    // ============================================
    const payment = await PaymentService.initializePayment({
      email: donorEmail,
      amount: actualAmount,
      reference,
      begId,
      donorId,
      isAnonymous: isAnonymous || false,
    });

    if (!payment.success) {
      logger.error('Payment initialization failed', {
        error: payment.error,
        reference,
      });

      sendResponse(res, 500, { success: false, message: payment.error! });
      return;
    }

    // Create PENDING donation record
    const donation = await prisma.donation.create({
      data: {
        begId,
        donorId: donorId || null,
        amount: actualAmount,
        isAnonymous: isAnonymous || false,
        paymentMethod,
        paymentReference: reference,
        status: 'pending',
        ipAddress: ip,
      },
    });

    logger.info('Donation initialized', {
      donationId: donation.id,
      amount: actualAmount,
      reference,
      donorId: donorId || 'guest',
      ipAddress: ip,
    });

    sendResponse(res, 201, {
      success: true,
      message: 'Please complete payment',
      data: {
        donation_id: donation.id,
        amount: actualAmount,
        payment_reference: reference,
        payment_url: payment.authorizationUrl,
        quick_amounts: QUICK_DONATION_AMOUNTS,
      },
    });
  } catch (error: any) {
    logger.error('Initialize donation error', { 
      error: error.message, 
      stack: error.stack 
    });
    
    sendResponse(res, 500, {
      success: false,
      message: 'An error occurred while processing your donation',
    });
  }
};