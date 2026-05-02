import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { EmojiService } from './emoji.service';
import {
  IAddReactionRequest,
  IReactionsResponse,
  ReactionTarget,
} from '../types/reaction.interface';

export class ReactionService {

  // ============================================
  // ADD / CHANGE / REMOVE REACTION
  // One reaction per user per target:
  // No reaction     → add it
  // Same emoji tap  → remove it (unreact)
  // Different emoji → replace old with new
  // ============================================
  static async addReaction(
    userId: string,
    data: IAddReactionRequest
  ): Promise<IReactionsResponse> {
    try {
      // Step 1: Validate emoji
      const allEmojis = await EmojiService.getAllEmojiChars();
      if (allEmojis.length > 0 && !allEmojis.includes(data.emoji)) {
        throw new Error('Invalid emoji');
      }

      // Step 2: Validate target exists and is valid
      await this.validateTarget(data.targetType, data.targetId);

      // Step 3: Find existing reaction by this user on this target
      const existing = await prisma.reaction.findFirst({
        where: {
          userId,
          ...(data.targetType === 'beg'
            ? { begId: data.targetId }
            : { donationId: data.targetId }
          ),
        },
      });

      if (!existing) {
        // No reaction yet — ADD
        await prisma.reaction.create({
          data: {
            userId,
            emoji: data.emoji,
            begId: data.targetType === 'beg' ? data.targetId : null,
            donationId: data.targetType === 'donation' ? data.targetId : null,
          },
        });
        logger.info('Reaction added', {
          userId,
          emoji: data.emoji,
          targetType: data.targetType,
          targetId: data.targetId,
        });

      } else if (existing.emoji === data.emoji) {
        // Same emoji tapped again — REMOVE (unreact)
        await prisma.reaction.delete({
          where: { id: existing.id },
        });
        logger.info('Reaction removed', {
          userId,
          emoji: data.emoji,
          targetType: data.targetType,
          targetId: data.targetId,
        });

      } else {
        // Different emoji — REPLACE
        await prisma.reaction.update({
          where: { id: existing.id },
          data: { emoji: data.emoji },
        });
        logger.info('Reaction changed', {
          userId,
          from: existing.emoji,
          to: data.emoji,
          targetType: data.targetType,
          targetId: data.targetId,
        });
      }

      // Return updated reactions
      return this.getReactions(data.targetType, data.targetId, userId);
    } catch (error: any) {
      logger.error('Failed to add reaction', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // GET REACTIONS FOR A BEG OR DONATION
  // ============================================
  static async getReactions(
    targetType: ReactionTarget,
    targetId: string,
    userId?: string
  ): Promise<IReactionsResponse> {
    try {
      const where = targetType === 'beg'
        ? { begId: targetId }
        : { donationId: targetId };

      const reactions = await prisma.reaction.findMany({
        where,
        select: {
          emoji: true,
          userId: true,
        },
      });

      // Group by emoji and count
      const emojiMap = new Map<string, number>();
      let userReaction: string | null = null;

      for (const reaction of reactions) {
        emojiMap.set(reaction.emoji, (emojiMap.get(reaction.emoji) || 0) + 1);
        if (userId && reaction.userId === userId) {
          userReaction = reaction.emoji;
        }
      }

      // Sort by count descending
      const reactionCounts = Array.from(emojiMap.entries())
        .map(([emoji, count]) => ({
          emoji,
          count,
          userReacted: emoji === userReaction,
        }))
        .sort((a, b) => b.count - a.count);

      return {
        targetId,
        targetType,
        totalReactions: reactions.length,
        reactions: reactionCounts,
        userReaction,
      };
    } catch (error: any) {
      logger.error('Failed to get reactions', { error: error.message, targetId });
      throw error;
    }
  }

  // ============================================
  // VALIDATE TARGET
  // ============================================
  private static async validateTarget(
    targetType: ReactionTarget,
    targetId: string
  ): Promise<void> {
    if (targetType === 'beg') {
      const beg = await prisma.beg.findUnique({
        where: { id: targetId },
        select: { id: true, status: true },
      });
      if (!beg) throw new Error('Beg not found');
      if (beg.status !== 'active' && beg.status !== 'funded') {
        throw new Error('Cannot react to this beg');
      }
    } else {
      const donation = await prisma.donation.findUnique({
        where: { id: targetId },
        select: { id: true, status: true },
      });
      if (!donation) throw new Error('Donation not found');
      if (donation.status !== 'success') {
        throw new Error('Cannot react to this donation');
      }
    }
  }
}