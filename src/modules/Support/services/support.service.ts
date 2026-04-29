import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { SupportEmailService } from './support-email.service';
import {
  ICreateTicketRequest,
  ITicketResponse,
  TicketStatus,
} from '../types/support.interface';

export class SupportService {

  // ============================================
  // CREATE TICKET
  // ============================================
  static async createTicket(
    userId: string,
    data: ICreateTicketRequest
  ): Promise<ITicketResponse> {
    try {
      const count = await prisma.supportTicket.count();
      const ticketNumber = `PLZ-${String(count + 1).padStart(6, '0')}`;

      const ticket = await prisma.supportTicket.create({
        data: {
          userId,
          ticketNumber,
          subject: data.subject,
          category: data.category,
          contactEmail: data.contactEmail,
          status: 'open',
          priority: 'normal',
          messages: {
            create: {
              senderId: userId,
              senderType: 'user',
              content: data.message,
              isRead: false,
            },
          },
        },
        include: {
          messages: {
            include: {
              sender: {
                select: {
                  username: true,
                  profile: { select: { displayName: true } },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          user: {
            select: {
              email: true,
              username: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      });

      const userName = ticket.user.profile?.displayName || ticket.user.username;

      // Send confirmation email to contactEmail
      await SupportEmailService.sendTicketConfirmation(
        data.contactEmail,
        userName,
        ticketNumber,
        data.subject,
        data.category
      );

      // Notify user in app
      await prisma.notification.create({
        data: {
          userId,
          type: 'ticket_created',
          title: '🎫 Support Ticket Created',
          body: `Ticket #${ticketNumber} created. We will reply to ${data.contactEmail} shortly.`,
          data: { ticketId: ticket.id, ticketNumber },
        },
      });

      logger.info('Support ticket created', { userId, ticketNumber, contactEmail: data.contactEmail });

      return this.formatTicket(ticket);
    } catch (error: any) {
      logger.error('Failed to create ticket', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // GET USER TICKETS
  // ============================================
  static async getUserTickets(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ tickets: ITicketResponse[]; total: number; pages: number }> {
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            include: {
              sender: {
                select: {
                  username: true,
                  profile: { select: { displayName: true } },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.supportTicket.count({ where: { userId } }),
    ]);

    return {
      tickets: tickets.map(t => this.formatTicket(t)),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  // ============================================
  // GET SINGLE TICKET
  // ============================================
  static async getTicket(
    ticketId: string,
    userId: string
  ): Promise<ITicketResponse> {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          include: {
            sender: {
              select: {
                username: true,
                profile: { select: { displayName: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) throw new Error('Ticket not found');
    if (ticket.userId !== userId) throw new Error('Unauthorized');

    // Mark agent and AI messages as read
    await prisma.supportMessage.updateMany({
      where: {
        ticketId,
        senderType: { not: 'user' },
        isRead: false,
      },
      data: { isRead: true },
    });

    return this.formatTicket(ticket);
  }

  // ============================================
  // USER REPLIES TO TICKET
  // ============================================
  static async replyToTicket(
    ticketId: string,
    userId: string,
    message: string
  ): Promise<ITicketResponse> {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) throw new Error('Ticket not found');
    if (ticket.userId !== userId) throw new Error('Unauthorized');
    if (ticket.status === 'closed') throw new Error('Cannot reply to a closed ticket');

    await prisma.supportMessage.create({
      data: {
        ticketId,
        senderId: userId,
        senderType: 'user',
        content: message,
        isRead: false,
      },
    });

    // Update status back to in_progress if waiting
    if (ticket.status === 'waiting_user') {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'in_progress' },
      });
    }

    logger.info('User replied to ticket', { ticketId, userId });

    return this.getTicket(ticketId, userId);
  }

  // ============================================
  // USER CLOSES TICKET
  // ============================================
  static async closeTicket(ticketId: string, userId: string): Promise<void> {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) throw new Error('Ticket not found');
    if (ticket.userId !== userId) throw new Error('Unauthorized');

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'closed', closedAt: new Date() },
    });

    logger.info('Ticket closed by user', { ticketId, userId });
  }

  // ============================================
  // ADMIN — GET ALL TICKETS
  // ============================================
  static async getAllTickets(
    page: number = 1,
    limit: number = 20,
    status?: string,
    category?: string,
    priority?: string
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              profile: { select: { displayName: true } },
            },
          },
          messages: {
            include: {
              sender: {
                select: {
                  username: true,
                  profile: { select: { displayName: true } },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          assignee: {
            select: {
              username: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return {
      tickets: tickets.map(t => this.formatTicket(t as any)),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  // ============================================
  // ADMIN — REPLY TO TICKET
  // ============================================
  static async adminReply(
    ticketId: string,
    adminId: string,
    message: string
  ): Promise<void> {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: {
          select: {
            username: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });

    if (!ticket) throw new Error('Ticket not found');

    // Add agent message
    await prisma.supportMessage.create({
      data: {
        ticketId,
        senderId: adminId,
        senderType: 'agent',
        content: message,
        isRead: false,
      },
    });

    // Update ticket status
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'waiting_user' },
    });

    const userName = ticket.user.profile?.displayName || ticket.user.username;

    // Notify user in app
    await prisma.notification.create({
      data: {
        userId: ticket.userId,
        type: 'ticket_reply',
        title: '💬 Support Reply Received',
        body: `Our support team has replied to your ticket #${ticket.ticketNumber}.`,
        data: { ticketId, ticketNumber: ticket.ticketNumber },
      },
    });

    // Send reply email to contactEmail
    await SupportEmailService.sendAgentReply(
      ticket.contactEmail,
      userName,
      ticket.ticketNumber,
      ticket.subject,
      message
    );

    logger.info('Admin replied to ticket', { ticketId, adminId });
  }

  // ============================================
  // ADMIN — ASSIGN TICKET
  // ============================================
  static async assignTicket(ticketId: string, adminId: string): Promise<void> {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedTo: adminId,
        status: 'in_progress',
      },
    });
    logger.info('Ticket assigned', { ticketId, adminId });
  }

  // ============================================
  // ADMIN — UPDATE TICKET STATUS
  // ============================================
  static async updateTicketStatus(
    ticketId: string,
    status: TicketStatus
  ): Promise<void> {
    const updateData: any = { status };
    if (status === 'resolved') updateData.resolvedAt = new Date();
    if (status === 'closed') updateData.closedAt = new Date();

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
    });

    // Notify user if resolved
    if (status === 'resolved') {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          user: {
            select: {
              username: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      });

      if (ticket) {
        const userName = ticket.user.profile?.displayName || ticket.user.username;

        // App notification
        await prisma.notification.create({
          data: {
            userId: ticket.userId,
            type: 'ticket_resolved',
            title: '✅ Ticket Resolved',
            body: `Your support ticket #${ticket.ticketNumber} has been resolved.`,
            data: { ticketId, ticketNumber: ticket.ticketNumber },
          },
        });

        // Email notification
        await SupportEmailService.sendTicketResolved(
          ticket.contactEmail,
          userName,
          ticket.ticketNumber,
          ticket.subject
        );
      }
    }

    logger.info('Ticket status updated', { ticketId, status });
  }

  // ============================================
  // FORMAT TICKET RESPONSE
  // ============================================
  private static formatTicket(ticket: any): ITicketResponse {
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      priority: ticket.priority,
      contactEmail: ticket.contactEmail,
      assignedTo: ticket.assignedTo,
      messages: (ticket.messages || []).map((msg: any) => ({
        id: msg.id,
        senderType: msg.senderType,
        senderName:
          msg.senderType === 'ai' ? 'Plz AI Support' :
          msg.senderType === 'agent'
            ? msg.sender?.profile?.displayName || msg.sender?.username || 'Support Agent'
            : msg.sender?.profile?.displayName || msg.sender?.username || 'You',
        content: msg.content,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
      })),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }
}