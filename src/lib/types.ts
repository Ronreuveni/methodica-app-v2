// Domain-facing types used by the UI. Distinct from database row types
// because we collapse the date_range_from/to columns back into a single
// {from, to} object that the editors and label components expect.

import type { ProjectStatus, Urgency } from './database.types';

export type { ProjectStatus, Urgency };

export interface Producer {
  id: string;
  name: string;
  color: string;
  capacity: number;
  hoursWeek: number;
  positionPct: number;
  teamId: string | null;
  isExternal: boolean;
  sortIndex: number;
  note: string | null;
}

export interface Team {
  id: string;
  name: string;
  leaderId: string | null;
  sortIndex: number;
}

export type DateField = string | { from: string; to: string };

export interface Project {
  id: string;
  name: string;
  type: string;
  status: ProjectStatus;
  client: string;
  pm: string;
  start: DateField;
  due: DateField;
  hours: number;
  producers: string[];
  notes: string;
  complexity: string;
  urgency: Urgency;
  archived: boolean;
  reportLink: string;
  folderLink: string;
  sortIndex: number;
}

export interface HistoryItem {
  id: string;
  name: string;
  type: string;
  client: string;
  pm: string;
  completedDate: string;
  hours: number;
  producers: string[];
}

export interface Assignment {
  id: string;
  producerId: string;
  date: string;          // ISO yyyy-mm-dd in local time
  projectId: string | null;
  hours: number;
  label: string | null;
}

export const STATUSES: Record<ProjectStatus, { label: string; color: string; bg: string; ring: string }> = {
  planning:   { label: 'בתכנון',  color: '#9CA3AF', bg: '#F3F4F6', ring: '#D1D5DB' },
  production: { label: 'בהפקה',   color: '#EC8223', bg: '#FEF1E4', ring: '#F5B878' },
  review:     { label: 'בתיקוף',  color: '#3B8DBC', bg: '#E4F0F7', ring: '#8DB9D5' },
  done:       { label: 'הושלם',   color: '#7DA842', bg: '#EDF3E0', ring: '#B1C884' },
  frozen:     { label: 'מוקפא',   color: '#6B7280', bg: '#E5E7EB', ring: '#9CA3AF' },
};

export const PROJECT_TYPES = [
  'סטוריליין', 'קמפוס', 'ג׳ניאלי', 'אנימציה', 'וידאו', 'H5P', 'לומדה', 'קוויז',
  'קוד', 'הזנה', 'קמטזיה', 'סרטון', 'סרטונים', 'סרטון AI', 'AI / ויונד',
  'אינפוגרפיקה וסרטון', 'ויונד', 'רייז', 'סלייס', 'הדרה', 'PPT', 'HTML',
];
