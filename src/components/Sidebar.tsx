// Left-anchored navigation: brand → view tabs → producer list. The producer
// list links to the per-producer detail view. Sign-out button at the bottom.

import clsx from 'clsx';
import { IS_LOCAL } from '../lib/backend';
import type { AuthState } from '../hooks/useAuth';
import type { StudioData } from '../hooks/useStudioData';
import type { Producer } from '../lib/types';
import { Avatar } from './Avatar';

export type ViewName = 'board' | 'matrix' | 'producer';

export function Sidebar({
  view, producerId, onNavigate, data, auth,
}: {
  view: ViewName;
  producerId: string | null;
  onNavigate: (view: ViewName, producerId?: string) => void;
  data: StudioData;
  auth: AuthState;
}) {
  return (
    <aside className="w-[240px] shrink-0 bg-ink-900 text-white flex flex-col h-full">
      <div className="px-5 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            <span className="w-2 h-2 rounded-full bg-red-400"/>
            <span className="w-2 h-2 rounded-full bg-amber-400"/>
            <span className="w-2 h-2 rounded-full bg-emerald-400"/>
          </div>
          <span className="font-bold tracking-tight">Methodica</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="text-[10px] uppercase tracking-wider text-white/40 px-2 mb-1">מבטים</div>
        <NavItem active={view === 'board'} onClick={() => onNavigate('board')}>
          <IconBoard/><span>לוח הפקות</span><Badge>{data.projects.length}</Badge>
        </NavItem>
        <NavItem active={view === 'matrix'} onClick={() => onNavigate('matrix')}>
          <IconMatrix/><span>לוז מפיקים</span><Badge>{data.producers.length}</Badge>
        </NavItem>

        <div className="text-[10px] uppercase tracking-wider text-white/40 px-2 mt-4 mb-1">מפיקים</div>
        {data.producers.map(p => (
          <ProducerNavItem
            key={p.id}
            producer={p}
            active={view === 'producer' && producerId === p.id}
            onClick={() => onNavigate('producer', p.id)}
          />
        ))}
      </nav>

      <div className="border-t border-white/10 p-3 text-[11px] text-white/70">
        {IS_LOCAL ? (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
            <span>מסד נתונים מקומי · SQLite</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>
              <span className="truncate" dir="ltr">{auth.email}</span>
            </div>
            <button
              className="w-full text-right text-white/60 hover:text-white transition-colors py-1"
              onClick={() => { void auth.signOut(); }}>
              ← התנתק
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

function NavItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={clsx(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors',
        active
          ? 'bg-brand-orange text-white'
          : 'text-white/80 hover:bg-white/10'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ProducerNavItem({ producer, active, onClick }: { producer: Producer; active: boolean; onClick: () => void }) {
  return (
    <button
      className={clsx(
        'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors',
        active ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'
      )}
      onClick={onClick}
    >
      <Avatar producer={producer} size="sm"/>
      <span className="flex-1 text-right">{producer.name}</span>
      {producer.isExternal && <span className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded">חיצוני</span>}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ms-auto bg-white/15 text-white/90 text-[11px] px-1.5 py-0.5 rounded font-mono">
      {children}
    </span>
  );
}

function IconBoard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="9" rx="1.5"/>
      <rect x="14" y="3" width="7" height="5" rx="1.5"/>
      <rect x="14" y="12" width="7" height="9" rx="1.5"/>
      <rect x="3" y="16" width="7" height="5" rx="1.5"/>
    </svg>
  );
}
function IconMatrix() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="9" y1="4" x2="9" y2="20"/>
      <line x1="15" y1="4" x2="15" y2="20"/>
    </svg>
  );
}
