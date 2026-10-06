'use client';

import React from 'react';
import { TrendingDown, AlertOctagon, Check, Play, CheckCircle2, ChevronRight, ExternalLink, RefreshCw, Calendar, Clock, User } from 'lucide-react';
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
      if (s.tasks && s.tasks.length > 0) {
        s.tasks.forEach((t: any) => {
          allTasks.push({ ...t, story_title: s.title });
        });
      } else {
        allTasks.push({
          id: s.id,
          key: s.key,
          title: s.title,
          status: s.status,
          task_type: "STORY",
          assignee_name: s.assignee_name || "Unassigned",
          effort_days: s.story_points ? s.story_points * 0.5 : 1.0,
          story_title: e.title,
          jira_url: s.jira_url || `https://the-ai-scrum-master.atlassian.net/browse/${s.key}`,
          created_at: s.created_at,
          updated_at: s.updated_at
        });
      }
    });
  });

  const isBlocked = (t: any) => {
    const val = (t.status || '').toLowerCase();
    return val === 'blocked' || val === 'impediment' || t.is_blocked;
  };

  const isTodo = (t: any) => {
    if (isBlocked(t)) return false;
    const val = (t.status || '').toLowerCase();
    return val === 'todo' || val === 'to do' || val === 'backlog' || val === 'open';
  };

  const isInProgress = (t: any) => {
    if (isBlocked(t)) return false;
    const val = (t.status || '').toLowerCase();
    return val === 'in_progress' || val === 'in progress' || val === 'active' || val === 'in review' || val === 'in development';
  };

  const isDone = (t: any) => {
    const val = (t.status || '').toLowerCase();
    return val === 'done' || val === 'completed' || val === 'closed' || val === 'resolved';
  };

  const todoTasks = allTasks.filter(isTodo);
  const inProgressTasks = allTasks.filter(isInProgress);
  const blockedTasks = allTasks.filter(isBlocked);
  const doneTasks = allTasks.filter(isDone);

  const moveTask = async (taskIdOrKey: string, newStatus: string) => {
    try {
      await api.updateTaskStatus(project.id, taskIdOrKey, newStatus);
      onRefresh();
    } catch (e) {
      console.warn("Update status fallback:", e);
      onRefresh();
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return null;
    }
  };

  const isJiraSource = sprint?.source === "JIRA" || backlog?.source === "JIRA";

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

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-brand-400 font-bold text-sm">[{project?.key || "SCRUM"}]</span>
            <h1 className="text-lg font-bold text-white">
              {sprint?.name || "Active Jira Sprint"} Board
            </h1>
            {isJiraSource && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Live Jira Cloud Sync
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isJiraSource
              ? `Real-time sprint board synced from Jira Cloud with live workflow transitions (${allTasks.length} issues tracked).`
              : `Automated status transitions with human-approved overrides (${allTasks.length} tasks tracked).`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg border border-zinc-800 bg-surface-900 hover:bg-zinc-800 text-zinc-300 transition text-xs flex items-center gap-1.5"
            title="Refresh directly from Jira"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Jira</span>
          </button>
          <span className="text-xs text-zinc-300 font-mono px-2 py-1 rounded bg-zinc-900 border border-zinc-800">
            {sprint?.remaining_days ?? 4} days remaining
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
                  <a
                    href={`https://the-ai-scrum-master.atlassian.net/browse/${t.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-blue-400 hover:underline flex items-center gap-0.5 font-semibold"
                  >
                    <span>{t.key}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[9px]">{t.task_type || "DEV"}</span>
                </div>
                <h4 className="text-xs font-medium text-white">{t.title}</h4>
                {t.story_title && (
                  <p className="text-[10px] text-zinc-500 truncate" title={t.story_title}>
                    Parent: {t.story_title}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1 text-[10px] text-zinc-400 truncate max-w-[120px]">
                    <User className="w-3 h-3 text-zinc-500" />
                    <span>{t.assignee_name || "Unassigned"}</span>
                  </span>
                  <button
                    onClick={() => moveTask(t.key || t.id, "IN_PROGRESS")}
                    className="text-brand-400 hover:underline flex items-center gap-0.5 text-[10px]"
                  >
                    <span>Start</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                {t.updated_at && (
                  <div className="text-[9px] text-zinc-500 pt-0.5">
                    Modified: {formatDate(t.updated_at)}
                  </div>
                )}
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
                  <a
                    href={`https://the-ai-scrum-master.atlassian.net/browse/${t.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-indigo-400 hover:underline flex items-center gap-0.5 font-bold"
                  >
                    <span>{t.key}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[9px]">{t.status}</span>
                </div>
                <h4 className="text-xs font-medium text-white">{t.title}</h4>
                {t.story_title && (
                  <p className="text-[10px] text-zinc-500 truncate" title={t.story_title}>
                    Parent: {t.story_title}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1 text-[10px] text-zinc-400 truncate max-w-[120px]">
                    <User className="w-3 h-3 text-indigo-400" />
                    <span>{t.assignee_name || "Unassigned"}</span>
                  </span>
                  <button
                    onClick={() => moveTask(t.key || t.id, "DONE")}
                    className="text-emerald-400 hover:underline flex items-center gap-0.5 text-[10px]"
                  >
                    <span>Finish</span>
                    <Check className="w-3 h-3" />
                  </button>
                </div>
                {t.updated_at && (
                  <div className="text-[9px] text-zinc-500 pt-0.5">
                    Modified: {formatDate(t.updated_at)}
                  </div>
                )}
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
                  <a
                    href={`https://the-ai-scrum-master.atlassian.net/browse/${t.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-rose-400 hover:underline flex items-center gap-0.5 font-bold"
                  >
                    <span>{t.key}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold font-mono text-[9px]">IMPEDIMENT</span>
                </div>
                <h4 className="text-xs font-semibold text-white">{t.title}</h4>
                <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/30 text-[10px] text-rose-300">
                  <p><strong>Blocker:</strong> {t.blocker_reason || "Dependency impediment flagged in Jira"}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                  <span>{t.assignee_name || "Unassigned"}</span>
                  <button onClick={() => onSwitchView('governance')} className="text-rose-400 hover:underline text-[10px] font-bold">
                    Escalate →
                  </button>
                </div>
                {t.updated_at && (
                  <div className="text-[9px] text-zinc-500 pt-0.5">
                    Modified: {formatDate(t.updated_at)}
                  </div>
                )}
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
                  <a
                    href={`https://the-ai-scrum-master.atlassian.net/browse/${t.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-zinc-500 line-through hover:underline flex items-center gap-0.5"
                  >
                    <span>{t.key}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-mono">Complete</span>
                </div>
                <h4 className="text-xs font-medium text-zinc-300 line-through">{t.title}</h4>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500">
                  <span>{t.assignee_name || "Unassigned"}</span>
                  <span className="text-emerald-400 flex items-center gap-1 text-[10px]"><Check className="w-3 h-3" /> Jira Verified</span>
                </div>
                {t.updated_at && (
                  <div className="text-[9px] text-zinc-500 pt-0.5">
                    Modified: {formatDate(t.updated_at)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-zinc-800 bg-surface-900/40 space-y-3">
          <h3 className="text-sm font-bold text-white">No Active Tasks in Sprint Board</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {isJiraSource
              ? `No active sprint items found in Jira project ${project?.key || 'SCRUM'}. Add tasks or stories in Jira or synthesize them in the Backlog view.`
              : `Backlog items have not been decomposed for ${project?.name} yet. Open Document Studio or Backlog tab to synthesize tasks.`}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <button
              onClick={() => onSwitchView('backlog')}
              className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md shadow-brand-500/20"
            >
              Open Backlog Tab
            </button>
            <a
              href="https://the-ai-scrum-master.atlassian.net/jira/software/projects/SCRUM/boards"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs flex items-center gap-1.5"
            >
              <span>Open Jira Agile Board</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
