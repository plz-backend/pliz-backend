import prisma from '../../../config/database';
import axios from 'axios';
import logger from '../../../config/logger';

export class PaymentMethodService {
  private static PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
  private static BASE_URL = 'https://api.paystack.co';

  /**
   * Save card from successful transaction
   * Called automatically after first successful payment
   */
  static async saveCardFromTransaction(
    userId: string,
    authorizationCode: string
  ): Promise<any> {
    try {
      // Get card details from Paystack
      const response = await axios.get(
        `${this.BASE_URL}/transaction/verify/${authorizationCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.PAYSTACK_SECRET}`,
          },
        }
      );

      const authorization = response.data.data.authorization;

      if (!authorization || authorization.reusable !== true) {
        throw new Error('Card is not reusable');
      }

      // Check if card already saved
      const existing = await prisma.savedCard.findUnique({
        where: { authorizationCode: authorization.authorization_code },
      });

      if (existing) {
        logger.info('Card already saved', { userId, last4: authorization.last4 });
        return existing;
      }

      // Check if user has no default card
      const hasDefault = await prisma.savedCard.findFirst({
        where: { userId, isDefault: true },
      });

      // Save card
      const savedCard = await prisma.savedCard.create({
        data: {
          userId,
          authorizationCode: authorization.authorization_code,
          cardType: authorization.card_type,
          last4: authorization.last4,
          expMonth: authorization.exp_month,
          expYear: authorization.exp_year,
          bank: authorization.bank,
          isDefault: !hasDefault, // First card is default
        },
      });

      logger.info('Card saved successfully', {
        userId,
        cardId: savedCard.id,
        last4: savedCard.last4,
      });

      return savedCard;
    } catch (error: any) {
      logger.error('Failed to save card', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user's saved cards
   */
  static async getUserCards(userId: string): Promise<any[]> {
    try {
      const cards = await prisma.savedCard.findMany({
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

      return cards;
    } catch (error: any) {
      logger.error('Failed to get user cards', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Set default card
   */
  static async setDefaultCard(userId: string, cardId: string): Promise<void> {
    try {
      // Verify card belongs to user
      const card = await prisma.savedCard.findFirst({
        where: { id: cardId, userId },
      });

      if (!card) {
        throw new Error('Card not found');
      }

      // Remove default from all cards
      await prisma.savedCard.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      // Set new default
      await prisma.savedCard.update({
        where: { id: cardId },
        data: { isDefault: true },
      });

      logger.info('Default card updated', { userId, cardId });
    } catch (error: any) {
      logger.error('Failed to set default card', {
        error: error.message,
        userId,
        cardId,
      });
      throw error;
    }
  }

  /**
   * Delete saved card
   */
  static async deleteCard(userId: string, cardId: string): Promise<void> {
    try {
      const card = await prisma.savedCard.findFirst({
        where: { id: cardId, userId },
      });

      if (!card) {
        throw new Error('Card not found');
      }

      await prisma.savedCard.delete({
        where: { id: cardId },
      });

      // If deleted card was default, set another as default
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
        error: error.message,
        userId,
        cardId,
      });
      throw error;
    }
  }

  /**
   * Charge saved card
   */
  static async chargeSavedCard(data: {
    userId: string;
    cardId?: string; // If not provided, use default
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
        // Use specific card
        card = await prisma.savedCard.findFirst({
          where: { id: data.cardId, userId: data.userId },
        });
      } else {
        // Use default card
        card = await prisma.savedCard.findFirst({
          where: { userId: data.userId, isDefault: true },
        });
      }

      if (!card) {
        throw new Error('No saved card found');
      }

      // Charge card using authorization code
      const response = await axios.post(
        `${this.BASE_URL}/transaction/charge_authorization`,
        {
          email: data.email,
          amount: Math.round(data.amount * 100), // Convert to kobo
          authorization_code: card.authorizationCode,
          reference: data.reference,
          metadata: data.metadata,
        },
        {
          headers: {
            Authorization: `Bearer ${this.PAYSTACK_SECRET}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Card charged successfully', {
        userId: data.userId,
        cardId: card.id,
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