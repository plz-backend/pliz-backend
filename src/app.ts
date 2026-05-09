import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { IApiResponse } from './modules/auth/types/user.interface';
import { errorLogger } from './logger/logger-middleware';

// Routes
import authRoutes from './modules/auth/routes/authRoutes';
import sessionRoutes from './modules/auth/routes/session.routes';
import profileRoutes from './modules/auth/routes/profile.routes';
import kycRoutes from './modules/KYC/routes/kyc.routes';
import begRoutes from './modules/Beg/routers/beg.routers';
import donorRoutes from './modules/Donor/router/donations.routes';
import notificationRoutes from './modules/notifications/routes/notification.routes';
import webhookRoutes from './webhooks/paystack.webhook';
import adminRoutes from './modules/admin/routes/admin.routes';
import paymentMethodRoutes from './modules/Payment/router/payment_method.routes';
import withdrawalRoutes from './modules/Withdrawal/router/withdrawal.routes';
import storyRoutes from './modules/Story/routes/story.routes';
import reactionRoutes from './modules/Reactions/routes/reaction.routes';
import profilePictureRoutes from './modules/ProfilePicture/routes/profile-picture.routes';
import locationRoutes from './modules/Location/routes/location.routes';
import supportRoutes from './modules/Support/routes/support.routes';

export const createApp = (): Express => {
  const app = express();

  // Raw body for Paystack webhook MUST be before express.json()
  app.use('/webhooks/paystack', express.raw({ type: 'application/json' }), webhookRoutes);

  // Security middleware
  app.use(helmet());

  // CORS — comma-separated ALLOWED_ORIGINS for staging + production web origins (credentialed cookies).
  // When empty, reflect the request origin (`true`) so browsers accept credentialed responses
  // (Access-Control-Allow-Origin must be a specific origin, not `*`). `undefined` falls back to
  // permissive defaults and often breaks httpOnly refresh cookies on cross-origin Expo web + API.
  const corsOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const corsOriginOption =
    corsOrigins.length === 0
      ? true
      : corsOrigins.length === 1
        ? corsOrigins[0]
        : corsOrigins;
  app.use(
    cors({
      origin: corsOriginOption,
      credentials: true,
    })
  );

  app.use(cookieParser());

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  }

  // Serve static assets
  app.use('/assets', express.static(path.join(process.cwd(), 'public/assets')));

  // ============================================
  // API ROUTES
  // ============================================
  app.use('/api/auth', authRoutes);
  app.use('/api/auth/profile', profileRoutes);
  app.use('/api/kyc', kycRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/begs', begRoutes);
  app.use('/api/donations', donorRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/payment-methods', paymentMethodRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/withdrawals', withdrawalRoutes);
  app.use('/api/stories', storyRoutes);
  app.use('/api/reactions', reactionRoutes);
  app.use('/api/profile-picture', profilePictureRoutes);
  app.use('/api/location', locationRoutes);
  app.use('/api/support', supportRoutes);

  // ============================================
  // ROOT ENDPOINT
  // ============================================
  app.get('/', (req: Request, res: Response) => {
    const response: IApiResponse = {
      success: true,
      message: 'Plz API Server',
      data: {
        version: '1.0.0',
        status: 'running',
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
          auth: '/api/auth',
          sessions: '/api/sessions',
          begs: '/api/begs',
          donations: '/api/donations',
          notifications: '/api/notifications',
          withdrawals: '/api/withdrawals',
          stories: '/api/stories',
          support: '/api/support',
          webhook: '/webhooks/paystack',
        },
        features: [
          'User Registration & Login',
          'Google & Apple OAuth',
          'Multi-Device Session Management',
          'JWT Authentication',
          'PostgreSQL Database',
          'Redis Caching',
          'Paystack Payments',
          'Real-time Notifications (Socket.io)',
          'Donor Ranking System',
          'Gratitude Messaging',
          'Community Stories',
        ],
      },
    };
    res.json(response);
  });

  // ============================================
  // HEALTH CHECK
  // ============================================
  app.get('/health', async (req: Request, res: Response) => {
    const response: IApiResponse = {
      success: true,
      message: 'Server is healthy',
      data: {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    };

    res.status(200).json(response);
  });

  // ============================================
  // 404 HANDLER
  // ============================================
  app.use((req: Request, res: Response) => {
    const response: IApiResponse = {
      success: false,
      message: 'Route not found',
      data: {
        path: req.path,
        method: req.method,
      },
    };
    res.status(404).json(response);
  });

  // Error logging middleware
  app.use(errorLogger);

  // Global error handler
  app.use((error: any, req: Request, res: Response, next: any) => {
    console.error('Global error handler:', error);
    const response: IApiResponse = {
      success: false,
      message: error.message || 'Internal server error',
    };
    res.status(error.status || 500).json(response);
  });

  return app;
};
