import { Server as HTTPServer } from 'http';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Server as IOServer } from 'socket.io';
import config from '../config';
import { User } from '../modules/user/user.model';
import { errorLogger, logger } from '../shared/logger';

let io: IOServer;

// open connections per profile id; a user is online while this is > 0,
// so closing one of several tabs doesn't mark them offline
const connections = new Map<string, number>();

const initializeSocket = (server: HTTPServer) => {
  if (io) return io;

  io = new IOServer(server, {
    pingTimeout: 60000,
    cors: { origin: config.cors_origins, credentials: true },
  });

  // authenticate before the connection is accepted
  io.use(async (socket, next) => {
    try {
      let token = (socket.handshake.auth?.token ||
        socket.handshake.query?.token) as string | undefined;
      if (!token) return next(new Error('Unauthorized'));
      if (token.startsWith('Bearer ')) token = token.slice(7);

      const decoded = jwt.verify(
        token.trim(),
        config.jwt_access_secret as string,
      ) as JwtPayload;
      if (!decoded?.profileId) return next(new Error('Unauthorized'));

      const user = await User.findById(decoded.id).select(
        'isBlocked isDeleted',
      );
      if (!user || user.isBlocked || user.isDeleted) {
        return next(new Error('Unauthorized'));
      }

      socket.data.profileId = String(decoded.profileId);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const profileId: string = socket.data.profileId;
    socket.join(profileId);
    connections.set(profileId, (connections.get(profileId) || 0) + 1);

    socket.on('disconnect', () => {
      const left = (connections.get(profileId) || 1) - 1;
      if (left > 0) connections.set(profileId, left);
      else connections.delete(profileId);
    });
  });

  io.engine.on('connection_error', (err) => {
    errorLogger.warn('Socket connection error', { message: err.message });
  });

  logger.info('Socket.io initialized');
  return io;
};

const isUserOnline = (userId: string) => (connections.get(userId) || 0) > 0;

const getIO = () => {
  if (!io) throw new Error('Socket.io is not initialized.');
  return io;
};

export { getIO, initializeSocket, isUserOnline };
