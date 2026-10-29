import crypto from 'node:crypto';
import { Room } from './Room.js';
import { RoomError } from '../utils/errors.js';

// 32 symbols, no I/O/0/1 -> 32^8 ≈ 1.1e12 possible codes, drawn from a CSPRNG
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Owns all rooms plus the socket -> (room, participant) mapping.
 * That mapping is the ONLY thing the server trusts to know who a socket is.
 * Swapping in a DB later means changing this class, not the handlers.
 */
export class RoomManager {
  constructor({ maxRooms = 500 } = {}) {
    this.maxRooms = maxRooms;
    this.rooms = new Map();
    this.socketIndex = new Map(); // socketId -> { roomId, userId }
  }

  #generateId() {
    let id = '';
    for (let i = 0; i < 8; i += 1) id += ALPHABET[crypto.randomInt(ALPHABET.length)];
    return id;
  }

  createRoom(name) {
    if (this.rooms.size >= this.maxRooms) {
      throw new RoomError('SERVER_BUSY', 'The server is at capacity. Please try again later.');
    }
    let id = this.#generateId();
    while (this.rooms.has(id)) id = this.#generateId();
    const room = new Room({ id, name });
    this.rooms.set(id, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) ?? null;
  }

  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.dispose();
    this.rooms.delete(roomId);
  }

  attachSocket(socketId, roomId, userId) {
    this.socketIndex.set(socketId, { roomId, userId });
  }

  detachSocket(socketId) {
    this.socketIndex.delete(socketId);
  }

  /** Resolve the caller from server-side state only. Throws if the socket is not in a room. */
  context(socketId) {
    const ref = this.socketIndex.get(socketId);
    const room = ref ? this.getRoom(ref.roomId) : null;
    const me = room ? room.getParticipant(ref.userId) : null;
    if (!room || !me || me.socketId !== socketId) {
      throw new RoomError('NOT_IN_ROOM', 'You are not in a room.');
    }
    return { room, me };
  }
}
