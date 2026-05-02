import Anthropic from '@anthropic-ai/sdk';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import {
  IChatMessage,
  IAIChatResponse,
  TicketCategory,
} from '../types/support.interface';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PLZ_SYSTEM_PROMPT = `You are Plz Support AI, a helpful and friendly customer support assistant for Plz — a Nigerian fundraising app where users create begs (requests for donations) and receive donations from other users.

Your role:
1. Answer general questions about how Plz works
2. Help users understand features — begs, donations, KYC verification, withdrawals, trust tiers, reactions
3. Troubleshoot common issues
4. Guide users through processes like completing profile, verifying identity, creating begs

Key facts about Plz:
- Users must complete their profile before creating begs
- KYC verification is required before creating begs (NIN or International Passport)
- Phone number must be verified via OTP before KYC
- Trust tiers affect request amounts and frequency
- To move to a higher trust tier, user must have donated once OR completed 2 successful begs
- Donations are processed via Paystack
- Withdrawals have a 12.5% total fee (5% company + 7.5% VAT)
- Begs expire after 24h, 72h, or 7 days — user chooses
- Begs can be extended before they expire
- Users can react to begs and donations with emojis
- Support email is support@plz.app

When you cannot help or issue is complex (account suspension, payment disputes, failed withdrawals, technical errors) — suggest escalating to a human agent or creating a support ticket.

If user mentions urgent financial issues or seems very frustrated — suggest human support immediately.

Always respond in simple, friendly English that Nigerian users can easily understand. Keep responses concise and helpful.`;

export class AIChatService {

  // ============================================
  // SAFELY PARSE CHAT HISTORY FROM DB
  // Validates each message before using it
  // Prevents corrupt data from crashing the app
  // ============================================
  private static parseChatHistory(messages: any): IChatMessage[] {
    try {
      if (!Array.isArray(messages)) return [];

      return messages.filter(msg =>
        msg &&
        typeof msg === 'object' &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        typeof msg.content === 'string' &&
        typeof msg.timestamp === 'string'
      ) as IChatMessage[];
    } catch {
      return [];
    }
  }

  // ============================================
  // SEND MESSAGE TO AI
  // ============================================
  static async chat(
    userId: string,
    message: string,
    sessionId?: string
  ): Promise<IAIChatResponse> {
    try {
      // Get or create session
      let session = sessionId
        ? await prisma.supportChat.findUnique({ where: { sessionId } })
        : null;

      if (!session) {
        const newSessionId = `chat_${userId}_${Date.now()}`;
        session = await prisma.supportChat.create({
          data: {
            userId,
            sessionId: newSessionId,
            status: 'active',
            messages: [],
          },
        });
      }

      if (session.userId !== userId) {
        throw new Error('Invalid session');
      }

      if (session.status === 'closed') {
        throw new Error('This chat session has ended. Please start a new conversation.');
      }

      // ← Safe parse instead of direct cast
      const history = this.parseChatHistory(session.messages);

      // Add user message
      history.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      });

      // Call Claude
      const response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system: PLZ_SYSTEM_PROMPT,
        messages: history.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const aiMessage = response.content[0].type === 'text'
        ? response.content[0].text
        : 'I apologize, I could not process your request. Please try again.';

      // Add AI response to history
      history.push({
        role: 'assistant',
        content: aiMessage,
        timestamp: new Date().toISOString(),
      });

      // Save updated history
      await prisma.supportChat.update({
        where: { id: session.id },
        data: { messages: history as any },
      });

      const suggestHuman = this.shouldSuggestHuman(message);
      const suggestTicket = this.shouldSuggestTicket(message);

      logger.info('AI chat response sent', {
        userId,
        sessionId: session.sessionId,
        suggestHuman,
        suggestTicket,
      });

      return {
        sessionId: session.sessionId,
        message: aiMessage,
        isAI: true,
        suggestHuman,
        suggestTicket,
      };
    } catch (error: any) {
      logger.error('AI chat failed', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // ESCALATE TO HUMAN
  // Converts chat session into a support ticket
  // ============================================
  static async escalateToHuman(
    userId: string,
    sessionId: string,
    subject: string,
    category: TicketCategory,
    contactEmail: string
  ): Promise<{ ticketNumber: string; ticketId: string }> {
    try {
      const session = await prisma.supportChat.findUnique({
        where: { sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('Chat session not found');
      }

      if (session.status === 'escalated') {
        throw new Error('This chat has already been escalated to a human agent');
      }

      // Generate ticket number
      const ticketNumber = await this.generateTicketNumber();

      // ← Safe parse instead of direct cast
      const history = this.parseChatHistory(session.messages);

      const chatSummary = history
        .map(msg => `**${msg.role === 'user' ? 'User' : 'AI Support'}:** ${msg.content}`)
        .join('\n\n');

      // Create ticket from chat
      const ticket = await prisma.supportTicket.create({
        data: {
          userId,
          ticketNumber,
          subject,
          category,
          contactEmail,
          status: 'open',
          priority: 'normal',
          messages: {
            create: {
              senderId: null,
              senderType: 'ai',
              content: `**Chat History:**\n\n${chatSummary}`,
              isRead: false,
            },
          },
        },
      });

      // Update chat session
      await prisma.supportChat.update({
        where: { id: session.id },
        data: {
          status: 'escalated',
          ticketId: ticket.id,
        },
      });

      // Notify user in app
      await prisma.notification.create({
        data: {
          userId,
          type: 'support_escalated',
          title: '👤 Connected to Support Team',
          body: `Your chat has been escalated to our support team. Ticket #${ticketNumber} created. We will reply to ${contactEmail} shortly.`,
          data: { ticketId: ticket.id, ticketNumber },
        },
      });

      logger.info('Chat escalated to human', { userId, sessionId, ticketNumber });

      return { ticketNumber, ticketId: ticket.id };
    } catch (error: any) {
      logger.error('Escalation failed', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // GENERATE TICKET NUMBER
  // ============================================
  private static async generateTicketNumber(): Promise<string> {
    const count = await prisma.supportTicket.count();
    return `PLZ-${String(count + 1).padStart(6, '0')}`;
  }

  // ============================================
  // DETECT IF HUMAN HELP NEEDED
  // ============================================
  private static shouldSuggestHuman(message: string): boolean {
    const keywords = [
      'speak to human', 'talk to agent', 'real person',
      'customer care', 'human support', 'not helpful',
      'frustrated', 'urgent', 'emergency', 'lost money',
      'payment failed', 'withdrawal failed', 'account suspended',
      'escalate', 'supervisor', 'manager', 'speak to someone',
    ];
    const lower = message.toLowerCase();
    return keywords.some(k => lower.includes(k));
  }

  private static shouldSuggestTicket(message: string): boolean {
    const keywords = [
      'report', 'issue', 'problem', 'bug', 'error',
      'not working', 'failed', 'wrong', 'complaint',
      'broken', 'cant', "can't", 'unable',
    ];
    const lower = message.toLowerCase();
    return keywords.some(k => lower.includes(k));
  }
}