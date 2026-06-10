// Per-producer detail view: hero KPIs, upcoming deadlines, active projects
// table, and (later) meeting log + history dashboard. Editing a project field
// here uses the SAME per-row Supabase update as the board view, so changes
// propagate automatically to every other surface.

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { PageHead } from '../components/PageHead';
import { StatusPill } from '../components/StatusPill';
import { Avatar } from '../components/Avatar';
import type { StudioData } from '../hooks/useStudioData';
import type { DateField, ProducerTask, ProjectStatus } from '../lib/types';

const HEBREW_MONTHS = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יונ׳','יול׳','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];

function rangeEnd(v: DateField): string {
  if (!v) return '';
  return typeof v === 'object' ? (v.to || v.from || '') : v;
}

// Imported due dates can be free text ("סוף אוגוסט") — only real dates can
// drive the deadline countdowns.
function parseDate(v: DateField): Date | null {
  const s = rangeEnd(v);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function ProducerView({ data, producerId, onBack }: {
  data: StudioData; producerId: string; onBack: () => void;
}) {
  const producer = data.producers.find(p => p.id === producerId);
  const myProjects = useMemo(
    () => data.projects.filter(p => p.producers.includes(producerId) && p.status !== 'done'),
    [data.projects, producerId]
  );
  const upcomingDeadlines = useMemo(() => {
    return [...myProjects]
      .filter(p => parseDate(p.due))
      .sort((a, b) => parseDate(a.due)!.getTime() - parseDate(b.due)!.getTime())
      .slice(0, 5);
  }, [myProjects]);

  if (!producer) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-500">
        מפיק.ה לא נמצא.ה. <button className="btn ms-2" onClick={onBack}>חזרה ללוז המפיקים</button>
      </div>
    );
  }

  const byStatus: Record<string, number> = {};
  myProjects.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });

  return (
    <div className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
      <button className="btn btn-ghost mb-4 text-[12px]" onClick={onBack}>
        ← חזרה ללוז המפיקים
      </button>
      <PageHead title={`לו״ז הפקות · ${producer.name}`}/>

      {/* Hero card */}
      <div className="card p-5 mb-5 grid grid-cols-4 gap-5">
        <div className="flex items-center gap-3">
          <Avatar producer={producer} size="lg"/>
          <div>
            <div className="text-xl font-bold">{producer.name}</div>
            <div className="text-[12px] text-ink-500">
              מפיק.ת דיגיטל
              {producer.positionPct < 1 && <span className="ms-2 px-1.5 py-0.5 bg-bg-muted rounded text-[10px]">{Math.round(producer.positionPct*100)}% משרה</span>}
            </div>
          </div>
        </div>
        <Kpi label="פרויקטים פעילים" value={myProjects.length}
          sub={Object.entries(byStatus).map(([k,v]) => `${k}:${v}`).join(' · ') || '—'}/>
        <Kpi label="קיבולת שבועית" value={producer.hoursWeek + ' שע׳'} sub={`${Math.round(producer.capacity*100)}% עומס יעד`}/>
        <Kpi label="הגשה קרובה"
          value={upcomingDeadlines[0]?.name.slice(0, 30) || '—'}
          sub={upcomingDeadlines[0] ? new Date(rangeEnd(upcomingDeadlines[0].due)).toLocaleDateString('he-IL', { day:'2-digit', month:'long' }) : '—'}/>
      </div>

      {/* Two-column: deadlines + active projects */}
      <div className="grid grid-cols-[1fr_2fr] gap-4">
        {/* Deadlines */}
        <div className="card">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h3 className="font-semibold text-[13px]">מועדים קרובים</h3>
            <span className="text-[11px] text-ink-500">{upcomingDeadlines.length} הגשות</span>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <div className="px-4 py-6 text-center text-ink-500 text-[12px]">אין מועדים קרובים.</div>
          ) : upcomingDeadlines.map(p => {
            const due = new Date(rangeEnd(p.due));
            const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
            const tone = days < 0 ? 'text-danger' : days <= 7 ? 'text-brand-orange' : days <= 21 ? 'text-amber-700' : 'text-ink-700';
            return (
              <div key={p.id} className="px-4 py-3 border-b border-line last:border-0 grid grid-cols-[56px_1fr_auto] gap-3 items-center">
                <div className="text-center bg-bg-muted rounded p-2">
                  <div className="text-xl font-bold">{due.getDate()}</div>
                  <div className="text-[10px] text-ink-500">{HEBREW_MONTHS[due.getMonth()]}</div>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-[11px] text-ink-500 truncate">{p.client}{p.pm ? ' · ' + p.pm : ''}</div>
                </div>
                <div className="text-end">
                  <StatusPill status={p.status}/>
                  <div className={'text-[11px] font-mono mt-1 ' + tone}>
                    {days < 0 ? `איחור ${Math.abs(days)}י׳` : days === 0 ? 'היום' : days === 1 ? 'מחר' : `בעוד ${days} ימים`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active projects table */}
        <div className="card">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h3 className="font-semibold text-[13px]">פרויקטים פעילים</h3>
            <span className="text-[11px] text-ink-500">{myProjects.length} פרויקטים</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-bg-muted text-[11px] text-ink-500">
                <tr>
                  <th className="px-3 py-2 text-start">משימה</th>
                  <th className="px-3 py-2 text-start">לקוח</th>
                  <th className="px-3 py-2 text-start">שעות</th>
                  <th className="px-3 py-2 text-start">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {myProjects.map(p => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{p.name}</div>
                      {p.pm && <div className="text-[10px] text-ink-500 mt-0.5">{p.pm}</div>}
                    </td>
                    <td className="px-3 py-2 text-ink-700">{p.client || '—'}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{p.hours || '—'}</td>
                    <td className="px-3 py-2">
                      <select
                        className="cell-input"
                        value={p.status}
                        onChange={e => { void data.patchProject(p.id, { status: e.target.value as ProjectStatus }); }}
                      >
                        {Object.entries({ planning:'בתכנון', production:'בהפקה', review:'בתיקוף', done:'הושלם', frozen:'מוקפא' })
                          .map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <TaskLog tasks={data.producerTasks.filter(t => t.producerId === producerId)}/>
    </div>
  );
}

// Month-by-month task log imported from the producer's personal לו"ז sheet.
function TaskLog({ tasks }: { tasks: ProducerTask[] }) {
  const [q, setQ] = useState('');
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set());

  const groups = useMemo(() => {
    const filtered = !q ? tasks : tasks.filter(t => {
      const n = q.toLowerCase();
      return t.name.toLowerCase().includes(n) || t.client.toLowerCase().includes(n) || t.pm.toLowerCase().includes(n);
    });
    const byMonth = new Map<string, ProducerTask[]>();
    for (const t of filtered) {
      const k = t.monthLabel || 'ללא חודש';
      (byMonth.get(k) || byMonth.set(k, []).get(k)!).push(t);
    }
    // The sheets run oldest → newest; show the newest month first.
    return [...byMonth.entries()].reverse();
  }, [tasks, q]);

  if (!tasks.length) return null;

  const toggle = (m: string) => setOpenMonths(prev => {
    const next = new Set(prev);
    if (next.has(m)) next.delete(m); else next.add(m);
    return next;
  });
  const isOpen = (m: string, idx: number) => !!q || openMonths.has(m) || (idx === 0 && !openMonths.size);

  return (
    <div className="card mt-4">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[13px]">יומן משימות (מיובא מהאקסל)</h3>
          <div className="text-[11px] text-ink-500">{tasks.length.toLocaleString()} משימות · לפי חודשים</div>
        </div>
        <input type="search" placeholder="חיפוש משימה / לקוח…" className="cell-input w-52"
          value={q} onChange={e => setQ(e.target.value)}/>
      </div>
      {groups.length === 0 && (
        <div className="px-4 py-6 text-center text-ink-500 text-[12px]">אין משימות תואמות.</div>
      )}
      {groups.map(([month, list], idx) => (
        <div key={month} className="border-b border-line last:border-0">
          <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-muted text-[13px]"
            onClick={() => toggle(month)}>
            <span className="font-semibold">{month}</span>
            <span className="text-[11px] text-ink-500">{list.length} משימות {isOpen(month, idx) ? '▴' : '▾'}</span>
          </button>
          {isOpen(month, idx) && (
            <table className="w-full text-[12px]">
              <thead className="bg-bg-muted text-[11px] text-ink-500">
                <tr>
                  <th className="px-3 py-1.5 text-start">משימה</th>
                  <th className="px-3 py-1.5 text-start w-28">לקוח</th>
                  <th className="px-3 py-1.5 text-start w-24">מנהל.ת</th>
                  <th className="px-3 py-1.5 text-start w-16">שעות</th>
                  <th className="px-3 py-1.5 text-start w-20">הגשה</th>
                  <th className="px-3 py-1.5 text-start w-24">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {list.map(t => (
                  <tr key={t.id} className="border-t border-line group">
                    <td className="px-3 py-1.5">
                      <div className="font-medium">{t.name}</div>
                      {t.notes && <div className="text-[10px] text-ink-500 mt-0.5 line-clamp-1">{t.notes}</div>}
                    </td>
                    <td className="px-3 py-1.5 text-ink-700">{t.client || '—'}</td>
                    <td className="px-3 py-1.5 text-ink-700">{t.pm || '—'}</td>
                    <td className="px-3 py-1.5 font-mono">{t.hours || '—'}</td>
                    <td className="px-3 py-1.5 font-mono">{t.due || '—'}</td>
                    <td className="px-3 py-1.5">
                      <span className={clsx('inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
                        /הושלם|הסתיים|בוצע/.test(t.status) ? 'bg-[#EDF3E0] text-[#5d7d31]'
                        : /בעבודה|בתהליך|בהפקה/.test(t.status) ? 'bg-[#FEF1E4] text-[#b05f12]'
                        : t.status ? 'bg-bg-muted text-ink-700' : 'text-ink-400')}>
                        {t.status || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
      {sub && <div className="text-[11px] text-ink-500 mt-0.5">{sub}</div>}
    </div>
  );
}
