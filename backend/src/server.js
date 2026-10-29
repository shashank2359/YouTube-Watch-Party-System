import http from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { RoomManager } from './rooms/RoomManager.js';
import { registerSocketHandlers } from './sockets/socketHandler.js';

/** Builds (but does not start listening on) the HTTP + Socket.IO server. Tests call this with short timers. */
export function createWatchServer(overrides = {}) {
  const config = loadConfig(overrides);
  const manager = new RoomManager({ maxRooms: config.maxRooms });
  const app = createApp({ config, manager });
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigins },
    maxHttpBufferSize: 10_000, // events are tiny; reject anything large
  });
  const handlers = registerSocketHandlers(io, manager, config);

  const close = () =>
    new Promise((resolve) => {
      handlers.stop();
      for (const id of [...manager.rooms.keys()]) manager.deleteRoom(id);
      io.close(() => resolve());
    });

  return { config, manager, httpServer, io, close };
}
