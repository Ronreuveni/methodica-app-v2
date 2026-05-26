// Hand-typed schema mirror. Regenerate with `supabase gen types typescript --linked` once the project is linked.

export type ProjectStatus = 'planning' | 'production' | 'review' | 'done' | 'frozen';
export type Urgency = 'normal' | 'hot';

export interface ProducerRow {
  id: string;
  name: string;
  color: string;
  capacity: number;
  hours_week: number;
  position_pct: number;
  team_id: string | null;
  is_external: boolean;
  sort_index: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamRow {
  id: string;
  name: string;
  leader_id: string | null;
  sort_index: number;
  created_at: string;
}

export interface ClientRow {
  id: string;
  name: string;
  short: string | null;
}

export interface ProjectRow {
  id: string;
  name: string;
  type: string;
  status: ProjectStatus;
  client: string;
  pm: string;
  start_date: string;
  start_range_from: string;
  start_range_to: string;
  due_date: string;
  due_range_from: string;
  due_range_to: string;
  hours: number;
  producers: string[];
  notes: string;
  complexity: string;
  urgency: Urgency;
  archived: boolean;
  report_link: string;
  folder_link: string;
  sort_index: number;
  created_by_email: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoryRow {
  id: string;
  name: string;
  type: string;
  client: string;
  pm: string;
  completed_date: string;
  hours: number;
  producers: string[];
  created_at: string;
}

export interface AssignmentRow {
  id: string;
  producer_id: string;
  date: string;
  project_id: string | null;
  hours: number;
  label: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface AllowedEmailRow {
  email: string;
  added_by: string | null;
  added_at: string;
}

// Supabase's generated Database type requires Relationships and CompositeTypes
// fields on each table — without them the .update()/.upsert() generic resolves
// to `never` and the build fails on every mutation.
type TableShape<Row, InsertExtra extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row> & InsertExtra;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      producers:      TableShape<ProducerRow,     { id: string; name: string }>;
      teams:          TableShape<TeamRow,         { id: string; name: string }>;
      clients:        TableShape<ClientRow,       { id: string; name: string }>;
      projects:       TableShape<ProjectRow,      { id: string; name: string }>;
      history:        TableShape<HistoryRow,      { id: string; name: string }>;
      assignments:    TableShape<AssignmentRow,   { id: string; producer_id: string; date: string }>;
      allowed_emails: TableShape<AllowedEmailRow, { email: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      is_allowed_user: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
