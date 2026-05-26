import { Request, Response } from 'express';

import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';
import {
  TransactionPinError,
  TransactionPinService,
} from '../services/transaction-pin.service';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

function statusForError(error: unknown): number {
  return error instanceof TransactionPinError ? error.statusCode : 500;
}

function messageForError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'We could not complete this request right now. Please try again.';
}

export const getTransactionPinStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const status = await TransactionPinService.getStatus(userId);
    sendResponse(res, 200, {
      success: true,
      message: 'Transaction PIN status retrieved',
      data: status,
    });
  } catch (error: any) {
    logger.error('Get transaction PIN status error', { error: error.message });
    sendResponse(res, statusForError(error), {
      success: false,
      message: messageForError(error),
    });
  }
};

export const setupTransactionPin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    await TransactionPinService.setup(userId, req.body.pin);
    sendResponse(res, 201, {
      success: true,
      message: 'Transaction PIN set successfully.',
    });
  } catch (error: any) {
    logger.error('Setup transaction PIN error', { error: error.message });
    sendResponse(res, statusForError(error), {
      success: false,
      message: messageForError(error),
    });
  }
};

export const verifyTransactionPin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    await TransactionPinService.verify(userId, req.body.pin);
    sendResponse(res, 200, {
      success: true,
      message: 'Transaction PIN verified.',
    });
  } catch (error: any) {
    logger.error('Verify transaction PIN error', { error: error.message });
    sendResponse(res, statusForError(error), {
      success: false,
      message: messageForError(error),
    });
  }
};

export const changeTransactionPin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    await TransactionPinService.change(userId, req.body.currentPin, req.body.newPin);
    sendResponse(res, 200, {
      success: true,
      message: 'Transaction PIN changed successfully.',
    });
  } catch (error: any) {
    logger.error('Change transaction PIN error', { error: error.message });
    sendResponse(res, statusForError(error), {
      success: false,
      message: messageForError(error),
    });
  }
};
