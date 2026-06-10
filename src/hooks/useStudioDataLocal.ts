// StudioData implementation backed by the local SQLite REST server.
// Same optimistic-update pattern as the Supabase hook: apply locally first,
// send the row write, roll back on failure. A focus/interval refetch keeps
// multiple open tabs loosely in sync.

import { useCallback, useEffect, useRef, useState } from 'react';
import { localApi, toast } from '../lib/localApi';
import {
  assignmentToInsert, assignmentToUpdate,
  producerToInsert, producerToUpdate,
  producerTaskToUpdate,
  projectToInsert, projectToUpdate,
  rowToAssignment, rowToHistory, rowToProducer, rowToProducerTask, rowToProject, rowToTeam,
  teamToInsert, teamToUpdate,
} from '../lib/mappers';
import type {
  Assignment, HistoryItem, ImportSummary, Producer, ProducerTask, Project, Team,
} from '../lib/types';
import type {
  AssignmentRow, HistoryRow, ProducerRow, ProducerTaskRow, ProjectRow, TeamRow,
} from '../lib/database.types';
import type { StudioData } from './useStudioData';

interface BootstrapPayload {
  producers: ProducerRow[];
  teams: TeamRow[];
  projects: ProjectRow[];
  history: HistoryRow[];
  assignments: AssignmentRow[];
  producer_tasks: ProducerTaskRow[];
}

