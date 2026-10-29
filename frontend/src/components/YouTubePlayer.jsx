import { useCallback, useEffect, useRef, useState } from 'react';
import { Film, MousePointerClick, TriangleAlert } from 'lucide-react';

let apiPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => { apiPromise = null; reject(new Error('YouTube API failed to load')); };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

const PLAYING = 1;
const BUFFERING = 3;
const ERROR_TEXT = {
  2: 'That video ID is invalid.',
  5: 'This video cannot be played in the embedded player.',
  100: 'This video was removed or is private.',
  101: 'The owner does not allow this video to be embedded.',
  150: 'The owner does not allow this video to be embedded.',
};

/**
 * Follows the server's authoritative playback state. It NEVER emits events itself:
 * native controls are disabled and a transparent shield blocks clicks on the iframe,
 * so a local interaction cannot desync the room or create a feedback loop.
 */
export default function YouTubePlayer({ playback, onTick }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const loadedVideoRef = useRef(null);
  const playbackRef = useRef(playback);
  const blockTimerRef = useRef(null);
  const [blocked, setBlocked] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [initFailed, setInitFailed] = useState(false);

  const apply = useCallback(() => {
    const player = playerRef.current;
    const pb = playbackRef.current;
    if (!player || !readyRef.current || !pb) return;

    if (!pb.videoId) {
      if (loadedVideoRef.current) { player.stopVideo(); loadedVideoRef.current = null; }
      return;
    }
    const playing = pb.playState === 'playing';
    // Server sent currentTime as of its send time; add local time since we received it.
    const target = pb.currentTime + (playing ? (Date.now() - pb.receivedAt) / 1000 : 0);

    if (loadedVideoRef.current !== pb.videoId) {
      loadedVideoRef.current = pb.videoId;
      setPlayerError(null);
      if (playing) player.loadVideoById({ videoId: pb.videoId, startSeconds: target });
      else player.cueVideoById({ videoId: pb.videoId, startSeconds: target });
    } else {
      const state = player.getPlayerState();
      const drift = Math.abs(player.getCurrentTime() - target);
      if (drift > (playing ? 1.5 : 0.5)) {
        player.seekTo(target, true);
        if (!playing) player.pauseVideo();
      }
      if (playing && state !== PLAYING && state !== BUFFERING) player.playVideo();
      if (!playing && (state === PLAYING || state === BUFFERING)) player.pauseVideo();
    }

    clearTimeout(blockTimerRef.current);
    if (playing) {
      blockTimerRef.current = setTimeout(() => {
        const s = playerRef.current?.getPlayerState?.();
        setBlocked(playbackRef.current?.playState === 'playing' && s !== PLAYING && s !== BUFFERING && !playerError);
      }, 2000);
    } else {
      setBlocked(false);
    }
  }, [playerError]);

  useEffect(() => {
    playbackRef.current = playback;
    apply();
  }, [playback, apply]);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        const mount = document.createElement('div');
        containerRef.current.appendChild(mount);
        playerRef.current = new YT.Player(mount, {
          width: '100%',
          height: '100%',
          playerVars: { controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1, fs: 0 },
          events: {
            onReady: () => { readyRef.current = true; apply(); },
            onError: (e) => { setPlayerError(ERROR_TEXT[e.data] ?? 'The video could not be played.'); loadedVideoRef.current = null; },
          },
        });
      })
      .catch(() => setInitFailed(true));

    const tick = setInterval(() => {
      const p = playerRef.current;
      if (!readyRef.current || !p?.getCurrentTime) return;
      onTick?.({ time: p.getCurrentTime(), duration: p.getDuration() || 0, title: p.getVideoData?.().title || '' });
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(tick);
      clearTimeout(blockTimerRef.current);
      try { playerRef.current?.destroy(); } catch { /* already gone */ }
      playerRef.current = null;
      readyRef.current = false;
      loadedVideoRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resume = () => {
    setBlocked(false);
    playerRef.current?.playVideo(); // inside a click => allowed by browser autoplay policy
    apply();
  };

  const hasVideo = Boolean(playback?.videoId);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-black">
      <div ref={containerRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
      <div className="absolute inset-0 z-10" aria-hidden="true" /> {/* click shield */}

      {!hasVideo && !initFailed && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950 text-center text-slate-400">
          <Film className="h-10 w-10 text-slate-600" aria-hidden="true" />
          <p className="max-w-xs text-sm">No video selected yet. Paste a YouTube link below to get started.</p>
        </div>
      )}
      {initFailed && (
        <div role="alert" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-950 p-4 text-center text-amber-300">
          <TriangleAlert className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm">The YouTube player could not load. Check your connection or ad blocker, then refresh.</p>
        </div>
      )}
      {playerError && (
        <div role="alert" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-950/95 p-4 text-center text-amber-300">
          <TriangleAlert className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm">{playerError}</p>
          <p className="text-xs text-slate-400">Ask the host or a moderator to pick another video.</p>
        </div>
      )}
      {blocked && !playerError && (
        <button
          onClick={resume}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-white backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <MousePointerClick className="h-8 w-8 text-blue-400" aria-hidden="true" />
          <span className="text-sm font-medium">Your browser blocked autoplay</span>
          <span className="text-xs text-slate-300">Click here to join playback</span>
        </button>
      )}
    </div>
  );
}
