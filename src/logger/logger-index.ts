// src/logger/index.ts
import winston from 'winston';
import { loggerConfig } from './logger-config';

class Logger {
  private logger: winston.Logger;
  
  constructor() {
    this.logger = winston.createLogger(loggerConfig);
  }
  
  // Create a child logger with module context
  forModule(moduleName: string) {
    return this.logger.child({ module: moduleName });
  }
  
  // Create a child logger with request context
  forRequest(requestId: string, userId?: string) {
    return this.logger.child({ 
      requestId, 
      ...(userId && { userId }) 
    });
  }
  
  // Direct logging methods
  error(message: string, meta?: any) {
    this.logger.error(message, meta);
  }
  
  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }
  
  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }
  
  http(message: string, meta?: any) {
    this.logger.http(message, meta);
  }
  
  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }
  
  // Utility method for logging slow operations
  logSlowOperation(operation: string, duration: number, threshold = 100) {
    if (duration > threshold) {
      this.warn(`Slow operation detected: ${operation}`, { 
        duration, 
        threshold 
      });
    }
  }
  
  // Log with execution time
  async withTiming<T>(
    operation: string, 
    fn: () => Promise<T>, 
    meta?: any
  ): Promise<T> {
    const start = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      this.info(`${operation} completed`, { duration, ...meta });
      this.logSlowOperation(operation, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${operation} failed`, { duration, error, ...meta });
      throw error;
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for creating module-specific loggers
export default logger;
