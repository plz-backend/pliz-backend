import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = unknown>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   GET /api/admin/operational-events
 * @desc    Search user-facing operational events for support troubleshooting
 * @access  Admin
 */
export const getOperationalEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const skip = (page - 1) * limit;

    const userId = req.query.userId as string | undefined;
    const eventType = req.query.eventType as string | undefined;
    const severity = req.query.severity as string | undefined;
    const requestId = req.query.requestId as string | undefined;
    const source = req.query.source as string | undefined;
    const search = req.query.search as string | undefined;
    const withdrawalId = req.query.withdrawalId as string | undefined;

    const where: {
      userId?: string;
      eventType?: { contains: string; mode: 'insensitive' };
      severity?: string;
      requestId?: string;
      source?: string;
      message?: { contains: string; mode: 'insensitive' };
      metadata?: { path: string[]; equals: string };
    } = {};

    if (userId) where.userId = userId;
    if (eventType) where.eventType = { contains: eventType, mode: 'insensitive' };
    if (severity) where.severity = severity;
    if (requestId) where.requestId = requestId;
    if (source) where.source = source;
    if (search) where.message = { contains: search, mode: 'insensitive' };
    if (withdrawalId) {
      where.metadata = { path: ['withdrawalId'], equals: withdrawalId };
    }

    const [events, total] = await Promise.all([
      prisma.operationalEvent.findMany({
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
            },
          },
        },
      }),
      prisma.operationalEvent.count({ where }),
    ]);

    sendResponse(res, 200, {
      success: true,
      message: 'Operational events retrieved successfully',
      data: {
        events: events.map((e) => ({
          id: e.id,
          user_id: e.userId,
          user: e.user,
          event_type: e.eventType,
          severity: e.severity,
          message: e.message,
          metadata: e.metadata,
          request_id: e.requestId,
          source: e.source,
          created_at: e.createdAt,
        })),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Get operational events error', { error: message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve operational events',
    });
  }
};
