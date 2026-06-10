// Parses the studio's "הפקות דיגיטל.xlsx" workbook into the local DB.
//
// Sheet routing (by sheet name):
//   הפקות תוצרי-דיגיטל            → projects
//   הפקות וידאו                    → projects (type וידאו)
//   הפקות תוצרי-דיגיטל - ישן       → history
//   לוז מפיקי דיגיטל / לוז - ארכיון → assignments (month → week-date rows → producer rows)
//   לו"ז הפקות <שם> / לו"ז <שם>     → producer_tasks
//   הפקות נכנסות                   → skipped (empty template)

import * as XLSX from 'xlsx';
import { db, upsertRow, clearAll, counts } from './db.mjs';

const HEBREW_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const ENGLISH_MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const PALETTE = ['#EC8223','#3B8DBC','#7DA842','#9B59B6','#D65046','#16A085','#E67E22','#2C6E91','#A04000','#5D6D7E','#C0392B','#7F8C8D','#B7950B','#2E86C1','#884EA0','#117864'];

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const hasHebrew = (s) => /[֐-׿]/.test(s);

// Producer-name cleanup: drop trailing percent annotations ("שרון 50-60%"),
// question marks, parentheticals, stray punctuation, and unify the many
// apostrophe/geresh variants (ג'אד / ג׳אד).
function cleanProducerName(raw) {
  let s = norm(raw);
  s = s.replace(/\d+\s*[-–]?\s*\d*\s*%/g, '');
  s = s.replace(/\(.*?\)/g, '');
  s = s.replace(/[׳`]/g, "'");
  s = s.replace(/\s*[-–]\s*/g, ' ');
  s = s.replace(/[?؟\\"]+/g, '');
  return norm(s);
}

const JUNK_NAMES = new Set(['כולם', 'פוסט', 'פרהפרודקשן', 'וכו']);
function isValidName(name) {
  return !!name && hasHebrew(name) && name.length >= 2 && name.length <= 30
    && !JUNK_NAMES.has(name) && /^[֐-׿]/.test(name);
}

// Word-boundary test for Hebrew names (so "רון" never matches inside "אורן"/"שרון").
function containsName(text, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\u0590-\\u05FF])${esc}($|[^\\u0590-\\u05FF])`).test(text);
}

// Month-block headers are real Excel dates formatted "mmmm yyyy" — SheetJS
// renders them with English month names ("January 2023"); hand-typed ones
// are Hebrew ("ינואר 2023"). Accept both.
function parseMonthHeader(s) {
  const t = norm(s);
  const m = t.match(/^([A-Za-z֐-׿"׳״]+)\s+(\d{4})$/);
  if (!m) return null;
  let idx = HEBREW_MONTHS.indexOf(m[1]);
  if (idx < 0) idx = ENGLISH_MONTHS.indexOf(m[1].toLowerCase());
  if (idx < 0) return null;
  return { month: idx + 1, year: parseInt(m[2], 10), label: `${HEBREW_MONTHS[idx]} ${m[2]}` };
}

const DATE_TOKEN = /^(\d{1,2})[./](\d{1,2})$/;

// "23.2.26" / "23.2.2026" → ISO; otherwise return the original free text.
function toIsoOrText(raw) {
  const t = norm(raw);
  if (!t || t === '-') return '';
  const m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const mo = parseInt(m[2], 10), d = parseInt(m[1], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
  }
  return t;
}

function mapStatus(raw) {
  const t = norm(raw);
  if (/הושלם|הסתיים|בוצע/.test(t)) return 'done';
  if (/בתיקוף|תיקוף/.test(t)) return 'review';
  if (/בהפקה|בשוטף|בעבודה/.test(t)) return 'production';
  if (/מוקפא|הוקפא|קפוא|בוטל/.test(t)) return 'frozen';
  return 'planning';
}

function sheetRows(wb, name) {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
}

// Find the column index for a header by substring(s), in a normalized header row.
function colOf(headers, ...needles) {
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (h && needles.some(n => h.includes(n))) return i;
  }
  return -1;
}

export function importWorkbook(buffer, { mode = 'replace' } = {}) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const warnings = [];

  // ── Pass 1: producer roster ─────────────────────────────────────────────
  // Core producers come from the per-producer sheet titles; everyone else
  // found in matrix rows or מפיק.ה cells is created on demand as external.
  const producers = new Map(); // canonical name → {id, name, isExternal, sortIndex}
  let producerSeq = 0;

  const canonical = (rawName) => {
    const name = cleanProducerName(rawName);
    if (!isValidName(name)) return null;
    for (const key of producers.keys()) {
      if (key === name) return key;
      // prefix-merge: "חן בן ברית" ↔ "חן בן ברית שפירא"
      if ((key.startsWith(name + ' ') || name.startsWith(key + ' ')) && name.split(' ')[0] === key.split(' ')[0]) {
        return key.length >= name.length ? key : (renameProducer(key, name), name);
      }
    }
    return null;
  };
  const renameProducer = (oldName, newName) => {
    const p = producers.get(oldName);
    producers.delete(oldName);
    p.name = newName;
    producers.set(newName, p);
  };
  const ensureProducer = (rawName, { external = true } = {}) => {
    const name = cleanProducerName(rawName);
    if (!isValidName(name)) return null;
    const existing = canonical(name);
    if (existing) {
      const p = producers.get(existing);
      if (!external) p.isExternal = false;
      return p;
    }
    const p = { id: 'p-' + (++producerSeq), name, isExternal: external, sortIndex: 0 };
    producers.set(name, p);
    return p;
  };

  const producerSheetRe = /לו["״׳']?ז/;
  const producerSheets = [];
  const matrixSheets = [];
  let mainSheet = null, videoSheet = null, oldSheet = null;

  for (const name of wb.SheetNames) {
    const t = norm(name);
    if (t.includes('ישן')) { oldSheet = name; continue; }
    if (t.includes('נכנסות')) continue;
    if (t.includes('תוצרי')) { mainSheet = name; continue; }
    if (t.includes('הפקות וידאו')) { videoSheet = name; continue; }
    if (t.includes('מפיקי') || t.includes('ארכיון')) { matrixSheets.push(name); continue; }
    if (producerSheetRe.test(t)) { producerSheets.push(name); continue; }
    warnings.push(`גיליון לא מזוהה — דולג: ${t}`);
  }

  // Core producers from sheet titles, in sheet order.
  for (const s of producerSheets) {
    const pName = norm(s).replace(producerSheetRe, '').replace(/הפקות/, '').trim();
    const p = ensureProducer(pName, { external: false });
    if (!p) warnings.push(`לא הצלחתי לחלץ שם מפיק.ה מגיליון: ${s}`);
  }

  // Split a מפיק.ה cell into producer entities.
  const parseProducerCell = (raw) => {
    const origText = norm(raw);
    if (!origText) return [];
    let text = origText;
    const found = [];
    const known = [...producers.keys()].sort((a, b) => b.length - a.length);
    for (const name of known) {
      if (containsName(text, name)) {
        found.push(producers.get(name));
        text = text.replace(name, ' ');
      }
    }
    for (let tok of text.split(/[,+/&\n|]| וגם /)) {
      tok = cleanProducerName(tok);
      if (!tok) continue;
      // Already a known name as-is?
      const full = canonical(tok);
      if (full) { found.push(producers.get(full)); continue; }
      // "ויעל" → "יעל": strip the conjunctive ו when the stripped form is a
      // known name (covers ודים too — it IS known, caught above).
      if (tok.startsWith('ו') && tok.length > 2) {
        const c = canonical(tok.slice(1));
        if (c) { found.push(producers.get(c)); continue; }
      }
      // Leftover that extends a name matched earlier in this cell
      // ("אורי בלאט" → matched אורי, leftover בלאט) — merge, don't create.
      // Never merge across a conjunctive ו ("מרח ויעל" is two people).
      if (!tok.startsWith('ו')) {
        const ext2 = found.find(f => containsName(origText, f.name.split(' ')[0] + ' ' + tok));
        if (ext2) { ensureProducer(ext2.name.split(' ')[0] + ' ' + tok); continue; }
      }
      if (tok.startsWith('ו') && tok.length > 2 && tok[1] !== 'ו' && isValidName(tok.slice(1))) tok = tok.slice(1);
      if (!isValidName(tok)) continue;
      const p = ensureProducer(tok);
      if (p) found.push(p);
    }
    return [...new Set(found)];
  };

  // ── Parse main productions sheet → projects ────────────────────────────
  const projects = [];
  let projSeq = 0;
  const parseProductions = (sheetName, { defaultType = '' } = {}) => {
    const rows = sheetRows(wb, sheetName);
    if (!rows.length) return 0;
    const headers = rows[0].map(norm);
    const c = {
      name: colOf(headers, 'פרויקט / משימות', 'שם הפרויקט'),
      type: colOf(headers, 'סוג הפקה'),
      status: colOf(headers, 'סטטוס'),
      client: colOf(headers, 'לקוח'),
      start: colOf(headers, 'תחילת הפקה'),
      reviewDue: colOf(headers, 'לתיקוף'),
      due: colOf(headers, 'מועד הגשת תוצר', 'מועד סופי להגשת'),
      hours: colOf(headers, 'שעות'),
      producers: colOf(headers, 'מפיק'),
      pm: colOf(headers, 'מנהל'),
      notes: colOf(headers, 'הערות'),
      complexity: colOf(headers, 'מורכבות', 'אפיון'),
      folder: colOf(headers, 'קישור לפרויקט', 'בענן'),
      report: colOf(headers, 'לינק לדיווח', 'קישור לדיווח'),
      director: colOf(headers, 'במאי'),
      editor: colOf(headers, 'עורכ'),
      designer: colOf(headers, 'מעצב'),
    };
    if (c.name < 0) { warnings.push(`לא נמצאה עמודת שם בגיליון ${sheetName}`); return 0; }
    let added = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const name = norm(row[c.name]);
      if (!name) continue;
      const get = (i) => (i >= 0 ? norm(row[i]) : '');
      const noteParts = [get(c.notes)];
      if (get(c.reviewDue) && get(c.reviewDue) !== '-') noteParts.push('הגשה לתיקוף: ' + get(c.reviewDue));
      if (c.director >= 0) {
        const crew = [['במאי.ת', get(c.director)], ['עורכ.ת', get(c.editor)], ['מעצב.ת', get(c.designer)]]
          .filter(([, v]) => v && v.toLowerCase() !== 'n.a').map(([k, v]) => `${k}: ${v}`).join(' · ');
        if (crew) noteParts.push(crew);
      }
      projects.push({
        id: 'prj-' + (++projSeq),
        name,
        type: get(c.type) || defaultType,
        status: mapStatus(get(c.status)),
        client: get(c.client),
        pm: get(c.pm),
        start_date: toIsoOrText(get(c.start)),
        start_range_from: '', start_range_to: '',
        due_date: toIsoOrText(get(c.due)),
        due_range_from: '', due_range_to: '',
        hours: parseInt(get(c.hours), 10) || 0,
        producerObjs: parseProducerCell(get(c.producers)),
        notes: noteParts.filter(Boolean).join(' | '),
        complexity: get(c.complexity),
        urgency: 'normal',
        archived: false,
        report_link: get(c.report), folder_link: get(c.folder),
        sort_index: projects.length,
      });
      added++;
    }
    return added;
  };

  // (invoked below — after the matrix pass completes the producer roster,
  //  so מפיק.ה cells like "מרח ויעל" resolve against known names)

  // ── Old sheet → history ────────────────────────────────────────────────
  const history = [];
  const parseHistory = () => {
    if (!oldSheet) return;
    const rows = sheetRows(wb, oldSheet);
    const headers = (rows[0] || []).map(norm);
    const c = {
      name: colOf(headers, 'פרויקט / משימות', 'שם הפרויקט'),
      type: colOf(headers, 'סוג הפקה'),
      client: colOf(headers, 'לקוח'),
      pm: colOf(headers, 'מנהל'),
      done: colOf(headers, 'מועד הגשת תוצר'),
      hours: colOf(headers, 'שעות'),
      producers: colOf(headers, 'מפיק'),
    };
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const name = norm(row[c.name]);
      if (!name) continue;
      const get = (i) => (i >= 0 ? norm(row[i]) : '');
      history.push({
        id: 'h-' + history.length,
        name, type: get(c.type), client: get(c.client), pm: get(c.pm),
        completed_date: toIsoOrText(get(c.done)),
        hours: parseInt(get(c.hours), 10) || 0,
        producerObjs: parseProducerCell(get(c.producers)),
      });
    }
  };

  // ── Matrix sheets → assignments ────────────────────────────────────────
  const assignments = [];
  const matrixRowCount = new Map(); // producer id → how many schedule rows
  let asgSeq = 0;
  for (const sheetName of matrixSheets) {
    const rows = sheetRows(wb, sheetName);
    let header = null;   // {month, year}
    let dateMap = null;  // [{col, iso}]
    for (const row of rows) {
      const first = norm(row[0]);
      const mh = parseMonthHeader(first);
      if (mh) { header = mh; dateMap = null; continue; }

      // date row: ≥2 cells matching d.m anywhere in the row
      const tokens = [];
      for (let i = 0; i < row.length; i++) {
        const m = norm(row[i]).match(DATE_TOKEN);
        if (m) tokens.push({ col: i, d: parseInt(m[1], 10), m: parseInt(m[2], 10) });
      }
      if (tokens.length >= 2) {
        if (!header) continue; // can't resolve a year — skip block
        dateMap = tokens.map(t => {
          let y = header.year;
          if (header.month === 12 && t.m <= 2) y += 1;       // week spilling into next year
          else if (header.month <= 2 && t.m >= 11) y -= 1;   // week starting in prev year
          return { col: t.col, iso: `${y}-${String(t.m).padStart(2,'0')}-${String(t.d).padStart(2,'0')}` };
        });
        continue;
      }

      // producer row
      if (!dateMap || !first || /^שבוע/.test(first) || /^\d+$/.test(first) || !hasHebrew(first)) continue;
      const prod = ensureProducer(first);
      if (!prod) continue;
      matrixRowCount.set(prod.id, (matrixRowCount.get(prod.id) || 0) + 1);
      for (const { col, iso } of dateMap) {
        const label = String(row[col] ?? '').trim();
        if (!label) continue;
        assignments.push({
          id: 'a-imp-' + (++asgSeq),
          producer_id: prod.id, date: iso, project_id: null,
          hours: 0, label,
        });
      }
    }
  }

  // Roster is now complete — parse the production sheets.
  if (mainSheet) parseProductions(mainSheet);
  else warnings.push('לא נמצא גיליון הפקות תוצרי-דיגיטל');
  if (videoSheet) parseProductions(videoSheet, { defaultType: 'וידאו' });
  parseHistory();

  // ── Per-producer sheets → producer_tasks ───────────────────────────────
  const tasks = [];
  for (const sheetName of producerSheets) {
    const pName = norm(sheetName).replace(producerSheetRe, '').replace(/הפקות/, '').trim();
    const prod = ensureProducer(pName, { external: false });
    if (!prod) continue;
    const rows = sheetRows(wb, sheetName);
    let monthLabel = '';
    let c = null;
    for (const row of rows) {
      const first = norm(row[0]);
      const mh = parseMonthHeader(first);
      if (mh) { monthLabel = mh.label; continue; }
      const headers = row.map(norm);
      if (headers.some(h => h === 'משימה' || h === 'משימות')) {
        c = {
          name: colOf(headers, 'משימה'),
          client: colOf(headers, 'לקוח'),
          pm: colOf(headers, 'מנהל'),
          hours: colOf(headers, 'שעות', 'היקף'),
          due: colOf(headers, 'מועד'),
          status: colOf(headers, 'סטטוס'),
          report: colOf(headers, 'דיווח'),
          notes: colOf(headers, 'הערות'),
        };
        continue;
      }
      if (!c || c.name < 0) continue;
      const name = norm(row[c.name]);
      if (!name) continue;
      const get = (i) => (i >= 0 ? norm(row[i]) : '');
      tasks.push({
        id: 't-' + tasks.length,
        producer_id: prod.id,
        month_label: monthLabel,
        name, client: get(c.client), pm: get(c.pm),
        hours: get(c.hours), due: toIsoOrText(get(c.due)),
        status: get(c.status), report: get(c.report), notes: get(c.notes),
        sort_index: tasks.length,
      });
    }
  }

  // ── Finalize producers (colors, sort) ──────────────────────────────────
  // Anyone with a meaningful presence in the schedule matrix is treated as
  // a team member even without a dedicated לו"ז sheet (e.g. סופי, יעל).
  const allProducers = [...producers.values()];
  for (const p of allProducers) {
    if (p.isExternal && (matrixRowCount.get(p.id) || 0) >= 8) p.isExternal = false;
  }
  const core = allProducers.filter(p => !p.isExternal);
  const ext = allProducers.filter(p => p.isExternal);
  [...core, ...ext].forEach((p, i) => {
    p.sortIndex = i;
    p.color = PALETTE[i % PALETTE.length];
  });

  // ── Write everything in one transaction ────────────────────────────────
  db.exec('BEGIN');
  try {
    if (mode === 'replace') clearAll();
    for (const p of allProducers) {
      upsertRow('producers', {
        id: p.id, name: p.name, color: p.color, capacity: 0.8, hours_week: 40,
        position_pct: 1, team_id: null, is_external: p.isExternal,
        sort_index: p.sortIndex, note: null,
      });
    }
    for (const pr of projects) {
      const { producerObjs, ...rest } = pr;
      upsertRow('projects', { ...rest, producers: producerObjs.map(p => p.id) });
    }
    for (const h of history) {
      const { producerObjs, ...rest } = h;
      upsertRow('history', { ...rest, producers: producerObjs.map(p => p.id) });
    }
    for (const a of assignments) upsertRow('assignments', a);
    for (const t of tasks) upsertRow('producer_tasks', t);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return {
    ok: true,
    counts: counts(),
    imported: {
      producers: allProducers.length,
      projects: projects.length,
      history: history.length,
      assignments: assignments.length,
      producer_tasks: tasks.length,
    },
    warnings,
  };
}
