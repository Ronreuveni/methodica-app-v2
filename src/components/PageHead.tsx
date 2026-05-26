import type { ReactNode } from 'react';

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        {sub && <p className="text-[13px] text-ink-500 mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
