## Testing

Results below were produced by actually running the commands on 27 October 2026. Anything marked "Not run" has not been executed yet and must not be reported as passed until you run it.

## Automated backend tests (executed)

Command: `cd backend && npm test` (Node test runner, real Socket.IO clients against a real server instance).
Result: 21 tests, 21 passed, 0 failed.

| Area | What is checked | Result |
|---|---|---|
| YouTube parsing | watch, youtu.be, embed, shorts, mobile URLs accepted; look-alike domains, short IDs, `javascript:`, non-strings rejected | Pass |
| Rooms | Creator is Host, joiner is Participant, 8-char code, tokens never leak in snapshots | Pass |
| Join validation | Bad code, unknown room, bad username, duplicate username rejected | Pass |
| Playback | Host change video / play / seek / pause broadcast correct state; negative and non-numeric seek and bad video rejected | Pass |
| Security | Participant rejected on play, pause, seek, change_video, assign_role, remove_participant, transfer_host; spoofed host payload rejected | Pass |
| Security | Socket that never joined a room rejected on every command | Pass |
| Roles | Promote/demote moderator; moderator can control playback but not manage people; role allowlist; self-demote and self-remove blocked | Pass |
| Removal | Removed user is notified and further commands are rejected | Pass |
| Requests | Request, approve, reject; replaying an approved request fails; participant cannot approve; demoted moderator cannot approve; hosts cannot file requests; bad payloads rejected | Pass |
| Sync | Late joiner gets current video and advanced position; periodic `sync_state` while playing | Pass |
| Reconnect | Session token reclaims seat and role; token not usable in another room; duplicate join idempotent | Pass |
| Lifecycle | Disconnect marks offline then removes after grace; host leave and host disconnect pass host on; explicit transfer; empty room deleted; malformed payloads do not crash | Pass |

Frontend: `cd frontend && npm run build` completed successfully (executed). There are no automated frontend tests.

## Manual and deployed tests (Not run)

Run these with two browser sessions (normal plus private window) and record the real outcome.

| Test | Expected | Actual | Status |
|---|---|---|---|
| Create room, copy link, open link in second session | Second user lands on name prompt, joins as Participant | | Not run |
| Join by code from Home | Joins; both lists show both users | | Not run |
| Host loads a video | Both players show it, paused at 0:00 | | Not run |
| Host plays, pauses, seeks | Participant player follows within about a second | | Not run |
| Late joiner | Sees current video and position | | Not run |
| Participant clicks Request play | Host sees request; Approve plays for all | | Not run |
| Promote to Moderator, then moderator controls video | Works; demote removes control | | Not run |
| Remove participant | Removed user sees "You were removed" | | Not run |
| Refresh a participant tab | Rejoins with same name and role | | Not run |
| Stop backend briefly | "Reconnecting" banner, recovers | | Not run |
| Autoplay blocked | Overlay with instruction appears; click resumes | | Not run |
| Embedding-disabled video | Clear error over the player | | Not run |
| Deployed app, all of the above | Same behavior over HTTPS/WSS; no console errors | | Not run |

## Room chat (added)

- [ ] Send a text message and an emoji from one browser; confirm it appears in another browser in the same room.
- [ ] Confirm the sender name is supplied by the server session, not accepted from the client payload.
- [ ] Confirm blank messages and messages over 500 characters are rejected.
- [ ] Confirm a new/reconnected room view receives the recent chat history.
- [ ] Confirm messages are scoped to the current room and are not persisted after the room is deleted/server restarts.
