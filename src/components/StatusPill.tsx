import { STATUSES, type ProjectStatus } from '../lib/types';

export function StatusPill({ status }: { status: ProjectStatus }) {
  const s = STATUSES[status];
  if (!s) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }}/>
      {s.label}
    </span>
  );
}
