// Central data hook for the whole studio app. Loads producers/teams/projects/
// history/assignments from Supabase, subscribes to per-row changes via
// realtime, and exposes typed mutation helpers that write only the changed
// row (no full-document overwrite → no echo loop). Optimistic updates apply
// immediately so the UI feels instant.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';
import {
  assignmentToInsert, assignmentToUpdate,
  producerToInsert, producerToUpdate,
  projectToInsert, projectToUpdate,
  rowToAssignment, rowToHistory, rowToProducer, rowToProject, rowToTeam,
  teamToInsert, teamToUpdate,
} from '../lib/mappers';
import type {
  Assignment, HistoryItem, Producer, Project, Team,
} from '../lib/types';
import type {
  AssignmentRow, ProducerRow, ProjectRow, HistoryRow, TeamRow,
} from '../lib/database.types';

export interface StudioData {
  ready: boolean;
  loading: boolean;
  error: string | null;
  producers: Producer[];
  teams: Team[];
  projects: Project[];
  history: HistoryItem[];
  assignments: Assignment[];

  // Mutations — every helper writes one row, returns when the request lands.
  upsertProducer: (p: Partial<Producer> & { id: string; name: string }) => Promise<void>;
  patchProducer:  (id: string, patch: Partial<Producer>) => Promise<void>;
  deleteProducer: (id: string) => Promise<void>;

