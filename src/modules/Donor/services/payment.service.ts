import axios from 'axios';
import logger from '../../../config/logger';

const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
});

type VerifiedTransaction = {
  amount: number;
  currency: string;
  txRef: string;
  flwRef: string;
  status: string;
  paymentMethod: string;
  customerEmail: string;
  meta?: unknown;
};

export type PaymentVerificationResult = {
  success: boolean;
  verified: boolean;
  pending?: boolean;
  data?: VerifiedTransaction;
  error?: string;
};

function mapFlutterwaveTransaction(
  transaction: Record<string, unknown>
): VerifiedTransaction {
  const customer = transaction.customer as { email?: string } | undefined;
  return {
    amount: Number(transaction.amount),
    currency: String(transaction.currency ?? 'NGN'),
    txRef: String(transaction.tx_ref),
    flwRef: String(transaction.flw_ref ?? ''),
    status: String(transaction.status),
    paymentMethod: String(transaction.payment_type ?? 'card'),
    customerEmail: customer?.email ?? '',
    meta: transaction.meta,
  };
}

export class PaymentService {

  // ============================================
  // INITIALIZE PAYMENT
  // Full amount settles to Plz main account; fees at withdrawal.
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
        `${process.env.FRONTEND_URL}/payment/callback`;

      // ── BUILD PAYMENT PAYLOAD ──────────────
      const payload: Record<string, unknown> = {
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
      };

      const response = await axios.post(
        `${FLW_BASE_URL}/payments`,
        payload,
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
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: unknown };
        message?: string;
      };
      logger.error('Flutterwave initialization failed', {
        error: err.response?.data || err.message,
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
  // VERIFY BY TRANSACTION ID
  // ============================================
  static async verifyTransaction(
    transactionId: string
  ): Promise<PaymentVerificationResult> {
    try {
      const response = await axios.get(
        `${FLW_BASE_URL}/transactions/${transactionId}/verify`,
        { headers: getHeaders(), timeout: 30000 }
      );

      if (
        response.data?.status !== 'success' ||
        !response.data?.data
      ) {
        return {
          success: false,
          verified: false,
          error:
            response.data?.message || 'Transaction verification failed',
        };
      }

      const transaction = response.data.data as Record<string, unknown>;
      const status = String(transaction.status);
      const isSuccessful = status === 'successful';
      const isPending = status === 'pending';

      logger.info('Flutterwave transaction verified by id', {
        transactionId,
        txRef: transaction.tx_ref,
        status,
        amount: transaction.amount,
      });

      return {
        success: true,
        verified: isSuccessful,
        pending: isPending,
        data: mapFlutterwaveTransaction(transaction),
      };
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      logger.error('Flutterwave verification by id failed', {
        error: err.response?.data || err.message,
        transactionId,
      });
      return {
        success: false,
        verified: false,
        error:
          err.response?.data?.message || 'Failed to verify transaction',
      };
    }
  }

  // ============================================
  // VERIFY BY TX_REF
  // Preferred path after hosted checkout
  // ============================================
  static async verifyTransactionByRef(
    txRef: string
  ): Promise<PaymentVerificationResult> {
    try {
      const response = await axios.get(
        `${FLW_BASE_URL}/transactions/verify_by_reference`,
        {
          params: { tx_ref: txRef },
          headers: getHeaders(),
          timeout: 30000,
        }
      );

      if (
        response.data?.status !== 'success' ||
        !response.data?.data
      ) {
        const message =
          response.data?.message || 'Transaction not found';
        const notFound =
          typeof message === 'string' &&
          message.toLowerCase().includes('no transaction was found');

        return {
          success: false,
          verified: false,
          error: notFound ? 'Transaction not found' : message,
        };
      }

      const transaction = response.data.data as Record<string, unknown>;
      const status = String(transaction.status);
      const isSuccessful = status === 'successful';
      const isPending = status === 'pending';

      logger.info('Flutterwave transaction verified by reference', {
        txRef,
        status,
        amount: transaction.amount,
      });

      return {
        success: true,
        verified: isSuccessful,
        pending: isPending,
        data: mapFlutterwaveTransaction(transaction),
      };
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      logger.error('Flutterwave verify_by_reference failed', {
        error: err.response?.data || err.message,
        txRef,
      });
      return {
        success: false,
        verified: false,
        error:
          err.response?.data?.message || 'Failed to verify transaction',
      };
    }
  }

  // ============================================
  // VERIFY PAYMENT — tries both methods
  // ============================================
  static async verifyPayment(input: {
    transactionId?: string;
    txRef?: string;
  }): Promise<PaymentVerificationResult> {
    const { transactionId, txRef } = input;

    if (transactionId && txRef) {
      const byId = await this.verifyTransaction(transactionId);
      if (byId.success) return byId;
      logger.warn(
        'Flutterwave verify by id failed; falling back to tx_ref',
        { transactionId, txRef, error: byId.error }
      );
      return this.verifyTransactionByRef(txRef);
    }

    if (transactionId) return this.verifyTransaction(transactionId);
    if (txRef) return this.verifyTransactionByRef(txRef);

    return {
      success: false,
      verified: false,
      error: 'transaction_id or tx_ref is required',
    };
  }

  // ============================================
  // GET TRANSACTION BY REF
  // @deprecated — use verifyTransactionByRef
  // ============================================
  static async getTransactionByRef(txRef: string): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    const result = await this.verifyTransactionByRef(txRef);
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Transaction not found',
      };
    }
    return {
      success: true,
      data: {
        id: result.data.flwRef,
        tx_ref: result.data.txRef,
        status: result.data.status,
        amount: result.data.amount,
      },
    };
  }

  // ============================================
  // VERIFY WEBHOOK SIGNATURE
  // ============================================
  static verifyWebhookSignature(signature: string): boolean {
    return signature === process.env.FLW_WEBHOOK_HASH;
  }
}