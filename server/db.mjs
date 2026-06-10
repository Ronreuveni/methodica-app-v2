// Local SQLite database layer. Mirrors the Supabase schema (snake_case
// columns, same table names) so the frontend row-mappers work unchanged.
// Arrays are stored as JSON text, booleans as 0/1 — toApi()/fromApi()
// convert at the boundary.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.STUDIO_DB_PATH || join(__dirname, 'data', 'studio.db');
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
create table if not exists producers (
  id            text primary key,
  name          text not null,
  color         text not null default '#3B8DBC',
  capacity      real not null default 0.80,
  hours_week    integer not null default 40,
  position_pct  real not null default 1.00,
  team_id       text,
  is_external   integer not null default 0,
  sort_index    integer not null default 0,
  note          text,
  created_at    text not null default (datetime('now')),
  updated_at    text not null default (datetime('now'))
);

create table if not exists teams (
  id          text primary key,
  name        text not null,
  leader_id   text,
  sort_index  integer not null default 0,
  created_at  text not null default (datetime('now'))
);

create table if not exists projects (
  id                  text primary key,
  name                text not null,
  type                text default '',
  status              text not null default 'planning',
  client              text default '',
  pm                  text default '',
  start_date          text default '',
  start_range_from    text default '',
  start_range_to      text default '',
  due_date            text default '',
  due_range_from      text default '',
  due_range_to        text default '',
  hours               integer not null default 0,
  producers           text not null default '[]',
  notes               text default '',
  complexity          text default '',
  urgency             text not null default 'normal',
  archived            integer not null default 0,
  report_link         text default '',
  folder_link         text default '',
  sort_index          integer not null default 0,
  created_by_email    text,
  updated_by_email    text,
  created_at          text not null default (datetime('now')),
  updated_at          text not null default (datetime('now'))
);

create table if not exists history (
  id              text primary key,
  name            text not null,
  type            text default '',
  client          text default '',
  pm              text default '',
  completed_date  text default '',
  hours           integer not null default 0,
  producers       text not null default '[]',
  created_at      text not null default (datetime('now'))
);

create table if not exists assignments (
  id          text primary key,
  producer_id text not null,
  date        text not null,
  project_id  text,
  hours       integer not null default 0,
  label       text,
  updated_by_email text,
  created_at  text not null default (datetime('now')),
  updated_at  text not null default (datetime('now'))
);
create index if not exists assignments_producer_date_idx on assignments(producer_id, date);

create table if not exists producer_tasks (
  id          text primary key,
  producer_id text not null,
  month_label text default '',
  name        text not null,
  client      text default '',
  pm          text default '',
  hours       text default '',
  due         text default '',
  status      text default '',
  report      text default '',
  notes       text default '',
  sort_index  integer not null default 0,
  created_at  text not null default (datetime('now'))
);
create index if not exists producer_tasks_producer_idx on producer_tasks(producer_id);
`);

// Column catalogues — whitelist for dynamic upsert/update, plus the type
// conversions each table needs at the API boundary.
export const TABLES = {
  producers: {
    columns: ['id','name','color','capacity','hours_week','position_pct','team_id','is_external','sort_index','note'],
    bools: ['is_external'], jsons: [],
  },
  teams: {
    columns: ['id','name','leader_id','sort_index'],
    bools: [], jsons: [],
  },
  projects: {
    columns: ['id','name','type','status','client','pm','start_date','start_range_from','start_range_to',
      'due_date','due_range_from','due_range_to','hours','producers','notes','complexity','urgency',
      'archived','report_link','folder_link','sort_index','created_by_email','updated_by_email'],
    bools: ['archived'], jsons: ['producers'],
  },
  history: {
    columns: ['id','name','type','client','pm','completed_date','hours','producers'],
    bools: [], jsons: ['producers'],
  },
  assignments: {
    columns: ['id','producer_id','date','project_id','hours','label','updated_by_email'],
    bools: [], jsons: [],
  },
  producer_tasks: {
    columns: ['id','producer_id','month_label','name','client','pm','hours','due','status','report','notes','sort_index'],
    bools: [], jsons: [],
  },
};

// DB row → API shape (parse JSON arrays, 0/1 → boolean)
export function toApi(table, row) {
  if (!row) return row;
  const spec = TABLES[table];
  const out = { ...row };
  for (const c of spec.jsons) { try { out[c] = JSON.parse(out[c] ?? '[]'); } catch { out[c] = []; } }
  for (const c of spec.bools) out[c] = !!out[c];
  return out;
}

// API payload → DB values (stringify arrays, boolean → 0/1), filtered to
// known columns only.
export function fromApi(table, payload) {
  const spec = TABLES[table];
  const out = {};
  for (const c of spec.columns) {
    if (!(c in payload)) continue;
    let v = payload[c];
    if (spec.jsons.includes(c)) v = JSON.stringify(v ?? []);
    else if (spec.bools.includes(c)) v = v ? 1 : 0;
    else if (v === undefined) v = null;
    out[c] = v;
  }
  return out;
}

export function listAll(table, orderBy = 'sort_index') {
  const rows = db.prepare(`select * from ${table} order by ${orderBy}`).all();
  return rows.map(r => toApi(table, r));
}

export function upsertRow(table, payload) {
  const vals = fromApi(table, payload);
  if (!vals.id) throw new Error('id is required');
  const cols = Object.keys(vals);
  const placeholders = cols.map(() => '?').join(', ');
  const updates = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`);
  const hasUpdatedAt = ['producers','projects','assignments'].includes(table);
  if (hasUpdatedAt) updates.push(`updated_at = datetime('now')`);
  const sql = `insert into ${table} (${cols.join(', ')}) values (${placeholders})
    on conflict(id) do update set ${updates.join(', ')}`;
  db.prepare(sql).run(...cols.map(c => vals[c]));
  return toApi(table, db.prepare(`select * from ${table} where id = ?`).get(vals.id));
}

export function updateRow(table, id, payload) {
  const vals = fromApi(table, payload);
  delete vals.id;
  const cols = Object.keys(vals);
  if (cols.length) {
    const sets = cols.map(c => `${c} = ?`);
    if (['producers','projects','assignments'].includes(table)) sets.push(`updated_at = datetime('now')`);
    db.prepare(`update ${table} set ${sets.join(', ')} where id = ?`).run(...cols.map(c => vals[c]), id);
  }
  return toApi(table, db.prepare(`select * from ${table} where id = ?`).get(id));
}

export function deleteRow(table, id) {
  db.prepare(`delete from ${table} where id = ?`).run(id);
}

export function clearAll() {
  for (const t of Object.keys(TABLES)) db.exec(`delete from ${t}`);
}

export function counts() {
  const out = {};
  for (const t of Object.keys(TABLES)) {
    out[t] = db.prepare(`select count(*) as n from ${t}`).get().n;
  }
  return out;
}
