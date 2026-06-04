// Producers schedule matrix — full parity with v1. Week / fortnight / month
// modes, drag projects from the sidebar onto cells, drag existing assignments
// between cells, click a chip to open the project modal, capacity bars,
// holidays, fortnight divider. Per-row Supabase writes.

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { PageHead } from '../components/PageHead';
import { Avatar } from '../components/Avatar';
import { CapacityBar } from '../components/CapacityBar';
import { isoLocal } from '../components/Icons';
import { STATUSES, type Project, type Assignment, type Producer } from '../lib/types';
import type { StudioData } from '../hooks/useStudioData';
import { UnscheduledSidebar } from './matrix/UnscheduledSidebar';
import { ProjectModal } from './matrix/ProjectModal';

type Range = 'week' | 'fortnight' | 'month';
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
const DAY_NAMES_FULL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
// Illustrative holidays — replace with the studio's real calendar as needed.
const HOLIDAYS: Record<string, string> = {};

function sundayOf(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()); }

// module-level drag payload (works around dataTransfer quirks in table cells)
let _drag: { type: 'project' | 'assignment'; id: string } | null = null;

export function MatrixView({ data, onOpenProducer }: { data: StudioData; onOpenProducer: (id: string) => void }) {
  const [range, setRange] = useState<Range>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [modalProject, setModalProject] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null); // `${producerId}|${date}`
  const [, setDragTick] = useState(0); // re-render on drag start/end

  const today = new Date(); const todayIso = isoLocal(today);
  const projectsById = useMemo(() => new Map(data.projects.map(p => [p.id, p])), [data.projects]);

  const isMonth = range === 'month';

  // Build the list of visible dates.
  const dateList = useMemo(() => {
    if (isMonth) {
      const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      const y = base.getFullYear(), mo = base.getMonth();
      const last = new Date(y, mo + 1, 0).getDate();
      const days: string[] = [];
      for (let d = 1; d <= last; d++) {
        const dt = new Date(y, mo, d);
        if (dt.getDay() >= 0 && dt.getDay() <= 4) days.push(isoLocal(dt));
      }
      return days;
    }
    const base = sundayOf(today);
    const wsY = base.getFullYear(), wsM = base.getMonth(), wsD = base.getDate() + weekOffset * 7;
    const days: string[] = [];
    const weeks = range === 'fortnight' ? 2 : 1;
    for (let w = 0; w < weeks; w++) for (let di = 0; di < 5; di++) days.push(isoLocal(new Date(wsY, wsM, wsD + w * 7 + di)));
    return days;
  }, [range, weekOffset, monthOffset]);

  const rangeLabel = useMemo(() => {
    if (isMonth) {
      const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      return MONTHS[base.getMonth()] + ' ' + base.getFullYear();
    }
    const first = new Date(dateList[0]), last = new Date(dateList[dateList.length - 1]);
    return `${first.getDate()}.${first.getMonth() + 1} – ${last.getDate()}.${last.getMonth() + 1}.${last.getFullYear()}`;
  }, [dateList, isMonth, monthOffset]);

  const offset = isMonth ? monthOffset : weekOffset;
  const setOffset = (fn: (o: number) => number) => isMonth ? setMonthOffset(fn) : setWeekOffset(fn);

  const scheduledIds = useMemo(() => new Set(data.assignments.filter(a => a.projectId && dateList.includes(a.date)).map(a => a.projectId!)), [data.assignments, dateList]);

  const cellMap = useMemo(() => {
    const m = new Map<string, Assignment[]>();
    data.assignments.forEach(a => { const k = a.producerId + '|' + a.date; (m.get(k) || m.set(k, []).get(k)!).push(a); });
    return m;
  }, [data.assignments]);

  // Drop handler — creates (project) or moves (assignment) on the cell.
  const onDrop = (producerId: string, date: string) => {
    const item = _drag; _drag = null; setDragOver(null); setDragTick(t => t + 1);
    if (!item) return;
    if (item.type === 'project') {
      // clear "free" placeholder on that day, then add
      const existingFree = (cellMap.get(producerId + '|' + date) || []).find(a => !a.projectId && a.label === 'פנוי');
      if (existingFree) void data.deleteAssignment(existingFree.id);
      const id = 'a-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      void data.upsertAssignment({ id, producerId, date, projectId: item.id, hours: 7, label: null });
    } else {
      void data.patchAssignment(item.id, { producerId, date });
    }
  };

  const totalsFor = (pid: string) => dateList.reduce((sum, d) => sum + (cellMap.get(pid + '|' + d) || []).reduce((s, a) => s + a.hours, 0), 0);
  const target = range === 'week' ? 45 : range === 'fortnight' ? 90 : dateList.length * 9;

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      <div className="px-8 py-6 pb-3">
        <PageHead title="לו״ז מפיקים" sub={isMonth ? 'מבט חודשי' : range === 'fortnight' ? 'מבט שבועיים' : 'מבט שבועי · מפיק.ה × ימים'}
          actions={
            <div className="flex items-center gap-2">
              <div className="inline-flex bg-bg-muted rounded p-0.5">
                {(['week', 'fortnight', 'month'] as Range[]).map(r => (
                  <button key={r} className={clsx('px-3 py-1.5 text-[12px] rounded', range === r ? 'bg-bg-card shadow-sm' : 'text-ink-500')} onClick={() => setRange(r)}>
                    {{ week: 'שבוע', fortnight: 'שבועיים', month: 'חודש' }[r]}
                  </button>
                ))}
              </div>
              <button className="btn" onClick={() => setOffset(() => 0)} disabled={offset === 0}>{isMonth ? 'חודש נוכחי' : 'שבוע נוכחי'}</button>
              <button className="btn" onClick={() => setOffset(o => o - 1)}>‹</button>
              <span className="text-[12px] font-medium min-w-[120px] text-center">{rangeLabel}</span>
              <button className="btn" onClick={() => setOffset(o => o + 1)}>›</button>
            </div>
          }/>
        <div className="flex items-center gap-4 text-[11px] text-ink-500">
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ background: '#7DA842' }}/>עומס תקין</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ background: '#EC8223' }}/>עומס גבוה (70-90%)</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ background: '#D65046' }}/>עומס מלא (90%+)</span>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto px-8 pb-6">
          {isMonth ? (
            <MonthCalendar dateList={dateList} producers={data.producers} cellMap={cellMap} projectsById={projectsById} todayIso={todayIso}/>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-[12px] border-collapse">
                <thead className="bg-bg-muted text-ink-500">
                  {range === 'fortnight' && (
                    <tr>
                      <th className="border-b border-line"/>
                      <th colSpan={5} className="px-2 py-1.5 text-center font-semibold border-b border-line">שבוע ראשון</th>
                      <th colSpan={5} className="px-2 py-1.5 text-center font-semibold border-b border-line border-s-2 border-s-brand-orange">שבוע שני</th>
                    </tr>
                  )}
                  <tr>
                    <th className="px-3 py-2 text-start w-44 sticky start-0 bg-bg-muted">מפיק.ה</th>
                    {dateList.map((iso, i) => {
                      const d = new Date(iso);
                      return (
                        <th key={iso} className={clsx('px-1 py-2 text-center font-medium min-w-[110px]', iso === todayIso && 'bg-orange-100', range === 'fortnight' && i === 5 && 'border-s-2 border-s-brand-orange')}>
                          <div className="text-[11px] text-ink-500">{DAY_NAMES[i % 5]}</div>
                          <div className="font-mono">{d.getDate()}.{d.getMonth() + 1}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.producers.map(prod => {
                    const total = totalsFor(prod.id);
                    const pct = total / target;
                    return (
                      <tr key={prod.id} className="border-t border-line">
                        <td className="px-3 py-2 align-top sticky start-0 bg-bg-card cursor-pointer hover:bg-bg-muted" onClick={() => onOpenProducer(prod.id)}>
                          <div className="flex items-center gap-2">
                            <Avatar producer={prod} size="sm"/>
                            <div className="min-w-0">
                              <div className="font-semibold text-[13px] truncate">{prod.name}</div>
                              <div className="text-[11px] text-ink-500">{total} שע׳ · {Math.round(pct * 100)}%</div>
                            </div>
                          </div>
                          <div className="mt-1"><CapacityBar value={pct}/></div>
                        </td>
                        {dateList.map((iso, di) => {
                          const key = prod.id + '|' + iso;
                          const entries = cellMap.get(key) || [];
                          return (
                            <td key={iso}
                              className={clsx('border-s border-line p-1 align-top', iso === todayIso && 'bg-orange-50/30', dragOver === key && 'bg-orange-100 outline-2 outline-dashed outline-brand-orange', range === 'fortnight' && di === 5 && 'border-s-2 border-s-brand-orange')}
                              onDragOver={e => { e.preventDefault(); if (dragOver !== key) setDragOver(key); }}
                              onDragLeave={() => { if (dragOver === key) setDragOver(null); }}
                              onDrop={() => onDrop(prod.id, iso)}>
                              <Cell entries={entries} producerId={prod.id} date={iso} data={data} projectsById={projectsById}
                                onProjectClick={setModalProject} onDragTick={() => setDragTick(t => t + 1)}/>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <UnscheduledSidebar
          projects={data.projects.filter(p => ['planning', 'production', 'review'].includes(p.status))}
          producers={data.producers}
          scheduledIds={scheduledIds}
          onDragProject={(id) => { _drag = id ? { type: 'project', id } : null; setDragTick(t => t + 1); }}/>
      </div>

      {modalProject && projectsById.get(modalProject) && (
        <ProjectModal project={projectsById.get(modalProject)!} assignments={data.assignments} producers={data.producers}
          onClose={() => setModalProject(null)} onOpenProducer={(id) => { setModalProject(null); onOpenProducer(id); }}/>
      )}
    </div>
  );
}

function Cell({ entries, producerId, date, data, projectsById, onProjectClick, onDragTick }: {
  entries: Assignment[]; producerId: string; date: string; data: StudioData;
  projectsById: Map<string, Project>; onProjectClick: (id: string) => void; onDragTick: () => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-1 min-h-[40px]">
      {entries.map(a => {
        if (!a.projectId) {
          const isVac = a.label && /חופש|זיכרון|עצמאות|מחלה|מילואים/.test(a.label);
          return (
            <div key={a.id} draggable
              onDragStart={() => { _drag = { type: 'assignment', id: a.id }; onDragTick(); }}
              onDragEnd={() => { _drag = null; onDragTick(); }}
              className={clsx('text-[11px] text-center py-1 rounded border cursor-grab', isVac ? 'bg-amber-50 border-amber-200 text-amber-800' : 'border-dashed border-line text-ink-500')}>
              {a.label || 'פנוי'}
              <button className="ms-1 opacity-50 hover:opacity-100" onClick={e => { e.stopPropagation(); void data.deleteAssignment(a.id); }}>×</button>
            </div>
          );
        }
        const proj = projectsById.get(a.projectId);
        if (!proj) return null;
        const s = STATUSES[proj.status];
        return (
          <div key={a.id} draggable
            onDragStart={() => { _drag = { type: 'assignment', id: a.id }; onDragTick(); }}
            onDragEnd={() => { _drag = null; onDragTick(); }}
            onClick={() => onProjectClick(proj.id)}
            className="text-[11px] rounded p-1.5 border-s-2 cursor-pointer hover:shadow-sm"
            style={{ background: s.bg, borderInlineStartColor: s.color }}>
            <div className="font-semibold leading-tight">{proj.urgency === 'hot' && '🔥 '}{proj.name}</div>
            <div className="text-ink-500 truncate">{proj.client || proj.type}</div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-mono">{a.hours} שע׳</span>
              <button className="text-ink-500 hover:text-danger" onClick={e => { e.stopPropagation(); void data.deleteAssignment(a.id); }}>×</button>
            </div>
          </div>
        );
      })}
      {adding ? (
        <Adder producerId={producerId} date={date} data={data} onDone={() => setAdding(false)}/>
      ) : (
        <button className="text-[11px] text-ink-400 hover:text-brand-orange hover:bg-orange-50 rounded py-0.5" onClick={() => setAdding(true)}>+ הוסף</button>
      )}
    </div>
  );
}

function Adder({ producerId, date, data, onDone }: { producerId: string; date: string; data: StudioData; onDone: () => void }) {
  const [projectId, setProjectId] = useState('');
  const [hours, setHours] = useState(7);
  const active = data.projects.filter(p => p.status !== 'done' && p.status !== 'frozen');
  const addProject = () => {
    if (!projectId) { onDone(); return; }
    void data.upsertAssignment({ id: 'a-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), producerId, date, projectId, hours, label: null });
    onDone();
  };
  const addLabel = (label: string) => {
    void data.upsertAssignment({ id: 'a-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), producerId, date, projectId: null, hours: 0, label });
    onDone();
  };
  return (
    <div className="bg-bg-card border border-line rounded p-1.5 shadow-pop space-y-1">
      <select className="cell-input w-full text-[11px]" value={projectId} onChange={e => setProjectId(e.target.value)} autoFocus>
        <option value="">— פרויקט —</option>
        {active.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="flex gap-1">
        <input type="number" className="cell-input flex-1 text-[11px]" value={hours} min={0} max={12} onChange={e => setHours(parseInt(e.target.value) || 0)}/>
        <button className="btn btn-primary text-[11px] px-2" onClick={addProject}>הוסף</button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {['חופש', 'מחלה', 'מילואים', 'פנוי'].map(l => <button key={l} className="btn text-[10px] px-1.5 py-0.5 flex-1" onClick={() => addLabel(l)}>{l}</button>)}
      </div>
      <button className="text-[10px] text-ink-500 w-full" onClick={onDone}>ביטול</button>
    </div>
  );
}

// Month calendar — compact grid showing producer-chips per working day.
function MonthCalendar({ dateList, producers, cellMap, projectsById, todayIso }: {
  dateList: string[]; producers: Producer[]; cellMap: Map<string, Assignment[]>;
  projectsById: Map<string, Project>; todayIso: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {dateList.map(iso => {
        const d = new Date(iso);
        const busy = producers.map(p => {
          const ents = cellMap.get(p.id + '|' + iso) || [];
          const proj = ents.find(a => a.projectId);
          const label = ents.find(a => !a.projectId)?.label;
          return { p, project: proj ? projectsById.get(proj.projectId!) : null, label };
        });
        const counts = busy.filter(b => b.project).length;
        return (
          <div key={iso} className={clsx('card p-3', iso === todayIso && 'ring-2 ring-brand-orange')}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-[13px]">{DAY_NAMES_FULL[d.getDay()]} · {d.getDate()}.{d.getMonth() + 1}</div>
              <div className="text-[11px] text-ink-500">{counts} בהפקה</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {busy.map(({ p, project, label }) => {
                const s = project ? STATUSES[project.status] : null;
                return (
                  <div key={p.id} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
                    style={{ background: s ? s.bg : 'var(--bg-muted)' }}
                    title={`${p.name}: ${project ? project.name : (label || 'פנוי')}`}>
                    <span className="w-3 h-3 rounded-full inline-flex items-center justify-center text-white text-[8px] font-bold" style={{ background: p.color }}>{p.name.charAt(0)}</span>
                    <span className="max-w-[90px] truncate" style={s ? { color: s.color } : undefined}>{project ? project.name : (label || 'פנוי')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
