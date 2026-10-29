import crypto from 'node:crypto';
import { ROLES } from './roles.js';
import { RoomError } from '../utils/errors.js';

const MAX_PENDING_PER_USER = 3;
const MAX_PENDING_PER_ROOM = 20;

/**
 * One watch party. This object is the single source of truth for the room:
 * clients only ever render what the server broadcasts from here.
 *
 * Playback is stored as (baseTime, updatedAt, playState). While playing, the
 * current position is baseTime + elapsed server time, so we never need a
 * ticking timer and late joiners get an accurate position.
 */
export class Room {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
    this.createdAt = Date.now();

    this.participants = new Map(); // userId -> participant record
    this.tokenIndex = new Map(); // sessionToken -> userId
    this.hostId = null;

    this.videoId = null;
    this.playState = 'paused';
    this.baseTime = 0;
    this.updatedAt = Date.now();
    this.version = 0; // increases on every playback mutation (ordering guard for clients)

    this.requests = new Map(); // requestId -> pending playback request
    this.chatMessages = []; // recent room chat; intentionally in-memory like room state
  }

  // ---- participants -------------------------------------------------------

  addParticipant({ username, socketId, role }) {
    const participant = {
      id: crypto.randomBytes(8).toString('hex'),
      username,
      role,
      socketId,
      connected: true,
      joinedAt: Date.now(),
      sessionToken: crypto.randomBytes(24).toString('base64url'), // secret: only ever sent to its owner
      disconnectTimer: null,
    };
    this.participants.set(participant.id, participant);
    this.tokenIndex.set(participant.sessionToken, participant.id);
    if (role === ROLES.HOST) this.hostId = participant.id;
    return participant;
  }

  getParticipant(userId) {
    return this.participants.get(userId) ?? null;
  }

  findByToken(token) {
    if (typeof token !== 'string' || token.length > 100) return null;
    const userId = this.tokenIndex.get(token);
    return userId ? this.participants.get(userId) ?? null : null;
  }

  isUsernameTaken(username, exceptUserId = null) {
    const lower = username.toLowerCase();
    for (const p of this.participants.values()) {
      if (p.id !== exceptUserId && p.username.toLowerCase() === lower) return true;
    }
    return false;
  }

  removeParticipant(userId) {
    const participant = this.participants.get(userId);
    if (!participant) return null;
    clearTimeout(participant.disconnectTimer);
    this.participants.delete(userId);
    this.tokenIndex.delete(participant.sessionToken);
    for (const [requestId, request] of this.requests) {
      if (request.userId === userId) this.requests.delete(requestId);
    }
    return participant;
  }

  /** Public view: never includes socketId or sessionToken. */
  publicParticipants() {
    return [...this.participants.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map(({ id, username, role, connected }) => ({ userId: id, username, role, connected }));
  }

  /** Who becomes host when the host leaves: connected moderators first, then oldest connected participant. */
  pickSuccessor(excludeUserId) {
    const candidates = [...this.participants.values()]
      .filter((p) => p.id !== excludeUserId)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    return (
      candidates.find((p) => p.connected && p.role === ROLES.MODERATOR) ??
      candidates.find((p) => p.connected) ??
      null
    );
  }

  setRole(userId, role) {
    this.participants.get(userId).role = role;
  }

  transferHost(toUserId) {
    const previous = this.participants.get(this.hostId);
    if (previous) previous.role = ROLES.MODERATOR;
    this.participants.get(toUserId).role = ROLES.HOST;
    this.hostId = toUserId;
  }

  // ---- playback -----------------------------------------------------------

  currentTime(now = Date.now()) {
    if (this.playState === 'playing') return this.baseTime + (now - this.updatedAt) / 1000;
    return this.baseTime;
  }

  #commit(playState, time) {
    this.baseTime = time;
    this.playState = playState;
    this.updatedAt = Date.now();
    this.version += 1;
  }

  #requireVideo() {
    if (!this.videoId) throw new RoomError('NO_VIDEO', 'No video is loaded yet.');
  }

  play() {
    this.#requireVideo();
    this.#commit('playing', this.currentTime());
  }

  pause() {
    this.#requireVideo();
    this.#commit('paused', this.currentTime());
  }

  seek(time) {
    this.#requireVideo();
    this.#commit(this.playState, time);
  }

  changeVideo(videoId) {
    this.videoId = videoId;
    this.#commit('paused', 0); // new videos start paused: avoids autoplay-block surprises
  }

  /** Payload for sync_state. currentTime is evaluated at serverTime. */
  state() {
    const now = Date.now();
    return {
      videoId: this.videoId,
      playState: this.playState,
      currentTime: this.currentTime(now),
      version: this.version,
      serverTime: now,
    };
  }

  // ---- room chat ----------------------------------------------------------

  addChatMessage(participant, text) {
    const message = {
      id: crypto.randomBytes(8).toString('hex'),
      userId: participant.id,
      username: participant.username,
      text,
      createdAt: Date.now(),
    };
    this.chatMessages.push(message);
    if (this.chatMessages.length > 80) this.chatMessages.splice(0, this.chatMessages.length - 80);
    return message;
  }

  // ---- playback requests (participant -> reviewer approval) ---------------

  addRequest(participant, { action, time = null, videoId = null }) {
    if (this.requests.size >= MAX_PENDING_PER_ROOM) {
      throw new RoomError('TOO_MANY_REQUESTS', 'Too many pending requests in this room.');
    }
    const mine = [...this.requests.values()].filter((r) => r.userId === participant.id).length;
    if (mine >= MAX_PENDING_PER_USER) {
      throw new RoomError('TOO_MANY_REQUESTS', 'You already have 3 pending requests.');
    }
    const request = {
      id: crypto.randomBytes(6).toString('hex'),
      userId: participant.id,
      username: participant.username,
      action,
      time,
      videoId,
      createdAt: Date.now(),
    };
    this.requests.set(request.id, request);
    return request;
  }

  takeRequest(requestId) {
    const request = typeof requestId === 'string' ? this.requests.get(requestId) : undefined;
    if (!request) throw new RoomError('REQUEST_NOT_FOUND', 'That request no longer exists.');
    this.requests.delete(requestId);
    return request;
  }

  pendingRequests() {
    return [...this.requests.values()];
  }

  dispose() {
    for (const p of this.participants.values()) clearTimeout(p.disconnectTimer);
  }
}
