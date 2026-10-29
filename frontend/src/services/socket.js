import { io } from 'socket.io-client';

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

// One shared connection for the whole app (prevents duplicate sockets / duplicate handlers).
export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnectionDelayMax: 5000,
});

export function connectSocket(timeoutMs = 8000) {
  if (socket.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok) => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      resolve(ok);
    };
    const onConnect = () => done(true);
    const timer = setTimeout(() => done(false), timeoutMs);
    socket.on('connect', onConnect);
    socket.connect();
  });
}

/** Emit with an acknowledgement; always resolves to { ok, ... } and never throws. */
export function emitAck(event, payload = {}) {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({ ok: false, error: { code: 'OFFLINE', message: 'Not connected to the server.' } });
      return;
    }
    socket.timeout(8000).emit(event, payload, (err, res) => {
      if (err) resolve({ ok: false, error: { code: 'TIMEOUT', message: 'The server did not respond in time.' } });
      else resolve(res);
    });
  });
}

// Session identity is kept per browser TAB (sessionStorage) so two tabs = two users, and it is never put in a URL.
const key = (roomId) => `wt:session:${roomId}`;
export const sessions = {
  get(roomId) {
    try { return JSON.parse(sessionStorage.getItem(key(roomId))); } catch { return null; }
  },
  set(roomId, data) {
    try { sessionStorage.setItem(key(roomId), JSON.stringify(data)); } catch { /* storage unavailable */ }
  },
  clear(roomId) {
    try { sessionStorage.removeItem(key(roomId)); } catch { /* ignore */ }
  },
};
