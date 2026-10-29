import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';

const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return h ? `${h}:${m.toString().padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

export default function PlaybackControls({ canControl, playing, hasVideo, time, duration, onPlay, onPause, onSeek }) {
  const [dragValue, setDragValue] = useState(null);
  useEffect(() => { if (!hasVideo) setDragValue(null); }, [hasVideo]);

  const shown = dragValue ?? time;
  const commit = () => {
    if (dragValue !== null) onSeek(dragValue);
    setDragValue(null);
  };
  const disabled = !hasVideo;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={playing ? onPause : onPlay}
          disabled={disabled}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          {canControl ? (playing ? 'Pause' : 'Play') : playing ? 'Request pause' : 'Request play'}
        </button>
        <span className="w-12 text-right text-xs tabular-nums text-slate-400">{fmt(shown)}</span>
        <input
          type="range"
          aria-label={canControl ? 'Seek' : 'Request seek'}
          min={0}
          max={Math.max(duration, 1)}
          step={1}
          value={Math.min(shown, Math.max(duration, 1))}
          disabled={disabled}
          onChange={(e) => setDragValue(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          className="h-1.5 w-full cursor-pointer accent-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <span className="w-12 text-xs tabular-nums text-slate-400">{fmt(duration)}</span>
      </div>
      {!canControl && (
        <p className="mt-2 text-xs text-slate-500">You are a participant: these controls send a request that a host or moderator must approve.</p>
      )}
    </div>
  );
}
