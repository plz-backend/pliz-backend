import { Request, Response } from 'express';
import { BegService } from '../services/beg.service';
import { CategoryService } from '../services/category.service';
import { ICreateBegRequest } from '../types/beg.interface';
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
 * @route   POST /api/begs
 * @desc    Create a new beg
 * @access  Private
 */
export const createBeg = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { category, description, amountRequested, mediaType, mediaUrl } = req.body; // ← title removed

    logger.info('Create beg request', {
      userId,
      category,
      amount: amountRequested,
      hasDescription: !!description,
    });

    // ============================================
    // BASIC VALIDATION
    // ============================================
    if (!category) {
      sendResponse(res, 400, { success: false, message: 'Category is required' });
      return;
    }

    if (!amountRequested || typeof amountRequested !== 'number') {
      sendResponse(res, 400, {
        success: false,
        message: 'Amount requested is required and must be a number',
      });
      return;
    }

    if (amountRequested < 100) {
      sendResponse(res, 400, { success: false, message: 'Minimum amount is ₦100' });
      return;
    }

    // ============================================
    // CATEGORY LOOKUP
    // ============================================
    const categoryId = await CategoryService.getCategoryIdByName(category);

    if (!categoryId) {
      sendResponse(res, 400, {
        success: false,
        message: 'Invalid category. Valid options: food, transport, rent, medical, education, emergency, other',
      });
      return;
    }

    // ============================================
    // CREATE BEG
    // ============================================
    const data: ICreateBegRequest = {
      categoryId,
      description: description ? description.trim() : null, // max 40 words / 300 chars
      amountRequested,
      mediaType,
      mediaUrl,
    };

    const beg = await BegService.createBeg(userId, data);

    logger.info('Beg created successfully', {
      begId: beg.id,
      userId,
      approved: beg.approved,
    });

    sendResponse(res, 201, {
      success: true,
      message: beg.approved
        ? 'Beg created successfully! It is now live.'
        : 'Beg created successfully and pending approval.',
      data: {
        beg: {
          id: beg.id,
          description: beg.description,        // ← title removed
          categoryId: beg.categoryId,
          amountRequested: beg.amountRequested,
          amountRaised: beg.amountRaised,
          status: beg.status,
          approved: beg.approved,
          mediaType: beg.mediaType,
          mediaUrl: beg.mediaUrl,
          expiresAt: beg.expiresAt,
          createdAt: beg.createdAt,
        },
      },
    });
  } catch (error: any) {
    logger.error('Create beg error', {
      error: error.message,
      stack: error.stack,
      userId: (req as any).user?.userId,
    });

    const statusCode =
      error.message.includes('Description') ||
      error.message.includes('cooldown') ||
      error.message.includes('limit') ||
      error.message.includes('tier')
        ? 400
        : 500;

    sendResponse(res, statusCode, {
      success: false,
      message: error.message || 'Failed to create beg',
    });
  }
};