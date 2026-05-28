import prisma from '../../../config/database';
import axios from 'axios';
import logger from '../../../config/logger';

const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
});

export class PaymentMethodService {

  // ============================================
  // SAVE CARD FROM TRANSACTION
  // ============================================
  static async saveCardFromTransaction(
    userId: string,
    transactionId: string
  ): Promise<any> {
    try {
      const response = await axios.get(
        `${FLW_BASE_URL}/transactions/${transactionId}/verify`,
        { headers: getHeaders() }
      );

      if (response.data?.status !== 'success') {
        throw new Error('Transaction not found');
      }

      const card = response.data.data?.card;

      if (!card?.token) {
        throw new Error('Card token not available');
      }

      const existing = await prisma.savedCard.findUnique({
        where: { authorizationCode: card.token },
      });

      if (existing) {
        logger.info('Card already saved', { userId });
        return existing;
      }

      const hasDefault = await prisma.savedCard.findFirst({
        where: { userId, isDefault: true },
      });

      const savedCard = await prisma.savedCard.create({
        data: {
          userId,
          authorizationCode: card.token,
          cardType: card.type || 'card',
          last4: card.last_4digits,
          expMonth: card.expiry?.split('/')[0] || '',
          expYear: card.expiry?.split('/')[1] || '',
          bank: card.issuer || '',
          isDefault: !hasDefault,
        },
      });

      logger.info('Card saved successfully', {
        userId,
        cardId: savedCard.id,
        last4: savedCard.last4,
      });

      return savedCard;
    } catch (error: any) {
      logger.error('Failed to save card', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // GET USER SAVED CARDS
  // ============================================
  static async getUserCards(userId: string): Promise<any[]> {
    try {
      return await prisma.savedCard.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          cardType: true,
          last4: true,
          expMonth: true,
          expYear: true,
          bank: true,
          isDefault: true,
          createdAt: true,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get user cards', { error: error.message, userId });
      return [];
    }
  }

  // ============================================
  // SET DEFAULT CARD
  // ============================================
  static async setDefaultCard(userId: string, cardId: string): Promise<void> {
    try {
      const card = await prisma.savedCard.findFirst({
        where: { id: cardId, userId },
      });

      if (!card) throw new Error('Card not found');

      await prisma.savedCard.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      await prisma.savedCard.update({
        where: { id: cardId },
        data: { isDefault: true },
      });

      logger.info('Default card updated', { userId, cardId });
    } catch (error: any) {
      logger.error('Failed to set default card', {
        error: error.message, userId, cardId,
      });
      throw error;
    }
  }

  // ============================================
  // DELETE CARD
  // ============================================
  static async deleteCard(userId: string, cardId: string): Promise<void> {
    try {
      const card = await prisma.savedCard.findFirst({
        where: { id: cardId, userId },
      });

      if (!card) throw new Error('Card not found');

      await prisma.savedCard.delete({ where: { id: cardId } });

      if (card.isDefault) {
        const firstCard = await prisma.savedCard.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });
        if (firstCard) {
          await prisma.savedCard.update({
            where: { id: firstCard.id },
            data: { isDefault: true },
          });
        }
      }

      logger.info('Card deleted', { userId, cardId });
    } catch (error: any) {
      logger.error('Failed to delete card', {
        error: error.message, userId, cardId,
      });
      throw error;
    }
  }

  // ============================================
  // CHARGE SAVED CARD
  // ============================================
  static async chargeSavedCard(data: {
    userId: string;
    cardId?: string;
    amount: number;
    email: string;
    reference: string;
    metadata: any;
  }): Promise<{
    success: boolean;
    status?: string;
    reference?: string;
    error?: string;
  }> {
    try {
      let card;

      if (data.cardId) {
        card = await prisma.savedCard.findFirst({
          where: { id: data.cardId, userId: data.userId },
        });
      } else {
        card = await prisma.savedCard.findFirst({
          where: { userId: data.userId, isDefault: true },
        });
      }

      if (!card) throw new Error('No saved card found');

      const response = await axios.post(
        `${FLW_BASE_URL}/tokenized-charges`,
        {
          token: card.authorizationCode,
          currency: 'NGN',
          country: 'NG',
          amount: data.amount,
          email: data.email,
          tx_ref: data.reference,
          narration: 'Plz Donation',
          meta: data.metadata,
        },
        { headers: getHeaders(), timeout: 30000 }
      );

      if (
        response.data?.status !== 'success' ||
        response.data?.data?.status !== 'successful'
      ) {
        return {
          success: false,
          error: response.data?.message || 'Failed to charge card',
        };
      }

      logger.info('Card charged successfully via Flutterwave', {
        userId: data.userId,
        amount: data.amount,
        reference: data.reference,
      });

      return {
        success: true,
        status: response.data.data.status,
        reference: data.reference,
      };
    } catch (error: any) {
      logger.error('Failed to charge card', {
        error: error.response?.data || error.message,
        userId: data.userId,
      });
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to charge card',
      };
    }
  }
}