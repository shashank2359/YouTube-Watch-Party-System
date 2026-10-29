import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

function parseOrigins(value) {
  return (value || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
}

export function loadConfig(overrides = {}) {
  const clientOrigins = parseOrigins(process.env.CLIENT_ORIGIN);
  if (isProduction && clientOrigins.length === 0) {
    throw new Error('CLIENT_ORIGIN must be set in production (comma-separated list of allowed origins).');
  }
  return {
    port: Number(process.env.PORT) || 4000,
    clientOrigins: clientOrigins.length ? clientOrigins : ['http://localhost:5173'],
    maxRooms: 500,
    maxParticipantsPerRoom: 50,
    hostGraceMs: 30_000, // how long a disconnected host keeps the role
    memberGraceMs: 20_000, // how long a disconnected member's seat is held for reconnect
    syncIntervalMs: 5_000, // periodic drift-correction broadcast while playing
    ...overrides,
  };
}
