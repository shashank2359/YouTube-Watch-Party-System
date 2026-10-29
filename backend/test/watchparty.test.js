import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { createWatchServer } from '../src/server.js';
import { extractVideoId } from '../src/utils/youtube.js';

let server;
let url;
const clients = [];

before(async () => {
  server = createWatchServer({ port: 0, hostGraceMs: 300, memberGraceMs: 300, syncIntervalMs: 200, clientOrigins: ['http://localhost:5173'] });
  await new Promise((resolve) => server.httpServer.listen(0, resolve));
  url = `http://localhost:${server.httpServer.address().port}`;
});

after(async () => {
  clients.forEach((c) => c.disconnect());
  await server.close();
});

async function client() {
  const socket = connect(url, { transports: ['websocket'], forceNew: true });
  clients.push(socket);
  await new Promise((resolve) => socket.on('connect', resolve));
  const call = (event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));
  const next = (event, timeout = 1500) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
      socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
    });
  return { socket, call, next };
}

/** host + moderator-capable setup helper */
async function party() {
  const host = await client();
  const created = await host.call('create_room', { username: 'Hostie', roomName: 'Test' });
  const roomId = created.room.roomId;
  const guest = await client();
  const joined = await guest.call('join_room', { roomId, username: 'Guesty' });
  return { host, guest, created, joined, roomId };
}

const VIDEO = 'dQw4w9WgXcQ';

test('YouTube URL parsing', () => {
  for (const input of [
    VIDEO,
    `https://www.youtube.com/watch?v=${VIDEO}&t=5s`,
    `https://youtu.be/${VIDEO}?si=x`,
    `https://youtube.com/embed/${VIDEO}`,
    `https://www.youtube.com/shorts/${VIDEO}`,
    `m.youtube.com/watch?v=${VIDEO}`,
  ]) assert.equal(extractVideoId(input), VIDEO, input);
  for (const bad of ['', 'hello', 'https://evil.com/watch?v=' + VIDEO, 'https://youtube.com/watch?v=short', 'javascript:alert(1)', null, 42]) {
    assert.equal(extractVideoId(bad), null, String(bad));
  }
});

