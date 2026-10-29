import { Crown, Shield, Eye } from 'lucide-react';

const STYLES = {
  host: { label: 'Host', Icon: Crown, cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  moderator: { label: 'Moderator', Icon: Shield, cls: 'border-blue-500/40 bg-blue-500/10 text-blue-300' },
  participant: { label: 'Participant', Icon: Eye, cls: 'border-slate-600 bg-slate-800 text-slate-300' },
};

export default function RoleBadge({ role }) {
  const { label, Icon, cls } = STYLES[role] ?? STYLES.participant;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
