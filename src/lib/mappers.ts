// Convert between database rows (snake_case, split date columns) and the
// domain types the UI works with ({ from, to } objects, camelCase).

import type {
  ProducerRow, TeamRow, ProjectRow, HistoryRow, AssignmentRow,
} from './database.types';
import type {
  Producer, Team, Project, HistoryItem, Assignment, DateField,
} from './types';

// Update payloads — each is a partial of the row, used as the argument to
// supabase.from(table).update(...). Declared as separate types so TypeScript
// matches them against the Database['public']['Tables'][T]['Update'] shape.
type ProducerUpdate   = Partial<ProducerRow>;
type TeamUpdate       = Partial<TeamRow>;
type ProjectUpdate    = Partial<ProjectRow>;
type AssignmentUpdate = Partial<AssignmentRow>;

// ── Date helpers ────────────────────────────────────────────────────────
function rowToDateField(single: string, from: string, to: string): DateField {
  if (from || to) return { from: from || '', to: to || '' };
  return single || '';
}
function dateFieldToColumns(v: DateField): { single: string; from: string; to: string } {
  if (!v) return { single: '', from: '', to: '' };
  if (typeof v === 'object') return { single: '', from: v.from || '', to: v.to || '' };
  return { single: v, from: '', to: '' };
}

// ── Producers ──────────────────────────────────────────────────────────
export function rowToProducer(r: ProducerRow): Producer {
  return {
    id: r.id, name: r.name, color: r.color,
    capacity: Number(r.capacity ?? 0.8),
    hoursWeek: r.hours_week ?? 40,
    positionPct: Number(r.position_pct ?? 1),
    teamId: r.team_id,
    isExternal: !!r.is_external,
    sortIndex: r.sort_index ?? 0,
    note: r.note,
  };
}
export function producerToInsert(p: Partial<Producer> & { id: string; name: string }) {
  return {
    id: p.id, name: p.name,
    color: p.color ?? '#3B8DBC',
    capacity: p.capacity ?? 0.8,
    hours_week: p.hoursWeek ?? 40,
    position_pct: p.positionPct ?? 1,
    team_id: p.teamId ?? null,
    is_external: !!p.isExternal,
    sort_index: p.sortIndex ?? 0,
    note: p.note ?? null,
  };
}
export function producerToUpdate(p: Partial<Producer>): ProducerUpdate {
  const u: ProducerUpdate = {};
  if (p.name !== undefined)        u.name = p.name;
  if (p.color !== undefined)       u.color = p.color;
  if (p.capacity !== undefined)    u.capacity = p.capacity;
  if (p.hoursWeek !== undefined)   u.hours_week = p.hoursWeek;
  if (p.positionPct !== undefined) u.position_pct = p.positionPct;
  if (p.teamId !== undefined)      u.team_id = p.teamId;
  if (p.isExternal !== undefined)  u.is_external = p.isExternal;
  if (p.sortIndex !== undefined)   u.sort_index = p.sortIndex;
  if (p.note !== undefined)        u.note = p.note;
  return u;
}

// ── Teams ──────────────────────────────────────────────────────────────
export function rowToTeam(r: TeamRow): Team {
  return { id: r.id, name: r.name, leaderId: r.leader_id, sortIndex: r.sort_index ?? 0 };
}
export function teamToInsert(t: Partial<Team> & { id: string; name: string }) {
  return { id: t.id, name: t.name, leader_id: t.leaderId ?? null, sort_index: t.sortIndex ?? 0 };
}
export function teamToUpdate(t: Partial<Team>): TeamUpdate {
  const u: TeamUpdate = {};
  if (t.name !== undefined)      u.name = t.name;
  if (t.leaderId !== undefined)  u.leader_id = t.leaderId;
  if (t.sortIndex !== undefined) u.sort_index = t.sortIndex;
  return u;
}

