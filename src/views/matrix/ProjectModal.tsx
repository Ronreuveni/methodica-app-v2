// Project detail modal opened by clicking an assignment chip. Ported from
// v1's ProjectModal — shows budget vs assigned hours, per-producer breakdown.

import { useEffect } from 'react';
import { STATUSES, type Project, type Assignment, type Producer } from '../../lib/types';
import { StatusPill } from '../../components/StatusPill';
import { Avatar } from '../../components/Avatar';
import { isRange, rangeStart, rangeEnd } from '../../components/Icons';

export function ProjectModal({ project, assignments, producers, onClose, onOpenProducer }: {
  project: Project;
  assignments: Assignment[];
  producers: Producer[];
  onClose: () => void;
  onOpenProducer: (id: string) => void;
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, []);

  const s = STATUSES[project.status];
  const projAssignments = assignments.filter(a => a.projectId === project.id);
  const byProducer: Record<string, Assignment[]> = {};
  projAssignments.forEach(a => { (byProducer[a.producerId] ||= []).push(a); });
  const totalAssigned = projAssignments.reduce((sum, a) => sum + a.hours, 0);
  const allDates = [...new Set(projAssignments.map(a => a.date))];
  const fmtRange = (v: Project['start']) => {
    const a = rangeStart(v), b = rangeEnd(v);
    if (!a && !b) return '—';
    if (a && b && a !== b) return `${new Date(a).toLocaleDateString('he-IL')} – ${new Date(b).toLocaleDateString('he-IL')}`;
    return new Date(a || b).toLocaleDateString('he-IL');
  };
  const prodMap = new Map(producers.map(p => [p.id, p]));

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-card rounded-lg shadow-pop w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-line" style={{ borderInlineStart: '4px solid ' + s.color }}>
          <div>
            <div className="text-[11px] text-ink-500">{project.client || '—'} · {project.type}</div>
            <div className="text-xl font-bold mt-0.5">{project.urgency === 'hot' && '🔥 '}{project.name}</div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-[12px] text-ink-700">
              <StatusPill status={project.status}/>
              {rangeStart(project.start) && <span>כניסה: <b>{fmtRange(project.start)}</b></span>}
              {rangeEnd(project.due) && <span>הגשה: <b>{fmtRange(project.due)}</b></span>}
              {project.pm && <span>מנהל.ת: <b>{project.pm}</b></span>}
              {project.complexity && <span>מורכבות: <b>{project.complexity}</b></span>}
            </div>
          </div>
          <button className="text-ink-500 hover:text-ink-900 text-xl" onClick={onClose}>×</button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-4 gap-3 mb-5">
            <Stat label="תקציב שעות" value={project.hours || '—'}/>
            <Stat label={`שובצו (${allDates.length} ימים)`} value={totalAssigned}/>
            <Stat label="מפיקים" value={Object.keys(byProducer).length}/>
            <Stat label="התקדמות" value={project.hours ? Math.round(totalAssigned / project.hours * 100) + '%' : '—'}/>
          </div>

          <div className="text-[12px] font-semibold text-ink-700 mb-2">שיבוצים</div>
          <div className="space-y-2">
            {Object.entries(byProducer).length === 0 ? (
              <div className="text-ink-500 text-[12px]">עדיין לא שובץ.</div>
            ) : Object.entries(byProducer).map(([pid, asses]) => {
              const pr = prodMap.get(pid);
              if (!pr) return null;
              const sum = asses.reduce((a, x) => a + x.hours, 0);
              return (
                <div key={pid} className="flex items-center justify-between bg-bg-muted rounded p-2 cursor-pointer hover:bg-line" onClick={() => onOpenProducer(pid)}>
                  <div className="flex items-center gap-2">
                    <Avatar producer={pr} size="sm"/>
                    <div>
                      <div className="font-semibold text-[12px]">{pr.name}</div>
                      <div className="text-[10px] text-ink-500">{asses.map(a => new Date(a.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })).join(' · ')}</div>
                    </div>
                  </div>
                  <div className="text-end"><div className="font-bold">{sum}</div><div className="text-[10px] text-ink-500">שעות</div></div>
                </div>
              );
            })}
          </div>

          {project.notes && (
            <>
              <div className="text-[12px] font-semibold text-ink-700 mt-4 mb-1">הערות</div>
              <div className="text-[12px] text-ink-700 whitespace-pre-wrap bg-bg-muted rounded p-2">{project.notes}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-bg-muted rounded p-2.5 text-center">
      <div className="text-[10px] text-ink-500">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}
