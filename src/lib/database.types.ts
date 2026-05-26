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

export interface Database {
  public: {
    Tables: {
      producers:      { Row: ProducerRow;      Insert: Partial<ProducerRow>      & { id: string; name: string }; Update: Partial<ProducerRow> };
      teams:          { Row: TeamRow;          Insert: Partial<TeamRow>          & { id: string; name: string }; Update: Partial<TeamRow> };
      clients:        { Row: ClientRow;        Insert: Partial<ClientRow>        & { id: string; name: string }; Update: Partial<ClientRow> };
      projects:       { Row: ProjectRow;       Insert: Partial<ProjectRow>       & { id: string; name: string }; Update: Partial<ProjectRow> };
      history:        { Row: HistoryRow;       Insert: Partial<HistoryRow>       & { id: string; name: string }; Update: Partial<HistoryRow> };
      assignments:    { Row: AssignmentRow;    Insert: Partial<AssignmentRow>    & { id: string; producer_id: string; date: string }; Update: Partial<AssignmentRow> };
      allowed_emails: { Row: AllowedEmailRow;  Insert: Partial<AllowedEmailRow>  & { email: string }; Update: Partial<AllowedEmailRow> };
    };
    Views: Record<string, never>;
    Functions: {
      is_allowed_user: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
  };
}
