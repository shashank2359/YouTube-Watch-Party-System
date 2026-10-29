import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Copy, Link2, Loader2, LogOut, Share2, Wifi, WifiOff } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import YouTubePlayer from '../components/YouTubePlayer.jsx';
import PlaybackControls from '../components/PlaybackControls.jsx';
import ParticipantList from '../components/ParticipantList.jsx';
import PlaybackRequests from '../components/PlaybackRequests.jsx';
import RoomChat from '../components/RoomChat.jsx';
import JoinGate from '../components/JoinGate.jsx';
import Toasts from '../components/Toast.jsx';
import { useWatchRoom } from '../hooks/useWatchRoom.js';
import { sessions } from '../services/socket.js';
import { extractVideoId } from '../utils/youtube.js';

function Notice({ title, text, tone = 'default' }) {
  return (
    <div className="mx-auto mt-20 max-w-md px-4 text-center">
      <div className={`animate-fade-up rounded-2xl border p-8 ${tone === 'error' ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800 bg-slate-900/60'}`}>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{text}</p>
        <Link to="/" className="mt-5 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-300">Back to home</Link>
      </div>
    </div>
  );
}

function ConnectionBadge({ state }) {
  const map = {
    connected: ['Connected', 'text-emerald-300 border-emerald-500/30', Wifi],
    connecting: ['Connecting…', 'text-amber-300 border-amber-500/30', Loader2],
    reconnecting: ['Reconnecting…', 'text-amber-300 border-amber-500/30', Loader2],
    offline: ['Server unavailable', 'text-red-300 border-red-500/30', WifiOff],
  };
  const [label, cls, Icon] = map[state] ?? map.connecting;
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${cls}`}>
      <Icon className={`h-3.5 w-3.5 ${Icon === Loader2 ? 'animate-spin' : ''}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export default function WatchRoom() {
  const roomId = (useParams().roomId || '').toUpperCase();
  const navigate = useNavigate();
  const initialUsername = useLocation().state?.username;
  const room = useWatchRoom(roomId, initialUsername);
  const { status, connection, playback, me, canControl, isHost } = room;

  const [tick, setTick] = useState({ time: 0, duration: 0, title: '' });
  const onTick = useCallback((t) => setTick((prev) => (Math.abs(prev.time - t.time) < 0.4 && prev.duration === t.duration && prev.title === t.title ? prev : t)), []);
  const [videoInput, setVideoInput] = useState('');
  const [videoError, setVideoError] = useState('');

  const link = `${window.location.origin}/room/${roomId}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); room.pushToast('success', 'Invitation link copied'); }
    catch { room.pushToast('error', `Copy failed — share this link: ${link}`); }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Join my watch party', url: link }); } catch { /* cancelled */ } }
    else copy();
  };
  const leave = async () => { await room.leave(); navigate('/'); };

  const submitVideo = async (e) => {
    e.preventDefault();
    const id = extractVideoId(videoInput);
    if (!id) return setVideoError('That does not look like a YouTube link or video ID.');
    setVideoError('');
    const res = await room.act('change_video', { videoId: id });
    if (res.ok) setVideoInput('');
  };

  const needsName = status === 'idle' && !sessions.get(roomId) && !initialUsername;

  if (status === 'error') return <><Navbar /><Notice tone="error" title="Room unavailable" text={room.error || 'This room does not exist or has ended.'} /></>;
  if (status === 'removed') return <><Navbar /><Notice tone="error" title="You were removed" text="The host removed you from this room." /></>;
  if (status === 'replaced') return <><Navbar /><Notice title="Session moved" text="This room was opened in another tab, so this one has been disconnected." /></>;

  if (status !== 'joined') {
    return (
      <>
        <Navbar />
        {needsName || (status === 'idle' && room.error)
          ? <JoinGate roomId={roomId} error={room.error} busy={status === 'joining'} onJoin={(n) => room.join(n)} />
          : (
            <div className="mt-24 flex flex-col items-center gap-3 text-slate-400" role="status">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <p className="text-sm">{connection === 'offline' ? 'Server unavailable — retrying…' : 'Joining room…'}</p>
            </div>
          )}
        <Toasts toasts={room.toasts} onDismiss={room.dismissToast} />
      </>
    );
  }

  const hostOnline = room.participants.find((p) => p.role === 'host')?.connected;
  const confirmThen = (message, fn) => { if (window.confirm(message)) fn(); };

  return (
    <div className="wt-room min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-white">{room.roomName}</h1>
            <p className="text-sm text-slate-400">Code <span className="font-mono tracking-widest text-slate-200">{roomId}</span></p>
          </div>
          <ConnectionBadge state={connection} />
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-400"><Copy className="h-4 w-4" aria-hidden="true" />Copy link</button>
          <button onClick={share} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-400"><Share2 className="h-4 w-4" aria-hidden="true" />Share</button>
          <button onClick={leave} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-400"><LogOut className="h-4 w-4" aria-hidden="true" />Leave</button>
        </div>

        {connection !== 'connected' && (
          <p role="alert" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Connection lost — trying to reconnect. Your seat is held for a short time.</p>
        )}
        {hostOnline === false && (
          <p role="status" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">The host disconnected. Hosting will pass to someone else if they do not return shortly.</p>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-3 lg:col-span-2" aria-label="Player">
            <YouTubePlayer playback={playback} onTick={onTick} />
            <p className="min-h-6 truncate text-sm text-slate-300">{playback?.videoId ? tick.title || 'Loading video…' : 'No video selected'}</p>
            <PlaybackControls
              canControl={canControl}
              playing={playback?.playState === 'playing'}
              hasVideo={Boolean(playback?.videoId)}
              time={tick.time}
              duration={tick.duration}
              onPlay={() => room.act('play')}
              onPause={() => room.act('pause')}
              onSeek={(t) => room.act('seek', { time: t })}
            />
            <form onSubmit={submitVideo} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <label htmlFor="video-url" className="mb-1 block text-sm text-slate-300">{canControl ? 'Change video' : 'Request a different video'}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" aria-hidden="true" />
                  <input id="video-url" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} placeholder="Paste a YouTube link…"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-300">{canControl ? 'Load' : 'Request'}</button>
              </div>
              {videoError && <p role="alert" className="mt-1.5 text-sm text-red-300">{videoError}</p>}
            </form>
          </section>

          <aside className="space-y-4" aria-label="Room">
            <section className="rounded-xl border border-slate-800 bg-slate-900/60">
              <h2 className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white">Participants ({room.participants.length})</h2>
              <ParticipantList
                participants={room.participants}
                meId={me?.userId}
                isHost={isHost}
                onAssign={room.assignRole}
                onRemove={(id, name) => confirmThen(`Remove ${name} from the room?`, () => room.removeParticipant(id))}
                onTransfer={(id, name) => confirmThen(`Make ${name} the host? You will become a moderator.`, () => room.transferHost(id))}
              />
            </section>
            <section className="rounded-xl border border-slate-800 bg-slate-900/60">
              <h2 className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white">{canControl ? 'Playback requests' : 'Your requests'} ({room.requests.length})</h2>
              <PlaybackRequests requests={room.requests} canReview={canControl} onResolve={room.resolveRequest} />
            </section>
            <RoomChat messages={room.chatMessages} me={me} onSend={room.sendChatMessage} />
          </aside>
        </div>
      </main>
      <Toasts toasts={room.toasts} onDismiss={room.dismissToast} />
    </div>
  );
}
