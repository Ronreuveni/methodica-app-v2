// ============================================================================
// Convert the legacy data.js (window.PRODUCERS/CLIENTS/PROJECTS/HISTORY) into
// a Supabase seed.sql file that can be pasted into the SQL Editor.
//
// Usage:
//   node scripts/convert-seed.mjs path/to/legacy/data.js > supabase/seed.sql
//
// Or set LEGACY_DATA_PATH:
//   LEGACY_DATA_PATH=../methodica-app-main/data.js node scripts/convert-seed.mjs > supabase/seed.sql
// ============================================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = process.argv[2] || process.env.LEGACY_DATA_PATH
  || resolve(process.cwd(), '../methodica-app-main/data.js');

const src = readFileSync(path, 'utf8');

// Evaluate the legacy file in a sandbox-ish way: it only assigns to `window.*`.
const window = {};
const fn = new Function('window', src + '\nreturn window;');
const w = fn(window);

const esc = (s) => String(s ?? '').replace(/'/g, "''");
const lit = (s) => `'${esc(s)}'`;
const arr = (a) => `ARRAY[${(a || []).map(lit).join(',')}]::text[]`;
const date = (s) => s ? lit(s) : `''`;

// Split a date field (string OR {from,to} object) into 3 columns.
function splitDate(v) {
  if (!v) return { single:'', from:'', to:'' };
  if (typeof v === 'object' && (v.from || v.to)) {
    return { single:'', from: v.from || '', to: v.to || '' };
  }
  return { single: String(v), from:'', to:'' };
}

let out = '';
out += '-- Auto-generated seed. Run AFTER schema.sql.\n';
out += "-- Truncates active tables first, leaves allowed_emails alone.\n\n";
out += 'truncate table public.assignments cascade;\n';
out += 'truncate table public.projects    cascade;\n';
out += 'truncate table public.history     cascade;\n';
out += 'truncate table public.producers   cascade;\n';
out += 'truncate table public.teams       cascade;\n';
out += 'truncate table public.clients     cascade;\n\n';

// Producers
out += '-- ─── Producers ─────────────────────────────────────────────────\n';
out += 'insert into public.producers (id,name,color,capacity,hours_week,position_pct,sort_index) values\n';
out += w.PRODUCERS.map((p, i) =>
  `  (${lit(p.id)},${lit(p.name)},${lit(p.color)},${p.capacity ?? 0.8},${p.hoursWeek ?? 40},${p.positionPct ?? 1.0},${i})`
).join(',\n');
out += ';\n\n';

// Clients (optional catalogue)
if (Array.isArray(w.CLIENTS) && w.CLIENTS.length) {
  out += '-- ─── Clients ───────────────────────────────────────────────────\n';
  out += 'insert into public.clients (id,name,short) values\n';
  out += w.CLIENTS.map(c => `  (${lit(c.id)},${lit(c.name)},${lit(c.short || '')})`).join(',\n');
  out += ';\n\n';
}

// Projects (active)
out += '-- ─── Projects ──────────────────────────────────────────────────\n';
out += 'insert into public.projects (id,name,type,status,client,pm,'
     + 'start_date,start_range_from,start_range_to,due_date,due_range_from,due_range_to,'
     + 'hours,producers,notes,complexity,urgency,sort_index) values\n';
out += w.PROJECTS.map((p, i) => {
  const s = splitDate(p.start);
  const d = splitDate(p.due);
  return '  (' + [
    lit(p.id), lit(p.name), lit(p.type || ''), lit(p.status || 'planning'),
    lit(p.client || ''), lit(p.pm || ''),
    lit(s.single), lit(s.from), lit(s.to),
    lit(d.single), lit(d.from), lit(d.to),
    p.hours || 0, arr(p.producers),
    lit(p.notes || ''), lit(p.complexity || ''),
    lit(p.urgency || 'normal'), i,
  ].join(',') + ')';
}).join(',\n');
out += ';\n\n';

// History (completed)
out += '-- ─── History ───────────────────────────────────────────────────\n';
out += 'insert into public.history (id,name,type,client,pm,completed_date,hours,producers) values\n';
out += w.HISTORY.map(h => '  (' + [
  lit(h.id), lit(h.name), lit(h.type || ''), lit(h.client || ''),
  lit(h.pm || ''), lit(h.completed || ''), h.hours || 0, arr(h.producers),
].join(',') + ')').join(',\n');
out += ';\n';

process.stdout.write(out);
