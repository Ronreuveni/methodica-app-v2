import type { Producer } from '../lib/types';
import clsx from 'clsx';

export function Avatar({ producer, size = 'md' }: { producer: Producer | undefined; size?: 'sm' | 'md' | 'lg' }) {
  if (!producer) return null;
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full text-white font-semibold select-none',
        size === 'sm' && 'w-6 h-6 text-[11px]',
        size === 'md' && 'w-8 h-8 text-[13px]',
        size === 'lg' && 'w-12 h-12 text-[18px]',
      )}
      style={{ background: producer.color }}
      title={producer.name}
    >
      {producer.name.charAt(0)}
    </span>
  );
}

export function AvatarStack({ producers, all, size = 'sm' }: {
  producers: string[]; all: Producer[]; size?: 'sm' | 'md';
}) {
  const map = new Map(all.map(p => [p.id, p]));
  return (
    <span className="inline-flex -space-x-1 rtl:space-x-reverse">
      {producers.map(id => {
        const p = map.get(id);
        return p ? (
          <span key={id} className="ring-2 ring-white rounded-full">
            <Avatar producer={p} size={size}/>
          </span>
        ) : null;
      })}
    </span>
  );
}
