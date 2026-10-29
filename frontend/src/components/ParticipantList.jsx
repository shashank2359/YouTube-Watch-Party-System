import { Crown, UserMinus, ShieldCheck, ShieldOff } from 'lucide-react';
import RoleBadge from './RoleBadge.jsx';

export default function ParticipantList({ participants, meId, isHost, onAssign, onRemove, onTransfer }) {
  if (participants.length === 0) {
    return <p className="p-4 text-sm text-slate-500">Nobody here yet.</p>;
  }
  return (
    <ul className="divide-y divide-slate-800">
      {participants.map((p) => {
        const isMe = p.userId === meId;
        const manageable = isHost && !isMe;
        return (
          <li key={p.userId} className="flex flex-wrap items-center gap-2 px-4 py-3">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${p.connected ? 'bg-emerald-400' : 'bg-slate-600'}`}
              title={p.connected ? 'Online' : 'Reconnecting…'}
              aria-label={p.connected ? 'Online' : 'Offline'}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
              {p.username}
              {isMe && <span className="ml-1 text-xs font-normal text-slate-500">(you)</span>}
            </span>
            <RoleBadge role={p.role} />
            {manageable && (
              <div className="flex w-full justify-end gap-1 sm:w-auto">
                {p.role === 'participant' && (
                  <IconButton label={`Make ${p.username} a moderator`} onClick={() => onAssign(p.userId, 'moderator')} Icon={ShieldCheck} />
                )}
                {p.role === 'moderator' && (
                  <IconButton label={`Demote ${p.username} to participant`} onClick={() => onAssign(p.userId, 'participant')} Icon={ShieldOff} />
                )}
                {p.connected && (
                  <IconButton label={`Make ${p.username} the host`} onClick={() => onTransfer(p.userId, p.username)} Icon={Crown} />
                )}
                <IconButton label={`Remove ${p.username}`} onClick={() => onRemove(p.userId, p.username)} Icon={UserMinus} danger />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function IconButton({ label, onClick, Icon, danger }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-md border p-1.5 transition focus-visible:ring-2 focus-visible:ring-blue-400 ${
        danger
          ? 'border-red-500/30 text-red-300 hover:bg-red-500/10'
          : 'border-slate-700 text-slate-300 hover:bg-slate-800'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
