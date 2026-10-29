import { useState } from 'react';
import { Loader2 } from 'lucide-react';

/** Shown when someone opens a shared room link and still needs to pick a name. */
export default function JoinGate({ roomId, error, busy, onJoin }) {
  const [name, setName] = useState('');
  return (
    <div className="mx-auto mt-16 w-full max-w-md px-4">
      <form
        onSubmit={(e) => { e.preventDefault(); onJoin(name); }}
        className="animate-fade-up space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <div>
          <h1 className="text-xl font-semibold text-white">Join watch party</h1>
          <p className="mt-1 text-sm text-slate-400">Room code <span className="font-mono text-slate-200">{roomId}</span></p>
        </div>
        <div>
          <label htmlFor="join-name" className="mb-1 block text-sm text-slate-300">Your name</label>
          <input
            id="join-name" autoFocus value={name} maxLength={24} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            placeholder="e.g. Priya"
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Join room
        </button>
      </form>
    </div>
  );
}
