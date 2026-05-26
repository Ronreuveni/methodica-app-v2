// Producer × day matrix: week / fortnight modes. Drag-drop wiring is left as
// a follow-up; for now the cells can be clicked to add/edit assignments via a
// small editor. Uses per-row Supabase writes so multiple users editing
// different cells never conflict.

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { PageHead } from '../components/PageHead';
import { StatusPill } from '../components/StatusPill';
import { Avatar } from '../components/Avatar';
import { STATUSES } from '../lib/types';
import type { Producer, Project, Assignment } from '../lib/types';
import type { StudioData } from '../hooks/useStudioData';

type Range = 'week' | 'fortnight';

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function sundayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}
const DAY_NAMES = ['ראשון','שני','שלישי','רביעי','חמישי'];

export function MatrixView({ data, onOpenProducer }: { data: StudioData; onOpenProducer: (id: string) => void }) {
  const [range, setRange] = useState<Range>('week');
  const [weekOffset, setWeekOffset] = useState(0);

  const baseSunday = useMemo(() => {
    const s = sundayOf(new Date());
    s.setDate(s.getDate() + weekOffset * 7);
    return s;
  }, [weekOffset]);

  const dates = useMemo(() => {
    const days: string[] = [];
    const weeks = range === 'week' ? 1 : 2;
    for (let w = 0; w < weeks; w++) {
      for (let di = 0; di < 5; di++) {
        const d = new Date(baseSunday);
        d.setDate(baseSunday.getDate() + w*7 + di);
        days.push(isoLocal(d));
      }
    }
    return days;
  }, [baseSunday, range]);

  const todayIso = isoLocal(new Date());
  const projectsById = useMemo(() => new Map(data.projects.map(p => [p.id, p])), [data.projects]);

  const rangeLabel = useMemo(() => {
    const first = new Date(dates[0]);
    const last = new Date(dates[dates.length-1]);
    return `${first.getDate()}.${first.getMonth()+1} – ${last.getDate()}.${last.getMonth()+1}.${last.getFullYear()}`;
  }, [dates]);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
      <PageHead
        title="לו״ז מפיקים"
        sub={range === 'week' ? 'מבט שבועי · מפיק.ה × ימים' : 'מבט שבועיים'}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-bg-muted rounded p-0.5">
              {(['week','fortnight'] as Range[]).map(r => (
                <button key={r}
                  className={clsx('px-3 py-1.5 text-[12px] rounded transition-colors',
                    range === r ? 'bg-bg-card shadow-sm' : 'text-ink-500')}
                  onClick={() => setRange(r)}>
                  {r === 'week' ? 'שבוע' : 'שבועיים'}
                </button>
              ))}
            </div>
            <button className="btn" onClick={() => setWeekOffset(o => o - 1)}>‹</button>
            <button className="btn" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>{rangeLabel}</button>
            <button className="btn" onClick={() => setWeekOffset(o => o + 1)}>›</button>
          </div>
        }
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-bg-muted text-ink-500">
              {range === 'fortnight' && (
                <tr>
                  <th className="border-b border-line"/>
                  <th colSpan={5} className="px-3 py-1.5 text-center font-semibold border-b border-line">שבוע ראשון</th>
                  <th colSpan={5} className="px-3 py-1.5 text-center font-semibold border-b border-line border-s-2 border-s-brand-orange">שבוע שני</th>
                </tr>
              )}
              <tr>
                <th className="px-3 py-2 text-start w-44">מפיק.ה</th>
                {dates.map((iso, i) => {
                  const d = new Date(iso);
                  const isToday = iso === todayIso;
                  const isWeek2Start = range === 'fortnight' && i === 5;
                  return (
                    <th key={iso} className={clsx(
                      'px-2 py-2 text-center font-medium',
                      isToday && 'bg-orange-100',
                      isWeek2Start && 'border-s-2 border-s-brand-orange',
                    )}>
                      <div className="text-[11px] text-ink-500">{DAY_NAMES[i % 5]}</div>
                      <div className="text-[12px] font-mono">{d.getDate()}.{d.getMonth()+1}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.producers.map(prod => (
                <ProducerRow key={prod.id} producer={prod} dates={dates} data={data} todayIso={todayIso}
                  range={range} projectsById={projectsById} onOpenProducer={onOpenProducer}/>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProducerRow({ producer, dates, data, todayIso, range, projectsById, onOpenProducer }: {
  producer: Producer; dates: string[]; data: StudioData; todayIso: string;
  range: Range; projectsById: Map<string, Project>;
  onOpenProducer: (id: string) => void;
}) {
  const cellsByDate = useMemo(() => {
    const out: Record<string, Assignment[]> = {};
    data.assignments.filter(a => a.producerId === producer.id).forEach(a => {
      (out[a.date] ||= []).push(a);
    });
    return out;
  }, [data.assignments, producer.id]);

  const total = dates.reduce((sum, d) => sum + (cellsByDate[d] || []).reduce((s, a) => s + a.hours, 0), 0);
  const target = range === 'week' ? 45 : 90;
  const pct = total / target;
  const loadColor = pct > 0.9 ? '#D65046' : pct > 0.7 ? '#EC8223' : '#7DA842';

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2 align-top cursor-pointer hover:bg-bg-muted" onClick={() => onOpenProducer(producer.id)}>
        <div className="flex items-center gap-2">
          <Avatar producer={producer} size="sm"/>
          <div>
            <div className="font-semibold text-[13px]">{producer.name}</div>
            <div className="text-[11px] text-ink-500">{total} שע׳ · {Math.round(pct*100)}%</div>
          </div>
        </div>
        <div className="mt-1 h-1 bg-bg-muted rounded overflow-hidden">
          <div className="h-full transition-all" style={{ width: Math.min(100, pct*100)+'%', background: loadColor }}/>
        </div>
      </td>
      {dates.map((iso, i) => {
        const entries = cellsByDate[iso] || [];
        const isToday = iso === todayIso;
        const isWeek2 = range === 'fortnight' && i === 5;
        return (
          <td key={iso} className={clsx(
            'border-s border-line p-1 align-top min-w-[110px] max-w-[150px]',
            isToday && 'bg-orange-50/30',
            isWeek2 && 'border-s-2 border-s-brand-orange',
          )}>
            <CellContents entries={entries} producer={producer} date={iso} data={data} projectsById={projectsById}/>
          </td>
        );
      })}
    </tr>
  );
}

function CellContents({ entries, producer, date, data, projectsById }: {
  entries: Assignment[]; producer: Producer; date: string; data: StudioData;
  projectsById: Map<string, Project>;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      {entries.map(a => {
        if (!a.projectId) {
          return (
            <div key={a.id} className="text-[11px] text-ink-500 italic text-center py-1 border border-dashed border-line rounded">
              {a.label || 'פנוי'}
              <button className="ms-1 opacity-50 hover:opacity-100" onClick={() => void data.deleteAssignment(a.id)}>×</button>
            </div>
          );
        }
        const proj = projectsById.get(a.projectId);
        if (!proj) return null;
        const s = STATUSES[proj.status];
        return (
          <div key={a.id} className="text-[11px] rounded p-1.5 border-s-2"
            style={{ background: s.bg, borderInlineStartColor: s.color }}>
            <div className="font-semibold leading-tight">{proj.name}</div>
            <div className="text-ink-500 truncate">{proj.client}</div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-mono">{a.hours} שע׳</span>
              <button className="text-ink-500 hover:text-danger" onClick={() => void data.deleteAssignment(a.id)}>×</button>
            </div>
          </div>
        );
      })}
      {adding ? (
        <AssignmentAdder producer={producer} date={date} data={data} onDone={() => setAdding(false)}/>
      ) : (
        <button className="text-[11px] text-ink-400 hover:text-brand-orange hover:bg-orange-50 rounded py-1" onClick={() => setAdding(true)}>+ הוסף</button>
      )}
    </div>
  );
}

function AssignmentAdder({ producer, date, data, onDone }: { producer: Producer; date: string; data: StudioData; onDone: () => void }) {
  const [projectId, setProjectId] = useState('');
  const [hours, setHours] = useState(7);
  const active = data.projects.filter(p => p.status !== 'done' && p.status !== 'frozen');
  const save = () => {
    if (!projectId) { onDone(); return; }
    const id = 'a-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    void data.upsertAssignment({ id, producerId: producer.id, date, projectId, hours, label: null });
    onDone();
  };
  const saveLabel = (label: string) => {
    const id = 'a-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    void data.upsertAssignment({ id, producerId: producer.id, date, projectId: null, hours: 0, label });
    onDone();
  };
  return (
    <div className="bg-bg-card border border-line rounded p-1.5 shadow-pop space-y-1">
      <select className="cell-input w-full" value={projectId} onChange={e => setProjectId(e.target.value)} autoFocus>
        <option value="">— בחר פרויקט —</option>
        {active.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="flex gap-1">
        <input type="number" className="cell-input flex-1" value={hours} min={0} max={12} onChange={e => setHours(parseInt(e.target.value) || 0)}/>
        <button className="btn btn-primary text-[11px] px-2" onClick={save}>הוסף</button>
      </div>
      <div className="flex gap-1 text-[10px]">
        {(['חופש','מחלה','מילואים','פנוי'] as const).map(lbl => (
          <button key={lbl} className="btn text-[10px] px-1.5 py-0.5 flex-1" onClick={() => saveLabel(lbl)}>{lbl}</button>
        ))}
      </div>
      <button className="text-[10px] text-ink-500 w-full text-center" onClick={onDone}>ביטול</button>
    </div>
  );
}
