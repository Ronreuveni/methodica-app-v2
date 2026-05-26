// Kickoff-email parser ported from v1. Methodica's Outlook template is a
// 2-column HTML table (label cell + value cell). Parses HTML when available,
// falls back to label-aware plain-text parsing.

import type { Project } from '../../lib/types';

const KICKOFF_LABELS: [string, string][] = [
  ['שם הלקוח', 'client'],
  ['שם הפרויקט', '_projectName'],
  ['שם התוצר', 'name'],
  ['סוג התוצר', 'type'],
  ['סטטוס נוכחי', '_status'],
  ['צורכי כוח אדם', '_manpower'],
  ['דגשים לעיצוב', '_design'],
  ['מסגרת תקציב', '_budget'],
  ['לוחות זמנים', 'due'],
  ['קישור לקבצי עיצוב', '_designLink'],
  ['קישור לתסריט', '_scriptLink'],
  ['שורה לדיווח', 'pm'],
  ['האם התוצר חלק מסדרת', '_series'],
  ['נתיב לשמירת התוצר', '_cloudPath'],
  ['לקוח', 'client'],
  ['client', 'client'],
  ['project name', 'name'],
  ['deadline', 'due'],
  ['due', 'due'],
];

function matchLabel(raw: string): string | null {
  const t = (raw || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return null;
  for (const [needle, key] of KICKOFF_LABELS) {
    if (t.includes(needle.toLowerCase())) return key;
  }
  return null;
}

export function parseLooseDate(raw: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  const thisYear = new Date().getFullYear();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = s.match(/(\d{1,2})[./-](\d{1,2})(?!\d)/);
  if (m) return `${thisYear}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

function extractLink(raw: string): string {
  if (!raw) return '';
  const url = (raw.match(/https?:\/\/\S+/) || [])[0];
  if (url) return url;
  const path = (raw.match(/[A-Za-z]:\\[\\\S]+/) || [])[0];
  return path || '';
}

type Pairs = Record<string, string>;

function pairsFromCells(cells: string[]): Pairs {
  const out: Pairs = {};
  for (let i = 0; i < cells.length; i++) {
    const key = matchLabel(cells[i]);
    if (!key) continue;
    for (let j = i + 1; j < cells.length; j++) {
      const next = (cells[j] || '').trim();
      if (!next) continue;
      if (matchLabel(next)) break;
      out[key] = next;
      i = j;
      break;
    }
  }
  return out;
}

export type ParsedDraft = {
  name: string; client: string; type: string; pm: string; hours: number;
  due: string; notes: string; folderLink: string;
};

function buildDraft(pairs: Pairs): ParsedDraft {
  const out: ParsedDraft = { name: '', client: '', type: 'לומדה', pm: '', hours: 0, due: '', notes: '', folderLink: '' };
  if (pairs.name) out.name = pairs.name;
  if (pairs.client) out.client = pairs.client;
  if (pairs.type) out.type = pairs.type;
  if (pairs.pm) out.pm = pairs.pm;
  if (pairs.due) out.due = parseLooseDate(pairs.due);
  if (pairs._budget) {
    const m = pairs._budget.match(/(\d+)\s*(?:שע|hours)/i) || pairs._budget.match(/(\d+)/);
    if (m) out.hours = parseInt(m[1], 10);
  }
  out.folderLink = extractLink(pairs._scriptLink) || extractLink(pairs._cloudPath) || extractLink(pairs._designLink);
  const noteParts: string[] = [];
  if (pairs._projectName) noteParts.push('פרויקט: ' + pairs._projectName);
  if (pairs._status) noteParts.push('סטטוס: ' + pairs._status);
  if (pairs._design) noteParts.push('דגשים לעיצוב: ' + pairs._design);
  if (pairs._manpower) noteParts.push('כוח אדם: ' + pairs._manpower);
  if (pairs._budget && !out.hours) noteParts.push('תקציב/זמן: ' + pairs._budget);
  if (pairs._series) noteParts.push('סדרה: ' + pairs._series);
  if (pairs._cloudPath) noteParts.push('ענן: ' + pairs._cloudPath);
  out.notes = noteParts.join('\n').slice(0, 1000);
  return out;
}

function parseHtml(html: string): ParsedDraft | null {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const cellNodes = Array.from(doc.querySelectorAll('td, th'));
    const cells = cellNodes.map(c => {
      const txt = (c.textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
      const a = c.querySelector('a[href]');
      return a ? `${txt} ${a.getAttribute('href')}` : txt;
    });
    return buildDraft(pairsFromCells(cells));
  } catch {
    return null;
  }
}

export function parseKickoffEmail(input: string): ParsedDraft {
  const empty: ParsedDraft = { name: '', client: '', type: 'לומדה', pm: '', hours: 0, due: '', notes: '', folderLink: '' };
  if (!input) return empty;
  if (/<\s*(table|tr|td|html|body|div)[\s>]/i.test(input)) {
    const r = parseHtml(input);
    if (r && (r.name || r.client || r.due)) return r;
  }
  const lines = input.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const r2 = buildDraft(pairsFromCells(lines));
  if (r2.name || r2.client || r2.due) return r2;
  // legacy single-line "label: value"
  const pick = (re: RegExp) => {
    for (const ln of input.split(/\r?\n/)) { const m = ln.match(re); if (m && m[1]) return m[1].trim(); }
    return '';
  };
  empty.name = pick(/^(?:נושא|subject)\s*[:\-]\s*(.+)/i) || (lines[0] || '').slice(0, 120);
  empty.client = pick(/^(?:לקוח|client)\s*[:\-]\s*(.+)/i);
  return empty;
}

export function draftToProject(parsed: ParsedDraft): Partial<Project> & { id: string; name: string } {
  return {
    id: 'em-' + Date.now(),
    name: parsed.name || 'פרויקט ממייל',
    client: parsed.client,
    type: parsed.type || 'לומדה',
    pm: parsed.pm,
    hours: parsed.hours || 0,
    due: parsed.due,
    status: 'planning',
    notes: parsed.notes,
    folderLink: parsed.folderLink,
    producers: [],
    urgency: 'normal',
    sortIndex: -1,
  };
}