  upsertTeam: (t: Partial<Team> & { id: string; name: string }) => Promise<void>;
  patchTeam:  (id: string, patch: Partial<Team>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;

  upsertProject: (p: Partial<Project> & { id: string; name: string }) => Promise<void>;
  patchProject:  (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  upsertAssignment: (a: Partial<Assignment> & { id: string; producerId: string; date: string }) => Promise<void>;
  patchAssignment:  (id: string, patch: Partial<Assignment>) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;
}

type RowFor<T extends string> =
  T extends 'producers' ? ProducerRow :
  T extends 'teams' ? TeamRow :
  T extends 'projects' ? ProjectRow :
  T extends 'history' ? HistoryRow :
  T extends 'assignments' ? AssignmentRow :
  never;

export function useStudioData(opts: { enabled: boolean }): StudioData {
  const { enabled } = opts;
  const [producers, setProducers]     = useState<Producer[]>([]);
  const [teams, setTeams]             = useState<Team[]>([]);
  const [projects, setProjects]       = useState<Project[]>([]);
  const [history, setHistory]         = useState<HistoryItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const ready = !loading && !error;

  // Initial load
  useEffect(() => {
    if (!enabled || !supabaseConfigured) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [prodRes, teamRes, projRes, histRes, assignRes] = await Promise.all([
          supabase.from('producers').select('*').order('sort_index'),
          supabase.from('teams').select('*').order('sort_index'),
          supabase.from('projects').select('*').order('sort_index'),
          supabase.from('history').select('*').order('completed_date', { ascending: false }),
          supabase.from('assignments').select('*'),
        ]);
        const firstErr = prodRes.error || teamRes.error || projRes.error
                        || histRes.error || assignRes.error;
        if (firstErr) throw firstErr;
        if (cancelled) return;
        setProducers((prodRes.data ?? []).map(rowToProducer));
        setTeams((teamRes.data ?? []).map(rowToTeam));
        setProjects((projRes.data ?? []).map(rowToProject));
        setHistory((histRes.data ?? []).map(rowToHistory));
        setAssignments((assignRes.data ?? []).map(rowToAssignment));
        setLoading(false);
      } catch (e: unknown) {
        if (cancelled) return;
        setError((e as Error).message);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // Realtime — one channel that listens to changes on every table we care
  // about, then merges each event into the appropriate React state.
  useEffect(() => {
    if (!enabled || !supabaseConfigured) return;
    const channel = supabase
      .channel('studio-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producers' },
          (payload) => applyRealtime('producers', payload, setProducers, rowToProducer))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' },
          (payload) => applyRealtime('teams', payload, setTeams, rowToTeam))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' },
          (payload) => applyRealtime('projects', payload, setProjects, rowToProject))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'history' },
          (payload) => applyRealtime('history', payload, setHistory, rowToHistory))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' },
          (payload) => applyRealtime('assignments', payload, setAssignments, rowToAssignment))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled]);

  // ─── Mutation helpers ─────────────────────────────────────────────────
  // Each helper does an optimistic local update first, then writes the row.
  // On error, we restore the previous state and surface the error.

  // Supabase queries return a PostgrestFilterBuilder, which is thenable
  // (you can call .then()) but TypeScript doesn't treat it as a real Promise.
  // PromiseLike + Promise.resolve() bridges that and keeps the helper generic.
  const withOptimistic = <T extends { id: string }>(
    list: T[],
    setList: React.Dispatch<React.SetStateAction<T[]>>,
    next: T[],
    request: () => PromiseLike<{ error: unknown }>,
  ): Promise<void> => {
    const prev = list;
    setList(next);
    return Promise.resolve(request()).then(({ error }) => {
      if (error) {
        setList(prev);
        throw error instanceof Error ? error : new Error(String(error));
      }
    });
  };

  // Producers ----------------------------------------------------------
  const upsertProducer = useCallback(async (p: Partial<Producer> & { id: string; name: string }) => {
    const merged: Producer = {
      id: p.id, name: p.name,
      color: p.color ?? '#3B8DBC',
      capacity: p.capacity ?? 0.8,
      hoursWeek: p.hoursWeek ?? 40,
      positionPct: p.positionPct ?? 1,
      teamId: p.teamId ?? null,
      isExternal: !!p.isExternal,
      sortIndex: p.sortIndex ?? producers.length,
      note: p.note ?? null,
    };
    await withOptimistic(producers, setProducers,
      replaceOrAppend(producers, merged),
      () => supabase.from('producers').upsert(producerToInsert(merged)));
  }, [producers]);

  const patchProducer = useCallback(async (id: string, patch: Partial<Producer>) => {
    const existing = producers.find(p => p.id === id);
    if (!existing) return;
    const next = { ...existing, ...patch };
    await withOptimistic(producers, setProducers,
      producers.map(p => p.id === id ? next : p),
      () => supabase.from('producers').update(producerToUpdate(patch)).eq('id', id));
  }, [producers]);

  const deleteProducer = useCallback(async (id: string) => {
    await withOptimistic(producers, setProducers,
      producers.filter(p => p.id !== id),
      () => supabase.from('producers').delete().eq('id', id));
  }, [producers]);

  // Teams --------------------------------------------------------------
  const upsertTeam = useCallback(async (t: Partial<Team> & { id: string; name: string }) => {
    const merged: Team = {
      id: t.id, name: t.name,
      leaderId: t.leaderId ?? null,
      sortIndex: t.sortIndex ?? teams.length,
    };
    await withOptimistic(teams, setTeams, replaceOrAppend(teams, merged),
      () => supabase.from('teams').upsert(teamToInsert(merged)));
  }, [teams]);
  const patchTeam = useCallback(async (id: string, patch: Partial<Team>) => {
    const existing = teams.find(t => t.id === id);
    if (!existing) return;
    const next = { ...existing, ...patch };
    await withOptimistic(teams, setTeams,
      teams.map(t => t.id === id ? next : t),
      () => supabase.from('teams').update(teamToUpdate(patch)).eq('id', id));
  }, [teams]);
  const deleteTeam = useCallback(async (id: string) => {
    await withOptimistic(teams, setTeams,
      teams.filter(t => t.id !== id),
      () => supabase.from('teams').delete().eq('id', id));
  }, [teams]);

  // Projects -----------------------------------------------------------
  const upsertProject = useCallback(async (p: Partial<Project> & { id: string; name: string }) => {
    const merged: Project = {
      id: p.id, name: p.name,
      type: p.type ?? '',
      status: p.status ?? 'planning',
      client: p.client ?? '',
      pm: p.pm ?? '',
      start: p.start ?? '',
      due: p.due ?? '',
      hours: p.hours ?? 0,
      producers: p.producers ?? [],
      notes: p.notes ?? '',
      complexity: p.complexity ?? '',
      urgency: p.urgency ?? 'normal',
      archived: !!p.archived,
      reportLink: p.reportLink ?? '',
      folderLink: p.folderLink ?? '',
      sortIndex: p.sortIndex ?? projects.length,
    };
    await withOptimistic(projects, setProjects,
      replaceOrAppend(projects, merged),
      () => supabase.from('projects').upsert(projectToInsert(merged)));
  }, [projects]);
  const patchProject = useCallback(async (id: string, patch: Partial<Project>) => {
    const existing = projects.find(p => p.id === id);
    if (!existing) return;
    const next = { ...existing, ...patch };
    await withOptimistic(projects, setProjects,
      projects.map(p => p.id === id ? next : p),
      () => supabase.from('projects').update(projectToUpdate(patch)).eq('id', id));
  }, [projects]);
  const deleteProject = useCallback(async (id: string) => {
    await withOptimistic(projects, setProjects,
      projects.filter(p => p.id !== id),
      () => supabase.from('projects').delete().eq('id', id));
  }, [projects]);

  // Assignments --------------------------------------------------------
  const upsertAssignment = useCallback(async (a: Partial<Assignment> & { id: string; producerId: string; date: string }) => {
    const merged: Assignment = {
      id: a.id, producerId: a.producerId, date: a.date,
      projectId: a.projectId ?? null,
      hours: a.hours ?? 0,
      label: a.label ?? null,
    };
    await withOptimistic(assignments, setAssignments,
      replaceOrAppend(assignments, merged),
      () => supabase.from('assignments').upsert(assignmentToInsert(merged)));
  }, [assignments]);
  const patchAssignment = useCallback(async (id: string, patch: Partial<Assignment>) => {
    const existing = assignments.find(a => a.id === id);
    if (!existing) return;
    const next = { ...existing, ...patch };
    await withOptimistic(assignments, setAssignments,
      assignments.map(a => a.id === id ? next : a),
      () => supabase.from('assignments').update(assignmentToUpdate(patch)).eq('id', id));
  }, [assignments]);
  const deleteAssignment = useCallback(async (id: string) => {
    await withOptimistic(assignments, setAssignments,
      assignments.filter(a => a.id !== id),
      () => supabase.from('assignments').delete().eq('id', id));
  }, [assignments]);

  return {
    ready, loading, error,
    producers, teams, projects, history, assignments,
    upsertProducer, patchProducer, deleteProducer,
    upsertTeam, patchTeam, deleteTeam,
    upsertProject, patchProject, deleteProject,
    upsertAssignment, patchAssignment, deleteAssignment,
  };
}

