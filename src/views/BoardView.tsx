// Main productions board: table of active projects with inline-edit cells,
// status filter chips, client/producer/PM filters, sort modes, search box,
// and group-by-client headers. Each cell write is a per-row Supabase update —
// no full-document overwrites, no echo loop.

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { PageHead } from '../components/PageHead';
import { StatusPill } from '../components/StatusPill';
import { AvatarStack } from '../components/Avatar';
import { STATUSES } from '../lib/types';
import type { Project, ProjectStatus, DateField } from '../lib/types';
import type { StudioData } from '../hooks/useStudioData';

type SortMode = 'manual' | 'status' | 'client' | 'due';
type Tab = 'active' | 'done';

function isRange(v: DateField): v is { from: string; to: string } {
  return typeof v === 'object' && v !== null && ('from' in v || 'to' in v);
}
function rangeEnd(v: DateField): string {
  if (!v) return '';
  return isRange(v) ? (v.to || v.from || '') : v;
}
function rangeStart(v: DateField): string {
  if (!v) return '';
  return isRange(v) ? (v.from || v.to || '') : v;
}
function fmtDM(iso: string): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

export function BoardView({ data }: { data: StudioData }) {
  const [tab, setTab] = useState<Tab>('active');
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState<ProjectStatus | 'all'>('all');
  const [clientF, setClientF] = useState<string>('all');
  const [producerF, setProducerF] = useState<string>('all');
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);

  const visible = useMemo(() => {
    const all = data.projects;
    let rows = all.filter(p => {
      const isDone = p.status === 'done';
      if (tab === 'active' && isDone) return false;
      if (tab === 'done' && !isDone) return false;
      if (statusF !== 'all' && p.status !== statusF) return false;
      if (clientF !== 'all' && p.client !== clientF) return false;
      if (producerF !== 'all' && !p.producers.includes(producerF)) return false;
      if (q) {
        const needle = q.toLowerCase();
        if (!p.name.toLowerCase().includes(needle)
         && !p.client.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
    if (tab === 'done') {
      rows = [...rows].sort((a, b) =>
        (a.client || '').localeCompare(b.client || '', 'he')
        || (a.name || '').localeCompare(b.name || '', 'he'));
    } else if (sortMode === 'status') {
      const order = Object.keys(STATUSES);
      rows = [...rows].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    } else if (sortMode === 'client') {
      rows = [...rows].sort((a, b) =>
        (a.client || 'אאא').localeCompare(b.client || 'אאא', 'he')
        || (rangeEnd(a.due) || '').localeCompare(rangeEnd(b.due) || '')
      );
    } else if (sortMode === 'due') {
      rows = [...rows].sort((a, b) => {
        const ad = rangeEnd(a.due), bd = rangeEnd(b.due);
        if (!ad && !bd) return 0;
        if (!ad) return 1;
        if (!bd) return -1;
        return new Date(ad).getTime() - new Date(bd).getTime();
      });
    } else {
      rows = [...rows].sort((a, b) => a.sortIndex - b.sortIndex);
    }
    return rows;
  }, [data.projects, tab, sortMode, q, statusF, clientF, producerF]);

  const counts = useMemo(() => ({
    total: data.projects.filter(p => p.status !== 'done').length,
    production: data.projects.filter(p => p.status === 'production').length,
    review: data.projects.filter(p => p.status === 'review').length,
    hot: data.projects.filter(p => p.urgency === 'hot' && p.status !== 'done').length,
    done: data.projects.filter(p => p.status === 'done').length,
  }), [data.projects]);

  const clientList = useMemo(() => [...new Set(data.projects.map(p => p.client).filter(Boolean))].sort(),
    [data.projects]);

  const addProject = () => {
    const id = 'new-' + Date.now();
    void data.upsertProject({
      id, name: '', type: 'סטוריליין', status: 'planning',
      client: '', pm: '', producers: [], hours: 0,
      urgency: 'normal', sortIndex: -1,
    });
    setEditing({ id, field: 'name' });
  };

  const showClientGroups = sortMode === 'client';
  let lastClient: string | null = null;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
      <PageHead
        title="לוח הפקות"
        sub={`${counts.total} פרויקטים פעילים · ${counts.done} בארכיון`}
        actions={
          <>
            <button className="btn btn-primary" onClick={addProject}>+ פרויקט חדש</button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <Kpi label="סה״כ פעילים" value={counts.total} sub="במערכת"/>
        <Kpi label="בהפקה" value={counts.production} color="#EC8223" sub="רצים עכשיו"/>
        <Kpi label="בתיקוף" value={counts.review} color="#3B8DBC" sub="ממתינים לאישור"/>
        <Kpi label="בוערים 🔥" value={counts.hot} color="#D65046" sub="דורשים תשומת לב"/>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3 border-b border-line">
        {(['active', 'done'] as const).map(t => (
          <button key={t}
            className={clsx(
              'px-4 py-2 text-[13px] font-medium transition-colors border-b-2',
              tab === t
                ? 'border-brand-orange text-ink-900'
                : 'border-transparent text-ink-500 hover:text-ink-900'
            )}
            onClick={() => setTab(t)}
          >
            {t === 'active' ? 'פעילים' : 'הושלמו'}
            <span className="ms-2 text-[11px] bg-bg-muted px-1.5 py-0.5 rounded">
              {t === 'active' ? counts.total : counts.done}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[12px] text-ink-500">סטטוס:</span>
        <button className={clsx('chip', statusF === 'all' && 'active')} onClick={() => setStatusF('all')}>הכל</button>
        {(Object.keys(STATUSES) as ProjectStatus[]).filter(k => tab === 'done' || k !== 'done').map(k => (
          <button key={k} className={clsx('chip', statusF === k && 'active')} onClick={() => setStatusF(k)}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUSES[k].color }}/>
            {STATUSES[k].label}
          </button>
        ))}
        <span className="w-px h-5 bg-line mx-1"/>
        <span className="text-[12px] text-ink-500">לקוח:</span>
        <select className="chip" value={clientF} onChange={e => setClientF(e.target.value)}>
          <option value="all">הכל</option>
          {clientList.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-[12px] text-ink-500">מפיק.ה:</span>
        <select className="chip" value={producerF} onChange={e => setProducerF(e.target.value)}>
          <option value="all">הכל</option>
          {data.producers.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
        </select>
        {tab === 'active' && (
          <>
            <span className="w-px h-5 bg-line mx-1"/>
            <span className="text-[12px] text-ink-500">מיון:</span>
            <div className="inline-flex bg-bg-muted rounded p-0.5">
              {(['manual','status','client','due'] as const).map(s => (
                <button key={s}
                  className={clsx(
                    'px-2.5 py-1 text-[12px] rounded transition-colors',
                    sortMode === s ? 'bg-bg-card shadow-sm text-ink-900' : 'text-ink-500 hover:text-ink-900'
                  )}
                  onClick={() => setSortMode(s)}>
                  {{ manual:'ידני', status:'לפי סטטוס', client:'לפי לקוח', due:'לפי הגשה' }[s]}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="ms-auto flex items-center gap-2 bg-bg-card border border-line rounded px-2">
          <span className="text-ink-500">🔍</span>
          <input
            type="search"
            placeholder="חיפוש פרויקט..."
            className="bg-transparent border-0 outline-none text-[13px] py-1.5 w-48"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-bg-muted text-[11px] text-ink-500 uppercase">
              <tr>
                <th className="px-2 py-2 w-8"/>
                <th className="px-3 py-2 text-start">שם פרויקט</th>
                <th className="px-3 py-2 text-start">לקוח</th>
                <th className="px-3 py-2 text-start">סוג</th>
                <th className="px-3 py-2 text-start">מפיק.ה</th>
                <th className="px-3 py-2 text-start">מנהל.ת</th>
                <th className="px-3 py-2 text-start">שעות</th>
                <th className="px-3 py-2 text-start">כניסה</th>
                <th className="px-3 py-2 text-start">הגשה</th>
                <th className="px-3 py-2 text-start">סטטוס</th>
                <th className="px-3 py-2 w-16"/>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-ink-500">אין פרויקטים תואמים.</td></tr>
              ) : visible.map(p => {
                let groupHeader: React.ReactElement | null = null;
                if (showClientGroups) {
                  const cur = p.client || '— ללא לקוח —';
                  if (cur !== lastClient) {
                    const groupCount = visible.filter(x => (x.client || '— ללא לקוח —') === cur).length;
                    lastClient = cur;
                    groupHeader = (
                      <tr key={'grp-'+cur} className="bg-orange-50/40">
                        <td colSpan={11} className="px-4 py-2 border-y border-brand-orange/30">
                          <span className="font-bold text-[13px]">{cur}</span>
                          <span className="ms-2 text-[11px] text-ink-500">{groupCount} פרויקטים</span>
                        </td>
                      </tr>
                    );
                  }
                }
                return (
                  <>
                    {groupHeader}
                    <BoardRow key={p.id} p={p} data={data} editing={editing} setEditing={setEditing}/>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] text-ink-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[11px] text-ink-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function BoardRow({ p, data, editing, setEditing }: {
  p: Project;
  data: StudioData;
  editing: { id: string; field: string } | null;
  setEditing: (e: { id: string; field: string } | null) => void;
}) {
  const isEditing = (field: string) => !!editing && editing.id === p.id && editing.field === field;
  const startEdit = (field: string) => setEditing({ id: p.id, field });
  const stopEdit = () => setEditing(null);
  const patch = (data2: Partial<Project>) => { void data.patchProject(p.id, data2); };
  const dueRef = rangeEnd(p.due);
  const today = new Date(); today.setHours(0,0,0,0);
  const overdue = dueRef && p.status !== 'done' && p.status !== 'frozen' &&
    new Date(dueRef) < today;

  return (
    <tr className={clsx(
      'border-t border-line group',
      p.urgency === 'hot' && 'bg-orange-50/30',
      overdue && 'bg-red-50/30',
    )}>
      <td className="px-2 py-1.5 text-center">
        <button
          className="text-[14px] opacity-40 hover:opacity-100 transition-opacity"
          title={p.urgency === 'hot' ? 'בוער' : 'סמן כבוער'}
          onClick={() => patch({ urgency: p.urgency === 'hot' ? 'normal' : 'hot' })}
        >
          {p.urgency === 'hot' ? '🔥' : '⚐'}
        </button>
      </td>

      <EditableTextCell
        editing={isEditing('name')} onStart={() => startEdit('name')} onSave={(v) => { patch({ name: v }); stopEdit(); }} onCancel={stopEdit}
        value={p.name} placeholder="שם פרויקט…" extra={p.notes && <div className="text-[11px] text-ink-500 mt-0.5">{p.notes}</div>}
      />
      <EditableTextCell editing={isEditing('client')} onStart={() => startEdit('client')} onSave={(v) => { patch({ client: v }); stopEdit(); }} onCancel={stopEdit} value={p.client} placeholder="לקוח…"/>
      <EditableTextCell editing={isEditing('type')} onStart={() => startEdit('type')} onSave={(v) => { patch({ type: v }); stopEdit(); }} onCancel={stopEdit} value={p.type} placeholder="סוג…"/>

      <td className="px-3 py-1.5">
        <ProducerMultiCell value={p.producers} onChange={(ids) => patch({ producers: ids })} all={data.producers}/>
      </td>

      <EditableTextCell editing={isEditing('pm')} onStart={() => startEdit('pm')} onSave={(v) => { patch({ pm: v }); stopEdit(); }} onCancel={stopEdit} value={p.pm} placeholder="—"/>

      <td className="px-3 py-1.5">
        {isEditing('hours') ? (
          <input
            type="number" autoFocus className="cell-input w-20" defaultValue={p.hours || ''}
            onBlur={(e) => { patch({ hours: parseInt(e.target.value) || 0 }); stopEdit(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') stopEdit(); }}
          />
        ) : (
          <button className="font-mono font-semibold w-full text-start hover:bg-bg-muted rounded px-1" onClick={() => startEdit('hours')}>
            {p.hours || <span className="text-ink-500 font-normal">—</span>}
          </button>
        )}
      </td>

      <DateCell editing={isEditing('start')} onStart={() => startEdit('start')} onSave={(v) => { patch({ start: v }); stopEdit(); }} onCancel={stopEdit} value={p.start} kind="start"/>
      <DateCell editing={isEditing('due')} onStart={() => startEdit('due')} onSave={(v) => { patch({ due: v }); stopEdit(); }} onCancel={stopEdit} value={p.due} kind="due"/>

      <td className="px-3 py-1.5">
        {isEditing('status') ? (
          <select
            autoFocus className="cell-input" defaultValue={p.status}
            onBlur={(e) => { patch({ status: e.target.value as ProjectStatus }); stopEdit(); }}
            onChange={(e) => { patch({ status: e.target.value as ProjectStatus }); stopEdit(); }}
          >
            {(Object.keys(STATUSES) as ProjectStatus[]).map(k => <option key={k} value={k}>{STATUSES[k].label}</option>)}
          </select>
        ) : (
          <button onClick={() => startEdit('status')}>
            <StatusPill status={p.status}/>
          </button>
        )}
      </td>

      <td className="px-3 py-1.5">
        <button
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-danger transition-opacity"
          title="מחק"
          onClick={() => { if (confirm('למחוק את "' + (p.name || 'הפרויקט') + '"?')) void data.deleteProject(p.id); }}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

function EditableTextCell({ editing, value, onStart, onSave, onCancel, placeholder, extra }: {
  editing: boolean; value: string; onStart: () => void;
  onSave: (v: string) => void; onCancel: () => void;
  placeholder?: string; extra?: React.ReactNode;
}) {
  return (
    <td className="px-3 py-1.5">
      {editing ? (
        <input
          autoFocus
          className="cell-input w-full"
          defaultValue={value}
          onBlur={(e) => onSave(e.target.value.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') onCancel();
          }}
        />
      ) : (
        <button className="w-full text-start hover:bg-bg-muted rounded px-1 py-0.5" onClick={onStart}>
          <div className={value ? 'font-medium' : 'text-ink-500'}>{value || placeholder}</div>
          {extra}
        </button>
      )}
    </td>
  );
}

function DateCell({ editing, value, onStart, onSave, onCancel, kind }: {
  editing: boolean; value: DateField; onStart: () => void;
  onSave: (v: DateField) => void; onCancel: () => void;
  kind: 'start' | 'due';
}) {
  const single = !isRange(value);
  return (
    <td className="px-3 py-1.5">
      {editing ? (
        <DateEditor value={value} onSave={onSave} onCancel={onCancel}/>
      ) : (
        <button className="hover:bg-bg-muted rounded px-1 py-0.5 text-[12px]" onClick={onStart}>
          <DateLabel value={value} kind={kind}/>
        </button>
      )}
    </td>
  );
}

function DateLabel({ value, kind }: { value: DateField; kind: 'start' | 'due' }) {
  if (!value || (isRange(value) && !value.from && !value.to)) {
    return <span className="text-ink-500">—</span>;
  }
  const from = rangeStart(value);
  const to = rangeEnd(value);
  const refDate = kind === 'due' ? to : from;
  let cls = 'text-ink-700';
  if (kind === 'due' && refDate) {
    const days = Math.ceil((new Date(refDate).getTime() - Date.now()) / 86400000);
    if (days < 0) cls = 'text-danger font-semibold';
    else if (days <= 7) cls = 'text-brand-orange font-semibold';
    else if (days <= 21) cls = 'text-amber-700';
  }
  return (
    <span className={cls + ' font-mono'}>
      {isRange(value) && from && to && from !== to
        ? <>{fmtDM(from)}<span className="mx-1 opacity-50">–</span>{fmtDM(to)}</>
        : fmtDM(from || to)}
    </span>
  );
}

function DateEditor({ value, onSave, onCancel }: { value: DateField; onSave: (v: DateField) => void; onCancel: () => void }) {
  const initialRange = isRange(value);
  const [mode, setMode] = useState<'single' | 'range'>(initialRange ? 'range' : 'single');
  const [from, setFrom] = useState(rangeStart(value) || '');
  const [to, setTo] = useState(rangeEnd(value) || '');
  const commit = () => {
    if (mode === 'single') onSave(from || '');
    else if (!from && !to) onSave('');
    else if (from && to && from !== to) onSave({ from, to });
    else onSave(from || to);
  };
  return (
    <div className="flex flex-col gap-1 bg-bg-card border border-line rounded p-2 shadow-pop">
      <div className="flex gap-1 text-[11px]">
        <button className={clsx('flex-1 py-1 rounded', mode==='single' ? 'bg-brand-orange text-white' : 'bg-bg-muted')} onClick={() => setMode('single')}>תאריך</button>
        <button className={clsx('flex-1 py-1 rounded', mode==='range'  ? 'bg-brand-orange text-white' : 'bg-bg-muted')} onClick={() => setMode('range')}>טווח</button>
      </div>
      <div className="flex gap-1 items-center">
        <input autoFocus type="date" className="cell-input flex-1" value={from} onChange={e => setFrom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}/>
        {mode === 'range' && (
          <>
            <span className="text-ink-500">–</span>
            <input type="date" className="cell-input flex-1" value={to} onChange={e => setTo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}/>
          </>
        )}
      </div>
      <div className="flex gap-1">
        <button className="btn btn-primary text-[11px] py-1 flex-1" onClick={commit}>שמור</button>
        <button className="btn text-[11px] py-1" onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

function ProducerMultiCell({ value, onChange, all }: {
  value: string[]; onChange: (ids: string[]) => void; all: import('../lib/types').Producer[];
}) {
  const [open, setOpen] = useState(false);
  const map = new Map(all.map(p => [p.id, p]));
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  return (
    <div className="relative">
      <button className="hover:bg-bg-muted rounded px-1 py-0.5" onClick={() => setOpen(o => !o)}>
        {value.length ? <AvatarStack producers={value} all={all}/> : <span className="text-ink-500 text-[12px]">+ הקצה</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
          <div className="absolute z-50 mt-1 bg-bg-card border border-line rounded shadow-pop p-2 w-48">
            {all.map(pr => (
              <label key={pr.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-bg-muted rounded cursor-pointer text-[12px]">
                <input type="checkbox" checked={value.includes(pr.id)} onChange={() => toggle(pr.id)}/>
                <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-white text-[10px] font-bold" style={{ background: pr.color }}>{pr.name.charAt(0)}</span>
                <span className="flex-1">{pr.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
