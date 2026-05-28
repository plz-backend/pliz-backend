import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { IApiResponse } from './modules/auth/types/user.interface';
import { errorLogger } from './logger/logger-middleware';
import { requestLoggerMiddleware, globalErrorHandler } from './middleware/request-logger.middleware';

// Routes
import authRoutes from './modules/auth/routes/authRoutes';
import sessionRoutes from './modules/auth/routes/session.routes';
import profileRoutes from './modules/auth/routes/profile.routes';
import usersRoutes from './modules/auth/routes/users.routes';
import kycRoutes from './modules/KYC/routes/kyc.routes';
import begRoutes from './modules/Beg/routers/beg.routers';
import donorRoutes from './modules/Donor/router/donations.routes';
import notificationRoutes from './modules/notifications/routes/notification.routes';
import flutterwaveWebhookRoutes from './webhooks/flutterwave.webhook';
import adminRoutes from './modules/admin/routes/admin.routes';
import paymentMethodRoutes from './modules/Payment/router/payment_method.routes';
import withdrawalRoutes from './modules/Withdrawal/router/withdrawal.routes';
import storyRoutes from './modules/Story/routes/story.routes';
import reactionRoutes from './modules/Reactions/routes/reaction.routes';
import profilePictureRoutes from './modules/ProfilePicture/routes/profile-picture.routes';
import locationRoutes from './modules/Location/routes/location.routes';
import supportRoutes from './modules/Support/routes/support.routes';
import securityRoutes from './modules/Security/routes/security.routes';
import schedulerRoutes from './routes/scheduler.routes';
import { runHealthChecks } from './config/health';
import { isProduction } from './config/env';

export const createApp = (): Express => {
  const app = express();

  // Cloud Run sits behind Google's load balancer (sets X-Forwarded-For).
  // Required for express-rate-limit and correct req.ip behind a proxy.
  app.set('trust proxy', 1);

  // ── Flutterwave webhook ───────────────────
  app.use(
    '/webhooks/flutterwave',
    express.json(),
    flutterwaveWebhookRoutes
  );

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
      ? isProduction()
        ? false
        : true
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

  // Request ID + structured logging (Cloud Run stdout)
  app.use(requestLoggerMiddleware);

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
  app.use('/api/users', usersRoutes);
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
  app.use('/api/security', securityRoutes);
  app.use('/internal/scheduler', schedulerRoutes);

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
          webhook: '/webhooks/flutterwave',
        },
        features: [
          'User Registration & Login',
          'Google & Apple OAuth',
          'Multi-Device Session Management',
          'JWT Authentication',
          'PostgreSQL Database',
          'Redis Caching',
          'Flutterwave Payments',
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
  app.get('/health', async (_req: Request, res: Response) => {
    const health = await runHealthChecks();
    const httpStatus = health.status === 'unhealthy' ? 503 : 200;

    res.status(httpStatus).json({
      success: health.status !== 'unhealthy',
      message:
        health.status === 'healthy'
          ? 'Server is healthy'
          : health.status === 'degraded'
            ? 'Server is degraded'
            : 'Server is unhealthy',
      data: health,
    });
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

  // Error logging middleware (legacy — no-op if req.logger missing)
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if ((req as Request & { logger?: { error: (msg: string, meta?: unknown) => void } }).logger) {
      return errorLogger(err, req, res, next);
    }
    next(err);
  });

  app.use(globalErrorHandler);

  return app;
};
