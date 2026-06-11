import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import { UserService } from '../../services/user.service';
import {
  AccountDeletionError,
  AccountDeletionService,
} from '../../services/account-deletion.service';
import { IApiResponse } from '../../types/user.interface';
import logger from '../../../../config/logger';
import { clearRefreshTokenCookie } from '../../utils/refresh_cookie';

const sendResponse = <T = unknown>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   DELETE /api/auth/account
 * @desc    Soft delete user account (password required)
 * @access  Private
 * @body    { password: string, reason?: string }
 */
export const deleteAccount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.user?.sessionId;
    const { password, reason } = req.body as { password?: string; reason?: string };

    if (!userId) {
      sendResponse(res, 401, { success: false, message: 'User not authenticated' });
      return;
    }

    if (!password?.trim()) {
      sendResponse(res, 400, {
        success: false,
        message: 'Password is required to delete your account',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        authProvider: true,
        passwordHash: true,
        isDeleted: true,
      },
    });

    if (!user) {
      sendResponse(res, 404, { success: false, message: 'User not found' });
      return;
    }

    const passwordValid = await UserService.comparePassword(password, user.passwordHash);
    if (!passwordValid) {
      const oauthOnly =
        user.authProvider === 'google' || user.authProvider === 'apple';
      sendResponse(res, 401, {
        success: false,
        message: oauthOnly
          ? 'Incorrect password. If you sign in with Google or Apple only, use Forgot password to set an account password first, then try again.'
          : 'Incorrect password. Please enter your current account password to confirm deletion.',
        code: 'INVALID_PASSWORD',
      });
      return;
    }

    const accessToken = req.headers.authorization?.split(' ')[1];

    await AccountDeletionService.softDeleteAccount({
      userId,
      deletedBy: userId,
      reason,
      accessToken,
    });

    clearRefreshTokenCookie(res);

    logger.info('Account soft deleted via API', {
      userId,
      sessionId,
      email: user.email,
    });

    sendResponse(res, 200, {
      success: true,
      message: 'Your account has been deleted. We are sorry to see you go.',
    });
  } catch (error: unknown) {
    if (error instanceof AccountDeletionError) {
      sendResponse(res, error.statusCode, {
        success: false,
        message: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
      return;
    }

    const err = error as Error;
    logger.error('Delete account error', {
      error: err.message,
      stack: err.stack,
    });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to delete account. Please try again.',
    });
  }
};
