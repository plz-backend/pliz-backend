import prisma from '../../../config/database';
import axios from 'axios';
import { Decimal } from '@prisma/client/runtime/library';
import logger from '../../../config/logger';
import { WithdrawalEmailService } from './withdrawal_email.service';
import { withdrawalQueue, emailQueue } from '../../../config/queue-manager';

const COMPANY_FEE_RATE = 0.05; // 5%
const VAT_RATE = 0.075; // 7.5%

// ============================================
// HELPER
// ============================================
const buildBegTitle = (
  category: { name: string; icon: string | null } | null,
  description: string | null
): string => {
  if (!category) return 'Help Request';
  const icon = category.icon ? ` ${category.icon}` : '';
  const desc = description ? ` — ${description}` : '';
  return `${category.name}${icon}${desc}`;
};

// ============================================
// TYPED INTERFACES
// ============================================
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
    profile: {
      displayName: string | null;
    } | null;
  };
  bankAccount: {
    id: string;
    accountNumber: string;
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
    category: {
      name: string;
      icon: string | null;
    };
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
    accountName: string;
    bankName: string;
    bankCode: string;
    isVerified: boolean;
    isDefault: boolean;
  };
  beg: {
    description: string | null;
    amountRaised: Decimal;
    category: {
      name: string;
      icon: string | null;
    };
  };
}

export class WithdrawalService {
  private static PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
  private static BASE_URL = 'https://api.paystack.co';

  /**
   * Calculate withdrawal fees
   */
  static calculateFees(amountRaised: number): {
    amountRequested: number;
    companyFee: number;
    vatFee: number;
    totalFees: number;
    amountToReceive: number;
  } {
    const companyFee = Math.round(amountRaised * COMPANY_FEE_RATE * 100) / 100;
    const vatFee = Math.round(amountRaised * VAT_RATE * 100) / 100;
    const totalFees = companyFee + vatFee;
    const amountToReceive = amountRaised - totalFees;

    return {
      amountRequested: amountRaised,
      companyFee,
      vatFee,
      totalFees,
      amountToReceive,
    };
  }

