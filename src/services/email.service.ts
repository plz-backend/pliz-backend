import nodemailer, { Transporter } from 'nodemailer';
import logger from '../config/logger';

interface ISendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;    // optional — defaults to Plz App
}

export class GenericEmailService {

  private static transporter: Transporter | null = null;

  // ============================================
  // INITIALIZE
  // Call once on server start
  // ============================================
  static initialize(): void {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
      logger.info('✅ Generic email service initialized');
    } catch (error) {
      logger.error('Failed to initialize generic email service', { error });
    }
  }

  // ============================================
  // SEND EMAIL
  // Generic reusable method
  // ============================================
  static async sendEmail(options: ISendEmailOptions): Promise<void> {
    try {
      if (!this.transporter) {
        logger.warn('Generic email service not initialized — initializing now');
        this.initialize();
      }

      if (!this.transporter) {
        throw new Error('Email service unavailable');
      }

      await this.transporter.sendMail({
        from: options.from || `"Plz App" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
      });
    } catch (error: any) {
      logger.error('Failed to send email', {
        error: error.message,
        to: options.to,
        subject: options.subject,
      });
      throw error;
    }
  }
}