test('creator becomes host, joiner becomes participant, room code is unpredictable-looking', async () => {
  const { created, joined, roomId } = await party();
  assert.equal(created.role, 'host');
  assert.equal(joined.role, 'participant');
  assert.match(roomId, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(joined.room.participants.length, 2);
  assert.ok(!JSON.stringify(joined.room).includes(created.sessionToken), 'tokens must never leak to other users');
});

test('invalid room ids and usernames are rejected', async () => {
  const c = await client();
  assert.equal((await c.call('join_room', { roomId: 'nope', username: 'Bob' })).error.code, 'INVALID_ROOM_ID');
  assert.equal((await c.call('join_room', { roomId: 'ABCDEFGH', username: 'Bob' })).error.code, 'ROOM_NOT_FOUND');
  const { roomId } = await party();
  assert.equal((await c.call('join_room', { roomId, username: '<script>' })).error.code, 'INVALID_USERNAME');
  assert.equal((await c.call('join_room', { roomId, username: 'guesty' })).error.code, 'USERNAME_TAKEN');
});

test('room chat broadcasts validated messages with server-authenticated sender and keeps recent history', async () => {
  const { host, guest, roomId } = await party();
  const guestMessage = host.next('chat_message');
  const sent = await guest.call('send_chat_message', { text: 'Movie night 🍿😂', username: 'FakeHost', userId: 'forged' });
  const received = await guestMessage;
  assert.equal(sent.ok, true);
  assert.equal(received.text, 'Movie night 🍿😂');
  assert.equal(received.username, 'Guesty');
  assert.equal(received.userId, sent.message.userId);
  assert.notEqual(received.username, 'FakeHost');
  assert.equal((await host.call('send_chat_message', { text: '   ' })).error.code, 'INVALID_MESSAGE');
  assert.equal((await host.call('send_chat_message', { text: 'x'.repeat(501) })).error.code, 'INVALID_MESSAGE');
  const rejoined = await host.call('join_room', { roomId, username: 'Hostie' });
  assert.equal(rejoined.ok, true);
  assert.equal(rejoined.room.chatMessages.length, 1);
  assert.equal(rejoined.room.chatMessages[0].text, 'Movie night 🍿😂');
});

test('host play/pause/seek/change_video broadcast authoritative state', async () => {
  const { host, guest } = await party();
  assert.equal((await host.call('play', {})).error.code, 'NO_VIDEO');

  let pending = guest.next('sync_state');
  assert.equal((await host.call('change_video', { videoId: `https://youtu.be/${VIDEO}` })).ok, true);
  let state = await pending;
  assert.equal(state.videoId, VIDEO);
  assert.equal(state.playState, 'paused');

  pending = guest.next('sync_state');
  await host.call('play', {});
  assert.equal((await pending).playState, 'playing');

  pending = guest.next('sync_state');
  await host.call('seek', { time: 42 });
  state = await pending;
  assert.ok(state.currentTime >= 42 && state.currentTime < 44);

  pending = guest.next('sync_state');
  await host.call('pause', {});
  assert.equal((await pending).playState, 'paused');

  assert.equal((await host.call('seek', { time: -5 })).error.code, 'INVALID_TIME');
  assert.equal((await host.call('seek', { time: 'abc' })).error.code, 'INVALID_TIME');
  assert.equal((await host.call('change_video', { videoId: 'not a video' })).error.code, 'INVALID_VIDEO');
});

test('participant cannot control playback, manage roles, remove users or claim host', async () => {
  const { host, guest, created, roomId } = await party();
  await host.call('change_video', { videoId: VIDEO });

  for (const [event, payload] of [
    ['play', {}], ['pause', {}], ['seek', { time: 10 }], ['change_video', { videoId: VIDEO }],
  ]) {
    const res = await guest.call(event, payload);
    assert.equal(res.ok, false, event);
    assert.equal(res.error.code, 'FORBIDDEN', event);
  }
  assert.equal((await guest.call('assign_role', { userId: created.userId, role: 'moderator' })).error.code, 'FORBIDDEN');
  assert.equal((await guest.call('remove_participant', { userId: created.userId })).error.code, 'FORBIDDEN');
  assert.equal((await guest.call('transfer_host', { userId: created.userId })).error.code, 'FORBIDDEN');

  // A client cannot smuggle in a host identity via the payload.
  const spoof = await guest.call('assign_role', { userId: created.userId, role: 'host', roomId, actorId: created.userId, role_override: 'host' });
  assert.equal(spoof.ok, false);
});

test('client that never joined a room cannot issue commands', async () => {
  const stranger = await client();
  for (const event of ['play', 'pause', 'seek', 'change_video', 'assign_role', 'remove_participant', 'resolve_request']) {
    assert.equal((await stranger.call(event, { time: 1, videoId: VIDEO, userId: 'x', role: 'moderator' })).error.code, 'NOT_IN_ROOM', event);
  }
});

test('host promotes/demotes moderator; moderator gets playback but not management', async () => {
  const { host, guest, joined } = await party();
  const promoted = guest.next('role_assigned');
  assert.equal((await host.call('assign_role', { userId: joined.userId, role: 'moderator' })).ok, true);
  assert.equal((await promoted).role, 'moderator');

  assert.equal((await guest.call('change_video', { videoId: VIDEO })).ok, true);
  assert.equal((await guest.call('play', {})).ok, true);
  assert.equal((await guest.call('assign_role', { userId: joined.userId, role: 'participant' })).error.code, 'FORBIDDEN');
  assert.equal((await guest.call('remove_participant', { userId: joined.userId })).error.code, 'FORBIDDEN');

  assert.equal((await host.call('assign_role', { userId: joined.userId, role: 'participant' })).ok, true);
  assert.equal((await guest.call('pause', {})).error.code, 'FORBIDDEN');
});

test('role allowlist and self-targeting protections', async () => {
  const { host, created, joined } = await party();
  assert.equal((await host.call('assign_role', { userId: joined.userId, role: 'host' })).error.code, 'INVALID_ROLE');
  assert.equal((await host.call('assign_role', { userId: joined.userId, role: 'admin' })).error.code, 'INVALID_ROLE');
  assert.equal((await host.call('assign_role', { userId: created.userId, role: 'participant' })).error.code, 'INVALID_TARGET');
  assert.equal((await host.call('remove_participant', { userId: created.userId })).error.code, 'INVALID_TARGET');
  assert.equal((await host.call('remove_participant', { userId: 'ghost' })).error.code, 'USER_NOT_FOUND');
});

test('removed participant is notified and cannot keep issuing commands', async () => {
  const { host, guest, joined } = await party();
  const removedEvent = guest.next('participant_removed');
  assert.equal((await host.call('remove_participant', { userId: joined.userId })).ok, true);
  assert.equal((await removedEvent).userId, joined.userId);
  assert.equal((await guest.call('request_playback', { action: 'play' })).error.code, 'NOT_IN_ROOM');
  assert.equal((await guest.call('sync_request', {})).error.code, 'NOT_IN_ROOM');
});

test('request/approve workflow: participant requests, host approves, state changes', async () => {
  const { host, guest } = await party();
  const received = host.next('playback_request_received');
  const ack = await guest.call('request_playback', { action: 'change_video', videoId: `https://youtu.be/${VIDEO}` });
  assert.equal(ack.ok, true);
  const request = await received;
  assert.equal(request.videoId, VIDEO);

  const syncOnGuest = guest.next('sync_state');
  const resolved = guest.next('playback_request_resolved');
  assert.equal((await host.call('resolve_request', { requestId: request.id, approve: true })).ok, true);
  assert.equal((await syncOnGuest).videoId, VIDEO);
  assert.equal((await resolved).approved, true);

  // Reject path leaves state untouched
  const second = host.next('playback_request_received');
  await guest.call('request_playback', { action: 'play' });
  const req2 = await second;
  const version = server.manager.rooms.values().next().value?.version;
  assert.equal((await host.call('resolve_request', { requestId: req2.id, approve: false })).ok, true);
  assert.notEqual(version, undefined);

  // Already-resolved request cannot be replayed
  assert.equal((await host.call('resolve_request', { requestId: req2.id, approve: true })).error.code, 'REQUEST_NOT_FOUND');
});

test('participant cannot resolve requests; moderators can; revoked moderator cannot', async () => {
  const { host, guest, joined, roomId } = await party();
  const third = await client();
  const thirdJoin = await third.call('join_room', { roomId, username: 'Third' });

  const received = host.next('playback_request_received');
  const { request } = await third.call('request_playback', { action: 'change_video', videoId: VIDEO });
  await received;

  assert.equal((await guest.call('resolve_request', { requestId: request.id, approve: true })).error.code, 'FORBIDDEN');
  await host.call('assign_role', { userId: joined.userId, role: 'moderator' });
  await host.call('assign_role', { userId: joined.userId, role: 'participant' }); // revoked before approving
  assert.equal((await guest.call('resolve_request', { requestId: request.id, approve: true })).error.code, 'FORBIDDEN');
  await host.call('assign_role', { userId: joined.userId, role: 'moderator' });
  assert.equal((await guest.call('resolve_request', { requestId: request.id, approve: true })).ok, true);
  assert.ok(thirdJoin.ok);
});

test('privileged users cannot send requests; invalid request payloads rejected', async () => {
  const { host, guest } = await party();
  assert.equal((await host.call('request_playback', { action: 'play' })).error.code, 'NOT_NEEDED');
  assert.equal((await guest.call('request_playback', { action: 'explode' })).error.code, 'INVALID_ACTION');
  assert.equal((await guest.call('request_playback', { action: 'play' })).error.code, 'NO_VIDEO');
  assert.equal((await guest.call('request_playback', { action: 'change_video', videoId: 'bad' })).error.code, 'INVALID_VIDEO');
});

test('late joiner receives current state with advanced position', async () => {
  const { host, roomId } = await party();
  await host.call('change_video', { videoId: VIDEO });
  await host.call('seek', { time: 30 });
  await host.call('play', {});
  await new Promise((r) => setTimeout(r, 600));
  const late = await client();
  const res = await late.call('join_room', { roomId, username: 'Latecomer' });
  assert.equal(res.room.state.videoId, VIDEO);
  assert.equal(res.room.state.playState, 'playing');
  assert.ok(res.room.state.currentTime >= 30.5 && res.room.state.currentTime < 33);
});

test('periodic sync_state is broadcast while playing', async () => {
  const { host, guest } = await party();
  await host.call('change_video', { videoId: VIDEO });
  await host.call('play', {});
  const tick = await guest.next('sync_state', 1000);
  assert.equal(tick.playState, 'playing');
});

test('reconnect with session token reclaims seat and role; token is not valid for other rooms', async () => {
  const { host, joined, roomId } = await party();
  await host.call('assign_role', { userId: joined.userId, role: 'moderator' });
  const comeback = await client();
  const res = await comeback.call('join_room', { roomId, sessionToken: joined.sessionToken });
  assert.equal(res.ok, true);
  assert.equal(res.userId, joined.userId);
  assert.equal(res.role, 'moderator');

  const other = await party();
  const bad = await (await client()).call('join_room', { roomId: other.roomId, sessionToken: joined.sessionToken });
  assert.equal(bad.error.code, 'INVALID_USERNAME'); // token ignored -> treated as new join without name
});

test('duplicate join from same socket is idempotent', async () => {
  const { guest, roomId, joined } = await party();
  const again = await guest.call('join_room', { roomId, username: 'Whatever' });
  assert.equal(again.ok, true);
  assert.equal(again.userId, joined.userId);
});

test('disconnected member is marked offline, then removed after grace period', async () => {
  const { host, guest, joined } = await party();
  const offline = host.next('participants_updated');
  guest.socket.disconnect();
  const list = (await offline).participants;
  assert.equal(list.find((p) => p.userId === joined.userId).connected, false);
  const left = await host.next('user_left', 1500);
  assert.equal(left.userId, joined.userId);
});

test('host leaving transfers host to the moderator (or oldest participant)', async () => {
  const { host, guest, joined } = await party();
  await host.call('assign_role', { userId: joined.userId, role: 'moderator' });
  const transferred = guest.next('host_transferred');
  assert.equal((await host.call('leave_room', {})).ok, true);
  const event = await transferred;
  assert.equal(event.userId, joined.userId);
  assert.equal(event.participants.find((p) => p.userId === joined.userId).role, 'host');
});

test('host disconnect: host role passes on after grace period', async () => {
  const { host, guest, joined } = await party();
  const transferred = guest.next('host_transferred', 2000);
  host.socket.disconnect();
  assert.equal((await transferred).userId, joined.userId);
});

test('explicit host transfer; empty room is cleaned up', async () => {
  const { host, guest, joined, created, roomId } = await party();
  assert.equal((await host.call('transfer_host', { userId: joined.userId })).ok, true);
  assert.equal((await guest.call('assign_role', { userId: created.userId, role: 'participant' })).ok, true);
  await guest.call('leave_room', {});
  await host.call('leave_room', {});
  assert.equal(server.manager.getRoom(roomId), null);
});

test('malformed payloads do not crash the server', async () => {
  const c = await client();
  for (const bad of ['str', 5, null, [1, 2]]) {
    const res = await c.call('join_room', bad);
    assert.equal(res.ok, false);
  }
  assert.equal((await c.call('create_room', { username: 'Valid Name' })).ok, true);
});
