import { Request, Response } from 'express';
import { BegService } from '../services/beg.service';
import { DonationService } from '../../Donor/services/donation.service';
import { IUpdateBegRequest } from '../types/beg.interface';
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
 * @route   PUT /api/begs/:id
 * @desc    Update a beg request (with donation protection)
 * @access  Private (Owner only)
 */
export const updateBeg = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const begId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    if (!userId) {
      sendResponse(res, 401, { success: false, message: 'User not authenticated' });
      return;
    }

    if (!begId) {
      sendResponse(res, 400, { success: false, message: 'Beg ID is required' });
      return;
    }

    logger.info('Beg update attempt', { begId, userId });

    // ============================================
    // CHECK IF BEG EXISTS
    // ============================================
    const existingBeg = await BegService.getBegById(begId);
    if (!existingBeg) {
      logger.warn('Beg update failed: Beg not found', { begId, userId });
      sendResponse(res, 404, { success: false, message: 'Beg request not found' });
      return;
    }

    // ============================================
    // CHECK OWNERSHIP
    // ============================================
    if (existingBeg.userId !== userId) {
      logger.warn('Unauthorized beg update attempt', { begId, userId, ownerId: existingBeg.userId });
      sendResponse(res, 403, { success: false, message: 'You are not authorized to update this beg request' });
      return;
    }

    // ============================================
    // CHECK IF BEG STATUS ALLOWS UPDATES
    // ============================================
    const finalizedStatuses = ['rejected', 'cancelled', 'expired', 'funded', 'flagged'];
    if (finalizedStatuses.includes(existingBeg.status)) {
      logger.warn('Attempt to update finalized beg', { begId, userId, status: existingBeg.status });
      sendResponse(res, 400, {
        success: false,
        message: `Cannot update ${existingBeg.status} beg request`,
        errors: [{ field: 'status', message: `This beg request has been ${existingBeg.status} and is locked` }],
      });
      return;
    }

    const isNotApproved = !existingBeg.approved;

    // ============================================
    // CHECK DONATIONS
    // ============================================
    let hasDonations = false;
    let donationCount = 0;
    let totalDonated = 0;

    if (existingBeg.approved && existingBeg.status === 'active') {
      const donations = await DonationService.getDonationsByBegId(begId);
      hasDonations = donations && donations.length > 0;
      donationCount = donations?.length || 0;
      totalDonated = donations?.reduce((sum, d) => sum + d.amount, 0) || 0;
      logger.info('Checking donations for beg update', { begId, hasDonations, donationCount, totalDonated });
    }

    // ============================================
    // DESTRUCTURE BODY — title removed
    // ============================================
    const { description, amountRequested, mediaType, mediaUrl } = req.body as IUpdateBegRequest;

    // Check if at least one field is being updated
    if (
      description === undefined &&
      amountRequested === undefined &&
      mediaType === undefined &&
      mediaUrl === undefined
    ) {
      sendResponse(res, 400, { success: false, message: 'At least one field must be provided for update' });
      return;
    }

    // ============================================
    // HELPER: Validate description
    // ============================================
    const validateDescription = (): boolean => {
      if (description === undefined) return true;
      if (description && description.length > 300) {
        sendResponse(res, 400, {
          success: false,
          message: 'Description must not exceed 300 characters',
          errors: [{ field: 'description', message: 'Description is too long (max 300 characters)' }],
        });
        return false;
      }
      const wordCount = description?.trim().split(/\s+/).filter(w => w.length > 0).length || 0;
      if (wordCount > 40) {
        sendResponse(res, 400, {
          success: false,
          message: 'Description must not exceed 40 words',
          errors: [{ field: 'description', message: 'Description is too long (max 40 words)' }],
        });
        return false;
      }
      return true;
    };

    // ============================================
    // RULE: APPROVED BEGS WITH DONATIONS — media only
    // ============================================
    if (existingBeg.approved && existingBeg.status === 'active' && hasDonations) {
      const restrictedFields = [];
      if (description !== undefined) restrictedFields.push('description');
      if (amountRequested !== undefined) restrictedFields.push('amount');

      if (restrictedFields.length > 0) {
        logger.warn('Attempt to update restricted fields on beg with donations', { begId, userId, restrictedFields, donationCount, totalDonated });
        sendResponse(res, 403, {
          success: false,
          message: 'This beg has received donations and cannot be modified',
          errors: [{
            field: 'donations',
            message: `Cannot update ${restrictedFields.join(', ')} after receiving donations. ${donationCount} donor${donationCount > 1 ? 's have' : ' has'} contributed ₦${totalDonated.toLocaleString()}. Only media can be updated.`,
          }],
        });
        return;
      }

      const updateData: any = {};
      if (mediaType !== undefined) updateData.mediaType = mediaType;
      if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;

      if (Object.keys(updateData).length === 0) {
        sendResponse(res, 400, { success: false, message: 'No valid fields to update' });
        return;
      }

      const updatedBeg = await BegService.updateBeg(begId, updateData);
      logger.info('Beg media updated (has donations)', { begId, userId, updatedFields: Object.keys(updateData), donationCount });
      sendResponse(res, 200, { success: true, message: 'Beg request media updated successfully', data: { beg: updatedBeg } });
      return;
    }

    // ============================================
    // RULE: APPROVED BEGS WITHOUT DONATIONS — description + media only
    // ============================================
    if (existingBeg.approved && existingBeg.status === 'active' && !hasDonations) {
      if (amountRequested !== undefined) {
        logger.warn('Attempt to update amount on approved beg', { begId, userId });
        sendResponse(res, 403, {
          success: false,
          message: 'Cannot update core details of approved beg request',
          errors: [{ field: 'approval', message: 'Cannot update amount after admin approval. Contact support if you need to make major changes.' }],
        });
        return;
      }

      if (!validateDescription()) return;

      const updateData: any = {};
      if (description !== undefined) updateData.description = description;
      if (mediaType !== undefined) updateData.mediaType = mediaType;
      if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;

      const updatedBeg = await BegService.updateBeg(begId, updateData);
      logger.info('Approved beg updated (no donations)', { begId, userId, updatedFields: Object.keys(updateData) });
      sendResponse(res, 200, { success: true, message: 'Beg request updated successfully', data: { beg: updatedBeg } });
      return;
    }

    // ============================================
    // RULE: NOT APPROVED BEGS — full updates allowed
    // ============================================
    if (isNotApproved) {
      if (!validateDescription()) return;

      if (amountRequested !== undefined && amountRequested < 100) {
        sendResponse(res, 400, {
          success: false,
          message: 'Amount must be at least ₦100',
          errors: [{ field: 'amountRequested', message: 'Minimum amount is ₦100' }],
        });
        return;
      }

      if (mediaType !== undefined && !['video', 'audio', 'text'].includes(mediaType)) {
        sendResponse(res, 400, {
          success: false,
          message: 'Invalid media type',
          errors: [{ field: 'mediaType', message: 'Media type must be: video, audio, or text' }],
        });
        return;
      }

      const updateData: any = {};
      if (description !== undefined) updateData.description = description;
      if (amountRequested !== undefined) updateData.amountRequested = amountRequested;
      if (mediaType !== undefined) updateData.mediaType = mediaType;
      if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;

      const updatedBeg = await BegService.updateBeg(begId, updateData);
      logger.info('Not approved beg updated', { begId, userId, updatedFields: Object.keys(updateData) });
      sendResponse(res, 200, { success: true, message: 'Beg request updated successfully', data: { beg: updatedBeg } });
      return;
    }

    // Unexpected state
    logger.error('Unexpected state in update beg', { begId, status: existingBeg.status, approved: existingBeg.approved, hasDonations });
    sendResponse(res, 500, { success: false, message: 'Unable to process update request' });

  } catch (error: any) {
    logger.error('Update beg error', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      begId: req.params.id,
    });
    sendResponse(res, 500, { success: false, message: 'Failed to update beg request. Please try again.' });
  }
};