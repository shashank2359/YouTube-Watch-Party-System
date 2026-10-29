import { RoomError } from './errors.js';

export const MAX_SEEK_SECONDS = 60 * 60 * 24; // 24h upper bound; YouTube lives are shorter
// 8 chars, no ambiguous characters (I, O, 0, 1)
export const ROOM_ID_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

export function validateUsername(raw) {
  if (typeof raw !== 'string') throw new RoomError('INVALID_USERNAME', 'Username is required.');
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 24) {
    throw new RoomError('INVALID_USERNAME', 'Username must be 2–24 characters.');
  }
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(name)) {
    throw new RoomError('INVALID_USERNAME', 'Username contains unsupported characters.');
  }
  return name;
}

export function validateRoomId(raw) {
  if (typeof raw !== 'string') throw new RoomError('INVALID_ROOM_ID', 'Room code is required.');
  const id = raw.trim().toUpperCase();
  if (!ROOM_ID_PATTERN.test(id)) {
    throw new RoomError('INVALID_ROOM_ID', 'Room code must be 8 letters/numbers.');
  }
  return id;
}

export function validateRoomName(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw !== 'string') throw new RoomError('INVALID_ROOM_NAME', 'Room name must be text.');
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 40) {
    throw new RoomError('INVALID_ROOM_NAME', 'Room name must be 1–40 characters.');
  }
  if (/[\u0000-\u001f<>]/.test(name)) {
    throw new RoomError('INVALID_ROOM_NAME', 'Room name contains unsupported characters.');
  }
  return name;
}

export function validateSeekTime(time) {
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > MAX_SEEK_SECONDS) {
    throw new RoomError('INVALID_TIME', 'Seek time must be a number between 0 and 24 hours.');
  }
  return time;
}
