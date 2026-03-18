import prisma from '../../../config/database';
import axios from 'axios';
import logger from '../../../config/logger';
import { WithdrawalEmailService } from './withdrawal_email.service'; // Import email service

const COMPANY_FEE_RATE = 0.05; // 5%
const VAT_RATE = 0.075; // 7.5%

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

    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

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
   * Request withdrawal (with auto-processing)
   */
  static async requestWithdrawal(
    userId: string,
    begId: string,
    bankAccountId?: string
  ): Promise<any> {
    try {
      // Check if user can withdraw
      const canWithdraw = await this.canUserWithdraw(userId);
      if (!canWithdraw.allowed) {
        throw new Error(canWithdraw.reason);
      }

      // Get beg details
      const beg = await prisma.beg.findUnique({
        where: { id: begId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              profile: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      });

      if (!beg) {
        throw new Error('Beg not found');
      }

      // Verify ownership
      if (beg.userId !== userId) {
        throw new Error('You can only withdraw from your own requests');
      }

      // Check if beg is funded
      if (beg.status !== 'funded') {
        throw new Error('Request must be fully funded to withdraw');
      }

      // Check if already withdrawn
      const existingWithdrawal = await prisma.withdrawal.findFirst({
        where: {
          begId,
          status: { in: ['pending', 'processing', 'completed'] },
        },
      });

      if (existingWithdrawal) {
        throw new Error('Withdrawal already requested for this beg');
      }

      // Get bank account
      let bankAccount;
      if (bankAccountId) {
        bankAccount = await prisma.bankAccount.findFirst({
          where: { id: bankAccountId, userId },
        });
      } else {
        // Use default bank account
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

      // Calculate fees
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
              title: true,
              amountRaised: true,
            },
          },
        },
      });

      logger.info('Withdrawal requested', {
        withdrawalId: withdrawal.id,
        userId,
        begId,
        amountToReceive: fees.amountToReceive,
      });

      // ✅ AUTO-PROCESS WITHDRAWAL IMMEDIATELY
      try {
        await this.processWithdrawal(withdrawal.id, true);

        return await prisma.withdrawal.findUnique({
          where: { id: withdrawal.id },
          include: {
            bankAccount: true,
            beg: { select: { title: true } },
          },
        });
      } catch (autoProcessError: any) {
        logger.warn('Auto-processing failed, withdrawal pending manual processing', {
          withdrawalId: withdrawal.id,
          error: autoProcessError.message,
        });

        // ✅ Send pending email
        const recipientName = beg.user.profile?.displayName || beg.user.username;
        await WithdrawalEmailService.sendPendingEmail(beg.user.email, {
          recipientName,
          amount: Number(withdrawal.amountToReceive),
          begTitle: beg.title || 'Your request',
          bankName: bankAccount.bankName,
          accountNumber: bankAccount.accountNumber,
        });

        // Return withdrawal in pending state
        return withdrawal;
      }
    } catch (error: any) {
      logger.error('Withdrawal request failed', {
        error: error.message,
        userId,
        begId,
      });
      throw error;
    }
  }

  /**
   * Process withdrawal (manual or automatic)
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
              profile: {
                select: {
                  displayName: true,
                },
              },
            },
          },
          bankAccount: true,
          beg: {
            select: {
              id: true,
              title: true,
              amountRaised: true,
            },
          },
        },
      });

      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }

      if (withdrawal.status !== 'pending') {
        throw new Error(`Withdrawal is already ${withdrawal.status}`);
      }

      // Double-check user status
      if (withdrawal.user.isSuspended || withdrawal.user.isUnderInvestigation) {
        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: 'on_hold',
            failureReason: 'Account is suspended or under investigation',
          },
        });
        throw new Error('User account is suspended or under investigation');
      }

      // Update status to processing
      await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: 'processing' },
      });

      // Generate transfer reference
      const reference = `WTH-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)
        .toUpperCase()}`;

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
        const failureReason =
          recipientResponse.data.message || 'Failed to create transfer recipient';

        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: 'failed',
            failureReason,
          },
        });

        // ✅ Send failure email
        const recipientName = withdrawal.user.profile?.displayName || withdrawal.user.username;
        await WithdrawalEmailService.sendFailureEmail(withdrawal.user.email, {
          recipientName,
          amount: Number(withdrawal.amountToReceive),
          bankName: withdrawal.bankAccount.bankName,
          accountNumber: withdrawal.bankAccount.accountNumber,
          failureReason,
          begTitle: withdrawal.beg.title || 'Your request',
          supportEmail: process.env.SUPPORT_EMAIL || 'support@pliz.app',
        });

        throw new Error(failureReason);
      }

      const recipientCode = recipientResponse.data.data.recipient_code;

      // Initiate transfer
      const transferResponse = await axios.post(
        `${this.BASE_URL}/transfer`,
        {
          source: 'balance',
          amount: Math.round(parseFloat(withdrawal.amountToReceive.toString()) * 100), // Convert to kobo
          recipient: recipientCode,
          reason: `Withdrawal for beg ${withdrawal.begId}`,
          reference: reference,
        },
        {
          headers: {
            Authorization: `Bearer ${this.PAYSTACK_SECRET}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!transferResponse.data.status) {
        const failureReason =
          transferResponse.data.message || 'Transfer initiation failed';

        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: 'failed',
            failureReason,
          },
        });

        // ✅ Send failure email
        const recipientName = withdrawal.user.profile?.displayName || withdrawal.user.username;
        await WithdrawalEmailService.sendFailureEmail(withdrawal.user.email, {
          recipientName,
          amount: Number(withdrawal.amountToReceive),
          bankName: withdrawal.bankAccount.bankName,
          accountNumber: withdrawal.bankAccount.accountNumber,
          failureReason,
          begTitle: withdrawal.beg.title || 'Your request',
          supportEmail: process.env.SUPPORT_EMAIL || 'support@pliz.app',
        });

        throw new Error(failureReason);
      }

      // Update withdrawal with transfer reference
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
        data: {
          isWithdrawn: true,
          withdrawnAt: new Date(),
        },
      });

      // ✅ Send success email
      const recipientName = withdrawal.user.profile?.displayName || withdrawal.user.username;
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
        begTitle: withdrawal.beg.title || 'Your request',
        processedAt: new Date(),
      });

      logger.info('Withdrawal processed successfully', {
        withdrawalId,
        reference,
        amount: withdrawal.amountToReceive,
        autoProcessed,
        emailSent: withdrawal.user.email,
      });

      return updatedWithdrawal;
    } catch (error: any) {
      logger.error('Withdrawal processing failed', {
        error: error.response?.data || error.message,
        withdrawalId,
      });

      // Update status to failed
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
                title: true,
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
        withdrawals: withdrawals.map((w) => ({
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
            title: w.beg.title,
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
      logger.error('Failed to get withdrawals', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }
}