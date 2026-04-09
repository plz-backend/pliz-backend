import prisma from '../../../config/database';
import { getIO, isUserOnline } from '../../../config/socket';
import logger from '../../../config/logger';

export type NotificationType =
  | 'beg_approved'
  | 'beg_funded'
  | 'donation_received'
  | 'message_received'
  | 'donor_reply';

interface CreateNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export class NotificationService {
  /**
   * Core method
   * 1. Always saves to DB (offline users read on next login)
   * 2. Emits real-time via Socket.io if user is currently online
   * Never throws - notification failure must never break main flow
   */
  /** @returns false if persistence failed (errors are logged). */
  static async send(payload: CreateNotificationPayload): Promise<boolean> {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: payload.userId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          isRead: false,
        },
      });

      logger.info('Notification saved to DB', {
        notificationId: notification.id,
        userId: payload.userId,
        type: payload.type,
      });

      // Real-time delivery if user is online (like WhatsApp)
      if (isUserOnline(payload.userId)) {
        const io = getIO();
        io.to(`user:${payload.userId}`).emit('notification', {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          is_read: false,
          created_at: notification.createdAt,
        });

        logger.info('Real-time notification emitted', {
          userId: payload.userId,
          type: payload.type,
        });
      }
      return true;
    } catch (error: any) {
      logger.error('Failed to send notification', {
        error: error.message,
        userId: payload.userId,
        type: payload.type,
      });
      return false;
    }
  }

  /**
   * Notify recipient they received a donation
   */
  static async donationReceived(data: {
    userId: string;
    begId: string;
    begTitle: string | null;
    amount: number;
    isAnonymous: boolean;
    donorName: string;
  }): Promise<void> {
    const from = data.isAnonymous ? 'Someone' : data.donorName;

    await this.send({
      userId: data.userId,
      type: 'donation_received',
      title: '💰 You received a donation!',
      body: `${from} donated ₦${data.amount.toLocaleString()} to${
        data.begTitle ? ` "${data.begTitle}"` : ' your beg'
      }.`,
      data: { beg_id: data.begId },
    });
  }

  /**
   * Notify requester that an admin approved their beg (now visible in the community).
   */
  static async begApproved(data: {
    userId: string;
    begId: string;
    begTitle: string | null;
  }): Promise<boolean> {
    const label = data.begTitle ? `"${data.begTitle}"` : 'Your help request';
    return this.send({
      userId: data.userId,
      type: 'beg_approved',
      title: '✅ Your request was approved',
      body: `${label} is now live. Others can see it and contribute.`,
      data: { beg_id: data.begId },
    });
  }

  /**
   * Notify recipient their beg is 100% funded
   */
  static async begFunded(data: {
    userId: string;
    begId: string;
    begTitle: string | null;
    amountReceived: number;
  }): Promise<void> {
    await this.send({
      userId: data.userId,
      type: 'beg_funded',
      title: '🎉 Your beg is fully funded!',
      body: `${
        data.begTitle ? `"${data.begTitle}"` : 'Your beg'
      } has been fully funded with ₦${data.amountReceived.toLocaleString()}!`,
      data: { beg_id: data.begId },
    });
  }

  /**
   * Notify donor they received a gratitude message (like WhatsApp)
   */
  static async messageReceived(data: {
    userId: string;
    donationId: string;
    senderName: string;
    preview: string;
  }): Promise<void> {
    const preview =
      data.preview.length > 50
        ? `${data.preview.substring(0, 50)}...`
        : data.preview;

    await this.send({
      userId: data.userId,
      type: 'message_received',
      title: `💬 ${data.senderName} sent you a thank you!`,
      body: `"${preview}"`,
      data: { donation_id: data.donationId },
    });
  }

  /**
   * Notify recipient that donor replied to their gratitude message
   */
  static async donorReplied(data: {
    userId: string;
    donationId: string;
    donorName: string;
    replyPreview: string;
  }): Promise<void> {
    const preview =
      data.replyPreview.length > 50
        ? `${data.replyPreview.substring(0, 50)}...`
        : data.replyPreview;

    await this.send({
      userId: data.userId,
      type: 'donor_reply',
      title: `💬 ${data.donorName} replied to your message!`,
      body: `"${preview}"`,
      data: { donation_id: data.donationId },
    });
  }

  /**
   * Get all notifications for a user (paginated)
   */
  static async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        is_read: n.isRead,
        created_at: n.createdAt,
      })),
      total,
      unread_count: unreadCount,
      pages: Math.ceil(total / limit),
    };
  }

  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }

  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  static async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  static async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }
}