import prisma from '../../../config/database';
import { NotificationService } from '../../notifications/services/notification.service';
import logger from '../../../config/logger';

export class MessageService {
  /**
   * Recipient sends gratitude message to donor
   * Fills the empty record created during processDonation()
   */
  static async sendGratitudeMessage(
    donationId: string,
    userId: string,
    data: {
      messageType: 1 | 2;   // 1=text only now, 2=audio coming soon
      content: string;
      donorReplyAllowed: boolean;
    }
  ): Promise<any> {
    try {
      if (data.messageType !== 1) {
        throw new Error('Audio messages are not yet supported');
      }

      const donation = await prisma.donation.findUnique({
        where: { id: donationId },
        include: {
          beg: { select: { userId: true } },
          gratitudeMessage: true,
        },
      });

      if (!donation) throw new Error('Donation not found');
      if (donation.beg.userId !== userId) {
        throw new Error('Unauthorized: Only the beg creator can send thanks');
      }
      if (!donation.gratitudeMessage) {
        throw new Error('Gratitude message record not found');
      }
      if (donation.gratitudeMessage.content) {
        throw new Error('Gratitude message already sent for this donation');
      }

      const replyExpiresAt = new Date();
      replyExpiresAt.setHours(replyExpiresAt.getHours() + 24);

      const message = await prisma.gratitudeMessage.update({
        where: { donationId },
        data: {
          messageType: 1,
          content: data.content,
          donorReplyAllowed: data.donorReplyAllowed,
          expiresAt: data.donorReplyAllowed ? replyExpiresAt : null,
        },
      });

      // Get sender display name for notification
      const senderProfile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { displayName: true },
      });
      const senderName = senderProfile?.displayName || 'Someone';

      // Notify donor - real-time if online (like WhatsApp)
      if (donation.donorId) {
        await NotificationService.messageReceived({
          userId: donation.donorId,
          donationId,
          senderName,
          preview: data.content,
        });
      }

      logger.info('Gratitude message sent', { donationId, userId });

      return {
        id: message.id,
        donation_id: message.donationId,
        message_type: message.messageType,
        content: message.content,
        donor_reply_allowed: message.donorReplyAllowed,
        donor_replied: message.donorReplied,
        expires_at: message.expiresAt,
        created_at: message.createdAt,
      };
    } catch (error: any) {
      logger.error('Failed to send gratitude message', { error: error.message, donationId });
      throw error;
    }
  }

  /**
   * Donor replies to gratitude message
   * One reply only, within 24 hours
   */
  static async sendDonorReply(
    donationId: string,
    donorId: string,
    reply: string
  ): Promise<any> {
    try {
      const donation = await prisma.donation.findUnique({
        where: { id: donationId },
        include: {
          beg: { select: { userId: true } },
          gratitudeMessage: true,
        },
      });

      if (!donation) throw new Error('Donation not found');
      if (donation.donorId !== donorId) throw new Error('Unauthorized');
      if (!donation.gratitudeMessage) throw new Error('No gratitude message found');
      if (!donation.gratitudeMessage.content) {
        throw new Error('Recipient has not sent a message yet');
      }
      if (!donation.gratitudeMessage.donorReplyAllowed) {
        throw new Error('Donor reply is not allowed for this message');
      }
      if (donation.gratitudeMessage.donorReplied) {
        throw new Error('You have already replied to this message');
      }
      if (
        donation.gratitudeMessage.expiresAt &&
        new Date() > donation.gratitudeMessage.expiresAt
      ) {
        throw new Error('Reply window has expired (24 hours)');
      }

      const updated = await prisma.gratitudeMessage.update({
        where: { donationId },
        data: {
          donorReply: reply,
          donorReplied: true,
          donorRepliedAt: new Date(),
        },
      });

      // Get donor display name for notification
      const donorProfile = await prisma.userProfile.findUnique({
        where: { userId: donorId },
        select: { displayName: true },
      });
      const donorName = donorProfile?.displayName || 'Your donor';

      // Notify recipient - real-time if online
      await NotificationService.donorReplied({
        userId: donation.beg.userId,
        donationId,
        donorName,
        replyPreview: reply,
      });

      logger.info('Donor reply sent', { donationId, donorId });

      return {
        id: updated.id,
        donation_id: updated.donationId,
        donor_replied: updated.donorReplied,
        donor_reply: updated.donorReply,
        donor_replied_at: updated.donorRepliedAt,
      };
    } catch (error: any) {
      logger.error('Failed to send donor reply', { error: error.message, donationId });
      throw error;
    }
  }

  /**
   * Get all thank you messages received by donor
   */
  static async getDonorMessages(
    donorId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.gratitudeMessage.findMany({
        where: { donation: { donorId }, content: { not: null } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          donation: {
            select: {
              id: true,
              amount: true,
              createdAt: true,
              beg: {
                select: {
                  id: true,
                  title: true,
                  category: { select: { name: true, icon: true } },
                },
              },
            },
          },
        },
      }),
      prisma.gratitudeMessage.count({
        where: { donation: { donorId }, content: { not: null } },
      }),
    ]);

    return {
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        donor_reply_allowed: m.donorReplyAllowed,
        donor_replied: m.donorReplied,
        donor_reply: m.donorReply,
        expires_at: m.expiresAt,
        created_at: m.createdAt,
        donation: {
          id: m.donation.id,
          amount: parseFloat(m.donation.amount.toString()),
          created_at: m.donation.createdAt,
          beg: m.donation.beg,
        },
      })),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all gratitude messages sent by recipient
   */
  static async getRecipientSentMessages(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.gratitudeMessage.findMany({
        where: { donation: { beg: { userId } }, content: { not: null } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          donation: {
            select: {
              id: true,
              amount: true,
              isAnonymous: true,
              createdAt: true,
              donor: {
                select: {
                  username: true,
                  profile: { select: { displayName: true } },
                },
              },
              beg: { select: { id: true, title: true } },
            },
          },
        },
      }),
      prisma.gratitudeMessage.count({
        where: { donation: { beg: { userId } }, content: { not: null } },
      }),
    ]);

    return {
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        donor_replied: m.donorReplied,
        donor_reply: m.donorReply,
        donor_replied_at: m.donorRepliedAt,
        created_at: m.createdAt,
        donation: {
          id: m.donation.id,
          amount: parseFloat(m.donation.amount.toString()),
          donor_name: m.donation.isAnonymous
            ? 'Anonymous'
            : m.donation.donor?.profile?.displayName ||
              m.donation.donor?.username ||
              'Unknown',
          beg: m.donation.beg,
        },
      })),
      total,
      pages: Math.ceil(total / limit),
    };
  }
}