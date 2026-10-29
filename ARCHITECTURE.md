# Architecture

## Overview

```
React UI  ->  Socket.IO client  ->  Express + Socket.IO server  ->  Room + permission logic
   ^                                                                        |
   |                       Socket.IO room broadcast  <-- authoritative state
YouTube IFrame Player (follows state, never emits)
```

The server holds the only true playback state for each room. Clients send intentions ("pause"); the server checks who is asking, whether they are allowed, and whether the data is valid; only then does it change state and broadcast the result. Every client renders what the server says.

## Components

Backend (`backend/src`)
- `server.js`, `app.js`, `index.js`: HTTP setup, Socket.IO setup, entry point. `GET /health` and `GET /api/rooms/:id` are the only HTTP routes.
- `rooms/Room.js`: one room: participants, role changes, playback state, pending requests.
- `rooms/RoomManager.js`: all rooms, secure room-code generation, and the socket-to-participant mapping used for identity.
- `rooms/roles.js`: role constants and helpers `isRoomMember`, `isHost`, `canControlPlayback`, `canManageParticipants`.
- `sockets/socketHandler.js`: event handlers wrapped in one function that rate-limits, checks payload shape, and returns uniform acknowledgements.
- `utils/`: validation, YouTube URL parsing, rate limiter, error type.

Frontend (`frontend/src`)
- `hooks/useWatchRoom.js`: mirrors server state into React state and exposes actions.
- `services/socket.js`: the single shared socket, ack helper, per-tab session storage.
- `components/YouTubePlayer.jsx`: wraps the IFrame API and applies server state.
- Pages: `Home` (create/join), `WatchRoom` (the room).

## Room state model

Room: `id`, `name`, `hostId`, `participants` (Map), `videoId`, `playState`, `baseTime`, `updatedAt`, `version`, `requests`.
Participant: `id`, `username`, `role`, `socketId`, `connected`, `sessionToken` (secret), `joinedAt`.

Playback is stored as a base position plus a timestamp. While playing, the current position is `baseTime + (now - updatedAt)`. This means no ticking timer on the server and late joiners get an accurate position. Every change increments `version`; clients ignore a `sync_state` older than the one they have.

## Identity and role enforcement

Identity: on join the server issues a random `userId` and `sessionToken`. The server maps `socket.id` to `(roomId, userId)`. For every event it looks the caller up from that mapping and ignores any room, user or role in the payload. A socket that is not in a room gets `NOT_IN_ROOM` for everything.

Enforcement order for a privileged event: resolve caller from mapping, re-read their current role from the server record, check the permission helper, validate the payload, apply to the room, broadcast. Failures return an error code and nothing is broadcast. The role allowlist is `moderator` and `participant`; `host` can only be obtained through `transfer_host` or automatic succession.

Participant requests: `request_playback` stores a validated request. `resolve_request` rechecks the reviewer's role at approval time, removes the request (so it cannot be replayed), applies it through the same code path as a direct command, and broadcasts.

## Synchronization

1. Host or moderator action reaches the server and updates the room.
2. Server broadcasts `sync_state` to the Socket.IO room.
3. Each client's player moves to the target: it loads a new video if needed, seeks only if drift exceeds 0.5 s (paused) or 1.5 s (playing), then plays or pauses.
4. While a room is playing, the server re-broadcasts state every 5 seconds so clients correct accumulated drift.

Feedback loops are prevented by design: the YouTube player's native controls are disabled, a transparent layer blocks clicks on the iframe, and the player component never emits events. New videos start paused to reduce autoplay blocking. If the browser still blocks playback, an overlay asks the user to click.

## Disconnects, reconnects, cleanup

- Disconnect: participant is marked offline and broadcast. The seat is held 20 seconds (30 for the host).
- Reconnect: the client rejoins with its session token and gets the same seat and role. Opening the same session in a second tab replaces the first.
- Grace expiry or explicit leave: participant is removed. If it was the host, host passes to the oldest online moderator, otherwise the oldest online participant.
- Empty room: deleted immediately. Maximum 500 rooms and 50 participants per room.

## Deployment architecture

Static frontend on Render talks over HTTPS and secure WebSocket to one Node web service. CORS and Socket.IO accept only origins in `CLIENT_ORIGIN`. The backend listens on the platform's `PORT`.

## Current limitations

One process, in-memory state, no authentication, not load-tested. To scale horizontally: add the Socket.IO Redis adapter, move room state into Redis or a database behind `RoomManager`, and use sticky sessions or WebSocket-only transport.

## Room chat

Room chat uses the same Socket.IO connection as room and playback events. A joined client emits `send_chat_message` with text only. The backend resolves the sender from its socket-to-room membership, trims and validates the text (1–500 characters), stores the last 80 messages in the in-memory `Room`, and broadcasts `chat_message` to that room. The client renders messages as React text (not HTML) and offers quick emoji insertion. Chat history is not durable: it disappears when the room is removed or the server restarts.
