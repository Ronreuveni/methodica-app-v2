-- ============================================================================
-- Methodica studio production board — Supabase schema
-- ============================================================================
-- Run this once in Supabase SQL Editor (Dashboard → SQL → New query → paste
-- this whole file → Run). Creates all tables, indexes, RLS policies, and the
-- realtime publication so the React app can subscribe to per-row changes.

-- ─── EXTENSIONS ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── TABLES ─────────────────────────────────────────────────────────────────

-- Producers (studio team members). Text PK so we can keep stable IDs across
-- environments and reference them from project.producers / assignments.producer_id.
create table if not exists public.producers (
  id            text primary key,
  name          text not null,
  color         text not null default '#3B8DBC',
  capacity      numeric not null default 0.80,
  hours_week    int     not null default 40,
  position_pct  numeric not null default 1.00,
  team_id       text,
  is_external   boolean not null default false,
  sort_index    int     not null default 0,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Teams (optional grouping for producers in the sidebar)
create table if not exists public.teams (
  id          text primary key,
  name        text not null,
  leader_id   text references public.producers(id) on delete set null,
  sort_index  int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.producers
  add constraint producers_team_fk
  foreign key (team_id) references public.teams(id) on delete set null;

-- Clients (catalogue used for autocomplete dropdowns)
create table if not exists public.clients (
  id     text primary key,
  name   text not null,
  short  text
);

-- Projects — the main board rows. Dates kept as text so we can store either
-- ISO yyyy-mm-dd, ranges (split into _from/_to), or free text like
-- "סוף אוגוסט" without complicating the schema.
create table if not exists public.projects (
  id                  text primary key,
  name                text not null,
  type                text default '',
  status              text not null default 'planning'
                       check (status in ('planning','production','review','done','frozen')),
  client              text default '',
  pm                  text default '',
  start_date          text default '',
  start_range_from    text default '',
  start_range_to      text default '',
  due_date            text default '',
  due_range_from      text default '',
  due_range_to        text default '',
  hours               int  not null default 0,
  producers           text[] not null default '{}',
  notes               text default '',
  complexity          text default '',
  urgency             text not null default 'normal'
                       check (urgency in ('normal','hot')),
  archived            boolean not null default false,
  report_link         text default '',
  folder_link         text default '',
  sort_index          int     not null default 0,
  created_by_email    text,
  updated_by_email    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists projects_status_idx   on public.projects(status);
create index if not exists projects_client_idx   on public.projects(client);
create index if not exists projects_sort_idx     on public.projects(sort_index);
create index if not exists projects_producers_gin on public.projects using gin(producers);

-- History — completed projects. Separate table so big history doesn't slow
-- the active board.
create table if not exists public.history (
  id              text primary key,
  name            text not null,
  type            text default '',
  client          text default '',
  pm              text default '',
  completed_date  text default '',
  hours           int  not null default 0,
  producers       text[] not null default '{}',
  created_at      timestamptz not null default now()
);

-- Assignments — one row per producer × day. Either project_id is set (working
-- on a project) or label is set (vacation, sick, free, etc.).
create table if not exists public.assignments (
  id          text primary key,
  producer_id text not null references public.producers(id) on delete cascade,
  date        text not null,           -- ISO yyyy-mm-dd
  project_id  text references public.projects(id) on delete cascade,
  hours       int  not null default 0,
  label       text,
  updated_by_email text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists assignments_producer_date_idx
  on public.assignments(producer_id, date);
create index if not exists assignments_project_idx
  on public.assignments(project_id);

-- Allowed emails — the gate. Only emails listed here can read/write.
create table if not exists public.allowed_emails (
  email      text primary key,
  added_by   text,
  added_at   timestamptz not null default now()
);

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists producers_touch on public.producers;
create trigger producers_touch before update on public.producers
  for each row execute function public.touch_updated_at();

drop trigger if exists assignments_touch on public.assignments;
create trigger assignments_touch before update on public.assignments
  for each row execute function public.touch_updated_at();

-- ─── ROW-LEVEL SECURITY ─────────────────────────────────────────────────────
-- Only users whose JWT email appears in allowed_emails can read or write.
-- Anonymous users cannot reach anything.

alter table public.producers      enable row level security;
alter table public.teams          enable row level security;
alter table public.clients        enable row level security;
alter table public.projects       enable row level security;
alter table public.history        enable row level security;
alter table public.assignments    enable row level security;
alter table public.allowed_emails enable row level security;

create or replace function public.is_allowed_user() returns boolean as $$
declare
  email_claim text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if email_claim = '' then return false; end if;
  return exists (
    select 1 from public.allowed_emails
    where lower(email) = email_claim
  );
end;
$$ language plpgsql stable security definer;

-- Generic policies: allowed users get full read+write on all the data tables.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'producers','teams','clients','projects','history','assignments'
  ])
  loop
    execute format('drop policy if exists "%s_read"  on public.%I', t, t);
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format(
      'create policy "%s_read" on public.%I for select using (public.is_allowed_user())',
      t, t);
    execute format(
      'create policy "%s_write" on public.%I for all using (public.is_allowed_user()) with check (public.is_allowed_user())',
      t, t);
  end loop;
end $$;

-- Allowed-emails table: only allowed users can read/write the list (treat as
-- an admin-only table — managed in-app by existing users).
drop policy if exists "allowed_emails_read"  on public.allowed_emails;
drop policy if exists "allowed_emails_write" on public.allowed_emails;
create policy "allowed_emails_read" on public.allowed_emails
  for select using (public.is_allowed_user());
create policy "allowed_emails_write" on public.allowed_emails
  for all using (public.is_allowed_user()) with check (public.is_allowed_user());

-- ─── REALTIME PUBLICATION ───────────────────────────────────────────────────
-- Subscribe to insert/update/delete on every table the React app cares about.
-- Supabase creates a default `supabase_realtime` publication; we add tables
-- to it (no-op if already present).

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.producers;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.history;
alter publication supabase_realtime add table public.assignments;
alter publication supabase_realtime add table public.allowed_emails;

-- ─── BOOTSTRAP THE OWNER ────────────────────────────────────────────────────
-- Insert the first allowed user so you can sign in. After signing in, you
-- can add more emails via the app (settings → "ניהול משתמשים") or by editing
-- this table directly in the Supabase dashboard.

insert into public.allowed_emails (email, added_by)
values ('ronr@methodic.co.il', 'bootstrap')
on conflict (email) do nothing;
