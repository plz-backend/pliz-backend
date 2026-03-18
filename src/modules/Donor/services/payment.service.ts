import axios from 'axios';
import crypto from 'crypto';
import logger from '../../../config/logger';

export class PaymentService {
  private static BASE_URL = 'https://api.paystack.co';
  private static SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

  private static get headers() {
    return {
      Authorization: `Bearer ${this.SECRET_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Initialize payment with Paystack
   * Returns authorization URL - donor is redirected here to pay
   */
  static async initializePayment(data: {
    email: string;
    amount: number;
    reference: string;
    begId: string;
    donorId?: string;
    isAnonymous: boolean;
  }): Promise<{
    success: boolean;
    authorizationUrl?: string;
    reference: string;
    error?: string;
  }> {
    try {
      const response = await axios.post(
        `${this.BASE_URL}/transaction/initialize`,
        {
          email: data.email,
          amount: Math.round(data.amount * 100), // Naira to kobo
          reference: data.reference,
          callback_url: `${process.env.BASE_URL}/api/donations/verify`,
          channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
          metadata: {
            beg_id: data.begId,
            donor_id: data.donorId,
            is_anonymous: data.isAnonymous,
          },
        },
        { headers: this.headers }
      );

      logger.info('Paystack payment initialized', {
        reference: data.reference,
        begId: data.begId,
        amount: data.amount,
      });

      return {
        success: true,
        authorizationUrl: response.data.data.authorization_url,
        reference: data.reference,
      };
    } catch (error: any) {
      logger.error('Paystack initialization failed', {
        error: error.response?.data || error.message,
        reference: data.reference,
      });

      return {
        success: false,
        reference: data.reference,
        error: 'Payment gateway error. Please try again.',
      };
    }
  }

  /**
   * Verify payment with Paystack
   * Called on redirect after donor completes payment
   */
  static async verifyPayment(reference: string): Promise<{
    status: string;
    amount: number;
    begId: string;
    donorId: string;
    isAnonymous: boolean;
    paymentMethod: string;
  }> {
    try {
      const response = await axios.get(
        `${this.BASE_URL}/transaction/verify/${reference}`,
        { headers: this.headers }
      );

      const data = response.data.data;

      logger.info('Paystack payment verified', {
        reference,
        status: data.status,
        amount: data.amount / 100,
      });

      return {
        status: data.status,               // 'success' | 'failed' | 'abandoned'
        amount: data.amount / 100,         // kobo back to Naira
        begId: data.metadata.beg_id,
        donorId: data.metadata.donor_id,
        isAnonymous: data.metadata.is_anonymous,
        paymentMethod: data.channel,       // 'card' | 'bank' | 'ussd'
      };
    } catch (error: any) {
      logger.error('Paystack verification failed', {
        error: error.response?.data || error.message,
        reference,
      });
      throw new Error('Failed to verify payment');
    }
  }

  /**
   * Verify webhook signature is genuinely from Paystack
   */
  static verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha512', this.SECRET_KEY)
      .update(rawBody)
      .digest('hex');
    return hash === signature;
  }
}