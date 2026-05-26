import { useEffect, useRef, useState } from 'react';
import { STATUSES, type Project, type ProjectStatus } from '../../lib/types';
import { parseKickoffEmail, draftToProject, type ParsedDraft } from './emailParser';

export function EmailImportModal({ onImport, onClose }: {
  onImport: (p: Partial<Project> & { id: string; name: string }) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState('');
  const [rawHtml, setRawHtml] = useState('');
  const [parsed, setParsed] = useState<ParsedDraft | null>(null);
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [source, setSource] = useState<'html' | 'text' | ''>('');
  const zoneRef = useRef<HTMLDivElement>(null);

  const readClipboard = async () => {
    try {
      const nav = navigator as Navigator & { clipboard: { read?: () => Promise<ClipboardItem[]>; readText?: () => Promise<string> } };
      if (nav.clipboard?.read) {
        const items = await nav.clipboard.read();
        for (const item of items) {
          if (item.types.includes('text/html')) {
            const html = await (await item.getType('text/html')).text();
            if (html && html.length > 30) {
              setRawHtml(html);
              setRaw(html.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/\n{2,}/g, '\n').trim());
              return;
            }
          }
        }
      }
      if (nav.clipboard?.readText) {
        const t = await nav.clipboard.readText();
        if (t && t.length > 20) setRaw(t);
      }
    } catch { /* clipboard blocked — user can paste manually */ }
  };

  useEffect(() => { void readClipboard(); }, []);
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain') || '';
    if (html && html.length > 30) {
      e.preventDefault();
      setRawHtml(html);
      setRaw(text || html.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/\n{2,}/g, '\n').trim());
    }
  };

  const handleParse = () => {
    setSource(rawHtml ? 'html' : 'text');
    setParsed(parseKickoffEmail(rawHtml || raw));
    setStep('review');
  };

  const handleImport = () => {
    if (!parsed) return;
    onImport(draftToProject(parsed));
    onClose();
  };

  return (
    <Overlay onClose={onClose}>
      <Head title="📧 ייבוא מייל התנעה" onClose={onClose}/>
      {step === 'paste' ? (
        <div className="p-5">
          <p className="text-[13px] text-ink-700 mb-3 leading-6">
            באאוטלוק: סמן את כל גוף המייל (כולל הטבלה הצבעונית) → <Kbd>Ctrl+C</Kbd> → הדבק כאן (<Kbd>Ctrl+V</Kbd>).
            {rawHtml && <span className="ms-2 inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5 text-[11px]">✓ זוהתה טבלת HTML</span>}
          </p>
          <div
            ref={zoneRef}
            contentEditable
            suppressContentEditableWarning
            onPaste={handlePaste}
            className="min-h-[200px] max-h-[360px] overflow-y-auto p-3 border-2 border-dashed border-line rounded bg-bg-muted text-[12px] leading-6 outline-none focus:border-brand-orange"
            dir="rtl"
            dangerouslySetInnerHTML={rawHtml ? { __html: rawHtml } : undefined}
          >
            {!rawHtml ? raw : undefined}
          </div>
          <div className="flex justify-between items-center mt-4">
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
              <button className="btn" onClick={() => void readClipboard()}>קרא מהקליפבורד</button>
            </div>
            <button className="btn btn-primary" onClick={handleParse} disabled={!raw && !rawHtml}>נתח →</button>
          </div>
        </div>
      ) : parsed && (
        <div className="p-5">
          <p className="text-[13px] text-ink-700 mb-3">
            בדוק את הפרטים שזוהו ועדכן אם צריך
            {source === 'html' && <span className="ms-2 inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5 text-[11px]">✓ נותחה טבלת HTML</span>}
            {source === 'text' && <span className="ms-2 inline-block bg-orange-50 text-orange-700 border border-orange-200 rounded px-2 py-0.5 text-[11px]">⚠ נותח כטקסט בלבד</span>}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="שם פרויקט"><input className="cell-input w-full" value={parsed.name} onChange={e => setParsed({ ...parsed, name: e.target.value })}/></Field>
            <Field label="לקוח"><input className="cell-input w-full" value={parsed.client} onChange={e => setParsed({ ...parsed, client: e.target.value })}/></Field>
            <Field label="סוג הפקה"><input className="cell-input w-full" value={parsed.type} onChange={e => setParsed({ ...parsed, type: e.target.value })}/></Field>
            <Field label="מנהל.ת פרויקט"><input className="cell-input w-full" value={parsed.pm} onChange={e => setParsed({ ...parsed, pm: e.target.value })}/></Field>
            <Field label="שעות"><input type="number" className="cell-input w-full" value={parsed.hours || ''} onChange={e => setParsed({ ...parsed, hours: parseInt(e.target.value) || 0 })}/></Field>
            <Field label="מועד הגשה"><input type="date" className="cell-input w-full" value={parsed.due} onChange={e => setParsed({ ...parsed, due: e.target.value })}/></Field>
            <Field label="הערות" full><textarea rows={4} className="cell-input w-full" value={parsed.notes} onChange={e => setParsed({ ...parsed, notes: e.target.value })}/></Field>
          </div>
          <div className="flex justify-between mt-4">
            <button className="btn btn-ghost" onClick={() => setStep('paste')}>← חזור</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={!parsed.name.trim()}>צור משימה</button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

// Shared modal chrome -------------------------------------------------
export function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-bg-card rounded-lg shadow-pop w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
export function Head({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-line">
      <span className="font-semibold">{title}</span>
      <button className="text-ink-500 hover:text-ink-900 text-lg" onClick={onClose}>×</button>
    </div>
  );
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={'flex flex-col gap-1 text-[11px] font-semibold text-ink-500 ' + (full ? 'col-span-2' : '')}>
      {label}
      {children}
    </label>
  );
}
function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="bg-bg-muted border border-line rounded px-1.5 py-0.5 text-[11px] font-mono">{children}</kbd>;
}

// re-export so BoardView can reuse STATUS list if needed
export { STATUSES };
export type { ProjectStatus };