// ──────────────────────────────────────────────────────────────────────
function replaceOrAppend<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex(x => x.id === item.id);
  if (idx < 0) return [...list, item];
  const copy = list.slice();
  copy[idx] = item;
  return copy;
}

// Realtime payload as Supabase delivers it. `new` and `old` are empty
// objects (not null) for irrelevant directions of the event (eg `new` on a
// DELETE), so we check `id` rather than null.
type RtPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

// Merges a single realtime payload into a list. Inserts append, updates
// replace, deletes remove. Idempotent — if the payload is an echo of an
// optimistic update we already applied, nothing visible changes.
function applyRealtime<T extends { id: string }>(
  _label: string,
  payload: RtPayload,
  setList: React.Dispatch<React.SetStateAction<T[]>>,
  // The Row type lives in database.types — we accept anything that's
  // converted to a domain object T by `fromRow`.
  fromRow: (r: never) => T,
) {
  if (payload.eventType === 'DELETE') {
    const oldId = (payload.old as { id?: string }).id;
    if (!oldId) return;
    setList(list => list.filter(x => x.id !== oldId));
    return;
  }
  const row = payload.new as { id?: string };
  if (!row || !row.id) return;
  const next = fromRow(row as never);
  setList(list => {
    const idx = list.findIndex(x => x.id === next.id);
    if (idx < 0) return [...list, next];
    // Idempotent: if the existing row is byte-equal to the incoming one, keep
    // the same reference so React skips a re-render.
    const cur = list[idx] as unknown;
    if (JSON.stringify(cur) === JSON.stringify(next)) return list;
    const copy = list.slice();
    copy[idx] = next;
    return copy;
  });
}
