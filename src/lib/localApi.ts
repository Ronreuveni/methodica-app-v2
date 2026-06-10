// Thin REST client for the local SQLite server. All endpoints are proxied
// through vite (/api → localhost:8787) in dev and same-origin in production.

import type { ImportSummary } from './types';

async function http<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { msg = (await res.json()).error || msg; } catch { /* keep status text */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export type TableName = 'producers' | 'teams' | 'projects' | 'history' | 'assignments' | 'producer_tasks';

export const localApi = {
  bootstrap: <T>() => http<T>('GET', '/api/bootstrap'),
  upsert: <T>(table: TableName, row: unknown) => http<T>('POST', `/api/${table}`, row),
  update: <T>(table: TableName, id: string, patch: unknown) =>
    http<T>('PATCH', `/api/${table}/${encodeURIComponent(id)}`, patch),
  remove: (table: TableName, id: string) =>
    http<{ ok: boolean }>('DELETE', `/api/${table}/${encodeURIComponent(id)}`),
  importExcel: async (file: File, mode: 'replace' | 'merge'): Promise<ImportSummary> => {
    const res = await fetch(`/api/import?mode=${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'הייבוא נכשל');
    return json as ImportSummary;
  },
};

// Lightweight save-feedback channel — the Toaster component listens for these.
export function toast(msg: string, tone: 'ok' | 'error' = 'ok') {
  window.dispatchEvent(new CustomEvent('studio-toast', { detail: { msg, tone } }));
}
