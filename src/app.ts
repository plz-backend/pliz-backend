import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { IApiResponse } from './modules/auth/types/user.interface';
import { errorLogger } from './logger/logger-middleware';

// Routes
import authRoutes from './modules/auth/routes/authRoutes';
import sessionRoutes from './modules/auth/routes/session.routes';
import profileRoutes from './modules/auth/routes/profile.routes';
import begRoutes from './modules/Beg/routers/beg.routers';
import donorRoutes from './modules/Donor/router/donations.routes';
import notificationRoutes from './modules/notifications/routes/notification.routes';
import webhookRoutes from './webhooks/paystack.webhook';
import adminRoutes from './modules/admin/routes/admin.routes';
import paymentMethodRoutes from './modules/Payment/router/payment_method.routes';
import withdrawalRoutes from './modules/Withdrawal/router/withdrawal.routes';
import path from 'path/win32';

export const createApp = (): Express => {
  const app = express();

  // Raw body for Paystack webhook MUST be before express.json()
  // Paystack signature verification needs the raw body string
  app.use('/webhooks/paystack', express.raw({ type: 'application/json' }), webhookRoutes);

  // Security middleware
  app.use(helmet());

  // CORS — comma-separated FRONTEND_URL for staging + production web origins (credentialed cookies)
  const corsOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  app.use(
    cors({
      origin:
        corsOrigins.length === 0
          ? undefined
          : corsOrigins.length === 1
            ? corsOrigins[0]
            : corsOrigins,
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

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/auth/profile', profileRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/begs', begRoutes);
  app.use('/api/donations', donorRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/payment-methods', paymentMethodRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/withdrawals', withdrawalRoutes); 
  // Serve static assets (BEFORE routes)
  app.use('/assets', express.static(path.join(__dirname, '../public/assets')));


  
  // Root endpoint
  app.get('/', (req: Request, res: Response) => {
    const response: IApiResponse = {
      success: true,
      message: 'PLIZ API Server',
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
          webhook: '/webhooks/paystack',
        },
        features: [
          'User Registration & Login',
          'Multi-Device Session Management',
          'JWT Authentication',
          'PostgreSQL Database',
          'Redis Caching',
          'Paystack Payments',
          'Real-time Notifications (Socket.io)',
          'Donor Ranking System',
          'Gratitude Messaging',
        ],
      },
    };
    res.json(response);
  });

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    const response: IApiResponse = {
      success: true,
      message: 'Server is healthy',
      data: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    };
    res.json(response);
  });

  // 404 handler
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