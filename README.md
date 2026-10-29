# WatchTogether — YouTube Watch Party

**WatchTogether** is a real-time YouTube watch-party application that allows people to watch videos together in shared rooms. It synchronizes playback across participants and provides room management, role-based permissions, playback approval requests, and real-time chat.

## Live Demo

- **Live Application:** https://youtube-watch-party-system-ettz.onrender.com
- **Backend API Health:** https://youtube-watch-party-system-backend.onrender.com/health
- **GitHub Repository:** https://github.com/shashank2359/YouTube-Watch-Party-System

## Features

- **Create and Join Rooms:** Create a watch room and invite others using a room code or shareable link.
- **Synchronized Playback:** Synchronize play, pause, seek, and YouTube video changes in real time.
- **YouTube Integration:** Play YouTube videos using the YouTube IFrame Player API.
- **Role-Based Access Control:** Host, Moderator, and Participant roles with server-side permission checks.
- **Playback Requests:** Participants can request playback changes, which authorized users can approve or decline.
- **Room Management:** Assign roles, remove participants, and transfer host privileges.
- **Real-Time Chat:** Exchange messages and emojis with other participants in a room.
- **Reconnection Support:** Restore room participation after temporary connection interruptions.
- **Responsive Interface:** A modern dark-themed interface for managing rooms, playback, participants, and chat.

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4 |
| Routing | React Router |
| Backend | Node.js, Express.js |
| Real-Time Communication | Socket.IO |
| YouTube Integration | YouTube IFrame Player API |
| Security | CORS, express-rate-limit, server-side role validation |
| Development Tools | npm, Git, GitHub |
| Deployment | Render |

## Project Structure

```text
YouTube-Watch-Party-System/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── rooms/
│   │   ├── sockets/
│   │   ├── utils/
│   │   ├── app.js
│   │   ├── index.js
│   │   └── server.js
│   ├── test/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
├── ARCHITECTURE.md
├── TESTING.md
├── render.yaml
└── README.md
```

## Prerequisites

To run the project locally, install:

- [Node.js 20 or later](https://nodejs.org/)
- npm, included with Node.js
- [Git](https://git-scm.com/downloads)

No MongoDB installation is required for the current in-memory room implementation.

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/shashank2359/YouTube-Watch-Party-System.git
cd YouTube-Watch-Party-System
```

### 2. Configure and start the backend

Open a terminal in the project root:

```bash
cd backend
npm install
```

Create a `.env` file by copying the example.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS/Linux:**

```bash
cp .env.example .env
```

Configure the backend environment variables:

```env
PORT=4000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
```

Start the development server:

```bash
npm run dev
```

The backend will run at `http://localhost:4000`.

Verify the health endpoint:

http://localhost:4000/health

### 3. Configure and start the frontend

Open a second terminal in the project root:

```bash
cd frontend
npm install
```

Create the frontend environment file.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS/Linux:**

```bash
cp .env.example .env
```

Set the backend URL in `frontend/.env`:

```env
VITE_SERVER_URL=http://localhost:4000
```

Start the frontend:

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Running Tests

Run the backend automated test suite:

```bash
cd backend
npm test
```

Build the frontend for production:

```bash
cd frontend
npm install
npm run build
```

The backend test suite previously passed all 22 tests, and the frontend production build completed successfully.

For additional test details, see [TESTING.md](https://github.com/shashank2359/YouTube-Watch-Party-System/blob/main/TESTING.md).

## How It Works

1. A user creates a room and becomes its Host.
2. Other users join using the room code or shared link.
3. The frontend connects to the backend using Socket.IO.
4. The backend manages room membership, roles, playback state, and chat events.
5. Playback updates are broadcast to connected participants to keep their YouTube players synchronized.
6. Participants request permission for playback changes, while Hosts and Moderators can approve or reject those requests.
7. The frontend renders the synchronized player and room interface.

## Deployment

The application is deployed on [Render](https://render.com/).

- **Frontend:** Render Static Site
- **Backend:** Render Web Service
- **Communication:** Socket.IO over the deployed backend URL
- **Frontend configuration:** `VITE_SERVER_URL`
- **Backend configuration:** `CLIENT_ORIGIN`

The frontend uses a rewrite rule to support direct navigation to room URLs.

## Author

**Shashank Singh Sengar**

GitHub: https://github.com/shashank2359

---
