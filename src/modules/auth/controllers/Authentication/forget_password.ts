import { Request, Response } from 'express';
import { UserService } from '../../services/user.service';
import { TokenService } from '../../services/tokenService';
import { EmailService } from '../../services/emailService';
import { CacheService } from '../../services/cacheService';
import { IForgotPasswordRequest, IApiResponse } from '../../types/user.interface';
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
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body as IForgotPasswordRequest;

    logger.info('Password reset request', { email, ip: req.ip });

    // Find user
    const user = await UserService.findByEmail(email);

    // Always return success (security: don't reveal if email exists)
    if (!user) {
      logger.warn('Password reset: User not found', { email });
      const response: IApiResponse = {
        success: true,
        message: 'If that email exists, a password reset link has been sent.',
      };
      sendResponse(res, 200, response);
      return;
    }

    // ========== EMAIL & CACHE: Generate and store password reset token ==========
    const resetToken = TokenService.generateEmailToken();

    // Store token in Redis cache (expires in 1 hour)
    await CacheService.storePasswordResetToken(
      email.toLowerCase(),
      resetToken,
      3600
    );

    try {
      await EmailService.sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      await CacheService.deletePasswordResetToken(resetToken);
      logger.error('Failed to send password reset email', { error: emailError, email });

      const response: IApiResponse = {
        success: false,
        message: 'Unable to send the reset email right now. Please try again later.',
      };
      sendResponse(res, 503, response);
      return;
    }

    logger.info('Password reset email sent', { email });

    const response: IApiResponse = {
      success: true,
      message: 'If that email exists, a password reset link has been sent.',
    };
    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Forgot password error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to process password reset request.',
    };
    sendResponse(res, 500, response);
  }
};