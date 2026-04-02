import nodemailer, { Transporter } from 'nodemailer';
import logger from '../../../config/logger';

/**
 * Email Service
 * Handles sending emails for authentication
 */
export class EmailService {
  private static transporter: Transporter | null = null;

  /**
   * Initialize email service
   */
  static initialize(): void {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      logger.info('✅ Email service initialized');
    } catch (error) {
      logger.error('Failed to initialize email service', { error });
    }
  }

  /**
   * Send email verification email
   */
  static async sendVerificationEmail(
    email: string,
    token: string
  ): Promise<void> {
    try {
      if (!this.transporter) {
        logger.warn('Email service not initialized');
        return;
      }

      const frontendBase = (
        process.env.FRONTEND_URL ||
        process.env.EXPO_PUBLIC_FRONTEND_URL ||
        ''
      ).replace(/\/$/, '');
      const apiBase = (process.env.BASE_URL || '').replace(/\/$/, '');
      const verificationUrl = frontendBase
        ? `${frontendBase}/verify-email?token=${encodeURIComponent(token)}`
        : `${apiBase}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

      const mailOptions = {
        from: `"Plz App" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify Your Email - Plz App',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
              .button { display: inline-block; padding: 12px 30px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
              .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to Plz App!</h1>
              </div>
              <div class="content">
                <h2>Verify Your Email Address</h2>
                <p>Thank you for registering with Plz App. Please click the button below to verify your email address:</p>
                <a
                  href="${verificationUrl}"
                  style="
                    display: inline-block;
                    background-color: #2563eb;
                    color: #ffffff;
                    text-decoration: none;
                    padding: 12px 20px;
                    border-radius: 6px;
                    font-weight: 600;
                  "
                >
                  Verify Email
                </a>
                <p style="margin-top: 20px;">Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #4F46E5;">${verificationUrl}</p>
                <p style="margin-top: 20px; color: #666;">This link will expire in 24 hours.</p>
              </div>
              <div class="footer">
                <p>If you didn't create an account with Plz App, please ignore this email.</p>
                <p>&copy; ${new Date().getFullYear()} Plz App. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await this.transporter.sendMail(mailOptions);

      logger.info('Verification email sent', { email });
    } catch (error) {
      logger.error('Failed to send verification email', { error, email });
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(
    email: string,
    token: string
  ): Promise<void> {
    try {
      if (!this.transporter) {
        logger.warn('Email service not initialized');
        return;
      }

      const resetUrl = `${process.env.BASE_URL}/api/auth/reset-password?token=${token}`;

      const mailOptions = {
        from: `"Plz App" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password Reset Request - Plz App',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #EF4444; color: white; padding: 20px; text-align: center; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
              .button { display: inline-block; padding: 12px 30px; background: #EF4444; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
              .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
              .warning { background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset Request</h1>
              </div>
              <div class="content">
                <h2>Reset Your Password</h2>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <a href="${resetUrl}" class="button">Reset Password</a>
                <p style="margin-top: 20px;">Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #EF4444;">${resetUrl}</p>
                <div class="warning">
                  <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour for security reasons.
                </div>
              </div>
              <div class="footer">
                <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
                <p>&copy; ${new Date().getFullYear()} Plz App. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await this.transporter.sendMail(mailOptions);

      logger.info('Password reset email sent', { email });
    } catch (error) {
      logger.error('Failed to send password reset email', { error, email });
      throw error;
    }
  }

  /**
   * Send password changed confirmation email
   */
  static async sendPasswordChangedEmail(
    email: string,
    username: string
  ): Promise<void> {
    try {
      if (!this.transporter) {
        logger.warn('Email service not initialized');
        return;
      }

      const mailOptions = {
        from: `"Plz App" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password Changed Successfully - Plz App',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #10B981; color: white; padding: 20px; text-align: center; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
              .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
              .alert { background: #FEE2E2; padding: 15px; border-left: 4px solid #EF4444; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✓ Password Changed</h1>
              </div>
              <div class="content">
                <h2>Hello ${username}!</h2>
                <p>Your password has been successfully changed.</p>
                <p>If you made this change, no further action is needed.</p>
                <div class="alert">
                  <strong>⚠️ Didn't make this change?</strong><br>
                  If you didn't change your password, please contact our support team immediately.
                </div>
                <p>For your security, all your active sessions on other devices have been logged out.</p>
              </div>
              <div class="footer">
                <p>This is an automated security notification.</p>
                <p>&copy; ${new Date().getFullYear()} Plz App. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await this.transporter.sendMail(mailOptions);

      logger.info('Password changed email sent', { email });
    } catch (error) {
      logger.error('Failed to send password changed email', { error, email });
      // Don't throw - this is a notification email
    }
  }
}