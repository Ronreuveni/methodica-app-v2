// Small icon button → popover with editable URL + Open action. Ported from
// v1's LinkPopoverButton. Used for report links and project-folder links.

import { useEffect, useRef, useState } from 'react';

export function LinkPopover({ value, onSave, icon, title }: {
  value?: string;
  onSave: (v: string) => void;
  icon: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(value || '');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVal(value || ''); }, [value]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const id = setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onDoc); };
  }, [open]);

  const save = () => {
    let v = (val || '').trim();
    if (v && !/^https?:\/\//i.test(v) && !v.startsWith('mailto:')) v = 'https://' + v;
    onSave(v);
    setOpen(false);
  };
  const hasLink = !!value;

  return (
    <div className="relative inline-block" ref={wrapRef}>
      <button
        className={'w-6 h-6 rounded inline-flex items-center justify-center text-[12px] transition-colors ' +
          (hasLink ? 'bg-orange-100 text-brand-orange' : 'text-ink-400 hover:bg-bg-muted')}
        title={hasLink ? title + ' · לחץ לעריכה' : 'הוסף ' + title}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      >
        {icon}
      </button>
      {open && (
        <div className="absolute z-[100] mt-1 end-0 bg-bg-card border border-line rounded shadow-pop p-2 w-56">
          <div className="text-[11px] font-semibold mb-1.5 text-ink-700">{title}</div>
          <input
            type="url" placeholder="https://..." value={val} autoFocus dir="ltr"
            className="cell-input w-full"
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') setOpen(false); }}
          />
          <div className="flex items-center justify-between mt-2 gap-2">
            {hasLink && (
              <a href={value} target="_blank" rel="noopener noreferrer"
                 className="text-[12px] text-brand-blue hover:underline">פתח ↗</a>
            )}
            <button className="btn btn-primary text-[11px] py-1 px-3 ms-auto" onClick={save}>שמור</button>
          </div>
        </div>
      )}
    </div>
  );
}
