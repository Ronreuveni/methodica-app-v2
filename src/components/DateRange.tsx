// Date label + editor supporting single date OR {from,to} range.
// Ported from v1's DateRangeLabel / DateRangeEditor.

import { useState } from 'react';
import clsx from 'clsx';
import type { DateField } from '../lib/types';
import { isRange, rangeStart, rangeEnd, fmtDM, dueDays } from './Icons';

export function DateRangeLabel({ value, kind }: { value: DateField; kind: 'start' | 'due' }) {
  if (!value || (isRange(value) && !value.from && !value.to)) {
    return <span className="text-ink-400">—</span>;
  }
  const from = rangeStart(value);
  const to = rangeEnd(value);
  const refDate = kind === 'due' ? to : from;
  const days = dueDays(refDate);
  let cls = 'text-ink-700';
  let rel = '';
  if (kind === 'due' && days != null) {
    if (days < 0) cls = 'text-danger font-semibold';
    else if (days <= 7) { cls = 'text-brand-orange font-semibold'; rel = days === 0 ? 'היום' : days === 1 ? 'מחר' : `בעוד ${days}י׳`; }
    else if (days <= 21) { cls = 'text-amber-700'; rel = `בעוד ${days}י׳`; }
    else if (days <= 60) rel = `בעוד ${days}י׳`;
  }
  return (
    <span className={clsx('inline-flex items-center gap-1 font-mono', cls)}>
      <span>
        {isRange(value) && from && to && from !== to
          ? <>{fmtDM(from)}<span className="mx-0.5 opacity-50">–</span>{fmtDM(to)}</>
          : fmtDM(from || to)}
      </span>
      {rel && <span className="text-[10px] opacity-70">{rel}</span>}
    </span>
  );
}

export function DateRangeEditor({ value, onSave, onCancel }: {
  value: DateField; onSave: (v: DateField) => void; onCancel: () => void;
}) {
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
    <div className="flex flex-col gap-1 bg-bg-card border border-line rounded p-2 shadow-pop min-w-[200px]">
      <div className="flex gap-1 text-[11px]">
        <button type="button" className={clsx('flex-1 py-1 rounded', mode === 'single' ? 'bg-brand-orange text-white' : 'bg-bg-muted')} onClick={() => setMode('single')}>תאריך</button>
        <button type="button" className={clsx('flex-1 py-1 rounded', mode === 'range' ? 'bg-brand-orange text-white' : 'bg-bg-muted')} onClick={() => setMode('range')}>טווח</button>
      </div>
      <div className="flex gap-1 items-center">
        <input autoFocus type="date" className="cell-input flex-1" value={from}
          onChange={(e) => setFrom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}/>
        {mode === 'range' && (
          <>
            <span className="text-ink-500">–</span>
            <input type="date" className="cell-input flex-1" value={to}
              onChange={(e) => setTo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}/>
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
