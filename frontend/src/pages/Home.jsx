import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, ShieldCheck, UserCheck, Users } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { connectSocket, emitAck, sessions } from '../services/socket.js';

const ROOM_CODE = /^[A-HJ-NP-Z2-9]{8}$/;

const FEATURES = [
  { Icon: RefreshCw, title: 'Always in sync', text: 'Play, pause, seek and video changes reach everyone through one authoritative room state, with automatic drift correction.' },
  { Icon: ShieldCheck, title: 'Roles that are enforced', text: 'Host, Moderator and Participant permissions are checked on the server — hiding a button is never the only protection.' },
  { Icon: UserCheck, title: 'Ask before changing', text: 'Participants can request a play, pause, seek or new video; a host or moderator approves it in one click.' },
];

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('create');
  const [username, setUsername] = useState('');
  const [roomName, setRoomName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const name = username.trim();
    if (name.length < 2 || name.length > 24) return setError('Enter a name between 2 and 24 characters.');

    if (mode === 'join') {
      const clean = code.trim().toUpperCase();
      if (!ROOM_CODE.test(clean)) return setError('Room codes are 8 letters/numbers, e.g. K7M2QX9P.');
      navigate(`/room/${clean}`, { state: { username: name } });
      return;
    }

    setBusy(true);
    const online = await connectSocket();
    if (!online) { setBusy(false); return setError('Cannot reach the server. It may be waking up — try again in a few seconds.'); }
    const res = await emitAck('create_room', { username: name, roomName: roomName.trim() || undefined });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    sessions.set(res.room.roomId, { userId: res.userId, sessionToken: res.sessionToken, username: res.username });
    navigate(`/room/${res.room.roomId}`);
  };

  const input = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30';

  return (
    <div className="wt-home min-h-screen">
      <Navbar />
      <main>
        <section id="start" className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-12 lg:grid-cols-2 lg:items-center lg:pt-20">
          <div className="animate-fade-up">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Watch YouTube together, <span className="text-blue-400">in sync.</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-slate-300">
              Create a room, share the link, and everyone sees the same video at the same moment. When the host pauses or seeks, the whole room follows.
            </p>
            <p className="mt-3 max-w-lg text-sm text-slate-400">
              How it works: the server keeps the one true playback state for each room and pushes it to every browser over a live WebSocket connection, so nobody drifts apart.
            </p>
          </div>

          <form onSubmit={submit} className="wt-form animate-fade-up rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl" aria-label="Create or join a room">
            <div role="tablist" className="mb-5 grid grid-cols-2 rounded-lg bg-slate-950 p-1 text-sm">
              {[['create', 'Create watch party'], ['join', 'Join existing room']].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => { setMode(id); setError(''); }}
                  className={`rounded-md px-3 py-2 font-medium transition focus-visible:ring-2 focus-visible:ring-blue-400 ${mode === id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="mb-1 block text-sm text-slate-300">Your name</label>
                <input id="username" className={input} value={username} maxLength={24} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. Priya" autoComplete="nickname" />
              </div>
              {mode === 'create' ? (
                <div>
                  <label htmlFor="roomname" className="mb-1 block text-sm text-slate-300">Room name <span className="text-slate-500">(optional)</span></label>
                  <input id="roomname" className={input} value={roomName} maxLength={40} onChange={(e) => setRoomName(e.target.value)} placeholder="Movie night" />
                </div>
              ) : (
                <div>
                  <label htmlFor="code" className="mb-1 block text-sm text-slate-300">Room code</label>
                  <input id="code" className={`${input} font-mono uppercase tracking-widest`} value={code} maxLength={8} onChange={(e) => setCode(e.target.value)} placeholder="K7M2QX9P" autoComplete="off" />
                </div>
              )}
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
              <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {mode === 'create' ? 'Create watch party' : 'Join room'}
              </button>
              <p className="text-center text-xs text-slate-500">You can also join by opening a shared room link.</p>
            </div>
          </form>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 pb-20">
          <div className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map(({ Icon, title, text }) => (
              <div key={title} className="wt-feature-card rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <Icon className="mb-3 h-5 w-5 text-blue-400" aria-hidden="true" />
                <h2 className="font-semibold text-white">{title}</h2>
                <p className="mt-1 text-sm text-slate-400">{text}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Sync depends on YouTube and your network; expect a small delay (usually under a second), not frame-perfect timing.
          </p>
        </section>
      </main>
    </div>
  );
}
