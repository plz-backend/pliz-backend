import { Request, Response } from 'express';
import { BegService } from '../services/beg.service';
import { DonationService } from '../../Donor/services/donation.service';
import { IUpdateBegRequest } from '../types/beg.interface';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

/**
 * Helper to send response
 */
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
 * @middleware authenticate - Requires valid JWT token
 * @middleware checkAccountStatus - Ensures user is not suspended/under investigation
 */
export const updateBeg = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const begId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];

    if (!userId) {
      const response: IApiResponse = {
        success: false,
        message: 'User not authenticated',
      };
      sendResponse(res, 401, response);
      return;
    }

    if (!begId) {
      const response: IApiResponse = {
        success: false,
        message: 'Beg ID is required',
      };
      sendResponse(res, 400, response);
      return;
    }

    logger.info('Beg update attempt', { begId, userId });

    // ============================================
    // CHECK IF BEG EXISTS
    // ============================================
    const existingBeg = await BegService.getBegById(begId);

    if (!existingBeg) {
      logger.warn('Beg update failed: Beg not found', { begId, userId });
      const response: IApiResponse = {
        success: false,
        message: 'Beg request not found',
      };
      sendResponse(res, 404, response);
      return;
    }

    // ============================================
    // CHECK OWNERSHIP
    // ============================================
    if (existingBeg.userId !== userId) {
      logger.warn('Unauthorized beg update attempt', {
        begId,
        userId,
        ownerId: existingBeg.userId,
      });
      const response: IApiResponse = {
        success: false,
        message: 'You are not authorized to update this beg request',
      };
      sendResponse(res, 403, response);
      return;
    }

    // ============================================
    // CHECK IF BEG STATUS ALLOWS UPDATES
    // ============================================

    // Rule 1: Cannot update REJECTED, CANCELLED, EXPIRED, FUNDED, or FLAGGED begs
    const finalizedStatuses = ['rejected', 'cancelled', 'expired', 'funded', 'flagged'];
    if (finalizedStatuses.includes(existingBeg.status)) {
      logger.warn('Attempt to update finalized beg', {
        begId,
        userId,
        status: existingBeg.status,
      });
      const response: IApiResponse = {
        success: false,
        message: `Cannot update ${existingBeg.status} beg request`,
        errors: [
          {
            field: 'status',
            message: `This beg request has been ${existingBeg.status} and is locked`,
          },
        ],
      };
      sendResponse(res, 400, response);
      return;
    }

    // Rule 2: NOT APPROVED begs (approved: false) can be updated freely
    const isNotApproved = !existingBeg.approved;

    // Rule 3: Check if APPROVED + ACTIVE beg has donations
    let hasDonations = false;
    let donationCount = 0;
    let totalDonated = 0;

    if (existingBeg.approved && existingBeg.status === 'active') {
      // Check if beg has received any donations
      const donations = await DonationService.getDonationsByBegId(begId);
      hasDonations = donations && donations.length > 0;
      donationCount = donations?.length || 0;
      totalDonated = donations?.reduce((sum, d) => sum + d.amount, 0) || 0;

      logger.info('Checking donations for beg update', {
        begId,
        hasDonations,
        donationCount,
        totalDonated,
      });
    }

    // ============================================
    // VALIDATE UPDATE DATA BASED ON STATUS
    // ============================================
    const {
      title,
      description,
      amountRequested,
      mediaType,
      mediaUrl,
    } = req.body as IUpdateBegRequest;

    // Check if at least one field is being updated
    if (
      title === undefined &&
      description === undefined &&
      amountRequested === undefined &&
      mediaType === undefined &&
      mediaUrl === undefined
    ) {
      const response: IApiResponse = {
        success: false,
        message: 'At least one field must be provided for update',
      };
      sendResponse(res, 400, response);
      return;
    }

    // ============================================
    // RULE: APPROVED BEGS WITH DONATIONS - VERY LIMITED UPDATES
    // ============================================
    if (existingBeg.approved && existingBeg.status === 'active' && hasDonations) {
      // Only allow media updates when donations exist (no core field changes)
      const restrictedFields = [];

      if (title !== undefined) restrictedFields.push('title');
      if (description !== undefined) restrictedFields.push('description');
      if (amountRequested !== undefined) restrictedFields.push('amount');

      if (restrictedFields.length > 0) {
        logger.warn('Attempt to update restricted fields on beg with donations', {
          begId,
          userId,
          restrictedFields,
          donationCount,
          totalDonated,
        });

        const response: IApiResponse = {
          success: false,
          message: 'This beg has received donations and cannot be modified',
          errors: [
            {
              field: 'donations',
              message: `Cannot update ${restrictedFields.join(', ')} after receiving donations. ${donationCount} donor${donationCount > 1 ? 's have' : ' has'} contributed ₦${totalDonated.toLocaleString()}. Only media can be updated.`,
            },
          ],
        };
        sendResponse(res, 403, response);
        return;
      }

      // Only media updates allowed
      const updateData: any = {};
      if (mediaType !== undefined) updateData.mediaType = mediaType;
      if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;

      if (Object.keys(updateData).length === 0) {
        const response: IApiResponse = {
          success: false,
          message: 'No valid fields to update',
        };
        sendResponse(res, 400, response);
        return;
      }

      const updatedBeg = await BegService.updateBeg(begId, updateData);

      logger.info('Beg media updated (has donations)', {
        begId,
        userId,
        updatedFields: Object.keys(updateData),
        donationCount,
      });

      const response: IApiResponse = {
        success: true,
        message: 'Beg request media updated successfully',
        data: { beg: updatedBeg },
      };
      sendResponse(res, 200, response);
      return;
    }

    // ============================================
    // RULE: APPROVED BEGS WITHOUT DONATIONS - LIMITED UPDATES
    // ============================================
    if (existingBeg.approved && existingBeg.status === 'active' && !hasDonations) {
      // Can update description and media
      // CANNOT update title or amount

      const restrictedFields = [];

      if (title !== undefined) restrictedFields.push('title');
      if (amountRequested !== undefined) restrictedFields.push('amount');

      if (restrictedFields.length > 0) {
        logger.warn('Attempt to update core fields on approved beg', {
          begId,
          userId,
          restrictedFields,
        });

        const response: IApiResponse = {
          success: false,
          message: 'Cannot update core details of approved beg request',
          errors: [
            {
              field: 'approval',
              message: `Cannot update ${restrictedFields.join(', ')} after admin approval. Contact support if you need to make major changes.`,
            },
          ],
        };
        sendResponse(res, 403, response);
        return;
      }

      // Allow description and media updates
      const updateData: any = {};

      if (description !== undefined) {
        // Validate description (max 500 chars / 30 words)
        if (description && description.length > 500) {
          const response: IApiResponse = {
            success: false,
            message: 'Description must not exceed 500 characters',
            errors: [
              {
                field: 'description',
                message: 'Description is too long (max 500 characters)',
              },
            ],
          };
          sendResponse(res, 400, response);
          return;
        }

        const wordCount = description?.trim().split(/\s+/).length || 0;
        if (wordCount > 30) {
          const response: IApiResponse = {
            success: false,
            message: 'Description must not exceed 30 words',
            errors: [
              {
                field: 'description',
                message: 'Description is too long (max 30 words)',
              },
            ],
          };
          sendResponse(res, 400, response);
          return;
        }

        updateData.description = description;
      }

      if (mediaType !== undefined) updateData.mediaType = mediaType;
      if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;

      const updatedBeg = await BegService.updateBeg(begId, updateData);

      logger.info('Approved beg updated (no donations)', {
        begId,
        userId,
        updatedFields: Object.keys(updateData),
      });

      const response: IApiResponse = {
        success: true,
        message: 'Beg request updated successfully',
        data: { beg: updatedBeg },
      };
      sendResponse(res, 200, response);
      return;
    }

    // ============================================
    // RULE: NOT APPROVED BEGS - FULL UPDATES ALLOWED
    // ============================================
    if (isNotApproved) {
      // Validate all fields that are being updated

      if (title !== undefined) {
        if (title.length > 25) {
          const response: IApiResponse = {
            success: false,
            message: 'Title must not exceed 25 characters',
            errors: [
              {
                field: 'title',
                message: 'Title is too long (max 25 characters)',
              },
            ],
          };
          sendResponse(res, 400, response);
          return;
        }
      }

      if (description !== undefined) {
        if (description && description.length > 500) {
          const response: IApiResponse = {
            success: false,
            message: 'Description must not exceed 500 characters',
            errors: [
              {
                field: 'description',
                message: 'Description is too long (max 500 characters)',
              },
            ],
          };
          sendResponse(res, 400, response);
          return;
        }

        const wordCount = description?.trim().split(/\s+/).length || 0;
        if (wordCount > 30) {
          const response: IApiResponse = {
            success: false,
            message: 'Description must not exceed 30 words',
            errors: [
              {
                field: 'description',
                message: 'Description is too long (max 30 words)',
              },
            ],
          };
          sendResponse(res, 400, response);
          return;
        }
      }

      if (amountRequested !== undefined) {
        if (amountRequested < 100) {
          const response: IApiResponse = {
            success: false,
            message: 'Amount must be at least ₦100',
            errors: [
              {
                field: 'amountRequested',
                message: 'Minimum amount is ₦100',
              },
            ],
          };
          sendResponse(res, 400, response);
          return;
        }
      }

      if (mediaType !== undefined) {
        const validMediaTypes = ['video', 'audio', 'text'];
        if (!validMediaTypes.includes(mediaType)) {
          const response: IApiResponse = {
            success: false,
            message: 'Invalid media type',
            errors: [
              {
                field: 'mediaType',
                message: 'Media type must be: video, audio, or text',
              },
            ],
          };
          sendResponse(res, 400, response);
          return;
        }
      }

      // Build update data
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (amountRequested !== undefined) updateData.amountRequested = amountRequested;
      if (mediaType !== undefined) updateData.mediaType = mediaType;
      if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;

      const updatedBeg = await BegService.updateBeg(begId, updateData);

      logger.info('Not approved beg updated', {
        begId,
        userId,
        updatedFields: Object.keys(updateData),
      });

      const response: IApiResponse = {
        success: true,
        message: 'Beg request updated successfully',
        data: { beg: updatedBeg },
      };
      sendResponse(res, 200, response);
      return;
    }

    // If we reach here, something unexpected happened
    logger.error('Unexpected state in update beg', {
      begId,
      status: existingBeg.status,
      approved: existingBeg.approved,
      hasDonations,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Unable to process update request',
    };
    sendResponse(res, 500, response);

  } catch (error: any) {
    logger.error('Update beg error', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      begId: req.params.id,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to update beg request. Please try again.',
    };

    sendResponse(res, 500, response);
  }
};