import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

const STYLES = {
  success: { Icon: CircleCheck, cls: 'border-emerald-500/40 text-emerald-200' },
  error: { Icon: CircleAlert, cls: 'border-red-500/40 text-red-200' },
  info: { Icon: Info, cls: 'border-slate-600 text-slate-200' },
};

export default function Toasts({ toasts, onDismiss }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const { Icon, cls } = STYLES[t.type] ?? STYLES.info;
        return (
          <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'}
            className={`animate-fade-up pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-lg border bg-slate-900 px-3 py-2 text-sm shadow-lg ${cls}`}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => onDismiss(t.id)} aria-label="Dismiss" className="rounded p-0.5 text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
