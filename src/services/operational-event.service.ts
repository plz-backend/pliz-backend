import prisma from '../config/database';
import logger from '../config/logger';
import { getRequestContext } from '../config/request-context';
import { maskPhoneForLog } from '../utils/sanitize-log';
import { Prisma } from '@prisma/client';

export type OperationalEventSeverity = 'info' | 'warn' | 'error';

export type RecordOperationalEventInput = {
  userId?: string | null;
  eventType: string;
  severity?: OperationalEventSeverity;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
};

function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase();
    if (lower.includes('password') || lower.includes('otp') || lower.includes('token')) {
      out[key] = '[REDACTED]';
    } else if (lower.includes('phone') && typeof value === 'string') {
      out[key] = maskPhoneForLog(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export class OperationalEventService {
  /**
   * Persist a support-friendly event and mirror it to structured logs.
   * Never throws — logging must not break user flows.
   */
  static record(input: RecordOperationalEventInput): void {
    const ctx = getRequestContext();
    const requestId = input.requestId ?? ctx?.requestId;
    const userId = input.userId ?? ctx?.userId ?? null;
    const severity = input.severity ?? 'info';
    const metadata = sanitizeMetadata(input.metadata);

    const logPayload = {
      eventType: input.eventType,
      userId,
      requestId,
      source: input.source,
      ...metadata,
    };

    if (severity === 'error') {
      logger.error(input.message, logPayload);
    } else if (severity === 'warn') {
      logger.warn(input.message, logPayload);
    } else {
      logger.info(input.message, logPayload);
    }

    void prisma.operationalEvent
      .create({
        data: {
          userId,
          eventType: input.eventType,
          severity,
          message: input.message,
          metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          requestId,
          source: input.source,
        },
      })
      .catch((err: Error) => {
        logger.error('operational_event.persist_failed', {
          eventType: input.eventType,
          error: err.message,
        });
      });
  }
}
