import nodemailer from 'nodemailer';
import logger from '../../../config/logger';
import { withdrawalSuccessTemplate, IWithdrawalSuccessEmail } from '../templates/withdrawal_success.template';
import { withdrawalFailedTemplate, IWithdrawalFailedEmail } from '../templates/withdrawal_failed.template';

/**
 * Withdrawal Email Service
 * Handles all withdrawal-related email notifications
 */
export class WithdrawalEmailService {
  private static transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  /**
   * Send withdrawal success email
   */
  static async sendSuccessEmail(
    email: string,
    data: IWithdrawalSuccessEmail
  ): Promise<void> {
    try {
      const html = withdrawalSuccessTemplate(data);

      await this.transporter.sendMail({
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: '✅ Withdrawal Successful - Funds on the Way! | Pliz',
        html,
      });

      logger.info('Withdrawal success email sent', { 
        email,
        withdrawalId: data.transferReference,
      });
    } catch (error: any) {
      logger.error('Failed to send withdrawal success email', {
        email,
        error: error.message,
      });
      // Don't throw - email failure shouldn't break withdrawal
    }
  }

  /**
   * Send withdrawal failed email
   */
  static async sendFailureEmail(
    email: string,
    data: IWithdrawalFailedEmail
  ): Promise<void> {
    try {
      const html = withdrawalFailedTemplate(data);

      await this.transporter.sendMail({
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: '❌ Withdrawal Failed - Action Required | Pliz',
        html,
      });

      logger.info('Withdrawal failed email sent', { 
        email,
        reason: data.failureReason,
      });
    } catch (error: any) {
      logger.error('Failed to send withdrawal failed email', {
        email,
        error: error.message,
      });
      // Don't throw - email failure shouldn't break withdrawal
    }
  }

  /**
   * Send withdrawal pending email (for manual processing)
   */
  static async sendPendingEmail(
    email: string,
    data: {
      recipientName: string;
      amount: number;
      begTitle: string;
      bankName: string;
      accountNumber: string;
    }
  ): Promise<void> {
    try {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .container { background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 28px; font-weight: bold; color: #4CAF50; }
    .pending-icon { font-size: 48px; margin: 20px 0; }
    h1 { color: #ff9800; font-size: 24px; }
    .info-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9ecef; }
    .footer { text-align: center; margin-top: 30px; color: #6c757d; font-size: 14px; border-top: 1px solid #e9ecef; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">pliz</div>
      <div class="pending-icon">⏳</div>
      <h1>Withdrawal Pending</h1>
    </div>
    
    <p>Hi ${data.recipientName},</p>
    
    <p>Your withdrawal request has been received and is pending processing by our team.</p>
    
    <div class="info-box">
      <strong>⏱️ Processing Time</strong>
      <p style="margin: 10px 0 0 0;">
        Your withdrawal will be processed within 24 hours. You'll receive another email once it's completed.
      </p>
    </div>
    
    <div class="details">
      <h3 style="margin-top: 0;">Withdrawal Details</h3>
      <div class="detail-row">
        <span>Request:</span>
        <span><strong>${data.begTitle}</strong></span>
      </div>
      <div class="detail-row">
        <span>Amount:</span>
        <span><strong>₦${data.amount.toLocaleString()}</strong></span>
      </div>
      <div class="detail-row">
        <span>Bank:</span>
        <span><strong>${data.bankName}</strong></span>
      </div>
      <div class="detail-row" style="border: none;">
        <span>Account:</span>
        <span><strong>${data.accountNumber}</strong></span>
      </div>
    </div>
    
    <p>We'll notify you as soon as the transfer is complete.</p>
    
    <div class="footer">
      <p>Thank you for your patience!</p>
      <p>Questions? Contact <a href="mailto:support@pliz.app">support@pliz.app</a></p>
    </div>
  </div>
</body>
</html>
      `;

      await this.transporter.sendMail({
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: '⏳ Withdrawal Pending - Processing Soon | Pliz',
        html,
      });

      logger.info('Withdrawal pending email sent', { email });
    } catch (error: any) {
      logger.error('Failed to send withdrawal pending email', {
        email,
        error: error.message,
      });
    }
  }
}