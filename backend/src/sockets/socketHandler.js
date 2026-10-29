import { ROLES, ASSIGNABLE_ROLES, isHost, canControlPlayback, canManageParticipants } from '../rooms/roles.js';
import { RoomError } from '../utils/errors.js';
import { createRateLimiter } from '../utils/rateLimiter.js';
import { extractVideoId } from '../utils/youtube.js';
import {
  validateRoomId,
  validateRoomName,
  validateSeekTime,
  validateUsername,
} from '../utils/validation.js';

const REQUEST_ACTIONS = ['play', 'pause', 'seek', 'change_video'];

export function registerSocketHandlers(io, manager, config) {
  // ---- helpers ------------------------------------------------------------

  const toRoom = (room, event, payload) => io.to(room.id).emit(event, payload);

  const broadcastState = (room, actor) =>
    toRoom(room, 'sync_state', { ...room.state(), updatedBy: actor?.username ?? null });

  /** Full snapshot returned to a client right after it joins (or re-joins). */
  function snapshotFor(room, me) {
    const reviewer = canControlPlayback(me);
    return {
      roomId: room.id,
      name: room.name,
      hostId: room.hostId,
      participants: room.publicParticipants(),
      state: room.state(),
      chatMessages: room.chatMessages.slice(-80),
      pendingRequests: reviewer
        ? room.pendingRequests()
        : room.pendingRequests().filter((r) => r.userId === me.id),
    };
  }

  const identityFor = (me) => ({ userId: me.id, sessionToken: me.sessionToken, role: me.role, username: me.username });

  function bindSocket(socket, room, participant) {
    participant.socketId = socket.id;
    participant.connected = true;
    clearTimeout(participant.disconnectTimer);
    participant.disconnectTimer = null;
    manager.attachSocket(socket.id, room.id, participant.id);
    socket.join(room.id);
  }

  /** Remove a participant from a room for good (leave, grace period expired). Handles host succession and cleanup. */
  function depart(room, participant, reason) {
    if (manager.getRoom(room.id) !== room || room.getParticipant(participant.id) !== participant) return;

    let newHost = null;
    if (room.hostId === participant.id) {
      newHost = room.pickSuccessor(participant.id);
      if (newHost) room.transferHost(newHost.id);
    }

    room.removeParticipant(participant.id);
    const departingSocket = io.sockets.sockets.get(participant.socketId);
    if (manager.socketIndex.get(participant.socketId)?.userId === participant.id) {
      manager.detachSocket(participant.socketId);
    }
    departingSocket?.leave(room.id);

    if (room.participants.size === 0) {
      manager.deleteRoom(room.id); // empty room cleanup
      return;
    }
    toRoom(room, 'user_left', {
      userId: participant.id,
      username: participant.username,
      reason,
      participants: room.publicParticipants(),
    });
    if (newHost) {
      toRoom(room, 'host_transferred', {
        userId: newHost.id,
        username: newHost.username,
        previousHostId: participant.id,
        reason: 'host_left',
        participants: room.publicParticipants(),
      });
    }
  }

  function leaveCurrentRoom(socketId, reason) {
    const ref = manager.socketIndex.get(socketId);
    if (!ref) return;
    const room = manager.getRoom(ref.roomId);
    const participant = room?.getParticipant(ref.userId);
    if (room && participant) depart(room, participant, reason);
    manager.detachSocket(socketId);
  }

  /** Apply a playback action to the room. Used by direct commands AND by approved requests. */
  function applyPlayback(room, action, { time, videoId }) {
    switch (action) {
      case 'play':
        room.play();
        break;
      case 'pause':
        room.pause();
        break;
      case 'seek':
        room.seek(validateSeekTime(time));
        break;
      case 'change_video': {
        const id = extractVideoId(videoId);
        if (!id) throw new RoomError('INVALID_VIDEO', 'That is not a valid YouTube video link or ID.');
        room.changeVideo(id);
        break;
      }
      default:
        throw new RoomError('INVALID_ACTION', 'Unknown playback action.');
    }
  }

  function requireControl(me) {
    if (!canControlPlayback(me)) {
      throw new RoomError('FORBIDDEN', 'Only the host or a moderator can do that. Send a request instead.');
    }
  }

  function requireHost(me) {
    if (!canManageParticipants(me)) throw new RoomError('FORBIDDEN', 'Only the host can do that.');
  }

  // ---- connection ---------------------------------------------------------

  io.on('connection', (socket) => {
    const allowEvent = createRateLimiter(40, 10_000); // per-socket flood protection

    /**
     * Wrap every handler: rate limit, payload shape check, uniform ack format,
     * and error translation. Clients get { ok: true, ... } or { ok: false, error: { code, message } }.
     */
    const on = (event, handler) => {
      socket.on(event, (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        try {
          if (!allowEvent()) throw new RoomError('RATE_LIMITED', 'You are sending too many actions. Slow down.');
          if (payload !== undefined && (typeof payload !== 'object' || payload === null || Array.isArray(payload))) {
            throw new RoomError('INVALID_PAYLOAD', 'Malformed request.');
          }
          const result = handler(payload ?? {}) ?? {};
          reply({ ok: true, ...result });
        } catch (error) {
          if (error instanceof RoomError) {
            socket.emit('operation_rejected', { event, code: error.code, message: error.message });
            reply({ ok: false, error: { code: error.code, message: error.message } });
          } else {
            console.error(`[socket] unexpected error in ${event}:`, error);
            reply({ ok: false, error: { code: 'INTERNAL', message: 'Something went wrong.' } });
          }
        }
      });
    };

    // ---- room lifecycle ---------------------------------------------------

    on('create_room', ({ username, roomName }) => {
      const name = validateUsername(username);
      const title = validateRoomName(roomName, `${name}'s party`);
      leaveCurrentRoom(socket.id, 'switched_room');

      const room = manager.createRoom(title);
      const host = room.addParticipant({ username: name, socketId: socket.id, role: ROLES.HOST });
      bindSocket(socket, room, host);
      return { ...identityFor(host), room: snapshotFor(room, host) };
    });

    on('join_room', ({ roomId, username, sessionToken }) => {
      const id = validateRoomId(roomId);
      const room = manager.getRoom(id);
      if (!room) throw new RoomError('ROOM_NOT_FOUND', 'That room does not exist or has ended.');

      // Duplicate join from a socket already seated in this room: idempotent.
      const existing = manager.socketIndex.get(socket.id);
      if (existing?.roomId === id) {
        const me = room.getParticipant(existing.userId);
        if (me) return { ...identityFor(me), room: snapshotFor(room, me) };
      }

      // Reconnect: a valid session token reclaims the same seat (and role).
      const returning = sessionToken ? room.findByToken(sessionToken) : null;
      if (returning) {
        leaveCurrentRoom(socket.id, 'switched_room');
        const staleSocket = io.sockets.sockets.get(returning.socketId);
        if (staleSocket && staleSocket.id !== socket.id) {
          manager.detachSocket(staleSocket.id);
          staleSocket.leave(room.id);
          staleSocket.emit('session_replaced', { message: 'This session was opened in another tab.' });
        }
        bindSocket(socket, room, returning);
        socket.to(room.id).emit('participants_updated', { participants: room.publicParticipants() });
        return { ...identityFor(returning), room: snapshotFor(room, returning) };
      }

      // New participant.
      const name = validateUsername(username);
      if (room.isUsernameTaken(name)) {
        throw new RoomError('USERNAME_TAKEN', 'That name is already in use in this room. Pick another.');
      }
      if (room.participants.size >= config.maxParticipantsPerRoom) {
        throw new RoomError('ROOM_FULL', 'This room is full.');
      }
      leaveCurrentRoom(socket.id, 'switched_room');
      const participant = room.addParticipant({ username: name, socketId: socket.id, role: ROLES.PARTICIPANT });
      bindSocket(socket, room, participant);

      socket.to(room.id).emit('user_joined', {
        userId: participant.id,
        username: participant.username,
        role: participant.role,
        participants: room.publicParticipants(),
      });
      return { ...identityFor(participant), room: snapshotFor(room, participant) };
    });

    on('leave_room', ({ roomId }) => {
      const { room } = manager.context(socket.id);
      if (roomId !== undefined && validateRoomId(roomId) !== room.id) {
        throw new RoomError('NOT_IN_ROOM', 'You are not in that room.');
      }
      leaveCurrentRoom(socket.id, 'left');
    });

    on('sync_request', () => {
      const { room } = manager.context(socket.id);
      return { state: room.state() };
    });

    // ---- room chat --------------------------------------------------------

    on('send_chat_message', ({ text }) => {
      const { room, me } = manager.context(socket.id);
      if (typeof text !== 'string') throw new RoomError('INVALID_MESSAGE', 'Message must be text.');
      const cleaned = text.trim();
      if (!cleaned) throw new RoomError('INVALID_MESSAGE', 'Write a message before sending.');
      if (cleaned.length > 500) throw new RoomError('INVALID_MESSAGE', 'Messages must be 500 characters or fewer.');
      if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(cleaned)) {
        throw new RoomError('INVALID_MESSAGE', 'Message contains unsupported control characters.');
      }
      const message = room.addChatMessage(me, cleaned);
      toRoom(room, 'chat_message', message);
      return { message };
    });

    // ---- playback (Host / Moderator only) ---------------------------------

    for (const action of ['play', 'pause', 'seek', 'change_video']) {
      on(action, (payload) => {
        const { room, me } = manager.context(socket.id); // identity from server-side mapping, never from payload
        requireControl(me); // role is re-read from the server record on every event
        applyPlayback(room, action, payload);
        broadcastState(room, me);
      });
    }

    // ---- participant management (Host only) -------------------------------

    on('assign_role', ({ userId, role }) => {
      const { room, me } = manager.context(socket.id);
      requireHost(me);
      if (!ASSIGNABLE_ROLES.includes(role)) {
        throw new RoomError('INVALID_ROLE', 'Role must be "moderator" or "participant". Use transfer_host to hand over hosting.');
      }
      const target = typeof userId === 'string' ? room.getParticipant(userId) : null;
      if (!target) throw new RoomError('USER_NOT_FOUND', 'That participant is not in the room.');
      if (target.id === me.id) throw new RoomError('INVALID_TARGET', 'You cannot change your own role.');
      room.setRole(target.id, role);
      toRoom(room, 'role_assigned', {
        userId: target.id,
        username: target.username,
        role,
        participants: room.publicParticipants(),
      });
    });

    on('remove_participant', ({ userId }) => {
      const { room, me } = manager.context(socket.id);
      requireHost(me);
      const target = typeof userId === 'string' ? room.getParticipant(userId) : null;
      if (!target) throw new RoomError('USER_NOT_FOUND', 'That participant is not in the room.');
      if (target.id === me.id) throw new RoomError('INVALID_TARGET', 'You cannot remove yourself. Use Leave instead.');

      room.removeParticipant(target.id);
      // Tell everyone (including the removed user) before they are detached.
      toRoom(room, 'participant_removed', {
        userId: target.id,
        username: target.username,
        participants: room.publicParticipants(),
      });
      const removedSocket = io.sockets.sockets.get(target.socketId);
      if (manager.socketIndex.get(target.socketId)?.userId === target.id) manager.detachSocket(target.socketId);
      removedSocket?.leave(room.id);
    });

    on('transfer_host', ({ userId }) => {
      const { room, me } = manager.context(socket.id);
      requireHost(me);
      const target = typeof userId === 'string' ? room.getParticipant(userId) : null;
      if (!target) throw new RoomError('USER_NOT_FOUND', 'That participant is not in the room.');
      if (target.id === me.id) throw new RoomError('INVALID_TARGET', 'You are already the host.');
      if (!target.connected) throw new RoomError('INVALID_TARGET', 'That participant is offline.');
      room.transferHost(target.id);
      toRoom(room, 'host_transferred', {
        userId: target.id,
        username: target.username,
        previousHostId: me.id,
        reason: 'transferred',
        participants: room.publicParticipants(),
      });
    });

    // ---- participant requests ---------------------------------------------

    on('request_playback', ({ action, time, videoId }) => {
      const { room, me } = manager.context(socket.id);
      if (canControlPlayback(me)) {
        throw new RoomError('NOT_NEEDED', 'You can control playback directly.');
      }
      if (!REQUEST_ACTIONS.includes(action)) throw new RoomError('INVALID_ACTION', 'Unknown playback action.');

      const cleaned = { action };
      if (action === 'seek') cleaned.time = validateSeekTime(time);
      if (action === 'change_video') {
        const id = extractVideoId(videoId);
        if (!id) throw new RoomError('INVALID_VIDEO', 'That is not a valid YouTube video link or ID.');
        cleaned.videoId = id;
      }
      if ((action === 'play' || action === 'pause' || action === 'seek') && !room.videoId) {
        throw new RoomError('NO_VIDEO', 'No video is loaded yet. Request a video change first.');
      }

      const request = room.addRequest(me, cleaned);
      for (const reviewer of room.participants.values()) {
        if (canControlPlayback(reviewer) && reviewer.connected) {
          io.to(reviewer.socketId).emit('playback_request_received', request);
        }
      }
      return { request };
    });

    on('resolve_request', ({ requestId, approve }) => {
      const { room, me } = manager.context(socket.id);
      requireControl(me); // reviewer's CURRENT role is checked at approval time
      if (typeof approve !== 'boolean') throw new RoomError('INVALID_PAYLOAD', '"approve" must be true or false.');

      const request = room.takeRequest(requestId);
      if (approve) {
        try {
          applyPlayback(room, request.action, request);
        } catch (error) {
          // Request was valid when made but cannot be applied now (e.g. bad state). Drop it and tell the reviewer.
          toRoom(room, 'playback_request_resolved', { requestId, userId: request.userId, action: request.action, approved: false, reviewer: me.username });
          throw error;
        }
        broadcastState(room, me);
      }
      toRoom(room, 'playback_request_resolved', {
        requestId,
        userId: request.userId,
        username: request.username,
        action: request.action,
        approved: approve,
        reviewer: me.username,
      });
    });

    // ---- disconnects ------------------------------------------------------

    socket.on('disconnect', () => {
      const ref = manager.socketIndex.get(socket.id);
      if (!ref) return;
      manager.detachSocket(socket.id);
      const room = manager.getRoom(ref.roomId);
      const participant = room?.getParticipant(ref.userId);
      if (!room || !participant || participant.socketId !== socket.id) return;

      // Keep the seat for a grace period so refreshes/network blips can reclaim it.
      participant.connected = false;
      toRoom(room, 'participants_updated', { participants: room.publicParticipants() });
      const grace = isHost(participant) ? config.hostGraceMs : config.memberGraceMs;
      participant.disconnectTimer = setTimeout(() => depart(room, participant, 'disconnected'), grace);
      participant.disconnectTimer.unref?.();
    });
  });

  // Periodic authoritative sync while playing -> clients correct drift.
  const syncTimer = setInterval(() => {
    for (const room of manager.rooms.values()) {
      if (room.playState === 'playing' && room.participants.size > 0) {
        toRoom(room, 'sync_state', { ...room.state(), updatedBy: null });
      }
    }
  }, config.syncIntervalMs);
  syncTimer.unref?.();

  return { stop: () => clearInterval(syncTimer) };
}
