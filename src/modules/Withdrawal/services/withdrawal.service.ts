import prisma from '../../../config/database';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { Decimal } from '@prisma/client/runtime/library';
import logger from '../../../config/logger';
import { WithdrawalEmailService } from './withdrawal_email.service';
import { TransactionPinService } from '../../Security/services/transaction-pin.service';
import { decryptText, maskAccountNumber } from '../../../utils/crypto.util';

const COMPANY_FEE_RATE = 0.05;
const VAT_RATE = 0.075;

const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
});

const buildBegTitle = (
  category: { name: string; icon: string | null } | null,
  description: string | null
): string => {
  if (!category) return 'Help Request';
  const icon = category.icon ? ` ${category.icon}` : '';
  const desc = description ? ` — ${description}` : '';
  return `${category.name}${icon}${desc}`;
};

interface IBegWithdrawalRelations {
  id: string;
  userId: string;
  begId: string;
  bankAccountId: string;
  amountRequested: Decimal;
  amountToReceive: Decimal;
  companyFee: Decimal;
  vatFee: Decimal;
  totalFees: Decimal;
  transferReference: string | null;
  status: string;
  failureReason: string | null;
  autoProcessed: boolean;
  processedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    username: string;
    isSuspended: boolean;
    isUnderInvestigation: boolean;
    profile: { displayName: string | null } | null;
  };
  bankAccount: {
    id: string;
    accountNumber: string;
    accountNumberEncrypted?: string | null;
    accountNumberLast4?: string | null;
    accountName: string;
    bankName: string;
    bankCode: string;
    isVerified: boolean;
    isDefault: boolean;
  };
  beg: {
    id: string;
    description: string | null;
    amountRaised: Decimal;
    category: { name: string; icon: string | null };
  };
}

interface IWithdrawalRequestRelations {
  id: string;
  userId: string;
  begId: string;
  bankAccountId: string;
  amountRequested: Decimal;
  amountToReceive: Decimal;
  companyFee: Decimal;
  vatFee: Decimal;
  totalFees: Decimal;
  transferReference: string | null;
  status: string;
  failureReason: string | null;
  autoProcessed: boolean;
  processedAt: Date | null;
  createdAt: Date;
  bankAccount: {
    id: string;
    accountNumber: string;
    accountNumberEncrypted?: string | null;
    accountNumberLast4?: string | null;
    accountName: string;
    bankName: string;
    bankCode: string;
    isVerified: boolean;
    isDefault: boolean;
  };
  beg: {
    description: string | null;
    amountRaised: Decimal;
    category: { name: string; icon: string | null };
  };
}

export class WithdrawalService {

  // ============================================
  // IS BEG WITHDRAWABLE
  // ============================================
  static isBegWithdrawable(beg: {
    status: string;
    expiresAt: Date;
    amountRaised: Decimal | number | string;
  }): { allowed: boolean; reason?: string } {
    const amountRaised = parseFloat(beg.amountRaised.toString());
    if (!Number.isFinite(amountRaised) || amountRaised <= 0) {
      return { allowed: false, reason: 'No donations to withdraw for this request' };
    }
    if (['cancelled', 'rejected', 'flagged'].includes(beg.status)) {
      return { allowed: false, reason: 'This request is not eligible for withdrawal' };
    }
    if (beg.status === 'funded') return { allowed: true };

    const periodEnded =
      beg.status === 'expired' || beg.expiresAt.getTime() <= Date.now();

    if (periodEnded) return { allowed: true };

    return {
      allowed: false,
      reason: 'Withdrawals are available once your request is fully funded or after it expires',
    };
  }

  // ============================================
  // CALCULATE FEES
  // ============================================
  static calculateFees(amountRaised: number): {
    amountRequested: number;
    companyFee: number;
    vatFee: number;
    totalFees: number;
    amountToReceive: number;
  } {
    const companyFee = Math.round(amountRaised * COMPANY_FEE_RATE * 100) / 100;
    const vatFee = Math.round(companyFee * VAT_RATE * 100) / 100;
    const totalFees = companyFee + vatFee;
    const amountToReceive = amountRaised - totalFees;
    return { amountRequested: amountRaised, companyFee, vatFee, totalFees, amountToReceive };
  }

