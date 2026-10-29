import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ROOM_ID_PATTERN } from './utils/validation.js';

export function createApp({ config, manager }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render sits behind a proxy; needed for correct client IPs in rate limiting
  app.use(cors({ origin: config.clientOrigins }));
  app.use(express.json({ limit: '10kb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', rooms: manager.rooms.size }));

  // Lets the join page give a friendly "room not found" before the user types a name.
  app.get('/api/rooms/:roomId', (req, res) => {
    const id = req.params.roomId.toUpperCase();
    const room = ROOM_ID_PATTERN.test(id) ? manager.getRoom(id) : null;
    if (!room) return res.status(404).json({ error: 'ROOM_NOT_FOUND', message: 'That room does not exist or has ended.' });
    res.json({ roomId: room.id, name: room.name, participantCount: room.participants.size });
  });

  app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[http] error:', err);
    res.status(500).json({ error: 'INTERNAL', message: 'Something went wrong.' });
  });
  return app;
}
