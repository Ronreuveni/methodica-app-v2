// Free-text input with an autocomplete dropdown of existing values.
// Ported from v1's ComboInput. Commits on Enter / blur / option click.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function ComboInput({ defaultValue, options, onCommit, onCancel, className }: {
  defaultValue: string;
  options: string[];
  onCommit: (v: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [val, setVal] = useState(defaultValue || '');
  const [hasTyped, setHasTyped] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const committed = useRef(false);

  const commit = (v: string) => {
    if (committed.current) return;
    committed.current = true;
    const t = (v || '').trim();
    if (!t) { onCancel(); return; }
    onCommit(t);
  };

  useLayoutEffect(() => {
    const update = () => {
      if (!inputRef.current) return;
      const r = inputRef.current.getBoundingClientRect();
      setPos({ left: r.left, top: r.bottom + 4, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (wrapRef.current && wrapRef.current.contains(t)) return;
      if (t.closest && t.closest('.combo-dropdown')) return;
      commit(val);
    };
    const id = setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onDoc); };
  });

  const list = options || [];
  const filtered = (hasTyped && val)
    ? list.filter(o => o.toLowerCase().includes(val.toLowerCase()))
    : list;

  return (
    <div className="relative" ref={wrapRef}>
      <input
        ref={inputRef}
        autoFocus
        className={className}
        value={val}
        autoComplete="off"
        onFocus={(e) => e.target.select()}
        onBlur={() => commit(val)}
        onChange={(e) => { setVal(e.target.value); setHasTyped(true); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(val); }
          else if (e.key === 'Escape') { committed.current = true; onCancel(); }
        }}
      />
      {filtered.length > 0 && pos && (
        <div
          className="combo-dropdown fixed z-[100] bg-bg-card border border-line rounded shadow-pop max-h-56 overflow-y-auto py-1"
          style={{ left: pos.left, top: pos.top, minWidth: pos.width }}
        >
          {filtered.slice(0, 50).map(o => (
            <div
              key={o}
              className={'px-3 py-1.5 text-[12px] cursor-pointer hover:bg-bg-muted ' + (o === defaultValue ? 'bg-orange-50 font-medium' : '')}
              onMouseDown={(e) => { e.preventDefault(); commit(o); }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
