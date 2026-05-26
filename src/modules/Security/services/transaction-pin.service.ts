import bcrypt from 'bcryptjs';

import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { SecurityConfig } from '../../../config/security';

const PIN_REGEX = /^\d{4}$/;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export class TransactionPinError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'TransactionPinError';
    this.statusCode = statusCode;
  }
}

function validatePin(pin: string, label = 'PIN'): void {
  if (!PIN_REGEX.test(pin)) {
    throw new TransactionPinError(`${label} must be exactly 4 digits.`);
  }
}

function lockExpiry(): Date {
  return new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
}

export class TransactionPinService {
  static async getStatus(userId: string): Promise<{
    hasPin: boolean;
    locked: boolean;
    lockedUntil: Date | null;
    failedAttempts: number;
    maxFailedAttempts: number;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        transactionPinHash: true,
        transactionPinFailedAttempts: true,
        transactionPinLockedUntil: true,
      },
    });

    if (!user) {
      throw new TransactionPinError('User not found.', 404);
    }

    const lockedUntil = user.transactionPinLockedUntil;
    const locked = Boolean(lockedUntil && lockedUntil.getTime() > Date.now());

    return {
      hasPin: Boolean(user.transactionPinHash),
      locked,
      lockedUntil: locked ? lockedUntil : null,
      failedAttempts: user.transactionPinFailedAttempts,
      maxFailedAttempts: MAX_FAILED_ATTEMPTS,
    };
  }

  static async setup(userId: string, pin: string): Promise<void> {
    validatePin(pin);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { transactionPinHash: true },
    });

    if (!user) {
      throw new TransactionPinError('User not found.', 404);
    }
    if (user.transactionPinHash) {
      throw new TransactionPinError('Transaction PIN is already set.');
    }

    const pinHash = await bcrypt.hash(pin, SecurityConfig.bcrypt.saltRounds);
    const now = new Date();

    await prisma.user.update({
      where: { id: userId },
      data: {
        transactionPinHash: pinHash,
        transactionPinSetAt: now,
        transactionPinUpdatedAt: now,
        transactionPinFailedAttempts: 0,
        transactionPinLockedUntil: null,
      },
    });

    logger.info('Transaction PIN set', { userId });
  }

  static async change(userId: string, currentPin: string, newPin: string): Promise<void> {
    validatePin(currentPin, 'Current PIN');
    validatePin(newPin, 'New PIN');

    await this.verify(userId, currentPin);

    const pinHash = await bcrypt.hash(newPin, SecurityConfig.bcrypt.saltRounds);
    await prisma.user.update({
      where: { id: userId },
      data: {
        transactionPinHash: pinHash,
        transactionPinUpdatedAt: new Date(),
        transactionPinFailedAttempts: 0,
        transactionPinLockedUntil: null,
      },
    });

    logger.info('Transaction PIN changed', { userId });
  }

  static async verify(userId: string, pin: string): Promise<void> {
    validatePin(pin);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        transactionPinHash: true,
        transactionPinFailedAttempts: true,
        transactionPinLockedUntil: true,
      },
    });

    if (!user) {
      throw new TransactionPinError('User not found.', 404);
    }
    if (!user.transactionPinHash) {
      throw new TransactionPinError('Set up your Transaction PIN before continuing.');
    }

    if (
      user.transactionPinLockedUntil &&
      user.transactionPinLockedUntil.getTime() > Date.now()
    ) {
      throw new TransactionPinError(
        'Your Transaction PIN is temporarily locked. Please try again later.',
        423
      );
    }

    const valid = await bcrypt.compare(pin, user.transactionPinHash);
    if (!valid) {
      const failedAttempts = user.transactionPinFailedAttempts + 1;
      const lockedUntil =
        failedAttempts >= MAX_FAILED_ATTEMPTS ? lockExpiry() : null;

      await prisma.user.update({
        where: { id: userId },
        data: {
          transactionPinFailedAttempts: failedAttempts,
          transactionPinLockedUntil: lockedUntil,
        },
      });

      if (lockedUntil) {
        throw new TransactionPinError(
          'Too many incorrect PIN attempts. Please try again in 15 minutes.',
          423
        );
      }

      throw new TransactionPinError(
        `Incorrect Transaction PIN. ${MAX_FAILED_ATTEMPTS - failedAttempts} attempt${
          MAX_FAILED_ATTEMPTS - failedAttempts === 1 ? '' : 's'
        } remaining.`
      );
    }

    if (
      user.transactionPinFailedAttempts > 0 ||
      user.transactionPinLockedUntil
    ) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          transactionPinFailedAttempts: 0,
          transactionPinLockedUntil: null,
        },
      });
    }
  }
}