// ── Projects ───────────────────────────────────────────────────────────
export function rowToProject(r: ProjectRow): Project {
  return {
    id: r.id, name: r.name, type: r.type || '',
    status: r.status, client: r.client || '', pm: r.pm || '',
    start: rowToDateField(r.start_date, r.start_range_from, r.start_range_to),
    due:   rowToDateField(r.due_date,   r.due_range_from,   r.due_range_to),
    hours: r.hours ?? 0, producers: r.producers ?? [],
    notes: r.notes || '', complexity: r.complexity || '',
    urgency: r.urgency, archived: !!r.archived,
    reportLink: r.report_link || '', folderLink: r.folder_link || '',
    sortIndex: r.sort_index ?? 0,
  };
}
export function projectToInsert(p: Partial<Project> & { id: string; name: string }) {
  const s = dateFieldToColumns(p.start ?? '');
  const d = dateFieldToColumns(p.due ?? '');
  return {
    id: p.id, name: p.name,
    type: p.type ?? '', status: p.status ?? 'planning',
    client: p.client ?? '', pm: p.pm ?? '',
    start_date: s.single, start_range_from: s.from, start_range_to: s.to,
    due_date:   d.single, due_range_from:   d.from, due_range_to:   d.to,
    hours: p.hours ?? 0, producers: p.producers ?? [],
    notes: p.notes ?? '', complexity: p.complexity ?? '',
    urgency: p.urgency ?? 'normal', archived: !!p.archived,
    report_link: p.reportLink ?? '', folder_link: p.folderLink ?? '',
    sort_index: p.sortIndex ?? 0,
  };
}
export function projectToUpdate(p: Partial<Project>): ProjectUpdate {
  const u: ProjectUpdate = {};
  if (p.name !== undefined)       u.name = p.name;
  if (p.type !== undefined)       u.type = p.type;
  if (p.status !== undefined)     u.status = p.status;
  if (p.client !== undefined)     u.client = p.client;
  if (p.pm !== undefined)         u.pm = p.pm;
  if (p.hours !== undefined)      u.hours = p.hours;
  if (p.producers !== undefined)  u.producers = p.producers;
  if (p.notes !== undefined)      u.notes = p.notes;
  if (p.complexity !== undefined) u.complexity = p.complexity;
  if (p.urgency !== undefined)    u.urgency = p.urgency;
  if (p.archived !== undefined)   u.archived = p.archived;
  if (p.reportLink !== undefined) u.report_link = p.reportLink;
  if (p.folderLink !== undefined) u.folder_link = p.folderLink;
  if (p.sortIndex !== undefined)  u.sort_index = p.sortIndex;
  if (p.start !== undefined) {
    const s = dateFieldToColumns(p.start);
    u.start_date = s.single; u.start_range_from = s.from; u.start_range_to = s.to;
  }
  if (p.due !== undefined) {
    const d = dateFieldToColumns(p.due);
    u.due_date = d.single; u.due_range_from = d.from; u.due_range_to = d.to;
  }
  return u;
}

// ── History ────────────────────────────────────────────────────────────
export function rowToHistory(r: HistoryRow): HistoryItem {
  return {
    id: r.id, name: r.name, type: r.type || '',
    client: r.client || '', pm: r.pm || '',
    completedDate: r.completed_date || '',
    hours: r.hours ?? 0, producers: r.producers ?? [],
  };
}

// ── Assignments ────────────────────────────────────────────────────────
export function rowToAssignment(r: AssignmentRow): Assignment {
  return {
    id: r.id, producerId: r.producer_id, date: r.date,
    projectId: r.project_id, hours: r.hours ?? 0, label: r.label,
  };
}
export function assignmentToInsert(a: Partial<Assignment> & { id: string; producerId: string; date: string }) {
  return {
    id: a.id, producer_id: a.producerId, date: a.date,
    project_id: a.projectId ?? null,
    hours: a.hours ?? 0,
    label: a.label ?? null,
  };
}
export function assignmentToUpdate(a: Partial<Assignment>): AssignmentUpdate {
  const u: AssignmentUpdate = {};
  if (a.producerId !== undefined) u.producer_id = a.producerId;
  if (a.date !== undefined)       u.date = a.date;
  if (a.projectId !== undefined)  u.project_id = a.projectId;
  if (a.hours !== undefined)      u.hours = a.hours;
  if (a.label !== undefined)      u.label = a.label;
  return u;
}
