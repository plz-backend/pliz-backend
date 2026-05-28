import axios from 'axios';
import logger from '../../../config/logger';

const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
});

export class PaymentService {

  // ============================================
  // INITIALIZE PAYMENT
  // ============================================
  static async initializePayment(data: {
    email: string;
    amount: number;
    reference: string;
    begId: string;
    donorId?: string | null;
    isAnonymous: boolean;
    redirectUrl?: string;
  }): Promise<{
    success: boolean;
    paymentUrl?: string;
    reference: string;
    error?: string;
  }> {
    try {
      const redirectUrl =
        data.redirectUrl?.trim() ||
        `${process.env.FRONTEND_URL}/donations/verify`;

      const response = await axios.post(
        `${FLW_BASE_URL}/payments`,
        {
          tx_ref: data.reference,
          amount: data.amount,
          currency: 'NGN',
          redirect_url: redirectUrl,
          payment_options: 'card,banktransfer,ussd',
          customer: {
            email: data.email,
          },
          customizations: {
            title: 'Plz',
            description: 'Support a request on Plz',
            logo: `${process.env.FRONTEND_URL}/logo.png`,
          },
          meta: {
            beg_id: data.begId,
            donor_id: data.donorId || 'guest',
            is_anonymous: data.isAnonymous,
            source: 'plz_app',
          },
        },
        { headers: getHeaders(), timeout: 30000 }
      );

      if (
        response.data?.status !== 'success' ||
        !response.data?.data?.link
      ) {
        return {
          success: false,
          reference: data.reference,
          error: response.data?.message || 'Failed to initialize payment',
        };
      }

      logger.info('Flutterwave payment initialized', {
        reference: data.reference,
        begId: data.begId,
        amount: data.amount,
      });

      return {
        success: true,
        paymentUrl: response.data.data.link,
        reference: data.reference,
      };
    } catch (error: any) {
      logger.error('Flutterwave initialization failed', {
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

  // ============================================
  // VERIFY TRANSACTION
  // ============================================
  static async verifyTransaction(transactionId: string): Promise<{
    success: boolean;
    verified: boolean;
    data?: {
      amount: number;
      currency: string;
      txRef: string;
      flwRef: string;
      status: string;
      paymentMethod: string;
      customerEmail: string;
      meta?: any;
    };
    error?: string;
  }> {
    try {
      const response = await axios.get(
        `${FLW_BASE_URL}/transactions/${transactionId}/verify`,
        { headers: getHeaders(), timeout: 30000 }
      );

      if (response.data?.status !== 'success') {
        return {
          success: false,
          verified: false,
          error: response.data?.message || 'Transaction verification failed',
        };
      }

      const transaction = response.data.data;
      const isSuccessful = transaction.status === 'successful';

      logger.info('Flutterwave transaction verified', {
        transactionId,
        txRef: transaction.tx_ref,
        status: transaction.status,
        amount: transaction.amount,
      });

      return {
        success: true,
        verified: isSuccessful,
        data: {
          amount: transaction.amount,
          currency: transaction.currency,
          txRef: transaction.tx_ref,
          flwRef: transaction.flw_ref,
          status: transaction.status,
          paymentMethod: transaction.payment_type,
          customerEmail: transaction.customer?.email,
          meta: transaction.meta,
        },
      };
    } catch (error: any) {
      logger.error('Flutterwave verification failed', {
        error: error.response?.data || error.message,
        transactionId,
      });
      return {
        success: false,
        verified: false,
        error: error.response?.data?.message || 'Failed to verify transaction',
      };
    }
  }

  // ============================================
  // GET TRANSACTION BY TX_REF
  // ============================================
  static async getTransactionByRef(txRef: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await axios.get(
        `${FLW_BASE_URL}/transactions?tx_ref=${txRef}`,
        { headers: getHeaders(), timeout: 30000 }
      );

      if (
        response.data?.status !== 'success' ||
        !response.data?.data?.length
      ) {
        return { success: false, error: 'Transaction not found' };
      }

      return { success: true, data: response.data.data[0] };
    } catch (error: any) {
      logger.error('Flutterwave get transaction by ref failed', {
        error: error.response?.data || error.message,
        txRef,
      });
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to get transaction',
      };
    }
  }

  // ============================================
  // VERIFY WEBHOOK SIGNATURE
  // ============================================
  static verifyWebhookSignature(signature: string): boolean {
    return signature === process.env.FLW_WEBHOOK_HASH;
  }
}