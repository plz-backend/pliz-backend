import prisma from '../../../config/database';
import axios from 'axios';
import logger from '../../../config/logger';

interface NigerianBank {
  name: string;
  code: string;
  slug: string;
}

const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
});

export class BankService {

  // ============================================
  // GET NIGERIAN BANKS
  // ============================================
  static async getNigerianBanks(): Promise<NigerianBank[]> {
    try {
      const response = await axios.get(
        `${FLW_BASE_URL}/banks/NG`,
        { headers: getHeaders(), timeout: 15000 }
      );

      if (response.data?.status !== 'success') {
        throw new Error('Failed to fetch banks from Flutterwave');
      }

      const banks: NigerianBank[] = response.data.data.map((bank: any) => ({
        name: bank.name,
        code: bank.code,
        slug: bank.name.toLowerCase().replace(/\s+/g, '-'),
      }));

      logger.info('Nigerian banks fetched', { count: banks.length });

      return banks;
    } catch (error: any) {
      logger.error('Failed to fetch Nigerian banks', {
        error: error.response?.data || error.message,
      });
      throw new Error('Failed to fetch banks');
    }
  }

  // ============================================
  // VERIFY BANK ACCOUNT
  // ============================================
  static async verifyBankAccount(
    accountNumber: string,
    bankCode: string
  ): Promise<{
    accountName: string;
    accountNumber: string;
    bankCode: string;
  }> {
    try {
      const response = await axios.post(
        `${FLW_BASE_URL}/accounts/resolve`,
        {
          account_number: accountNumber,
          account_bank: bankCode,
        },
        { headers: getHeaders(), timeout: 15000 }
      );

      if (response.data?.status !== 'success') {
        throw new Error(
          response.data?.message || 'Could not verify bank account'
        );
      }

      const data = response.data.data;

      logger.info('Bank account verified via Flutterwave', {
        accountNumber,
        accountName: data.account_name,
      });

      return {
        accountName: data.account_name,
        accountNumber: data.account_number,
        bankCode,
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

  // ============================================
  // ADD BANK ACCOUNT
  // ============================================
  static async addBankAccount(
    userId: string,
    accountNumber: string,
    bankCode: string
  ): Promise<any> {
    try {
      const verified = await this.verifyBankAccount(accountNumber, bankCode);
      const banks = await this.getNigerianBanks();
      const bank = banks.find((b) => b.code === bankCode);

      if (!bank) throw new Error('Invalid bank code');

      const existing = await prisma.bankAccount.findFirst({
        where: { userId, accountNumber },
      });

      if (existing) throw new Error('Bank account already added');

      const hasDefault = await prisma.bankAccount.findFirst({
        where: { userId, isDefault: true },
      });

      const bankAccount = await prisma.bankAccount.create({
        data: {
          userId,
          accountNumber: verified.accountNumber,
          accountName: verified.accountName,
          bankCode: verified.bankCode,
          bankName: bank.name,
          isVerified: true,
          isDefault: !hasDefault,
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
        error: error.message, userId,
      });
      throw error;
    }
  }

  // ============================================
  // GET USER BANK ACCOUNTS
  // ============================================
  static async getUserBankAccounts(userId: string): Promise<any[]> {
    try {
      return await prisma.bankAccount.findMany({
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
    } catch (error: any) {
      logger.error('Failed to get bank accounts', {
        error: error.message, userId,
      });
      return [];
    }
  }

  // ============================================
  // SET DEFAULT BANK ACCOUNT
  // ============================================
  static async setDefaultBankAccount(
    userId: string,
    accountId: string
  ): Promise<void> {
    try {
      const account = await prisma.bankAccount.findFirst({
        where: { id: accountId, userId },
      });

      if (!account) throw new Error('Bank account not found');

      await prisma.bankAccount.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      await prisma.bankAccount.update({
        where: { id: accountId },
        data: { isDefault: true },
      });

      logger.info('Default bank account updated', { userId, accountId });
    } catch (error: any) {
      logger.error('Failed to set default bank account', {
        error: error.message, userId, accountId,
      });
      throw error;
    }
  }

  // ============================================
  // DELETE BANK ACCOUNT
  // ============================================
  static async deleteBankAccount(
    userId: string,
    accountId: string
  ): Promise<void> {
    try {
      const account = await prisma.bankAccount.findFirst({
        where: { id: accountId, userId },
      });

      if (!account) throw new Error('Bank account not found');

      const pendingWithdrawals = await prisma.withdrawal.count({
        where: {
          bankAccountId: accountId,
          status: { in: ['pending', 'processing'] },
        },
      });

      if (pendingWithdrawals > 0) {
        throw new Error('Cannot delete account with pending withdrawals');
      }

      await prisma.bankAccount.delete({ where: { id: accountId } });

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
        error: error.message, userId, accountId,
      });
      throw error;
    }
  }
}