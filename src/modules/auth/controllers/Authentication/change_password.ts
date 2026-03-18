import { Request, Response } from 'express';
import { UserService } from '../../services/user.service';
import { SessionService } from '../../services/session.service';
import { CacheService } from '../../services/cacheService';
import { IApiResponse, IChangePasswordRequest } from '../../types/user.interface';
import logger from '../../../../config/logger';

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
 * @route   POST /api/auth/change-password
 * @desc    Change user password (requires current password)
 * @access  Private
 */
export const changePassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.user?.sessionId;

    if (!userId) {
      const response: IApiResponse = {
        success: false,
        message: 'User not authenticated',
      };
      sendResponse(res, 401, response);
      return;
    }

    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body as IChangePasswordRequest;

    logger.info('Change password attempt', { userId });

    // ============================================
    // VALIDATION
    // ============================================

    // Check all required fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      const response: IApiResponse = {
        success: false,
        message: 'All fields are required',
        errors: [
          {
            field: 'general',
            message: 'Current password, new password, and confirmation are required',
          },
        ],
      };
      sendResponse(res, 400, response);
      return;
    }

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      const response: IApiResponse = {
        success: false,
        message: 'New passwords do not match',
        errors: [
          {
            field: 'confirmPassword',
            message: 'New password and confirmation must match',
          },
        ],
      };
      sendResponse(res, 400, response);
      return;
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      const response: IApiResponse = {
        success: false,
        message: 'Password must be at least 8 characters long',
        errors: [
          {
            field: 'newPassword',
            message: 'Password must be at least 8 characters',
          },
        ],
      };
      sendResponse(res, 400, response);
      return;
    }

    // Check if new password is same as current
    if (currentPassword === newPassword) {
      const response: IApiResponse = {
        success: false,
        message: 'New password must be different from current password',
        errors: [
          {
            field: 'newPassword',
            message: 'Please choose a different password',
          },
        ],
      };
      sendResponse(res, 400, response);
      return;
    }

    // ============================================
    // GET USER AND VERIFY CURRENT PASSWORD
    // ============================================

    const user = await UserService.findById(userId);

    if (!user) {
      logger.warn('Change password failed: User not found', { userId });
      const response: IApiResponse = {
        success: false,
        message: 'User not found',
      };
      sendResponse(res, 404, response);
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await UserService.comparePassword(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      logger.warn('Change password failed: Invalid current password', {
        userId,
      });
      const response: IApiResponse = {
        success: false,
        message: 'Current password is incorrect',
        errors: [
          {
            field: 'currentPassword',
            message: 'The current password you entered is incorrect',
          },
        ],
      };
      sendResponse(res, 401, response);
      return;
    }

    // ============================================
    // UPDATE PASSWORD
    // ============================================

    const updatedUser = await UserService.updatePassword(userId, newPassword);

    if (!updatedUser) {
      logger.error('Change password failed: Database update failed', {
        userId,
      });
      const response: IApiResponse = {
        success: false,
        message: 'Failed to update password. Please try again.',
      };
      sendResponse(res, 500, response);
      return;
    }

    // ============================================
    // INVALIDATE OTHER SESSIONS (SECURITY)
    // ============================================

    // Deactivate all sessions except current one
    const deactivatedCount = await SessionService.deactivateOtherSessions(
      userId,
      sessionId!
    );

    // Delete refresh tokens from cache for other sessions
    const otherSessions = await SessionService.getActiveSessions(userId);
    const cacheDeletePromises = otherSessions
      .filter((session) => session.id !== sessionId)
      .map((session) => CacheService.deleteRefreshToken(session.id));

    await Promise.all(cacheDeletePromises);

    logger.info('Password changed successfully', {
      userId,
      email: user.email,
      otherSessionsDeactivated: deactivatedCount,
    });

    const response: IApiResponse = {
      success: true,
      message: 'Password changed successfully. Other sessions have been logged out for security.',
      data: {
        otherSessionsDeactivated: deactivatedCount,
      },
    };

    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Change password error', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to change password. Please try again.',
    };

    sendResponse(res, 500, response);
  }
};