import { Response } from 'express';
import { IApiResponse } from '../types/user.interface';

type AccountGuardUser = {
  isDeleted?: boolean;
  isSuspended?: boolean;
};

/**
 * Returns false and sends a JSON error when the account must not authenticate.
 */
export function rejectInactiveAccount(
  user: AccountGuardUser,
  res: Response,
  sendResponse: <T = unknown>(res: Response, statusCode: number, response: IApiResponse<T>) => void
): boolean {
  if (user.isDeleted) {
    sendResponse(res, 401, {
      success: false,
      message: 'Unable to sign in. Please try again.',
    });
    return true;
  }

  if (user.isSuspended) {
    sendResponse(res, 403, {
      success: false,
      message: 'Your account has been suspended. Contact support@plz.ng for help.',
    });
    return true;
  }

  return false;
}
