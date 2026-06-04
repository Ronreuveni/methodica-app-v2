// Draggable list of active projects to assign onto the matrix. Search +
// status / producer / client filters + sort. Ported from v1's
// UnscheduledSidebar. Drag a card onto a matrix cell to create an assignment.

import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { STATUSES, type Project, type ProjectStatus, type Producer } from '../../lib/types';
import { rangeEnd } from '../../components/Icons';

export function UnscheduledSidebar({ projects, producers, scheduledIds, onDragProject }: {
  projects: Project[];
  producers: Producer[];
  scheduledIds: Set<string>;
  onDragProject: (id: string | null) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<'due' | 'name' | 'client' | 'hot'>('due');
  const [fStatus, setFStatus] = useState<ProjectStatus[]>(['planning', 'production', 'review']);
  const [fProducers, setFProducers] = useState<string[]>([]);
  const [fClients, setFClients] = useState<string[]>([]);
  const [prodMenu, setProdMenu] = useState(false);
  const [clientMenu, setClientMenu] = useState(false);
  const prodRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<HTMLDivElement>(null);

  const clientList = useMemo(() => [...new Set(projects.map(p => p.client).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he')), [projects]);

  const filtered = useMemo(() => {
    let rows = projects.filter(p => {
      if (!fStatus.includes(p.status)) return false;
      if (fProducers.length && !fProducers.some(id => p.producers.includes(id))) return false;
      if (fClients.length && !fClients.includes(p.client)) return false;
      if (q && !p.name.toLowerCase().includes(q.toLowerCase()) && !p.client.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sortBy === 'hot') { const av = a.urgency === 'hot' ? 1 : 0, bv = b.urgency === 'hot' ? 1 : 0; if (av !== bv) return bv - av; }
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'he');
      if (sortBy === 'client') return (a.client || '').localeCompare(b.client || '', 'he');
      const ad = rangeEnd(a.due), bd = rangeEnd(b.due);
      if (!ad && !bd) return 0; if (!ad) return 1; if (!bd) return -1;
      return new Date(ad).getTime() - new Date(bd).getTime();
    });
    return rows;
  }, [projects, fStatus, fProducers, fClients, q, sortBy]);

  const toggle = <T,>(arr: T[], v: T, set: (a: T[]) => void) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const activeFilters = (fStatus.length !== 3 ? 1 : 0) + (fProducers.length ? 1 : 0) + (fClients.length ? 1 : 0);

  if (collapsed) {
    return (
      <aside className="w-10 shrink-0 bg-bg-card border-s border-line flex flex-col items-center py-3">
        <button className="text-ink-500 hover:text-ink-900" onClick={() => setCollapsed(false)} title="פתח">«</button>
        <div className="mt-3 text-[10px] text-ink-500 [writing-mode:vertical-rl]">שיבוץ פרויקטים</div>
      </aside>
    );
  }

  return (
    <aside className="w-64 shrink-0 bg-bg-card border-s border-line flex flex-col">
      <div className="px-3 py-3 border-b border-line flex items-start justify-between">
        <div>
          <div className="font-semibold text-[13px]">שיבוץ פרויקטים</div>
          <div className="text-[11px] text-ink-500">{filtered.length} מתוך {projects.length}</div>
        </div>
        <button className="text-ink-500 hover:text-ink-900" onClick={() => setCollapsed(true)} title="כווץ">»</button>
      </div>

      <div className="px-3 py-2 border-b border-line space-y-2">
        <div className="flex items-center gap-1.5 bg-bg-muted border border-line rounded px-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-500"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
          <input className="bg-transparent border-0 outline-none text-[12px] py-1.5 flex-1" placeholder="חיפוש..." value={q} onChange={e => setQ(e.target.value)}/>
          {q && <button className="text-ink-500" onClick={() => setQ('')}>×</button>}
        </div>
        <div className="flex gap-1.5">
          <select className="cell-input flex-1 text-[11px]" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
            <option value="due">מועד הגשה</option><option value="name">שם</option><option value="client">לקוח</option><option value="hot">בוערים תחילה</option>
          </select>
          <button className={clsx('btn text-[11px] px-2 relative', filtersOpen && 'bg-brand-orange text-white border-transparent', activeFilters && !filtersOpen && 'text-brand-orange border-orange-300')} onClick={() => setFiltersOpen(o => !o)}>
            סינון {activeFilters > 0 && <span className="ms-1 bg-brand-orange text-white text-[9px] rounded-full px-1">{activeFilters}</span>}
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="px-3 py-2 border-b border-line bg-bg-muted space-y-2 text-[12px]">
          <div>
            <div className="text-[11px] text-ink-500 mb-1">סטטוס</div>
            <div className="flex flex-wrap gap-1">
              {(['planning', 'production', 'review'] as ProjectStatus[]).map(k => (
                <button key={k} className={clsx('px-2 py-0.5 rounded-full text-[11px] border', fStatus.includes(k) ? '' : 'opacity-40')}
                  style={fStatus.includes(k) ? { background: STATUSES[k].bg, color: STATUSES[k].color, borderColor: STATUSES[k].ring } : { borderColor: 'var(--line)' }}
                  onClick={() => toggle(fStatus, k, setFStatus)}>{STATUSES[k].label}</button>
              ))}
            </div>
          </div>
          <DropFilter label="מפיק.ה" open={prodMenu} setOpen={setProdMenu} refEl={prodRef}
            current={fProducers.length === 0 ? 'הכל' : `${fProducers.length} נבחרו`}
            items={producers.map(p => ({ id: p.id, label: p.name, color: p.color }))}
            selected={fProducers} onToggle={id => toggle(fProducers, id, setFProducers)} onClear={() => setFProducers([])}/>
          <DropFilter label="לקוח" open={clientMenu} setOpen={setClientMenu} refEl={clientRef}
            current={fClients.length === 0 ? 'הכל' : `${fClients.length} נבחרו`}
            items={clientList.map(c => ({ id: c, label: c }))}
            selected={fClients} onToggle={id => toggle(fClients, id, setFClients)} onClear={() => setFClients([])}/>
          {activeFilters > 0 && <button className="text-[11px] text-brand-orange" onClick={() => { setFStatus(['planning', 'production', 'review']); setFProducers([]); setFClients([]); }}>נקה סינון ↺</button>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center text-ink-400 text-[12px] py-6">אין פרויקטים תואמים.</div>
        ) : filtered.map(p => {
          const s = STATUSES[p.status];
          const due = rangeEnd(p.due);
          const days = due ? Math.ceil((new Date(due).getTime() - Date.now()) / 86400000) : null;
          const scheduled = scheduledIds.has(p.id);
          return (
            <div key={p.id} draggable
              onDragStart={() => onDragProject(p.id)}
              onDragEnd={() => onDragProject(null)}
              className={clsx('bg-bg-card border border-line rounded p-2 cursor-grab active:cursor-grabbing hover:shadow-sm', scheduled && 'opacity-70')}>
              <div className="font-semibold text-[12px] leading-tight flex items-center gap-1">
                {p.urgency === 'hot' && <span>🔥</span>}
                <span className="flex-1">{p.name}</span>
                {scheduled && <span className="text-[9px] text-emerald-600">✓</span>}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">{p.client || '—'} · {p.type}</div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                {days != null && (
                  <span className={clsx('text-[10px] font-mono', days < 7 ? 'text-danger' : days < 21 ? 'text-brand-orange' : 'text-ink-500')}>
                    {days < 0 ? `איחור ${Math.abs(days)}י׳` : days === 0 ? 'היום' : days === 1 ? 'מחר' : `${days}י׳`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function DropFilter({ label, current, items, selected, onToggle, onClear, open, setOpen, refEl }: {
  label: string; current: string;
  items: { id: string; label: string; color?: string }[];
  selected: string[]; onToggle: (id: string) => void; onClear: () => void;
  open: boolean; setOpen: (b: boolean) => void; refEl: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="relative" ref={refEl}>
      <div className="text-[11px] text-ink-500 mb-1">{label}</div>
      <button className="btn text-[11px] w-full justify-between" onClick={() => setOpen(!open)}>{current} ▾</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
          <div className="absolute z-50 mt-1 bg-bg-card border border-line rounded shadow-pop p-1 w-full max-h-48 overflow-y-auto">
            <button className="w-full text-start px-2 py-1 hover:bg-bg-muted rounded text-[12px]" onClick={onClear}>הכל</button>
            {items.map(it => (
              <label key={it.id} className="flex items-center gap-2 px-2 py-1 hover:bg-bg-muted rounded cursor-pointer text-[12px]">
                <input type="checkbox" checked={selected.includes(it.id)} onChange={() => onToggle(it.id)}/>
                {it.color && <span className="w-3 h-3 rounded-full" style={{ background: it.color }}/>}
                <span className="flex-1 truncate">{it.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
