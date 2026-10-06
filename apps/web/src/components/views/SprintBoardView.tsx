'use client';

import React from 'react';
import { TrendingDown, AlertOctagon, Check, Play, CheckCircle2, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';

interface SprintBoardViewProps {
  project: any;
  sprint: any;
  backlog: any;
  onRefresh: () => void;
  onSwitchView: (view: string) => void;
  onOpenSpilloverModal: () => void;
}

export const SprintBoardView: React.FC<SprintBoardViewProps> = ({
  project,
  sprint,
  backlog,
  onRefresh,
  onSwitchView,
  onOpenSpilloverModal,
}) => {
  const epics = backlog?.epics || [];
  const allTasks: any[] = [];
  epics.forEach((e: any) => {
    (e.stories || []).forEach((s: any) => {
      (s.tasks || []).forEach((t: any) => {
        allTasks.push({ ...t, story_title: s.title });
      });
    });
  });

  const todoTasks = allTasks.filter((t) => t.status === "TODO" && !t.is_blocked);
  const inProgressTasks = allTasks.filter((t) => t.status === "IN_PROGRESS" && !t.is_blocked);
  const blockedTasks = allTasks.filter((t) => t.status === "BLOCKED" || t.is_blocked);
  const doneTasks = allTasks.filter((t) => t.status === "DONE");

  const moveTask = async (taskId: string, newStatus: string) => {
    try {
      await api.updateTaskStatus(project.id, taskId, newStatus);
      onRefresh();
    } catch (e) {
      console.warn("Update status fallback:", e);
      onRefresh();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-4 flex-1 flex flex-col">
      {/* Spillover Warning Banner */}
      {blockedTasks.length > 0 && (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-amber-200">
            <TrendingDown className="w-4 h-4 text-amber-400" />
            <span>
              <strong>Spillover Forecast Alert (Stage 11 · FR-13):</strong> {blockedTasks.length} task(s) currently blocked with high risk of spilling over.
            </span>
          </div>
          <button
            onClick={onOpenSpilloverModal}
            className="px-2.5 py-1 rounded bg-amber-400 text-surface-950 font-bold hover:bg-amber-300 transition text-[11px] shadow-sm"
          >
            Launch Spillover Triage Workbench
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-brand-400 font-bold text-sm">[{project?.key}]</span>
            <h1 className="text-lg font-bold text-white">Active {sprint?.name || "Sprint 1"} Board</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">Automated status transitions with human-approved overrides ({allTasks.length} tasks tracked).</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono">
            {sprint?.remaining_days || 10} days remaining
          </span>
        </div>
      </div>

      {allTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
          {/* TO DO COLUMN */}
          <div className="p-3 rounded-xl border border-zinc-800 bg-surface-900/50 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 pb-2 border-b border-zinc-800">
              <span className="flex items-center gap-2">To Do <span className="text-[10px] bg-zinc-800 px-1.5 py-0.2 rounded font-mono">{todoTasks.length}</span></span>
            </div>

            {todoTasks.map((t) => (
              <div key={t.id || t.key} className="p-3 rounded-lg bg-surface-950 border border-zinc-800 hover:border-zinc-700 transition space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-zinc-500">{t.key}</span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">{t.task_type || "DEV"}</span>
                </div>
                <h4 className="text-xs font-medium text-white">{t.title}</h4>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                  <span>{t.assignee_name || "Assignee"}</span>
                  <button
                    onClick={() => moveTask(t.id, "IN_PROGRESS")}
                    className="text-brand-400 hover:underline flex items-center gap-0.5 text-[10px]"
                  >
                    <span>Start</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* IN PROGRESS COLUMN */}
          <div className="p-3 rounded-xl border border-zinc-800 bg-surface-900/50 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 pb-2 border-b border-zinc-800">
              <span className="flex items-center gap-2">In Progress <span className="text-[10px] bg-zinc-800 px-1.5 py-0.2 rounded font-mono">{inProgressTasks.length}</span></span>
            </div>

            {inProgressTasks.map((t) => (
              <div key={t.id || t.key} className="p-3 rounded-lg bg-surface-950 border border-indigo-500/40 hover:border-indigo-500 transition space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-indigo-400 font-bold">{t.key}</span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">Active</span>
                </div>
                <h4 className="text-xs font-medium text-white">{t.title}</h4>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                  <span>{t.assignee_name || "Alex"}</span>
                  <button
                    onClick={() => moveTask(t.id, "DONE")}
                    className="text-emerald-400 hover:underline flex items-center gap-0.5 text-[10px]"
                  >
                    <span>Finish</span>
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* BLOCKED COLUMN */}
          <div className="p-3 rounded-xl border border-rose-900/40 bg-rose-950/10 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-rose-400 pb-2 border-b border-rose-900/40">
              <span className="flex items-center gap-2">Blocked <span className="text-[10px] bg-rose-500/20 px-1.5 py-0.2 rounded font-mono">{blockedTasks.length}</span></span>
            </div>

            {blockedTasks.map((t) => (
              <div key={t.id || t.key} className="p-3 rounded-lg bg-surface-950 border border-rose-500/50 space-y-2 shadow-lg shadow-rose-950/20">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-rose-400 font-bold">{t.key}</span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold font-mono">IMPEDIMENT</span>
                </div>
                <h4 className="text-xs font-semibold text-white">{t.title}</h4>
                <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/30 text-[10px] text-rose-300">
                  <p><strong>Blocker:</strong> {t.blocker_reason || "External dependency delay"}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                  <span>{t.assignee_name || "David"}</span>
                  <button onClick={() => onSwitchView('governance')} className="text-rose-400 hover:underline text-[10px] font-bold">
                    Escalate →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* DONE COLUMN */}
          <div className="p-3 rounded-xl border border-zinc-800 bg-surface-900/50 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 pb-2 border-b border-zinc-800">
              <span className="flex items-center gap-2">Done <span className="text-[10px] bg-zinc-800 px-1.5 py-0.2 rounded font-mono">{doneTasks.length}</span></span>
            </div>

            {doneTasks.map((t) => (
              <div key={t.id || t.key} className="p-3 rounded-lg bg-surface-950 border border-zinc-800/80 opacity-80 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-zinc-500 line-through">{t.key}</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-mono">Complete</span>
                </div>
                <h4 className="text-xs font-medium text-zinc-300 line-through">{t.title}</h4>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500">
                  <span>{t.assignee_name || "Developer"}</span>
                  <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Verified</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-zinc-800 bg-surface-900/40 space-y-3">
          <h3 className="text-sm font-bold text-white">No Active Tasks in Sprint Board</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Backlog items have not been decomposed for {project?.name} yet. Open Document Studio or Backlog tab to synthesize tasks.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onSwitchView('backlog')}
              className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md shadow-brand-500/20"
            >
              Open Backlog Tab
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
