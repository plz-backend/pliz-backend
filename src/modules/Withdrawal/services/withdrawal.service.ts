import prisma from '../../../config/database';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { Decimal } from '@prisma/client/runtime/library';
import logger from '../../../config/logger';
import { WithdrawalEmailService } from './withdrawal_email.service';
import { TransactionPinService } from '../../Security/services/transaction-pin.service';
import { decryptText, maskAccountNumber } from '../../../utils/crypto.util';
import {
  extractInternalTransferFailureReason,
  toUserWithdrawalFailureDisplay,
  toUserWithdrawalRequestMessage,
  WITHDRAWAL_TRANSFER_FAILURE_USER_MESSAGE,
} from '../utils/withdrawal-errors';
import { WithdrawalAuditService } from './withdrawal-audit.service';

// ── FEE RATES ─────────────────────────────
const COMPANY_FEE_RATE = 0.07;    // ← 7% (was 5%)
const VAT_RATE = 0.075;           // 7.5% of fee
// Total: 7% + (7% × 7.5%) = 7.525%

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
    amountRequested: Decimal;
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

  /// ============================================
// IS BEG WITHDRAWABLE
// User can withdraw at ANY time as long as
// there are donations. No need to wait for
// funded or expired.
// ============================================
static isBegWithdrawable(beg: {
  status: string;
  expiresAt: Date;
  amountRaised: Decimal | number | string;
  isWithdrawn?: boolean;
}): { allowed: boolean; reason?: string } {
  const amountRaised = parseFloat(beg.amountRaised.toString());

  if (!Number.isFinite(amountRaised) || amountRaised <= 0) {
    return {
      allowed: false,
      reason: 'No donations to withdraw yet. Wait until you receive at least one donation.',
    };
  }

  if (beg.isWithdrawn) {
    return {
      allowed: false,
      reason: 'You have already withdrawn funds from this request.',
    };
  }

  if (['cancelled', 'rejected', 'flagged', 'withdrawn'].includes(beg.status)) {
    return {
      allowed: false,
      reason: 'This request is not eligible for withdrawal.',
    };
  }

  // Allow withdrawal while active (Withdraw Now) or after funded/expired
  return { allowed: true };
}

  /** Status after owner withdraw closes the request. */
  static computeClosedBegStatus(
    raised: number,
    requested: number
  ): 'funded' | 'withdrawn' {
    return requested > 0 && raised >= requested ? 'funded' : 'withdrawn';
  }

  /** Restore beg when a payout fails after the request was closed for withdrawal. */
  static resolveBegStatusAfterWithdrawalReopen(beg: {
    expiresAt: Date;
    amountRaised: Decimal | number | string;
    amountRequested: Decimal | number | string;
  }): 'active' | 'funded' | 'expired' {
    const raised = parseFloat(beg.amountRaised.toString());
    const requested = parseFloat(beg.amountRequested.toString());
    if (requested > 0 && raised >= requested) return 'funded';
    if (new Date() > new Date(beg.expiresAt)) return 'expired';
    return 'active';
  }

  static async reopenBegAfterFailedWithdrawal(begId: string): Promise<void> {
    const beg = await prisma.beg.findUnique({
      where: { id: begId },
      select: {
        isWithdrawn: true,
        expiresAt: true,
        amountRaised: true,
        amountRequested: true,
      },
    });
    if (!beg?.isWithdrawn) return;

    const status = this.resolveBegStatusAfterWithdrawalReopen(beg);
    await prisma.beg.update({
      where: { id: begId },
      data: {
        isWithdrawn: false,
        withdrawnAt: null,
        status,
      },
    });

    logger.info('Beg reopened after failed withdrawal', { begId, status });

    const linkedWithdrawal = await prisma.withdrawal.findFirst({
      where: { begId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true, transferReference: true },
    });
    if (linkedWithdrawal) {
      WithdrawalAuditService.recordBegReopened(
        {
          withdrawalId: linkedWithdrawal.id,
          userId: linkedWithdrawal.userId,
          begId,
          transferReference: linkedWithdrawal.transferReference,
        },
        status
      );
    }
  }

  static async closeBegForWithdrawal(
    begId: string,
    raised: number,
    requested: number
  ): Promise<void> {
    const endStatus = this.computeClosedBegStatus(raised, requested);
    await prisma.beg.update({
      where: { id: begId },
      data: {
        isWithdrawn: true,
        withdrawnAt: new Date(),
        status: endStatus,
      },
    });
  }

  private static async loadWithdrawalForTransferEmail(
    withdrawalId: string
  ): Promise<IBegWithdrawalRelations | null> {
    return (await prisma.withdrawal.findUnique({
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
            amountRequested: true,
            amountRaised: true,
            category: { select: { name: true, icon: true } },
          },
        },
      },
    })) as IBegWithdrawalRelations | null;
  }

  private static async sendWithdrawalSuccessEmail(
    withdrawal: IBegWithdrawalRelations,
    transferReference: string
  ): Promise<void> {
    const begTitle = buildBegTitle(
      withdrawal.beg.category,
      withdrawal.beg.description
    );
    const recipientName =
      withdrawal.user.profile?.displayName || withdrawal.user.username;
    const amountToReceive = parseFloat(withdrawal.amountToReceive.toString());
    const transferAccountNumber =
      decryptText(withdrawal.bankAccount.accountNumberEncrypted) ??
      withdrawal.bankAccount.accountNumber;
    const displayAccountNumber = withdrawal.bankAccount.accountNumberLast4
      ? `******${withdrawal.bankAccount.accountNumberLast4}`
      : maskAccountNumber(transferAccountNumber);

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
      transferReference,
      begTitle,
      processedAt: new Date(),
    });
  }

  private static async sendWithdrawalFailureEmail(
    withdrawal: IBegWithdrawalRelations,
    failureReason: string
  ): Promise<void> {
    const begTitle = buildBegTitle(
      withdrawal.beg.category,
      withdrawal.beg.description
    );
    const recipientName =
      withdrawal.user.profile?.displayName || withdrawal.user.username;
    const amountToReceive = parseFloat(withdrawal.amountToReceive.toString());
    const transferAccountNumber =
      decryptText(withdrawal.bankAccount.accountNumberEncrypted) ??
      withdrawal.bankAccount.accountNumber;
    const displayAccountNumber = withdrawal.bankAccount.accountNumberLast4
      ? `******${withdrawal.bankAccount.accountNumberLast4}`
      : maskAccountNumber(transferAccountNumber);

    await WithdrawalEmailService.sendFailureEmail(withdrawal.user.email, {
      recipientName,
      amount: amountToReceive,
      bankName: withdrawal.bankAccount.bankName,
      accountNumber: displayAccountNumber,
      failureReason:
        toUserWithdrawalFailureDisplay(failureReason) ??
        WITHDRAWAL_TRANSFER_FAILURE_USER_MESSAGE,
      begTitle,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@plz.app',
    });
  }

  /**
   * Flutterwave transfer webhook — payout succeeded (async or late confirmation).
   */
  static async handleTransferSuccessful(transferReference: string): Promise<void> {
    const withdrawal = await prisma.withdrawal.findFirst({
      where: { transferReference },
    });
    if (!withdrawal) {
      logger.warn('Transfer success webhook: withdrawal not found', {
        transferReference,
      });
      return;
    }
    if (withdrawal.status === 'completed') return;

    const beg = await prisma.beg.findUnique({
      where: { id: withdrawal.begId },
      select: { amountRequested: true, amountRaised: true },
    });
    if (!beg) {
      logger.error('Transfer success webhook: beg not found', {
        withdrawalId: withdrawal.id,
        begId: withdrawal.begId,
      });
      return;
    }

    const raised = parseFloat(beg.amountRaised.toString());
    const requested = parseFloat(beg.amountRequested.toString());

    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'completed',
          processedAt: new Date(),
        },
      });
      await tx.beg.update({
        where: { id: withdrawal.begId },
        data: {
          isWithdrawn: true,
          withdrawnAt: new Date(),
          status: this.computeClosedBegStatus(raised, requested),
        },
      });
    });

    const full = await this.loadWithdrawalForTransferEmail(withdrawal.id);
    if (full) {
      try {
        await this.sendWithdrawalSuccessEmail(full, transferReference);
      } catch (error: unknown) {
        logger.error('Transfer success webhook: email failed', {
          withdrawalId: withdrawal.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Transfer success webhook: withdrawal completed', {
      withdrawalId: withdrawal.id,
      transferReference,
    });

    WithdrawalAuditService.recordCompleted({
      withdrawalId: withdrawal.id,
      userId: withdrawal.userId,
      begId: withdrawal.begId,
      transferReference,
      amountToReceive: parseFloat(withdrawal.amountToReceive.toString()),
    });
  }

  /**
   * Flutterwave transfer webhook — payout failed; reopen beg so owner can retry.
   */
  static async handleTransferFailed(
    transferReference: string,
    failureReason: string,
    flutterwavePayload?: unknown
  ): Promise<void> {
    const withdrawal = await prisma.withdrawal.findFirst({
      where: { transferReference },
    });
    if (!withdrawal) {
      logger.warn('Transfer failed webhook: withdrawal not found', {
        transferReference,
      });
      return;
    }
    if (withdrawal.status === 'completed') {
      logger.error('Transfer failed webhook after completion — manual review', {
        withdrawalId: withdrawal.id,
        transferReference,
        failureReason,
      });
      return;
    }

    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: 'failed',
        failureReason,
      },
    });

    await this.reopenBegAfterFailedWithdrawal(withdrawal.begId);

    const full = await this.loadWithdrawalForTransferEmail(withdrawal.id);
    if (full) {
      try {
        await this.sendWithdrawalFailureEmail(full, failureReason);
      } catch (error: unknown) {
        logger.error('Transfer failed webhook: email failed', {
          withdrawalId: withdrawal.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.warn('Transfer failed webhook: withdrawal failed, beg reopened', {
      withdrawalId: withdrawal.id,
      transferReference,
      failureReason,
    });

    WithdrawalAuditService.recordFailed(
      {
        withdrawalId: withdrawal.id,
        userId: withdrawal.userId,
        begId: withdrawal.begId,
        transferReference,
        amountToReceive: parseFloat(withdrawal.amountToReceive.toString()),
        status: 'failed',
      },
      {
        internalReason: failureReason,
        source: 'flutterwave_webhook',
        flutterwavePayload,
      }
    );
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

      WithdrawalAuditService.recordCreated({
        withdrawalId: withdrawal.id,
        userId,
        begId,
        amountToReceive: fees.amountToReceive,
        status: 'pending',
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

        const afterFailure = await prisma.withdrawal.findUnique({
          where: { id: withdrawal.id },
          select: {
            status: true,
            failureReason: true,
            transferReference: true,
          },
        });
        if (
          afterFailure?.status === 'failed' &&
          afterFailure.failureReason
        ) {
          WithdrawalAuditService.recordFailed(
            {
              withdrawalId: withdrawal.id,
              userId,
              begId,
              transferReference: afterFailure.transferReference,
              amountToReceive: fees.amountToReceive,
              status: afterFailure.status,
            },
            {
              internalReason: afterFailure.failureReason,
              source: 'user_request',
            }
          );
        }

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
    let begClosedThisRun = false;

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
              amountRequested: true,
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
        const onHoldReason = 'Account suspended or under investigation';
        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: 'on_hold',
            failureReason: onHoldReason,
          },
        });
        WithdrawalAuditService.recordOnHold(
          {
            withdrawalId,
            userId: withdrawal.userId,
            begId: withdrawal.begId,
            amountToReceive: parseFloat(withdrawal.amountToReceive.toString()),
            status: 'on_hold',
          },
          onHoldReason
        );
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

      const amountToReceive = parseFloat(withdrawal.amountToReceive.toString());
      const raised = parseFloat(withdrawal.beg.amountRaised.toString());
      const requested = parseFloat(withdrawal.beg.amountRequested.toString());

      const transferAccountNumber =
        decryptText(withdrawal.bankAccount.accountNumberEncrypted) ??
        withdrawal.bankAccount.accountNumber;

      const transferResponse = await axios.post(
        `${FLW_BASE_URL}/transfers`,
        {
          account_bank: withdrawal.bankAccount.bankCode,
          account_number: transferAccountNumber,
          amount: amountToReceive,
          narration: `Plz withdrawal — ${buildBegTitle(
            withdrawal.beg.category,
            withdrawal.beg.description
          )}`,
          currency: 'NGN',
          reference,
          debit_currency: 'NGN',
        },
        { headers: getHeaders(), timeout: 30000 }
      );

      const transferDataStatus = String(
        transferResponse.data?.data?.status ?? ''
      ).toUpperCase();
      const transferAccepted =
        transferResponse.data?.status === 'success' &&
        (transferDataStatus === 'SUCCESSFUL' || transferDataStatus === 'NEW');

      if (!transferAccepted) {
        const internalReason = extractInternalTransferFailureReason(
          transferResponse.data?.message || transferResponse.data
        );

        logger.warn('Flutterwave transfer rejected', {
          withdrawalId,
          internalReason,
        });

        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: { status: 'failed', failureReason: internalReason },
        });

        WithdrawalAuditService.recordFailed(
          {
            withdrawalId,
            userId: withdrawal.userId,
            begId: withdrawal.begId,
            amountToReceive,
            status: 'failed',
          },
          {
            internalReason,
            source: 'flutterwave_sync',
            flutterwavePayload: transferResponse.data,
          }
        );

        await this.sendWithdrawalFailureEmail(withdrawal, internalReason);
        throw new Error(WITHDRAWAL_TRANSFER_FAILURE_USER_MESSAGE);
      }

      const isImmediateSuccess = transferDataStatus === 'SUCCESSFUL';
      const endStatus = this.computeClosedBegStatus(raised, requested);

      const updatedWithdrawal = await prisma.$transaction(async (tx) => {
        const updated = await tx.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            transferReference: reference,
            status: isImmediateSuccess ? 'completed' : 'processing',
            autoProcessed,
            ...(isImmediateSuccess ? { processedAt: new Date() } : {}),
          },
        });

        await tx.beg.update({
          where: { id: withdrawal.begId },
          data: {
            isWithdrawn: true,
            withdrawnAt: new Date(),
            status: endStatus,
          },
        });

        return updated;
      });

      begClosedThisRun = true;

      if (isImmediateSuccess) {
        try {
          await this.sendWithdrawalSuccessEmail(withdrawal, reference);
        } catch (emailError: unknown) {
          logger.error('Withdrawal success email failed', {
            withdrawalId,
            error:
              emailError instanceof Error
                ? emailError.message
                : String(emailError),
          });
        }
      }

      logger.info('Withdrawal transfer initiated via Flutterwave', {
        withdrawalId,
        reference,
        amount: amountToReceive,
        transferStatus: transferDataStatus,
        begClosed: true,
      });

      const auditCtx = {
        withdrawalId,
        userId: withdrawal.userId,
        begId: withdrawal.begId,
        transferReference: reference,
        amountToReceive,
        status: updatedWithdrawal.status,
      };
      WithdrawalAuditService.recordTransferInitiated(auditCtx, transferDataStatus);
      if (isImmediateSuccess) {
        WithdrawalAuditService.recordCompleted(auditCtx);
      }

      return updatedWithdrawal;
    } catch (error: any) {
      logger.error('Withdrawal processing failed', {
        error: error.response?.data || error.message,
        withdrawalId,
        begClosedThisRun,
      });

      const current = await prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        select: { status: true, transferReference: true, begId: true },
      });

      // Async transfer already accepted — webhook will finalize or reopen.
      if (current?.status === 'processing' && current.transferReference) {
        throw new Error(WITHDRAWAL_TRANSFER_FAILURE_USER_MESSAGE);
      }

      if (
        current &&
        !['completed', 'failed', 'on_hold'].includes(current.status)
      ) {
        const internalReason = extractInternalTransferFailureReason(error);
        logger.warn('Withdrawal processing failed', {
          withdrawalId,
          internalReason,
        });
        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: 'failed',
            failureReason: internalReason,
          },
        });

        const failedRow = await prisma.withdrawal.findUnique({
          where: { id: withdrawalId },
          select: {
            userId: true,
            begId: true,
            transferReference: true,
            amountToReceive: true,
          },
        });
        if (failedRow) {
          WithdrawalAuditService.recordFailed(
            {
              withdrawalId,
              userId: failedRow.userId,
              begId: failedRow.begId,
              transferReference: failedRow.transferReference,
              amountToReceive: parseFloat(failedRow.amountToReceive.toString()),
              status: 'failed',
            },
            {
              internalReason,
              source: autoProcessed ? 'user_request' : 'admin_process',
              flutterwavePayload: error.response?.data,
            }
          );
        }
      }

      if (begClosedThisRun && current?.begId) {
        await this.reopenBegAfterFailedWithdrawal(current.begId);
      }

      throw new Error(toUserWithdrawalRequestMessage(error));
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
          failure_reason:
            w.failureReason && ['failed', 'rejected', 'on_hold'].includes(w.status)
              ? toUserWithdrawalFailureDisplay(w.failureReason)
              : null,
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
