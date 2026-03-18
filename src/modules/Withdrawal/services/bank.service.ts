import prisma from '../../../config/database';
import axios from 'axios';
import logger from '../../../config/logger';

interface NigerianBank {
  name: string;
  code: string;
  slug: string;
}

export class BankService {
  private static PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
  private static BASE_URL = 'https://api.paystack.co';

  /**
   * Get list of Nigerian banks from Paystack
   */
  static async getNigerianBanks(): Promise<NigerianBank[]> {
    try {
      const response = await axios.get(`${this.BASE_URL}/bank?country=nigeria`, {
        headers: {
          Authorization: `Bearer ${this.PAYSTACK_SECRET}`,
        },
      });

      const banks = response.data.data.map((bank: any) => ({
        name: bank.name,
        code: bank.code,
        slug: bank.slug,
      }));

      return banks;
    } catch (error: any) {
      logger.error('Failed to fetch Nigerian banks', {
        error: error.response?.data || error.message,
      });
      throw new Error('Failed to fetch banks');
    }
  }

  /**
   * Verify bank account with Paystack
   */
  static async verifyBankAccount(
    accountNumber: string,
    bankCode: string
  ): Promise<{
    accountName: string;
    accountNumber: string;
    bankCode: string;
  }> {
    try {
      const response = await axios.get(
        `${this.BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.PAYSTACK_SECRET}`,
          },
        }
      );

      const data = response.data.data;

      logger.info('Bank account verified', {
        accountNumber,
        accountName: data.account_name,
      });

      return {
        accountName: data.account_name,
        accountNumber: data.account_number,
        bankCode: bankCode,
      };
    } catch (error: any) {
      logger.error('Bank verification failed', {
        error: error.response?.data || error.message,
        accountNumber,
        bankCode,
      });
      throw new Error(
        error.response?.data?.message || 'Could not verify bank account'
      );
    }
  }

  /**
   * Add bank account for user
   */
  static async addBankAccount(
    userId: string,
    accountNumber: string,
    bankCode: string
  ): Promise<any> {
    try {
      // Verify account first
      const verified = await this.verifyBankAccount(accountNumber, bankCode);

      // Get bank name
      const banks = await this.getNigerianBanks();
      const bank = banks.find((b) => b.code === bankCode);

      if (!bank) {
        throw new Error('Invalid bank code');
      }

      // Check if account already exists
      const existing = await prisma.bankAccount.findFirst({
        where: {
          userId,
          accountNumber,
        },
      });

      if (existing) {
        throw new Error('Bank account already added');
      }

      // Check if user has any bank accounts
      const hasDefault = await prisma.bankAccount.findFirst({
        where: { userId, isDefault: true },
      });

      // Create bank account
      const bankAccount = await prisma.bankAccount.create({
        data: {
          userId,
          accountNumber: verified.accountNumber,
          accountName: verified.accountName,
          bankCode: verified.bankCode,
          bankName: bank.name,
          isVerified: true,
          isDefault: !hasDefault, // First account is default
        },
      });

      logger.info('Bank account added', {
        userId,
        accountNumber: bankAccount.accountNumber,
        bankName: bankAccount.bankName,
      });

      return bankAccount;
    } catch (error: any) {
      logger.error('Failed to add bank account', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user's bank accounts
   */
  static async getUserBankAccounts(userId: string): Promise<any[]> {
    try {
      const accounts = await prisma.bankAccount.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          accountNumber: true,
          accountName: true,
          bankCode: true,
          bankName: true,
          isVerified: true,
          isDefault: true,
          createdAt: true,
        },
      });

      return accounts;
    } catch (error: any) {
      logger.error('Failed to get bank accounts', {
        error: error.message,
        userId,
      });
      return [];
    }
  }

  /**
   * Set default bank account
   */
  static async setDefaultBankAccount(userId: string, accountId: string): Promise<void> {
    try {
      // Verify account belongs to user
      const account = await prisma.bankAccount.findFirst({
        where: { id: accountId, userId },
      });

      if (!account) {
        throw new Error('Bank account not found');
      }

      // Remove default from all accounts
      await prisma.bankAccount.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      // Set new default
      await prisma.bankAccount.update({
        where: { id: accountId },
        data: { isDefault: true },
      });

      logger.info('Default bank account updated', { userId, accountId });
    } catch (error: any) {
      logger.error('Failed to set default bank account', {
        error: error.message,
        userId,
        accountId,
      });
      throw error;
    }
  }

  /**
   * Delete bank account
   */
  static async deleteBankAccount(userId: string, accountId: string): Promise<void> {
    try {
      const account = await prisma.bankAccount.findFirst({
        where: { id: accountId, userId },
      });

      if (!account) {
        throw new Error('Bank account not found');
      }

      // Check if account has pending withdrawals
      const pendingWithdrawals = await prisma.withdrawal.count({
        where: {
          bankAccountId: accountId,
          status: { in: ['pending', 'processing'] },
        },
      });

      if (pendingWithdrawals > 0) {
        throw new Error('Cannot delete account with pending withdrawals');
      }

      await prisma.bankAccount.delete({
        where: { id: accountId },
      });

      // If deleted account was default, set another as default
      if (account.isDefault) {
        const firstAccount = await prisma.bankAccount.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });

        if (firstAccount) {
          await prisma.bankAccount.update({
            where: { id: firstAccount.id },
            data: { isDefault: true },
          });
        }
      }

      logger.info('Bank account deleted', { userId, accountId });
    } catch (error: any) {
      logger.error('Failed to delete bank account', {
        error: error.message,
        userId,
        accountId,
      });
      throw error;
    }
  }
}