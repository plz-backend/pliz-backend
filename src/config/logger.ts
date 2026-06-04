import winston from 'winston';
import { getRequestContext } from './request-context';

const SENSITIVE_KEYS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'secret',
  'otp',
  'phoneotp',
  'api_key',
  'apikey',
  'authorizationcode',
  'accountnumber',
  'nin',
  'bvn',
  'passportnumber',
  'providerresponse',
  'requestbody',
  'body',
];

function sanitizeValue(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeValue);
  }

  const record = obj as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeValue(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

const attachRequestContext = winston.format((info) => {
  const ctx = getRequestContext();
  if (ctx?.requestId) info.requestId = ctx.requestId;
  if (ctx?.userId) info.userId = ctx.userId;
  if (ctx?.method) info.method = ctx.method;
  if (ctx?.path) info.path = ctx.path;
  return info;
});

const sanitizeMetadata = winston.format((info) => sanitizeValue(info) as winston.Logform.TransformableInfo);

const isProduction = process.env.NODE_ENV === 'production';
const logToFile = process.env.LOG_TO_FILE === 'true';

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          attachRequestContext(),
          sanitizeMetadata(),
          winston.format.json()
        )
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          attachRequestContext(),
          winston.format.printf(({ level, message, timestamp, requestId, userId, ...meta }) => {
            let line = `${timestamp} [${level}]`;
            if (requestId) line += ` [${requestId}]`;
            if (userId) line += ` user=${userId}`;
            line += `: ${message}`;
            const rest = sanitizeValue(meta) as Record<string, unknown>;
            const keys = Object.keys(rest).filter((k) => !['service', 'level', 'message', 'timestamp'].includes(k));
            if (keys.length > 0) {
              line += ` ${JSON.stringify(Object.fromEntries(keys.map((k) => [k, rest[k]])))}`;
            }
            return line;
          })
        ),
  }),
];

if (logToFile) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  defaultMeta: { service: 'pliz-app' },
  transports,
  exitOnError: false,
});

export default logger;
