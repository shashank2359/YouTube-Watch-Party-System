# WatchTogether — YouTube Watch Party

A real-time YouTube watch-party application. A host creates a room, shares its code/link, and participants receive synchronized playback state. Built for the **YouTube Watch Party System** internship assignment.

> **Deployment status:** Not deployed yet. Do not submit a placeholder as a live URL. After deployment, replace the two values below with the real public URLs and verify the production flows.
>
> - **Live frontend:** `PENDING — add the deployed frontend URL`
> - **Backend health endpoint:** `PENDING — add the deployed backend URL + /health`

## Features implemented

- Create a room; creator becomes Host.
- Join by room code or shared room link; joiners become Participants.
- Embed and control YouTube videos using the YouTube IFrame Player API.
- Synchronize play, pause, seek and video changes over Socket.IO.
- Host, Moderator and Participant roles with backend-side permission enforcement.
- Host can promote/demote moderators, remove participants and transfer host.
- Participants can request playback changes; Host/Moderator can approve or decline them.
- Late joiners receive current state; periodic state broadcasts help correct playback drift.
- Reconnection with a per-tab session token and host succession after leaving/disconnection.
- UI states for connecting, reconnecting, invalid room links, removed users and player errors.

Implemented optional bonus: room chat with emoji picker and in-memory recent message history. Not implemented: persistent database storage and Redis-based multi-instance scaling.

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, React Router, Socket.IO client, `lucide-react`, YouTube IFrame Player API.
- **Backend:** Node.js 20+, Express, Socket.IO, CORS, dotenv, express-rate-limit.
- **Room model:** `Room` and `RoomManager` classes; room/session state is stored in memory.

## Requirements

- Node.js 20 or newer and npm.
- Two browser sessions (for example, a regular window and a private window) for multi-user manual testing.

## Run locally (PowerShell)

Open two terminals from the repository root.

### Terminal 1 — backend

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```

Backend listens on `http://localhost:4000`. Health check: `http://localhost:4000/health`.

### Terminal 2 — frontend

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. Use two browser sessions to test creating and joining a room.

On macOS/Linux, use `cp .env.example .env` instead of `Copy-Item`.

## Tests and production build

```powershell
cd backend
npm test
cd ..\frontend
npm run build
```

The uploaded source was verified with **22 passing backend tests** in the current review environment. The frontend build should be rerun after installing dependencies on the target machine; a prior Windows `node_modules` executable is not portable to Linux.

See [TESTING.md](TESTING.md) for automated test coverage and manual test cases. Manual browser and production checks must be marked complete only after actually performing them.

## Deployment on Render

This repository includes [`render.yaml`](render.yaml) for a backend web service and a frontend static site. Deployment requires a GitHub repository and a Render account; no live URL exists until the services have deployed successfully.

1. Push this repository to GitHub. Ensure `.env` files and `node_modules` are not committed.
2. In Render, choose **New → Blueprint** and select the repository. Review `render.yaml` and create both services, or create the services manually using the settings below.
3. Backend web service:
   - Root directory: `backend`
   - Build command: `npm install --omit=dev`
   - Start command: `npm start`
   - Health check path: `/health`
   - Environment: `NODE_ENV=production`, `CLIENT_ORIGIN=<frontend public origin>`
4. Deploy the backend and open `https://<backend-host>/health`. Expect JSON with `"status":"ok"`.
5. Frontend static site:
   - Root directory: `frontend`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
   - Rewrite rule: `/*` → `/index.html`
   - Build-time environment variable: `VITE_SERVER_URL=https://<backend-host>`
6. Set backend `CLIENT_ORIGIN` to the exact frontend origin, without a trailing slash, and redeploy the backend. Redeploy the frontend after setting `VITE_SERVER_URL`.
7. Verify the frontend loads, room creation and joining work across two separate browser sessions, YouTube loads, playback and seeking synchronize, roles are enforced, and approval requests work. Check browser console and Render logs.
8. Replace the pending URL values at the top of this README with the actual URLs. Never invent or claim a URL before it is live and tested.

`VITE_SERVER_URL` is embedded into the frontend bundle at build time; changing it in the dashboard requires a frontend rebuild/redeploy. Render free web services may sleep while idle, so the first backend request can take time to wake up.

## Environment variables

| Service | Variable | Purpose |
|---|---|---|
| Backend | `PORT` | HTTP port; Render provides this automatically. Defaults to 4000 locally. |
| Backend | `CLIENT_ORIGIN` | Comma-separated allowed frontend origins; required in production. |
| Backend | `NODE_ENV` | Set to `production` in deployment. |
| Frontend | `VITE_SERVER_URL` | Public backend origin compiled into the frontend bundle. Contains no secret. |

Use `.env.example` as a template. Never commit `.env` files or secrets.

## Roles and permissions

| Action | Host | Moderator | Participant |
|---|---|---|---|
| Play, pause, seek, change video | Yes | Yes | Request only |
| Approve/decline playback requests | Yes | Yes | No |
| Assign roles | Yes | No | No |
| Remove participants | Yes | No | No |
| Transfer host | Yes | No | No |

The backend validates privileges; hiding or disabling frontend controls is not the security boundary.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the client/server event flow. See [docs/INTERVIEW_WALKTHROUGH.md](docs/INTERVIEW_WALKTHROUGH.md) for a walkthrough outline and [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for a demo sequence.

## Known limitations

- No accounts. A random per-tab session token is stored in `sessionStorage`; anyone with a room code can join as a participant, and a stolen token could impersonate that session. Tokens are not placed in URLs or logs.
- Rooms are stored in memory on a single backend instance. Restarting the server ends active rooms.
- Playback synchronization is best effort. YouTube buffering, network delay, embed restrictions and browser autoplay policies may cause offsets; drift correction is periodic.
- Load testing for 1,000+ users, 100+ rooms and 50+ users per room has not been performed. Multi-instance deployment would require shared room state and a Socket.IO adapter such as Redis.
