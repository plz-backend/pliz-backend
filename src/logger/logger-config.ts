// src/logger/config.ts
import winston from 'winston';
import path from 'path';

const { combine, timestamp, json, printf, colorize, errors } = winston.format;

// Custom format for console logging (development)
const consoleFormat = printf(({ level, message, timestamp, module, requestId, ...metadata }) => {
  let log = `${timestamp} [${level}]`;
  
  if (module) log += ` [${module}]`;
  if (requestId) log += ` [${requestId}]`;
  
  log += `: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }
  
  return log;
});

// Sanitize sensitive data
const sanitizeFormat = winston.format((info) => {
  const sanitize = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = { ...obj };
    const sensitiveKeys = ['password', 'token', 'authorization', 'cookie', 'secret'];
    
    for (const key in sanitized) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitize(sanitized[key]);
      }
    }
    
    return sanitized;
  };
  
  return sanitize(info);
});

// Create transports based on environment
const getTransports = () => {
  const transports: winston.transport[] = [];
  
  // Console transport (always enabled in development)
  if (process.env.NODE_ENV !== 'production' || process.env.LOG_TO_CONSOLE === 'true') {
    transports.push(
      new winston.transports.Console({
        format: combine(
          colorize(),
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          consoleFormat
        ),
      })
    );
  }
  
  // File transports (production)
  if (process.env.LOG_TO_FILE === 'true' || process.env.NODE_ENV === 'production') {
    const logsDir = process.env.LOGS_DIR || 'logs';
    
    // Combined logs
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: combine(timestamp(), json()),
        maxsize: 20 * 1024 * 1024, // 20MB
        maxFiles: 14, // 14 days
      })
    );
    
    // Error logs
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: combine(timestamp(), json()),
        maxsize: 20 * 1024 * 1024,
        maxFiles: 30, // Keep errors longer
      })
    );
  }
  
  return transports;
};

// Main logger configuration
export const loggerConfig: winston.LoggerOptions = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: combine(
    errors({ stack: true }),
    sanitizeFormat(),
    timestamp(),
    json()
  ),
  transports: getTransports(),
  exitOnError: false,
};

// Log levels
export const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};
