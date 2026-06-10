import axios from 'axios';
import prisma from '../../../config/database';
import logger from '../../../config/logger';

const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

// ============================================
// PLATFORM FEE SPLIT
// Plz takes 7% + VAT (7.5% of 7%) = 7.525%
// Beneficiary receives 92.475%
// ============================================
export const PLATFORM_FEE_RATE = 0.07;           // 7%
export const VAT_RATE = 0.075;                    // 7.5% of platform fee
export const PLATFORM_FEE_TOTAL =
  PLATFORM_FEE_RATE + PLATFORM_FEE_RATE * VAT_RATE; // 7.525%
export const BENEFICIARY_RATE = 1 - PLATFORM_FEE_TOTAL; // 92.475%

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
});

export class SubaccountService {

  // ============================================
  // CREATE SUBACCOUNT
  // Called when user adds a bank account
  // Flutterwave will auto-split payments:
  // → 7.525% to Plz
  // → 92.475% to this subaccount
  // ============================================
  static async createSubaccount(params: {
    userId: string;
    accountNumber: string;
    bankCode: string;
    accountName: string;
    email: string;
    phoneNumber?: string;
  }): Promise<string | null> {
    try {
      const response = await axios.post(
        `${FLW_BASE_URL}/subaccounts`,
        {
          account_bank: params.bankCode,
          account_number: params.accountNumber,
          business_name: params.accountName,
          business_email: params.email,
          business_contact: params.accountName,
          business_contact_mobile: params.phoneNumber || '',
          business_mobile: params.phoneNumber || '',
          country: 'NG',
          split_type: 'percentage',
          split_value: BENEFICIARY_RATE,  // 0.92475
        },
        { headers: getHeaders(), timeout: 30000 }
      );

      if (
        response.data?.status !== 'success' ||
        !response.data?.data?.subaccount_id
      ) {
        logger.error('Failed to create Flutterwave subaccount', {
          response: response.data,
          userId: params.userId,
        });
        return null;
      }

      const subaccountId = response.data.data.subaccount_id;

      logger.info('Flutterwave subaccount created', {
        userId: params.userId,
        subaccountId,
      });

      return subaccountId;
    } catch (error: any) {
      logger.error('Subaccount creation failed', {
        error: error.response?.data || error.message,
        userId: params.userId,
      });
      return null;
    }
  }

  // ============================================
  // GET SUBACCOUNT FOR USER
  // Returns subaccountId from their bank account
  // ============================================
  static async getSubaccountForUser(userId: string): Promise<string | null> {
    try {
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { userId, isDefault: true, flwSubaccountId: { not: null } },
        select: { flwSubaccountId: true },
      });

      return bankAccount?.flwSubaccountId || null;
    } catch (error: any) {
      logger.error('Failed to get subaccount for user', {
        error: error.message,
        userId,
      });
      return null;
    }
  }

  // ============================================
  // CALCULATE SPLIT
  // Returns platform fee and beneficiary amount
  // ============================================
  static calculateSplit(amount: number): {
    platformFee: number;
    vatFee: number;
    totalFee: number;
    beneficiaryAmount: number;
  } {
    const platformFee = Math.round(amount * PLATFORM_FEE_RATE * 100) / 100;
    const vatFee = Math.round(platformFee * VAT_RATE * 100) / 100;
    const totalFee = platformFee + vatFee;
    const beneficiaryAmount = amount - totalFee;

    return { platformFee, vatFee, totalFee, beneficiaryAmount };
  }
}