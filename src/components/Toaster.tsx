// Bottom-corner save feedback. Listens for 'studio-toast' window events
// (dispatched by the data layer after every DB write) and collapses bursts —
// a drag-reorder fires a dozen writes but should read as one "saved".

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface ToastItem { id: number; msg: string; tone: 'ok' | 'error' }

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const lastShown = useRef<{ msg: string; at: number }>({ msg: '', at: 0 });

  useEffect(() => {
    const onToast = (e: Event) => {
      const { msg, tone } = (e as CustomEvent<{ msg: string; tone: 'ok' | 'error' }>).detail;
      const now = Date.now();
      if (tone === 'ok' && msg === lastShown.current.msg && now - lastShown.current.at < 1500) {
        lastShown.current.at = now;
        return;
      }
      lastShown.current = { msg, at: now };
      const id = ++seq.current;
      setItems(list => [...list.slice(-2), { id, msg, tone }]);
      setTimeout(() => setItems(list => list.filter(t => t.id !== id)), tone === 'error' ? 6000 : 2200);
    };
    window.addEventListener('studio-toast', onToast);
    return () => window.removeEventListener('studio-toast', onToast);
  }, []);

  if (!items.length) return null;
  return (
    <div className="fixed bottom-4 start-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {items.map(t => (
        <div key={t.id}
          className={clsx(
            'px-3.5 py-2 rounded-lg shadow-pop text-[12px] font-medium text-white animate-toast-in',
            t.tone === 'ok' ? 'bg-ink-900/90' : 'bg-danger'
          )}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
