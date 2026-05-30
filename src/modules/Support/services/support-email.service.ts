import logger from '../../../config/logger';
import { GenericEmailService } from '../../../services/email.service';

export class SupportEmailService {

  // ============================================
  // TICKET CONFIRMATION TO USER
  // ============================================
  static async sendTicketConfirmation(
    contactEmail: string,
    name: string,
    ticketNumber: string,
    subject: string,
    category: string
  ): Promise<void> {
    try {
      await GenericEmailService.sendEmail({
        to: contactEmail,
        subject: `[${ticketNumber}] Support Ticket Created — Plz`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333;">Plz Support</h1>
            </div>
            <h2>Hi ${name},</h2>
            <p>Your support ticket has been created successfully. Our team will get back to you as soon as possible.</p>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
              <p style="margin: 5px 0;"><strong>Ticket Number:</strong> ${ticketNumber}</p>
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin: 5px 0;"><strong>Category:</strong> ${category}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> Open</p>
              <p style="margin: 5px 0;"><strong>Contact Email:</strong> ${contactEmail}</p>
            </div>
            <p>You can also track and reply to your ticket directly in the <strong>Plz app</strong> under <strong>Support → My Tickets</strong>.</p>
            <p>If you need to reply via email, just reply to this email and include your ticket number <strong>${ticketNumber}</strong>.</p>
            <br />
            <p>Best regards,<br /><strong>Plz Support Team</strong></p>
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #999;">Plz — Nigerian Fundraising App | support@plz.app</p>
          </div>
        `,
      });
      logger.info('Ticket confirmation email sent', { contactEmail, ticketNumber });
    } catch (error: any) {
      logger.error('Failed to send ticket confirmation email', { error: error.message });
    }
  }

  // ============================================
  // AGENT REPLY TO USER
  // ============================================
  static async sendAgentReply(
    contactEmail: string,
    name: string,
    ticketNumber: string,
    subject: string,
    message: string
  ): Promise<void> {
    try {
      await GenericEmailService.sendEmail({
        to: contactEmail,
        subject: `Re: [${ticketNumber}] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333;">Plz Support</h1>
            </div>
            <h2>Hi ${name},</h2>
            <p>Our support team has replied to your ticket <strong>${ticketNumber}</strong>.</p>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3;">
              <p style="margin: 0 0 10px 0;"><strong>Support Team Reply:</strong></p>
              <p style="margin: 0; line-height: 1.6;">${message}</p>
            </div>
            <p>You can reply directly in the <strong>Plz app</strong> under <strong>Support → My Tickets</strong>, or reply to this email.</p>
            <br />
            <p>Best regards,<br /><strong>Plz Support Team</strong></p>
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #999;">Ticket: ${ticketNumber} | support@plz.app</p>
          </div>
        `,
      });
      logger.info('Agent reply email sent', { contactEmail, ticketNumber });
    } catch (error: any) {
      logger.error('Failed to send agent reply email', { error: error.message });
    }
  }

  // ============================================
  // TICKET RESOLVED EMAIL
  // ============================================
  static async sendTicketResolved(
    contactEmail: string,
    name: string,
    ticketNumber: string,
    subject: string
  ): Promise<void> {
    try {
      await GenericEmailService.sendEmail({
        to: contactEmail,
        subject: `[${ticketNumber}] Ticket Resolved — Plz`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333;">Plz Support</h1>
            </div>
            <h2>Hi ${name},</h2>
            <p>Your support ticket <strong>${ticketNumber}</strong> has been resolved.</p>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
              <p style="margin: 5px 0;"><strong>Ticket:</strong> ${ticketNumber}</p>
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> ✅ Resolved</p>
            </div>
            <p>If you still need help, please create a new support ticket in the Plz app or email us at <strong>support@plz.app</strong>.</p>
            <br />
            <p>Thank you for using Plz!</p>
            <p>Best regards,<br /><strong>Plz Support Team</strong></p>
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #999;">Plz — Nigerian Fundraising App | support@plz.app</p>
          </div>
        `,
      });
      logger.info('Ticket resolved email sent', { contactEmail, ticketNumber });
    } catch (error: any) {
      logger.error('Failed to send ticket resolved email', { error: error.message });
    }
  }
}