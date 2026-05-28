import { Request, Response } from 'express';
import { AdminTeamService } from '../../../admin/services/admin-team.service';
import { createSessionAndTokens } from '../../services/create_session.service';
import { setRefreshTokenCookie } from '../../utils/refresh_cookie';
import prisma from '../../../../config/database';
import { IApiResponse, IUserResponse } from '../../types/user.interface';
import { toUserResponse } from '../../../admin/utils/admin-user-response';
import logger from '../../../../config/logger';

export const acceptAdminInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password, confirmPassword, username } = req.body as {
      token?: string;
      password?: string;
      confirmPassword?: string;
      username?: string;
    };

    if (!token?.trim() || !password || !confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Token, password, and confirmation are required',
      } satisfies IApiResponse);
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Passwords do not match' } satisfies IApiResponse);
      return;
    }

    const { userId } = await AdminTeamService.acceptInvite({
      token,
      password,
      username,
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const { accessToken, refreshToken } = await createSessionAndTokens(req, user);

    const userResponse: IUserResponse = toUserResponse(user);

    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Account created. Welcome to Pliz Admin.',
      data: { user: userResponse, accessToken, refreshToken },
    } satisfies IApiResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to accept invite';
    logger.error('Accept admin invite error', { error: message });
    res.status(400).json({ success: false, message } satisfies IApiResponse);
  }
};