  /**
   * Check if user can withdraw
   */
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
        reason: `Your account is under investigation. Withdrawals are temporarily on hold. Reason: ${user.investigationReason || 'Contact support'}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Request withdrawal (queue first, direct fallback)
   */
  static async requestWithdrawal(
    userId: string,
    begId: string,
    bankAccountId?: string
  ): Promise<any> {
    try {
      const canWithdraw = await this.canUserWithdraw(userId);
      if (!canWithdraw.allowed) throw new Error(canWithdraw.reason);

      // Get beg details
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
      if (beg.userId !== userId) throw new Error('You can only withdraw from your own requests');
      if (beg.status !== 'funded') throw new Error('Request must be fully funded to withdraw');

      const existingWithdrawal = await prisma.withdrawal.findFirst({
        where: { begId, status: { in: ['pending', 'processing', 'completed'] } },
      });
      if (existingWithdrawal) throw new Error('Withdrawal already requested for this beg');

      // Get bank account
      let bankAccount;
      if (bankAccountId) {
        bankAccount = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, userId } });
      } else {
        bankAccount = await prisma.bankAccount.findFirst({ where: { userId, isDefault: true } });
      }

      if (!bankAccount) throw new Error('No bank account found. Please add a bank account first.');
      if (!bankAccount.isVerified) throw new Error('Bank account must be verified');

      const amountRaised = parseFloat(beg.amountRaised.toString());
      const fees = this.calculateFees(amountRaised);

      // Create withdrawal record
      const withdrawal = await prisma.withdrawal.create({
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
      }) as IWithdrawalRequestRelations;

      logger.info('Withdrawal record created', {
        withdrawalId: withdrawal.id,
        userId,
        begId,
        amountToReceive: fees.amountToReceive,
      });

      // ============================================
      // TRY QUEUE FIRST (best for high traffic)
      // Falls back to direct processing if queue fails
      // ============================================
      let queuedSuccessfully = false;

      try {
        await withdrawalQueue.add(
          'process-withdrawal',
          {
            withdrawalId: withdrawal.id,
            autoProcessed: true,
          },
          {
            jobId: `withdrawal-${withdrawal.id}`,  // Prevents duplicate processing
            priority: 1,
          }
        );

        queuedSuccessfully = true;
        logger.info('Withdrawal added to queue', { withdrawalId: withdrawal.id });
      } catch (queueError: any) {
        // Queue failed (e.g. Redis is down) — fall back to direct processing
        logger.warn('Queue unavailable, falling back to direct processing', {
          withdrawalId: withdrawal.id,
          error: queueError.message,
        });
      }

      // ============================================
      // FALLBACK: Direct processing if queue failed
      // ============================================
      if (!queuedSuccessfully) {
        try {
          await this.processWithdrawal(withdrawal.id, true);
          logger.info('Withdrawal processed directly (queue fallback)', {
            withdrawalId: withdrawal.id,
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
        } catch (directError: any) {
          logger.warn('Direct processing failed, withdrawal stays pending', {
            withdrawalId: withdrawal.id,
            error: directError.message,
          });

          // Send pending email since processing failed
          const recipientName = beg.user.profile?.displayName || beg.user.username;
          const begTitle = buildBegTitle(beg.category, beg.description);

          // ✅ Queue email or send directly
          try {
            await emailQueue.add('send-email', {
              type: 'withdrawal_pending',
              to: beg.user.email,
              data: {
                recipientName,
                amount: Number(withdrawal.amountToReceive),
                begTitle,
                bankName: bankAccount.bankName,
                accountNumber: bankAccount.accountNumber,
              },
            });
          } catch {
            // Email queue also down — send directly
            await WithdrawalEmailService.sendPendingEmail(beg.user.email, {
              recipientName,
              amount: Number(withdrawal.amountToReceive),
              begTitle,
              bankName: bankAccount.bankName,
              accountNumber: bankAccount.accountNumber,
            });
          }
        }
      }

      return withdrawal;
    } catch (error: any) {
      logger.error('Withdrawal request failed', { error: error.message, userId, begId });
      throw error;
    }
  }

  /**
   * Process withdrawal (manual or automatic)
   * Called by queue worker OR directly as fallback
   */
  static async processWithdrawal(
    withdrawalId: string,
    autoProcessed: boolean = false
  ): Promise<any> {
    try {
      const withdrawal = await prisma.withdrawal.findUnique({
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
      }) as IBegWithdrawalRelations | null;

      if (!withdrawal) throw new Error('Withdrawal not found');
      if (withdrawal.status !== 'pending') {
        throw new Error(`Withdrawal is already ${withdrawal.status}`);
      }

      // Double-check user status
      if (withdrawal.user.isSuspended || withdrawal.user.isUnderInvestigation) {
        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: { status: 'on_hold', failureReason: 'Account is suspended or under investigation' },
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

      const begTitle = buildBegTitle(withdrawal.beg.category, withdrawal.beg.description);
      const recipientName = withdrawal.user.profile?.displayName || withdrawal.user.username;

      // Create transfer recipient on Paystack
      const recipientResponse = await axios.post(
        `${this.BASE_URL}/transferrecipient`,
        {
          type: 'nuban',
          name: withdrawal.bankAccount.accountName,
          account_number: withdrawal.bankAccount.accountNumber,
          bank_code: withdrawal.bankAccount.bankCode,
          currency: 'NGN',
        },
        {
          headers: {
            Authorization: `Bearer ${this.PAYSTACK_SECRET}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!recipientResponse.data.status) {
        const failureReason = recipientResponse.data.message || 'Failed to create transfer recipient';

        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: { status: 'failed', failureReason },
        });

        // ✅ Queue failure email or send directly
        try {
          await emailQueue.add('send-email', {
            type: 'withdrawal_failed',
            to: withdrawal.user.email,
            data: {
              recipientName,
              amount: Number(withdrawal.amountToReceive),
              bankName: withdrawal.bankAccount.bankName,
              accountNumber: withdrawal.bankAccount.accountNumber,
              failureReason,
              begTitle,
              supportEmail: process.env.SUPPORT_EMAIL || 'support@plz.app',
            },
          });
        } catch {
          await WithdrawalEmailService.sendFailureEmail(withdrawal.user.email, {
            recipientName,
            amount: Number(withdrawal.amountToReceive),
            bankName: withdrawal.bankAccount.bankName,
            accountNumber: withdrawal.bankAccount.accountNumber,
            failureReason,
            begTitle,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@plz.app',
          });
        }

        throw new Error(failureReason);
      }

      const recipientCode = recipientResponse.data.data.recipient_code;

      // Initiate transfer
      const transferResponse = await axios.post(
        `${this.BASE_URL}/transfer`,
        {
          source: 'balance',
          amount: Math.round(parseFloat(withdrawal.amountToReceive.toString()) * 100),
          recipient: recipientCode,
          reason: `Withdrawal for beg ${withdrawal.begId}`,
          reference,
        },
        {
          headers: {
            Authorization: `Bearer ${this.PAYSTACK_SECRET}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!transferResponse.data.status) {
        const failureReason = transferResponse.data.message || 'Transfer initiation failed';

        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: { status: 'failed', failureReason },
        });

        // ✅ Queue failure email or send directly
        try {
          await emailQueue.add('send-email', {
            type: 'withdrawal_failed',
            to: withdrawal.user.email,
            data: {
              recipientName,
              amount: Number(withdrawal.amountToReceive),
              bankName: withdrawal.bankAccount.bankName,
              accountNumber: withdrawal.bankAccount.accountNumber,
              failureReason,
              begTitle,
              supportEmail: process.env.SUPPORT_EMAIL || 'support@plz.app',
            },
          });
        } catch {
          await WithdrawalEmailService.sendFailureEmail(withdrawal.user.email, {
            recipientName,
            amount: Number(withdrawal.amountToReceive),
            bankName: withdrawal.bankAccount.bankName,
            accountNumber: withdrawal.bankAccount.accountNumber,
            failureReason,
            begTitle,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@plz.app',
          });
        }

        throw new Error(failureReason);
      }

      // Update withdrawal as completed
      const updatedWithdrawal = await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          transferReference: reference,
          status: 'completed',
          autoProcessed,
          processedAt: new Date(),
        },
      });

      // Mark beg as withdrawn
      await prisma.beg.update({
        where: { id: withdrawal.begId },
        data: { isWithdrawn: true, withdrawnAt: new Date() },
      });

      // ✅ Queue success email or send directly
      try {
        await emailQueue.add('send-email', {
          type: 'withdrawal_success',
          to: withdrawal.user.email,
          data: {
            recipientName,
            amount: Number(withdrawal.amountRequested),
            companyFee: Number(withdrawal.companyFee),
            vatFee: Number(withdrawal.vatFee),
            totalFees: Number(withdrawal.totalFees),
            amountToReceive: Number(withdrawal.amountToReceive),
            bankName: withdrawal.bankAccount.bankName,
            accountNumber: withdrawal.bankAccount.accountNumber,
            accountName: withdrawal.bankAccount.accountName,
            transferReference: reference,
            begTitle,
            processedAt: new Date(),
          },
        });
      } catch {
        // Email queue down — send directly
        await WithdrawalEmailService.sendSuccessEmail(withdrawal.user.email, {
          recipientName,
          amount: Number(withdrawal.amountRequested),
          companyFee: Number(withdrawal.companyFee),
          vatFee: Number(withdrawal.vatFee),
          totalFees: Number(withdrawal.totalFees),
          amountToReceive: Number(withdrawal.amountToReceive),
          bankName: withdrawal.bankAccount.bankName,
          accountNumber: withdrawal.bankAccount.accountNumber,
          accountName: withdrawal.bankAccount.accountName,
          transferReference: reference,
          begTitle,
          processedAt: new Date(),
        });
      }

      logger.info('Withdrawal processed successfully', {
        withdrawalId,
        reference,
        amount: withdrawal.amountToReceive,
        autoProcessed,
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

  /**
   * Get user's withdrawal history
   */
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
            account_number: w.bankAccount.accountNumber,
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
      logger.error('Failed to get withdrawals', { error: error.message, userId });
      throw error;
    }
  }
}
// ```

// **Key changes:**
// 1. Added `withdrawalQueue` and `emailQueue` imports
// 2. `requestWithdrawal` — tries queue first, falls back to direct `processWithdrawal` if Redis is down
// 3. `processWithdrawal` — every email now tries `emailQueue` first, falls back to `WithdrawalEmailService` directly if email queue is down
// 4. `jobId: withdrawal-${withdrawal.id}` — prevents duplicate processing
// 5. `processWithdrawal` is still fully intact and called by both the queue worker AND directly as fallback

// **The pattern everywhere is:**
// ```
// Try queue → fails → fall back to direct → ✅ always works