  // ============================================
  // CAN USER WITHDRAW
  // ============================================
  static async canUserWithdraw(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isSuspended: true,
        suspensionReason: true,
        isUnderInvestigation: true,
        investigationReason: true,
      },
    });

    if (!user) return { allowed: false, reason: 'User not found' };
    if (user.isSuspended) {
      return {
        allowed: false,
        reason: `Your account is suspended. Reason: ${user.suspensionReason || 'Contact support'}`,
      };
    }
    if (user.isUnderInvestigation) {
      return {
        allowed: false,
        reason: `Your account is under investigation. Reason: ${user.investigationReason || 'Contact support'}`,
      };
    }
    return { allowed: true };
  }

  // ============================================
  // REQUEST WITHDRAWAL
  // ============================================
  static async requestWithdrawal(
    userId: string,
    begId: string,
    bankAccountId?: string,
    transactionPin?: string
  ): Promise<any> {
    try {
      if (!transactionPin) {
        throw new Error('Enter your Transaction PIN to continue.');
      }
      await TransactionPinService.verify(userId, transactionPin);

      const canWithdraw = await this.canUserWithdraw(userId);
      if (!canWithdraw.allowed) throw new Error(canWithdraw.reason);

      const beg = await prisma.beg.findUnique({
        where: { id: begId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              profile: { select: { displayName: true } },
            },
          },
          category: { select: { name: true, icon: true } },
        },
      });

      if (!beg) throw new Error('Beg not found');
      if (beg.userId !== userId) {
        throw new Error('You can only withdraw from your own requests');
      }

      const withdrawable = this.isBegWithdrawable(beg);
      if (!withdrawable.allowed) throw new Error(withdrawable.reason);

      if (beg.status === 'active' && beg.expiresAt.getTime() <= Date.now()) {
        await prisma.beg.update({
          where: { id: begId },
          data: { status: 'expired' },
        });
      }

      const existingWithdrawal = await prisma.withdrawal.findFirst({
        where: {
          begId,
          status: { in: ['pending', 'processing', 'completed', 'on_hold'] },
        },
      });
      if (existingWithdrawal) {
        throw new Error('Withdrawal already requested for this beg');
      }

      let bankAccount;
      if (bankAccountId) {
        bankAccount = await prisma.bankAccount.findFirst({
          where: { id: bankAccountId, userId },
        });
      } else {
        bankAccount = await prisma.bankAccount.findFirst({
          where: { userId, isDefault: true },
        });
      }

      if (!bankAccount) {
        throw new Error('No bank account found. Please add a bank account first.');
      }
      if (!bankAccount.isVerified) {
        throw new Error('Bank account must be verified');
      }

      const amountRaised = parseFloat(beg.amountRaised.toString());
      const fees = this.calculateFees(amountRaised);

      let withdrawal: IWithdrawalRequestRelations;
      try {
        withdrawal = (await prisma.withdrawal.create({
          data: {
            userId,
            begId,
            bankAccountId: bankAccount.id,
            amountRequested: fees.amountRequested,
            companyFee: fees.companyFee,
            vatFee: fees.vatFee,
            totalFees: fees.totalFees,
            amountToReceive: fees.amountToReceive,
            status: 'pending',
          },
          include: {
            bankAccount: true,
            beg: {
              select: {
                description: true,
                amountRaised: true,
                category: { select: { name: true, icon: true } },
              },
            },
          },
        })) as IWithdrawalRequestRelations;
      } catch (error: any) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new Error('Withdrawal already requested for this beg');
        }
        throw error;
      }

      logger.info('Withdrawal record created', {
        withdrawalId: withdrawal.id,
        userId,
        begId,
        amountToReceive: fees.amountToReceive,
      });

      try {
        await this.processWithdrawal(withdrawal.id, true);
        return await prisma.withdrawal.findUnique({
          where: { id: withdrawal.id },
          include: {
            bankAccount: true,
            beg: {
              select: {
                description: true,
                category: { select: { name: true, icon: true } },
              },
            },
          },
        });
      } catch (directError: any) {
        logger.warn('Direct withdrawal processing failed', {
          withdrawalId: withdrawal.id,
          error: directError.message,
        });
        return await prisma.withdrawal.findUnique({
          where: { id: withdrawal.id },
          include: {
            bankAccount: true,
            beg: {
              select: {
                description: true,
                category: { select: { name: true, icon: true } },
              },
            },
          },
        });
      }
    } catch (error: any) {
      logger.error('Withdrawal request failed', {
        error: error.message, userId, begId,
      });
      throw error;
    }
  }

  // ============================================
  // PROCESS WITHDRAWAL
  // Uses Flutterwave transfer API
  // Amount in Naira (not kobo)
  // ============================================
  static async processWithdrawal(
    withdrawalId: string,
    autoProcessed: boolean = false
  ): Promise<any> {
    try {
      const withdrawal = (await prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              isSuspended: true,
              isUnderInvestigation: true,
              profile: { select: { displayName: true } },
            },
          },
          bankAccount: true,
          beg: {
            select: {
              id: true,
              description: true,
              amountRaised: true,
              category: { select: { name: true, icon: true } },
            },
          },
        },
      })) as IBegWithdrawalRelations | null;

      if (!withdrawal) throw new Error('Withdrawal not found');
      if (withdrawal.status !== 'pending') {
        throw new Error(`Withdrawal is already ${withdrawal.status}`);
      }

      if (withdrawal.user.isSuspended || withdrawal.user.isUnderInvestigation) {
        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: 'on_hold',
            failureReason: 'Account suspended or under investigation',
          },
        });
        throw new Error('User account is suspended or under investigation');
      }

      await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: 'processing' },
      });

      const reference = `WTH-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)
        .toUpperCase()}`;

      const begTitle = buildBegTitle(
        withdrawal.beg.category,
        withdrawal.beg.description
      );
      const recipientName =
        withdrawal.user.profile?.displayName || withdrawal.user.username;
      const amountToReceive = parseFloat(withdrawal.amountToReceive.toString());

      // ── FLUTTERWAVE TRANSFER ──────────────────
      const transferAccountNumber =
        decryptText(withdrawal.bankAccount.accountNumberEncrypted) ??
        withdrawal.bankAccount.accountNumber;
      const displayAccountNumber = withdrawal.bankAccount.accountNumberLast4
        ? `******${withdrawal.bankAccount.accountNumberLast4}`
        : maskAccountNumber(transferAccountNumber);

      const transferResponse = await axios.post(
        `${FLW_BASE_URL}/transfers`,
        {
          account_bank: withdrawal.bankAccount.bankCode,
          account_number: transferAccountNumber,
          amount: amountToReceive,        // ← Naira directly
          narration: `Plz withdrawal — ${begTitle}`,
          currency: 'NGN',
          reference,
          debit_currency: 'NGN',
        },
        { headers: getHeaders(), timeout: 30000 }
      );

      if (
        transferResponse.data?.status !== 'success' &&
        transferResponse.data?.data?.status !== 'SUCCESSFUL' &&
        transferResponse.data?.data?.status !== 'NEW'
      ) {
        const failureReason =
          transferResponse.data?.message || 'Transfer initiation failed';

        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: { status: 'failed', failureReason },
        });

        await WithdrawalEmailService.sendFailureEmail(withdrawal.user.email, {
          recipientName,
          amount: amountToReceive,
          bankName: withdrawal.bankAccount.bankName,
          accountNumber: displayAccountNumber,
          failureReason,
          begTitle,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@plz.app',
        });

        throw new Error(failureReason);
      }

      const updatedWithdrawal = await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          transferReference: reference,
          status: 'completed',
          autoProcessed,
          processedAt: new Date(),
        },
      });

      await prisma.beg.update({
        where: { id: withdrawal.begId },
        data: { isWithdrawn: true, withdrawnAt: new Date() },
      });

      await WithdrawalEmailService.sendSuccessEmail(withdrawal.user.email, {
        recipientName,
        amount: parseFloat(withdrawal.amountRequested.toString()),
        companyFee: parseFloat(withdrawal.companyFee.toString()),
        vatFee: parseFloat(withdrawal.vatFee.toString()),
        totalFees: parseFloat(withdrawal.totalFees.toString()),
        amountToReceive,
        bankName: withdrawal.bankAccount.bankName,
        accountNumber: displayAccountNumber,
        accountName: withdrawal.bankAccount.accountName,
        transferReference: reference,
        begTitle,
        processedAt: new Date(),
      });

      logger.info('Withdrawal processed via Flutterwave', {
        withdrawalId,
        reference,
        amount: amountToReceive,
      });

      return updatedWithdrawal;
    } catch (error: any) {
      logger.error('Withdrawal processing failed', {
        error: error.response?.data || error.message,
        withdrawalId,
      });

      await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'failed',
          failureReason: error.response?.data?.message || error.message,
        },
      });

      throw error;
    }
  }

  // ============================================
  // GET USER WITHDRAWALS
  // ============================================
  static async getUserWithdrawals(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    try {
      const skip = (page - 1) * limit;

      const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            beg: {
              select: {
                id: true,
                description: true,
                category: { select: { name: true, icon: true } },
              },
            },
            bankAccount: {
              select: {
                accountNumber: true,
                accountNumberLast4: true,
                accountName: true,
                bankName: true,
              },
            },
          },
        }),
        prisma.withdrawal.count({ where: { userId } }),
      ]);

      return {
        withdrawals: (withdrawals as any[]).map((w) => ({
          id: w.id,
          amount_raised: parseFloat(w.amountRequested.toString()),
          company_fee: parseFloat(w.companyFee.toString()),
          vat_fee: parseFloat(w.vatFee.toString()),
          total_fees: parseFloat(w.totalFees.toString()),
          amount_received: parseFloat(w.amountToReceive.toString()),
          status: w.status,
          transfer_reference: w.transferReference,
          failure_reason: w.failureReason,
          auto_processed: w.autoProcessed,
          beg: {
            id: w.beg.id,
            title: buildBegTitle(w.beg.category, w.beg.description),
            category: w.beg.category,
          },
          bank_account: {
            account_number: w.bankAccount.accountNumberLast4
              ? `******${w.bankAccount.accountNumberLast4}`
              : maskAccountNumber(w.bankAccount.accountNumber),
            account_name: w.bankAccount.accountName,
            bank_name: w.bankAccount.bankName,
          },
          created_at: w.createdAt,
          processed_at: w.processedAt,
        })),
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error('Failed to get withdrawals', {
        error: error.message, userId,
      });
      throw error;
    }
  }
}
