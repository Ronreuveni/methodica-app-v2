// Paste a tab-separated row from Google Sheets / Excel and map columns to
// project fields. Ported from v1's PasteImportModal (mapping persisted to
// localStorage). Simplified to the essential map-and-import flow.

import { useEffect, useState } from 'react';
import { STATUSES, type Project, type ProjectStatus } from '../../lib/types';
import { Overlay, Head } from './EmailImportModal';

const MAP_KEY = 'v2-import-mapping';
type FieldKey = 'name' | 'client' | 'type' | 'pm' | 'hours' | 'start' | 'due' | 'status' | 'notes';
type Mapping = Record<FieldKey, number>;
const EMPTY: Mapping = { name: -1, client: -1, type: -1, pm: -1, hours: -1, start: -1, due: -1, status: -1, notes: -1 };

const FIELDS: { key: FieldKey; label: string; req?: boolean }[] = [
  { key: 'name', label: 'שם פרויקט', req: true },
  { key: 'client', label: 'לקוח' },
  { key: 'type', label: 'סוג הפקה' },
  { key: 'pm', label: 'מנהל.ת' },
  { key: 'hours', label: 'שעות' },
  { key: 'start', label: 'כניסה להפקה' },
  { key: 'due', label: 'מועד הגשה' },
  { key: 'status', label: 'סטטוס' },
  { key: 'notes', label: 'הערות' },
];

export function PasteImportModal({ onImport, onClose }: {
  onImport: (p: Partial<Project> & { id: string; name: string }) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeaders, setHasHeaders] = useState(false);
  const [selectedRow, setSelectedRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping>(() => {
    try { return JSON.parse(localStorage.getItem(MAP_KEY) || 'null') || EMPTY; } catch { return EMPTY; }
  });
  const [step, setStep] = useState<'paste' | 'map'>('paste');

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, []);

  const doParse = (text: string) => {
    const lines = text.trim().split(/\r?\n/).map(l => l.split('\t').map(c => c.trim())).filter(l => l.length > 1 || l[0]);
    if (!lines.length) return;
    const first = lines[0];
    const looksHeader = first.some(c => /שם|לקוח|סוג|מנהל|שעות|תאריך|סטטוס|pm|type|name|client/i.test(c));
    setHasHeaders(looksHeader);
    setRows(lines);
    if (looksHeader) {
      const auto = { ...EMPTY };
      first.forEach((h, i) => {
        if (/שם|name/i.test(h) && auto.name < 0) auto.name = i;
        else if (/לקוח|client/i.test(h) && auto.client < 0) auto.client = i;
        else if (/סוג|type|הפקה/i.test(h) && auto.type < 0) auto.type = i;
        else if (/מנהל|pm/i.test(h) && auto.pm < 0) auto.pm = i;
        else if (/שעות|hours/i.test(h) && auto.hours < 0) auto.hours = i;
        else if (/כניסה|start|התחל/i.test(h) && auto.start < 0) auto.start = i;
        else if (/הגשה|due|סיום/i.test(h) && auto.due < 0) auto.due = i;
        else if (/סטטוס|status/i.test(h) && auto.status < 0) auto.status = i;
        else if (/הערות|notes/i.test(h) && auto.notes < 0) auto.notes = i;
      });
      setMapping(m => (m === EMPTY ? auto : m));
    }
    setSelectedRow(looksHeader && lines.length > 1 ? 1 : 0);
    setStep('map');
  };

  useEffect(() => {
    if (navigator.clipboard?.readText) {
      navigator.clipboard.readText().then(t => { if (t && t.includes('\t')) { setRaw(t); doParse(t); } }).catch(() => {});
    }
  }, []);

  const dataRows = hasHeaders ? rows.slice(1) : rows;
  const headers = hasHeaders ? rows[0] : (rows[0] ? rows[0].map((_, i) => `עמודה ${i + 1}`) : []);
  const selected = dataRows[selectedRow] || [];

  const handleImport = () => {
    const get = (f: FieldKey) => mapping[f] >= 0 ? (selected[mapping[f]] || '') : '';
    const rawStatus = get('status');
    const matched = (Object.entries(STATUSES) as [ProjectStatus, { label: string }][])
      .find(([k, v]) => v.label === rawStatus || k === rawStatus);
    try { localStorage.setItem(MAP_KEY, JSON.stringify(mapping)); } catch { /* ignore */ }
    onImport({
      id: 'imp-' + Date.now(),
      name: get('name'),
      client: get('client'),
      type: get('type') || 'לומדה',
      pm: get('pm'),
      hours: parseInt(get('hours')) || 0,
      start: get('start'),
      due: get('due'),
      status: matched ? matched[0] : 'planning',
      notes: get('notes'),
      producers: [],
      urgency: 'normal',
      sortIndex: -1,
    });
    onClose();
  };

  return (
    <Overlay onClose={onClose}>
      <Head title="📋 ייבוא שורה מ-Google Sheets" onClose={onClose}/>
      {step === 'paste' ? (
        <div className="p-5">
          <p className="text-[13px] text-ink-700 mb-3">העתק שורה ב-Google Sheets (Ctrl+C), הדבק כאן:</p>
          <textarea className="cell-input w-full h-32" placeholder="הדבק כאן שורה מ-Google Sheets..."
            value={raw} onChange={e => setRaw(e.target.value)} autoFocus/>
          <div className="flex justify-between mt-4">
            <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
            <button className="btn btn-primary" onClick={() => doParse(raw)} disabled={!raw.trim()}>המשך →</button>
          </div>
        </div>
      ) : (
        <div className="p-5">
          <p className="text-[13px] text-ink-700 mb-3">
            זוהו <b>{headers.length}</b> עמודות{dataRows.length > 0 && <> ו-<b>{dataRows.length}</b> שורות</>}. שייך כל שדה לעמודה:
          </p>
          {dataRows.length > 1 && (
            <div className="flex items-center gap-2 mb-3 text-[12px]">
              <label>שורה לייבוא:</label>
              <select className="cell-input" value={selectedRow} onChange={e => setSelectedRow(+e.target.value)}>
                {dataRows.map((r, i) => <option key={i} value={i}>{mapping.name >= 0 ? (r[mapping.name] || `שורה ${i + 1}`) : `שורה ${i + 1}`}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {FIELDS.map(({ key, label, req }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-28 text-[12px] text-ink-700">{label}{req ? ' *' : ''}</span>
                <select className="cell-input flex-1" value={mapping[key]} onChange={e => setMapping(m => ({ ...m, [key]: +e.target.value }))}>
                  <option value={-1}>— לא ממפה —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h}{selected[i] ? ` — ${selected[i]}` : ''}</option>)}
                </select>
                {mapping[key] >= 0 && selected[mapping[key]] && (
                  <span className="text-[11px] text-ink-500 max-w-[120px] truncate">{selected[mapping[key]]}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4">
            <button className="btn btn-ghost" onClick={() => setStep('paste')}>← חזרה</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={!dataRows.length}>ייבא פרויקט</button>
          </div>
        </div>
      )}
    </Overlay>
  );
}