export function useStudioDataLocal(opts: { enabled: boolean }): StudioData {
  const { enabled } = opts;
  const [producers, setProducers]         = useState<Producer[]>([]);
  const [teams, setTeams]                 = useState<Team[]>([]);
  const [projects, setProjects]           = useState<Project[]>([]);
  const [history, setHistory]             = useState<HistoryItem[]>([]);
  const [assignments, setAssignments]     = useState<Assignment[]>([]);
  const [producerTasks, setProducerTasks] = useState<ProducerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const pendingWrites = useRef(0);
  const ready = !loading && !error;

  const applyBootstrap = useCallback((d: BootstrapPayload) => {
    setProducers(d.producers.map(rowToProducer));
    setTeams(d.teams.map(rowToTeam));
    setProjects(d.projects.map(rowToProject));
    setHistory(d.history.map(rowToHistory));
    setAssignments(d.assignments.map(rowToAssignment));
    setProducerTasks(d.producer_tasks.map(rowToProducerTask));
  }, []);

  const refresh = useCallback(async () => {
    if (pendingWrites.current > 0) return; // don't clobber optimistic state
    const d = await localApi.bootstrap<BootstrapPayload>();
    applyBootstrap(d);
  }, [applyBootstrap]);

  // Initial load
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const d = await localApi.bootstrap<BootstrapPayload>();
        if (cancelled) return;
        applyBootstrap(d);
        setLoading(false);
      } catch (e: unknown) {
        if (cancelled) return;
        setError('אין חיבור לשרת המקומי — ודא ש-npm run server רץ (' + (e as Error).message + ')');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, applyBootstrap]);

  // Keep other tabs / restarts loosely in sync.
  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => { void refresh().catch(() => {}); };
    const iv = setInterval(onFocus, 20_000);
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(iv); window.removeEventListener('focus', onFocus); };
  }, [enabled, refresh]);

  // Optimistic write wrapper — identical contract to the Supabase hook.
  const withOptimistic = <T extends { id: string }>(
    list: T[],
    setList: React.Dispatch<React.SetStateAction<T[]>>,
    next: T[],
    request: () => Promise<unknown>,
  ): Promise<void> => {
    const prev = list;
    setList(next);
    pendingWrites.current++;
    return request()
      .then(() => { toast('נשמר במסד הנתונים ✓'); })
      .catch((e: unknown) => {
        setList(prev);
        toast('השמירה נכשלה: ' + (e as Error).message, 'error');
        throw e;
      })
      .finally(() => { pendingWrites.current--; });
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
    await withOptimistic(producers, setProducers, replaceOrAppend(producers, merged),
      () => localApi.upsert('producers', producerToInsert(merged)));
  }, [producers]);

  const patchProducer = useCallback(async (id: string, patch: Partial<Producer>) => {
    const existing = producers.find(p => p.id === id);
    if (!existing) return;
    await withOptimistic(producers, setProducers,
      producers.map(p => p.id === id ? { ...existing, ...patch } : p),
      () => localApi.update('producers', id, producerToUpdate(patch)));
  }, [producers]);

  const deleteProducer = useCallback(async (id: string) => {
    await withOptimistic(producers, setProducers, producers.filter(p => p.id !== id),
      () => localApi.remove('producers', id));
  }, [producers]);

  // Teams --------------------------------------------------------------
  const upsertTeam = useCallback(async (t: Partial<Team> & { id: string; name: string }) => {
    const merged: Team = { id: t.id, name: t.name, leaderId: t.leaderId ?? null, sortIndex: t.sortIndex ?? teams.length };
    await withOptimistic(teams, setTeams, replaceOrAppend(teams, merged),
      () => localApi.upsert('teams', teamToInsert(merged)));
  }, [teams]);
  const patchTeam = useCallback(async (id: string, patch: Partial<Team>) => {
    const existing = teams.find(t => t.id === id);
    if (!existing) return;
    await withOptimistic(teams, setTeams,
      teams.map(t => t.id === id ? { ...existing, ...patch } : t),
      () => localApi.update('teams', id, teamToUpdate(patch)));
  }, [teams]);
  const deleteTeam = useCallback(async (id: string) => {
    await withOptimistic(teams, setTeams, teams.filter(t => t.id !== id),
      () => localApi.remove('teams', id));
  }, [teams]);

  // Projects -----------------------------------------------------------
  const upsertProject = useCallback(async (p: Partial<Project> & { id: string; name: string }) => {
    const merged: Project = {
      id: p.id, name: p.name,
      type: p.type ?? '', status: p.status ?? 'planning',
      client: p.client ?? '', pm: p.pm ?? '',
      start: p.start ?? '', due: p.due ?? '',
      hours: p.hours ?? 0, producers: p.producers ?? [],
      notes: p.notes ?? '', complexity: p.complexity ?? '',
      urgency: p.urgency ?? 'normal', archived: !!p.archived,
      reportLink: p.reportLink ?? '', folderLink: p.folderLink ?? '',
      sortIndex: p.sortIndex ?? projects.length,
    };
    await withOptimistic(projects, setProjects, replaceOrAppend(projects, merged),
      () => localApi.upsert('projects', projectToInsert(merged)));
  }, [projects]);
  const patchProject = useCallback(async (id: string, patch: Partial<Project>) => {
    const existing = projects.find(p => p.id === id);
    if (!existing) return;
    await withOptimistic(projects, setProjects,
      projects.map(p => p.id === id ? { ...existing, ...patch } : p),
      () => localApi.update('projects', id, projectToUpdate(patch)));
  }, [projects]);
  const deleteProject = useCallback(async (id: string) => {
    await withOptimistic(projects, setProjects, projects.filter(p => p.id !== id),
      () => localApi.remove('projects', id));
  }, [projects]);

  // Assignments --------------------------------------------------------
  const upsertAssignment = useCallback(async (a: Partial<Assignment> & { id: string; producerId: string; date: string }) => {
    const merged: Assignment = {
      id: a.id, producerId: a.producerId, date: a.date,
      projectId: a.projectId ?? null, hours: a.hours ?? 0, label: a.label ?? null,
    };
    await withOptimistic(assignments, setAssignments, replaceOrAppend(assignments, merged),
      () => localApi.upsert('assignments', assignmentToInsert(merged)));
  }, [assignments]);
  const patchAssignment = useCallback(async (id: string, patch: Partial<Assignment>) => {
    const existing = assignments.find(a => a.id === id);
    if (!existing) return;
    await withOptimistic(assignments, setAssignments,
      assignments.map(a => a.id === id ? { ...existing, ...patch } : a),
      () => localApi.update('assignments', id, assignmentToUpdate(patch)));
  }, [assignments]);
  const deleteAssignment = useCallback(async (id: string) => {
    await withOptimistic(assignments, setAssignments, assignments.filter(a => a.id !== id),
      () => localApi.remove('assignments', id));
  }, [assignments]);

  // Producer tasks -----------------------------------------------------
  const patchProducerTask = useCallback(async (id: string, patch: Partial<ProducerTask>) => {
    const existing = producerTasks.find(t => t.id === id);
    if (!existing) return;
    await withOptimistic(producerTasks, setProducerTasks,
      producerTasks.map(t => t.id === id ? { ...existing, ...patch } : t),
      () => localApi.update('producer_tasks', id, producerTaskToUpdate(patch)));
  }, [producerTasks]);
  const deleteProducerTask = useCallback(async (id: string) => {
    await withOptimistic(producerTasks, setProducerTasks, producerTasks.filter(t => t.id !== id),
      () => localApi.remove('producer_tasks', id));
  }, [producerTasks]);

  // Excel import -------------------------------------------------------
  const importExcel = useCallback(async (file: File, mode: 'replace' | 'merge'): Promise<ImportSummary> => {
    const summary = await localApi.importExcel(file, mode);
    const d = await localApi.bootstrap<BootstrapPayload>();
    applyBootstrap(d);
    return summary;
  }, [applyBootstrap]);

  return {
    ready, loading, error,
    producers, teams, projects, history, assignments, producerTasks,
    upsertProducer, patchProducer, deleteProducer,
    upsertTeam, patchTeam, deleteTeam,
    upsertProject, patchProject, deleteProject,
    upsertAssignment, patchAssignment, deleteAssignment,
    patchProducerTask, deleteProducerTask,
    importExcel, refresh,
  };
}

function replaceOrAppend<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex(x => x.id === item.id);
  if (idx < 0) return [...list, item];
  const copy = list.slice();
  copy[idx] = item;
  return copy;
}
