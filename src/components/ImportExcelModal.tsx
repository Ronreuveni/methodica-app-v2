// Upload the legacy "הפקות דיגיטל.xlsx" workbook into the local database.
// The server parses every sheet (productions, video, archive schedule,
// producer matrix, per-producer logs) and returns a per-table summary.

import { useRef, useState } from 'react';
import clsx from 'clsx';
import type { ImportSummary } from '../lib/types';

const TABLE_LABELS: Record<string, string> = {
  producers: 'מפיקים.ות',
  projects: 'פרויקטים (לוח הפקות)',
  history: 'היסטוריה (ארכיון ישן)',
  assignments: 'שיבוצים בלו״ז',
  producer_tasks: 'משימות אישיות (גיליונות לו״ז)',
};

export function ImportExcelModal({ onImport, onClose }: {
  onImport: (file: File, mode: 'replace' | 'merge') => Promise<ImportSummary>;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!/\.(xlsx|xlsm)$/i.test(f.name)) { setError('יש לבחור קובץ Excel ‏(.xlsx)'); return; }
    setError(null);
    setFile(f);
  };

  const run = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      setSummary(await onImport(file, mode));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-900/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold">ייבוא מקובץ אקסל</h2>
          <button className="text-ink-500 hover:text-ink-900 text-xl leading-none" onClick={onClose}>×</button>
        </div>

        {summary ? (
          <div>
            <div className="text-[13px] text-ink-700 mb-3 mt-2">✅ הייבוא הושלם — הנתונים נשמרו במסד הנתונים:</div>
            <div className="space-y-1.5 mb-4">
              {Object.entries(summary.imported).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between bg-bg-muted rounded px-3 py-2 text-[13px]">
                  <span>{TABLE_LABELS[k] ?? k}</span>
                  <span className="font-mono font-bold">{v.toLocaleString()}</span>
                </div>
              ))}
            </div>
            {summary.warnings.length > 0 && (
              <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-4">
                {summary.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
              </div>
            )}
            <button className="btn btn-primary w-full justify-center" onClick={onClose}>סיום</button>
          </div>
        ) : (
          <div>
            <p className="text-[12px] text-ink-500 mb-4 leading-5">
              העלה את קובץ <b>הפקות דיגיטל.xlsx</b> — כל הגיליונות ייקלטו אוטומטית:
              לוח ההפקות, הפקות וידאו, לו״ז המפיקים (כולל ארכיון), והגיליונות האישיים.
            </p>

            <div
              className={clsx(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4',
                dragOver ? 'border-brand-orange bg-orange-50' : 'border-line hover:border-brand-orange/60'
              )}
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0]); }}>
              <input ref={inputRef} type="file" accept=".xlsx,.xlsm" className="hidden"
                onChange={e => pick(e.target.files?.[0])}/>
              {file ? (
                <div>
                  <div className="text-2xl mb-1">📄</div>
                  <div className="font-semibold text-[13px]">{file.name}</div>
                  <div className="text-[11px] text-ink-500">{(file.size / 1024 / 1024).toFixed(1)} MB · לחץ להחלפה</div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl mb-1">⬆️</div>
                  <div className="text-[13px] font-medium">גרור לכאן קובץ או לחץ לבחירה</div>
                  <div className="text-[11px] text-ink-500 mt-1">‎.xlsx בלבד</div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mb-5 text-[12px]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')}/>
                <span><b>החלפה מלאה</b> — מנקה את המסד וטוען מחדש</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')}/>
                <span>מיזוג על הקיים</span>
              </label>
            </div>

            {error && (
              <div className="text-[12px] text-danger bg-red-50 border border-red-200 rounded p-2 mb-4">{error}</div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center py-2.5" disabled={!file || busy} onClick={() => { void run(); }}>
                {busy ? 'מייבא… זה לוקח כמה שניות' : 'ייבא למסד הנתונים'}
              </button>
              <button className="btn" onClick={onClose} disabled={busy}>ביטול</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
