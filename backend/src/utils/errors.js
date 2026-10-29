// Errors that are safe to show to clients (no stack traces, no internals).
export class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
  }
}
