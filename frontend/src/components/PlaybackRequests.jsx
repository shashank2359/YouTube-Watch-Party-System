import { Check, Clock, X } from 'lucide-react';

const LABEL = { play: 'play', pause: 'pause', seek: 'seek', change_video: 'change video' };
const fmtTime = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

function describe(r) {
  if (r.action === 'seek') return `seek to ${fmtTime(r.time)}`;
  if (r.action === 'change_video') return `change video (${r.videoId})`;
  return LABEL[r.action];
}

export default function PlaybackRequests({ requests, canReview, onResolve }) {
  if (requests.length === 0) {
    return <p className="p-4 text-sm text-slate-500">{canReview ? 'No pending requests.' : 'You have no pending requests.'}</p>;
  }
  return (
    <ul className="divide-y divide-slate-800">
      {requests.map((r) => (
        <li key={r.id} className="animate-fade-up flex items-center gap-2 px-4 py-3">
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate text-slate-100"><span className="font-medium">{canReview ? r.username : 'You'}</span> asked to {describe(r)}</p>
            {!canReview && <p className="flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3 w-3" aria-hidden="true" /> Waiting for approval</p>}
          </div>
          {canReview && (
            <div className="flex gap-1">
              <button onClick={() => onResolve(r.id, true)} aria-label={`Approve ${r.username}'s request`} className="rounded-md bg-emerald-600 p-1.5 text-white hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-300">
                <Check className="h-4 w-4" aria-hidden="true" />
              </button>
              <button onClick={() => onResolve(r.id, false)} aria-label={`Decline ${r.username}'s request`} className="rounded-md border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-400">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
