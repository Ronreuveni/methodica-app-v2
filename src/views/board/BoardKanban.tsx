import clsx from 'clsx';
import { STATUSES, type Project, type ProjectStatus } from '../../lib/types';
import { AvatarStack } from '../../components/Avatar';
import { DateRangeLabel } from '../../components/DateRange';
import { rangeEnd } from '../../components/Icons';
import type { Producer } from '../../lib/types';

export function BoardKanban({ rows, kanbanBy, producers }: {
  rows: Project[]; kanbanBy: 'status' | 'date'; producers: Producer[];
}) {
  let columns: { id: string; title: string; accent: string; items: Project[] }[];
  if (kanbanBy === 'status') {
    columns = (Object.entries(STATUSES) as [ProjectStatus, typeof STATUSES[ProjectStatus]][])
      .filter(([k]) => k !== 'done')
      .map(([k, s]) => ({ id: k, title: s.label, accent: s.color, items: rows.filter(p => p.status === k) }));
  } else {
    const buckets: Record<string, { id: string; title: string; accent: string; items: Project[] }> = {
      week:  { id: 'week',  title: 'השבוע',       accent: '#E05A5A', items: [] },
      next:  { id: 'next',  title: 'שבוע הבא',    accent: '#EC8223', items: [] },
      month: { id: 'month', title: 'בחודש הקרוב', accent: '#F5C84A', items: [] },
      later: { id: 'later', title: 'מאוחר יותר',  accent: '#A8B1BC', items: [] },
      none:  { id: 'none',  title: 'ללא תאריך',   accent: '#D6DAE0', items: [] },
    };
    rows.forEach(p => {
      const due = rangeEnd(p.due);
      if (!due) { buckets.none.items.push(p); return; }
      const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
      if (days <= 7) buckets.week.items.push(p);
      else if (days <= 14) buckets.next.items.push(p);
      else if (days <= 31) buckets.month.items.push(p);
      else buckets.later.items.push(p);
    });
    columns = Object.values(buckets);
  }

  return (
    <div className="grid grid-flow-col auto-cols-[minmax(220px,1fr)] gap-3 overflow-x-auto pb-4">
      {columns.map(col => (
        <div key={col.id} className="bg-bg-muted rounded-lg flex flex-col min-h-[200px]">
          <div className="flex items-center justify-between px-3 py-2 border-t-2 rounded-t-lg" style={{ borderTopColor: col.accent }}>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold">
              <span className="w-2 h-2 rounded-full" style={{ background: col.accent }}/>
              {col.title}
            </div>
            <span className="text-[11px] text-ink-500 bg-bg-card rounded px-1.5">{col.items.length}</span>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {col.items.length === 0 ? (
              <div className="text-center text-ink-400 text-[12px] py-4">—</div>
            ) : col.items.map(p => (
              <div key={p.id} className={clsx('bg-bg-card rounded p-2.5 border border-line shadow-sm', p.urgency === 'hot' && 'ring-1 ring-orange-200')}>
                <div className="flex items-start justify-between gap-1">
                  <div className="font-semibold text-[12px] leading-tight">{p.name}</div>
                  {p.urgency === 'hot' && <span>🔥</span>}
                </div>
                <div className="text-[11px] text-ink-500 mt-1">{p.client || '—'} · {p.type}</div>
                <div className="flex items-center justify-between mt-2">
                  <AvatarStack producers={p.producers} all={producers}/>
                  <div className="flex items-center gap-2">
                    {p.hours > 0 && <span className="text-[11px] font-mono"><b>{p.hours}</b> שע׳</span>}
                    {p.due ? <DateRangeLabel value={p.due} kind="due"/> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
