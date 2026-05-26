// Productions board — full parity with v1: table + kanban modes, paste &
// email import, status/client/producer filters, sort modes incl. group-by-
// client, search, inline cell editing (combo autocomplete, date ranges,
// producer multi-select, link popovers), urgency flags, drag-reorder, delete.

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { PageHead } from '../components/PageHead';
import { StatusPill } from '../components/StatusPill';
import { AvatarStack } from '../components/Avatar';
import { ComboInput } from '../components/ComboInput';
import { LinkPopover } from '../components/LinkPopover';
import { DateRangeLabel, DateRangeEditor } from '../components/DateRange';
import { Icons, rangeEnd } from '../components/Icons';
import { STATUSES, PROJECT_TYPES, type Project, type ProjectStatus, type Producer } from '../lib/types';
import type { StudioData } from '../hooks/useStudioData';
import { BoardKanban } from './board/BoardKanban';
import { PasteImportModal } from './board/PasteImportModal';
import { EmailImportModal } from './board/EmailImportModal';

type SortMode = 'manual' | 'status' | 'client' | 'due';
type Tab = 'active' | 'done';
type Mode = 'table' | 'kanban';

export function BoardView({ data }: { data: StudioData }) {
  const [tab, setTab] = useState<Tab>('active');
  const [mode, setMode] = useState<Mode>('table');
  const [kanbanBy, setKanbanBy] = useState<'status' | 'date'>('status');
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState<ProjectStatus | 'all'>('all');
  const [clientF, setClientF] = useState('all');
  const [producerF, setProducerF] = useState('all');
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const visible = useMemo(() => {
    let rows = data.projects.filter(p => {
      const isDone = p.status === 'done';
      if (tab === 'active' && isDone) return false;
      if (tab === 'done' && !isDone) return false;
      if (statusF !== 'all' && p.status !== statusF) return false;
      if (clientF !== 'all' && p.client !== clientF) return false;
      if (producerF !== 'all' && !p.producers.includes(producerF)) return false;
      if (q) {
        const n = q.toLowerCase();
        if (!p.name.toLowerCase().includes(n) && !p.client.toLowerCase().includes(n)) return false;
      }
      return true;
    });
    if (tab === 'done') {
      rows = [...rows].sort((a, b) => (a.client || '').localeCompare(b.client || '', 'he') || (a.name || '').localeCompare(b.name || '', 'he'));
    } else if (sortMode === 'status') {
      const order = Object.keys(STATUSES);
      rows = [...rows].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    } else if (sortMode === 'client') {
      rows = [...rows].sort((a, b) => (a.client || 'תתת').localeCompare(b.client || 'תתת', 'he') || (rangeEnd(a.due) || '').localeCompare(rangeEnd(b.due) || ''));
    } else if (sortMode === 'due') {
      rows = [...rows].sort((a, b) => {
        const ad = rangeEnd(a.due), bd = rangeEnd(b.due);
        if (!ad && !bd) return 0; if (!ad) return 1; if (!bd) return -1;
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

  const clientList = useMemo(() => [...new Set(data.projects.map(p => p.client).filter(Boolean))].sort(), [data.projects]);
  const suggest = useMemo(() => {
    const uniq = (a: string[]) => [...new Set(a.filter(Boolean))].sort();
    return {
      names: uniq([...data.projects.map(p => p.name), ...data.history.map(h => h.name)]),
      clients: uniq([...data.projects.map(p => p.client), ...data.history.map(h => h.client)]),
      types: uniq([...PROJECT_TYPES, ...data.projects.map(p => p.type), ...data.history.map(h => h.type)]),
      pms: uniq([...data.projects.map(p => p.pm), ...data.history.map(h => h.pm)]),
    };
  }, [data.projects, data.history]);

  const addProject = () => {
    const id = 'new-' + Date.now();
    void data.upsertProject({ id, name: '', type: 'סטוריליין', status: 'planning', client: '', pm: '', producers: [], hours: 0, urgency: 'normal', sortIndex: -1 });
    setEditing({ id, field: 'name' });
  };

  // Drag-reorder: drop src before tgt by swapping sortIndex values.
  const reorder = (srcId: string, tgtId: string) => {
    if (!srcId || !tgtId || srcId === tgtId) return;
    const ordered = [...data.projects].sort((a, b) => a.sortIndex - b.sortIndex);
    const srcIdx = ordered.findIndex(p => p.id === srcId);
    const tgtIdx = ordered.findIndex(p => p.id === tgtId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const [item] = ordered.splice(srcIdx, 1);
    ordered.splice(tgtIdx, 0, item);
    ordered.forEach((p, i) => { if (p.sortIndex !== i) void data.patchProject(p.id, { sortIndex: i }); });
  };

  const canDrag = tab === 'active' && sortMode === 'manual';
  const showClientGroups = sortMode === 'client' && tab === 'active';
  let lastClient: string | null = null;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
      <PageHead title="לוח הפקות" sub={`${counts.total} פרויקטים פעילים · ${counts.done} בארכיון`}
        actions={<>
          <button className="btn btn-ghost" onClick={() => setShowEmail(true)}>📧 ייבוא ממייל</button>
          <button className="btn btn-ghost" onClick={() => setShowPaste(true)}>📋 ייבא שורה</button>
          <button className="btn btn-primary" onClick={addProject}><Icons.plus/> פרויקט חדש</button>
        </>}/>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <Kpi label="סה״כ פעילים" value={counts.total} sub="במערכת"/>
        <Kpi label="בהפקה" value={counts.production} color="#EC8223" sub="רצים עכשיו"/>
        <Kpi label="בתיקוף" value={counts.review} color="#3B8DBC" sub="ממתינים לאישור"/>
        <Kpi label="בוערים 🔥" value={counts.hot} color="#D65046" sub="דורשים תשומת לב"/>
      </div>

      <div className="flex items-center justify-between mb-3 border-b border-line">
        <div className="flex items-center gap-1">
          {(['active', 'done'] as const).map(t => (
            <button key={t} className={clsx('px-4 py-2 text-[13px] font-medium border-b-2', tab === t ? 'border-brand-orange text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-900')} onClick={() => setTab(t)}>
              {t === 'active' ? 'פעילים' : 'הושלמו'}
              <span className="ms-2 text-[11px] bg-bg-muted px-1.5 py-0.5 rounded">{t === 'active' ? counts.total : counts.done}</span>
            </button>
          ))}
        </div>
        <div className="inline-flex bg-bg-muted rounded p-0.5 mb-1">
          <button className={clsx('px-2.5 py-1 text-[12px] rounded inline-flex items-center gap-1', mode === 'table' ? 'bg-bg-card shadow-sm' : 'text-ink-500')} onClick={() => setMode('table')}><Icons.table/> טבלה</button>
          <button className={clsx('px-2.5 py-1 text-[12px] rounded inline-flex items-center gap-1', mode === 'kanban' ? 'bg-bg-card shadow-sm' : 'text-ink-500')} onClick={() => setMode('kanban')}><Icons.kanban/> קנבן</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[12px] text-ink-500">סטטוס:</span>
        <button className={clsx('chip', statusF === 'all' && 'active')} onClick={() => setStatusF('all')}>הכל</button>
        {(Object.keys(STATUSES) as ProjectStatus[]).filter(k => tab === 'done' || k !== 'done').map(k => (
          <button key={k} className={clsx('chip', statusF === k && 'active')} onClick={() => setStatusF(k)}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUSES[k].color }}/>{STATUSES[k].label}
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
        {mode === 'kanban' && (
          <>
            <span className="w-px h-5 bg-line mx-1"/>
            <span className="text-[12px] text-ink-500">קיבוץ:</span>
            <div className="inline-flex bg-bg-muted rounded p-0.5">
              <button className={clsx('px-2.5 py-1 text-[12px] rounded', kanbanBy === 'status' ? 'bg-bg-card shadow-sm' : 'text-ink-500')} onClick={() => setKanbanBy('status')}>סטטוס</button>
              <button className={clsx('px-2.5 py-1 text-[12px] rounded', kanbanBy === 'date' ? 'bg-bg-card shadow-sm' : 'text-ink-500')} onClick={() => setKanbanBy('date')}>טווח זמן</button>
            </div>
          </>
        )}
        {mode === 'table' && tab === 'active' && (
          <>
            <span className="w-px h-5 bg-line mx-1"/>
            <span className="text-[12px] text-ink-500">מיון:</span>
            <div className="inline-flex bg-bg-muted rounded p-0.5">
              {(['manual', 'status', 'client', 'due'] as const).map(s => (
                <button key={s} className={clsx('px-2.5 py-1 text-[12px] rounded', sortMode === s ? 'bg-bg-card shadow-sm' : 'text-ink-500')} onClick={() => setSortMode(s)}>
                  {{ manual: 'ידני', status: 'לפי סטטוס', client: 'לפי לקוח', due: 'לפי הגשה' }[s]}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="ms-auto flex items-center gap-2 bg-bg-card border border-line rounded px-2">
          <Icons.search/>
          <input type="search" placeholder="חיפוש פרויקט..." className="bg-transparent border-0 outline-none text-[13px] py-1.5 w-44" value={q} onChange={e => setQ(e.target.value)}/>
        </div>
      </div>

      {showPaste && <PasteImportModal onImport={p => void data.upsertProject(p)} onClose={() => setShowPaste(false)}/>}
      {showEmail && <EmailImportModal onImport={p => void data.upsertProject(p)} onClose={() => setShowEmail(false)}/>}

      {mode === 'kanban' ? (
        <BoardKanban rows={visible} kanbanBy={kanbanBy} producers={data.producers}/>
      ) : (
        <div className="card overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-bg-muted text-[11px] text-ink-500">
                <tr>
                  <th className="px-2 py-2 w-8"/>
                  <th className="px-3 py-2 text-start">שם פרויקט</th>
                  <th className="px-3 py-2 text-start">לקוח</th>
                  <th className="px-3 py-2 text-start">סוג הפקה</th>
                  <th className="px-3 py-2 text-start">מפיק.ה</th>
                  <th className="px-3 py-2 text-start">מנהל.ת</th>
                  <th className="px-3 py-2 text-start">שעות</th>
                  <th className="px-3 py-2 text-start">כניסה</th>
                  <th className="px-3 py-2 text-start">הגשה</th>
                  <th className="px-3 py-2 text-start">סטטוס</th>
                  <th className="px-3 py-2 w-20"/>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-ink-500">אין פרויקטים תואמים.</td></tr>
                ) : visible.map(p => {
                  const out: React.ReactNode[] = [];
                  if (showClientGroups) {
                    const cur = p.client || '— ללא לקוח —';
                    if (cur !== lastClient) {
                      lastClient = cur;
                      const cnt = visible.filter(x => (x.client || '— ללא לקוח —') === cur).length;
                      out.push(
                        <tr key={'grp-' + cur} className="bg-orange-50/40">
                          <td colSpan={11} className="px-4 py-2 border-y border-brand-orange/30">
                            <span className="font-bold text-[13px]">{cur}</span>
                            <span className="ms-2 text-[11px] text-ink-500">{cnt} פרויקטים</span>
                          </td>
                        </tr>
                      );
                    }
                  }
                  out.push(
                    <BoardRow key={p.id} p={p} data={data} editing={editing} setEditing={setEditing}
                      suggest={suggest} canDrag={canDrag && !showClientGroups}
                      dragId={dragId} setDragId={setDragId} reorder={reorder}/>
                  );
                  return out;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
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

type Suggest = { names: string[]; clients: string[]; types: string[]; pms: string[] };

function BoardRow({ p, data, editing, setEditing, suggest, canDrag, dragId, setDragId, reorder }: {
  p: Project; data: StudioData;
  editing: { id: string; field: string } | null;
  setEditing: (e: { id: string; field: string } | null) => void;
  suggest: Suggest; canDrag: boolean;
  dragId: string | null; setDragId: (id: string | null) => void;
  reorder: (src: string, tgt: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const isEditing = (f: string) => !!editing && editing.id === p.id && editing.field === f;
  const start = (f: string) => setEditing({ id: p.id, field: f });
  const stop = () => setEditing(null);
  const patch = (x: Partial<Project>) => { void data.patchProject(p.id, x); };
  const due = rangeEnd(p.due);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = due && p.status !== 'done' && p.status !== 'frozen' && new Date(due) < today;

  const dnd = canDrag ? {
    draggable: true,
    onDragStart: () => setDragId(p.id),
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (!dragOver) setDragOver(true); },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (dragId && dragId !== p.id) reorder(dragId, p.id); setDragId(null); },
  } : {};

  return (
    <tr {...dnd} className={clsx('border-t border-line group', p.urgency === 'hot' && 'bg-orange-50/30', overdue && 'bg-red-50/30', dragOver && 'border-t-2 border-t-brand-orange', canDrag && 'cursor-grab')}>
      <td className="px-2 py-1.5 text-center">
        <button className="text-[14px] opacity-40 hover:opacity-100" title={p.urgency === 'hot' ? 'בוער' : 'סמן כבוער'}
          onClick={() => patch({ urgency: p.urgency === 'hot' ? 'normal' : 'hot' })}>
          {p.urgency === 'hot' ? '🔥' : '⚐'}
        </button>
      </td>

      <td className="px-3 py-1.5">
        {isEditing('name') ? (
          <ComboInput defaultValue={p.name} options={suggest.names} className="cell-input w-full"
            onCommit={v => { patch({ name: v }); stop(); }} onCancel={stop}/>
        ) : (
          <button className="w-full text-start hover:bg-bg-muted rounded px-1 py-0.5" onClick={() => start('name')}>
            <div className={p.name ? 'font-semibold' : 'text-ink-400'}>{p.name || 'שם פרויקט…'}</div>
            {p.notes && <div className="text-[11px] text-ink-500 mt-0.5 line-clamp-1">{p.notes}</div>}
          </button>
        )}
      </td>

      <TextCell editing={isEditing('client')} value={p.client} placeholder="לקוח…" options={suggest.clients}
        onStart={() => start('client')} onCommit={v => { patch({ client: v }); stop(); }} onCancel={stop}/>
      <TextCell editing={isEditing('type')} value={p.type} placeholder="סוג…" options={suggest.types}
        onStart={() => start('type')} onCommit={v => { patch({ type: v }); stop(); }} onCancel={stop}/>

      <td className="px-3 py-1.5">
        <ProducerMultiCell value={p.producers} onChange={ids => patch({ producers: ids })} all={data.producers}/>
      </td>

      <TextCell editing={isEditing('pm')} value={p.pm} placeholder="—" options={suggest.pms}
        onStart={() => start('pm')} onCommit={v => { patch({ pm: v }); stop(); }} onCancel={stop}/>

      <td className="px-3 py-1.5">
        {isEditing('hours') ? (
          <input type="number" autoFocus className="cell-input w-20" defaultValue={p.hours || ''}
            onBlur={e => { patch({ hours: parseInt(e.target.value) || 0 }); stop(); }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') stop(); }}/>
        ) : (
          <button className="font-mono font-semibold text-start hover:bg-bg-muted rounded px-1 w-full" onClick={() => start('hours')}>
            {p.hours || <span className="text-ink-400 font-normal">—</span>}
          </button>
        )}
      </td>

      <DateCell editing={isEditing('start')} value={p.start} kind="start" onStart={() => start('start')} onSave={v => { patch({ start: v }); stop(); }} onCancel={stop}/>
      <DateCell editing={isEditing('due')} value={p.due} kind="due" onStart={() => start('due')} onSave={v => { patch({ due: v }); stop(); }} onCancel={stop}/>

      <td className="px-3 py-1.5">
        {isEditing('status') ? (
          <select autoFocus className="cell-input" defaultValue={p.status}
            onBlur={e => { patch({ status: e.target.value as ProjectStatus }); stop(); }}
            onChange={e => { patch({ status: e.target.value as ProjectStatus }); stop(); }}>
            {(Object.keys(STATUSES) as ProjectStatus[]).map(k => <option key={k} value={k}>{STATUSES[k].label}</option>)}
          </select>
        ) : (
          <button onClick={() => start('status')}><StatusPill status={p.status}/></button>
        )}
      </td>

      <td className="px-3 py-1.5">
        <div className="flex items-center gap-1">
          <LinkPopover value={p.reportLink} icon="🔗" title="קישור דיווח" onSave={v => patch({ reportLink: v })}/>
          <LinkPopover value={p.folderLink} icon="📁" title="תקיית פרויקט" onSave={v => patch({ folderLink: v })}/>
          <button className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-danger" title="מחק"
            onClick={() => { if (confirm('למחוק את "' + (p.name || 'הפרויקט') + '"?')) void data.deleteProject(p.id); }}>✕</button>
        </div>
      </td>
    </tr>
  );
}

function TextCell({ editing, value, placeholder, options, onStart, onCommit, onCancel }: {
  editing: boolean; value: string; placeholder?: string; options: string[];
  onStart: () => void; onCommit: (v: string) => void; onCancel: () => void;
}) {
  return (
    <td className="px-3 py-1.5">
      {editing ? (
        <ComboInput defaultValue={value} options={options} className="cell-input w-full" onCommit={onCommit} onCancel={onCancel}/>
      ) : (
        <button className="w-full text-start hover:bg-bg-muted rounded px-1 py-0.5 text-[12px]" onClick={onStart}>
          <span className={value ? 'text-ink-700' : 'text-ink-400'}>{value || placeholder}</span>
        </button>
      )}
    </td>
  );
}

function DateCell({ editing, value, kind, onStart, onSave, onCancel }: {
  editing: boolean; value: Project['start']; kind: 'start' | 'due';
  onStart: () => void; onSave: (v: Project['start']) => void; onCancel: () => void;
}) {
  return (
    <td className="px-3 py-1.5 relative">
      {editing ? (
        <div className="absolute z-50"><DateRangeEditor value={value} onSave={onSave} onCancel={onCancel}/></div>
      ) : (
        <button className="hover:bg-bg-muted rounded px-1 py-0.5 text-[12px]" onClick={onStart}>
          <DateRangeLabel value={value} kind={kind}/>
        </button>
      )}
    </td>
  );
}

function ProducerMultiCell({ value, onChange, all }: { value: string[]; onChange: (ids: string[]) => void; all: Producer[] }) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  return (
    <div className="relative">
      <button className="hover:bg-bg-muted rounded px-1 py-0.5" onClick={() => setOpen(o => !o)}>
        {value.length ? <AvatarStack producers={value} all={all}/> : <span className="text-ink-400 text-[12px]">+ הקצה</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
          <div className="absolute z-50 mt-1 bg-bg-card border border-line rounded shadow-pop p-2 w-48 max-h-64 overflow-y-auto">
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
