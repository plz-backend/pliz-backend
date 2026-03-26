import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import logger from './logger';

let io: SocketIOServer;

// userId → socketId for direct user targeting
const connectedUsers = new Map<string, string>();

export const initializeSocket = (server: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info('Socket client connected', { socketId: socket.id });

    // Frontend calls: socket.emit('register', userId) after login
    socket.on('register', (userId: string) => {
      connectedUsers.set(userId, socket.id);
      socket.join(`user:${userId}`);
      logger.info('User registered to socket', { userId, socketId: socket.id });
    });

    socket.on('disconnect', () => {
      for (const [userId, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          logger.info('User socket disconnected', { userId });
          break;
        }
      }
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

export const isUserOnline = (userId: string): boolean => {
  return connectedUsers.has(userId);
};