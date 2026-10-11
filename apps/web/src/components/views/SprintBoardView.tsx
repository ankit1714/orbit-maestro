'use client';

import React from 'react';
import { TrendingDown, AlertOctagon, Check, Play, CheckCircle2, ChevronRight, ExternalLink, RefreshCw, Calendar, Clock, User, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useRole } from '@/lib/roleContext';

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
  const { can, profile } = useRole();
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
    if (!can('canMoveTasks')) return;
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
      {/* Read Only Persona Banner */}
      {profile.permissions.isReadOnly && (
        <div className="p-3.5 rounded-xl border border-[#dadce0] bg-[#f8f9fa] flex items-center justify-between text-xs text-[#3c4043] shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#c5221f] shrink-0" />
            <span>Viewing as <strong className="text-[#202124]">{profile.title}</strong> — Sprint Board is in read-only observation mode. Workflow transitions and task movements are disabled.</span>
          </div>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white text-[#5f6368] border border-[#dadce0] font-bold shadow-sm">
            Read Only
          </span>
        </div>
      )}

      {/* Spillover Warning Banner */}
      {blockedTasks.length > 0 && (
        <div className="p-3.5 rounded-xl border border-[#feefc3] bg-[#fef7e0] flex items-center justify-between text-xs shadow-sm">
          <div className="flex items-center space-x-2 text-[#b06000]">
            <TrendingDown className="w-4 h-4 text-[#b06000] shrink-0" />
            <span>
              <strong>Spillover Forecast Alert:</strong> {blockedTasks.length} task(s) currently blocked with high risk of spilling over.
            </span>
          </div>
          {can('canTriageSpillover') ? (
            <button
              onClick={onOpenSpilloverModal}
              className="px-3 py-1 rounded-lg bg-[#b06000] text-white font-bold hover:bg-[#8d4d00] transition text-[11px] shadow-sm"
            >
              Launch Spillover Triage Workbench
            </button>
          ) : (
            <div
              className="px-2.5 py-1 rounded bg-[#f1f3f4] text-[#5f6368] font-medium text-[11px] flex items-center gap-1 cursor-not-allowed border border-[#dadce0]"
              title={`Role "${profile.title}" cannot triage spillover (Requires Scrum Master or Admin)`}
            >
              <Lock className="w-3 h-3 text-[#5f6368]" />
              <span>Triage (SM Only)</span>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#dadce0]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-[#1a73e8] font-bold text-sm">[{project?.key || "SCRUM"}]</span>
            <h1 className="text-xl font-bold text-[#202124]">
              {sprint?.name || "Active Jira Sprint"} Board
            </h1>
            {isJiraSource && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] animate-pulse" />
                Live Jira Cloud Sync
              </span>
            )}
          </div>
          <p className="text-xs text-[#5f6368] mt-1">
            {isJiraSource
              ? `Real-time sprint board synced from Jira Cloud with live workflow transitions (${allTasks.length} issues tracked).`
              : `Automated status transitions with human-approved overrides (${allTasks.length} tasks tracked).`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg border border-[#dadce0] bg-white hover:bg-[#f1f3f4] text-[#3c4043] transition text-xs font-medium flex items-center gap-1.5 shadow-sm"
            title="Refresh directly from Jira"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Jira</span>
          </button>
          <span className="text-xs text-[#3c4043] font-mono px-2.5 py-1.5 rounded-lg bg-white border border-[#dadce0] shadow-sm font-semibold">
            {sprint?.remaining_days ?? 4} days remaining
          </span>
        </div>
      </div>

      {allTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 items-start">
          {/* TO DO COLUMN */}
          <div className="p-3.5 rounded-2xl border border-[#dadce0] bg-[#f8f9fa] flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#5f6368] pb-2 border-b border-[#dadce0]">
              <span className="flex items-center gap-2">
                To Do
                <span className="text-[10px] bg-[#e8eaed] text-[#3c4043] px-2 py-0.5 rounded-full font-mono font-bold">
                  {todoTasks.length}
                </span>
              </span>
            </div>

            {todoTasks.map((t) => (
              <div
                key={t.id || t.key}
                className="p-3.5 rounded-xl bg-white border border-[#dadce0] hover:border-[#1a73e8]/40 hover:shadow-md transition space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <a
                    href={`https://the-ai-scrum-master.atlassian.net/browse/${t.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[#1a73e8] hover:underline flex items-center gap-0.5 font-bold"
                  >
                    <span>{t.key}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="px-2 py-0.5 rounded bg-[#f1f3f4] text-[#5f6368] font-mono text-[9px] border border-[#dadce0]">
                    {t.task_type || "DEV"}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-[#202124] leading-snug">{t.title}</h4>
                {t.story_title && (
                  <p className="text-[10px] text-[#5f6368] truncate" title={t.story_title}>
                    Parent: {t.story_title}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-[#f1f3f4] text-[11px] text-[#5f6368]">
                  <span className="flex items-center gap-1.5 text-[10px] text-[#5f6368] truncate max-w-[120px]">
                    <User className="w-3 h-3 text-[#5f6368]" />
                    <span className="truncate">{t.assignee_name || "Unassigned"}</span>
                  </span>
                  {can('canMoveTasks') ? (
                    <button
                      onClick={() => moveTask(t.key || t.id, "IN_PROGRESS")}
                      className="text-[#1a73e8] hover:text-[#1557b0] hover:underline flex items-center gap-0.5 text-[10px] font-semibold"
                    >
                      <span>Start</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#80868b] flex items-center gap-0.5 font-mono">
                      <Lock className="w-2.5 h-2.5" /> Read-only
                    </span>
                  )}
                </div>
                {t.updated_at && (
                  <div className="text-[9px] text-[#80868b] pt-0.5">
                    Modified: {formatDate(t.updated_at)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* IN PROGRESS COLUMN */}
          <div className="p-3.5 rounded-2xl border border-[#d2e3fc] bg-[#f8f9fa] flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#1967d2] pb-2 border-b border-[#d2e3fc]">
              <span className="flex items-center gap-2">
                In Progress
                <span className="text-[10px] bg-[#e8f0fe] text-[#1967d2] px-2 py-0.5 rounded-full font-mono font-bold">
                  {inProgressTasks.length}
                </span>
              </span>
            </div>

            {inProgressTasks.map((t) => (
              <div
                key={t.id || t.key}
                className="p-3.5 rounded-xl bg-white border border-[#1a73e8]/30 hover:border-[#1a73e8] hover:shadow-md transition space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <a
                    href={`https://the-ai-scrum-master.atlassian.net/browse/${t.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[#1a73e8] hover:underline flex items-center gap-0.5 font-bold"
                  >
                    <span>{t.key}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="px-2 py-0.5 rounded bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc] font-mono text-[9px] font-medium">
                    {t.status}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-[#202124] leading-snug">{t.title}</h4>
                {t.story_title && (
                  <p className="text-[10px] text-[#5f6368] truncate" title={t.story_title}>
                    Parent: {t.story_title}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-[#f1f3f4] text-[11px] text-[#5f6368]">
                  <span className="flex items-center gap-1.5 text-[10px] text-[#1967d2] truncate max-w-[120px]">
                    <User className="w-3 h-3 text-[#1a73e8]" />
                    <span className="truncate">{t.assignee_name || "Unassigned"}</span>
                  </span>
                  {can('canMoveTasks') ? (
                    <button
                      onClick={() => moveTask(t.key || t.id, "DONE")}
                      className="text-[#137333] hover:text-[#0d652d] hover:underline flex items-center gap-0.5 text-[10px] font-semibold"
                    >
                      <span>Finish</span>
                      <Check className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#80868b] flex items-center gap-0.5 font-mono">
                      <Lock className="w-2.5 h-2.5" /> Read-only
                    </span>
                  )}
                </div>
                {t.updated_at && (
                  <div className="text-[9px] text-[#80868b] pt-0.5">
                    Modified: {formatDate(t.updated_at)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* BLOCKED COLUMN */}
          <div className="p-3.5 rounded-2xl border border-[#fad2cf] bg-[#fffafb] flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#c5221f] pb-2 border-b border-[#fad2cf]">
              <span className="flex items-center gap-2">
                Blocked
                <span className="text-[10px] bg-[#fce8e6] text-[#c5221f] px-2 py-0.5 rounded-full font-mono font-bold">
                  {blockedTasks.length}
                </span>
              </span>
            </div>

            {blockedTasks.map((t) => (
              <div
                key={t.id || t.key}
                className="p-3.5 rounded-xl bg-white border border-[#f28b82] space-y-2.5 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <a
                    href={`https://the-ai-scrum-master.atlassian.net/browse/${t.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[#c5221f] hover:underline flex items-center gap-0.5 font-bold"
                  >
                    <span>{t.key}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="px-2 py-0.5 rounded bg-[#fce8e6] text-[#c5221f] font-bold font-mono text-[9px] border border-[#fad2cf]">
                    IMPEDIMENT
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-[#202124] leading-snug">{t.title}</h4>
                <div className="p-2 rounded-lg bg-[#fce8e6]/60 border border-[#fad2cf] text-[10px] text-[#c5221f]">
                  <p><strong>Blocker:</strong> {t.blocker_reason || "Dependency impediment flagged in Jira"}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#f1f3f4] text-[11px] text-[#5f6368]">
                  <span className="truncate max-w-[120px]">{t.assignee_name || "Unassigned"}</span>
                  <button onClick={() => onSwitchView('governance')} className="text-[#c5221f] hover:underline text-[10px] font-bold">
                    Escalate →
                  </button>
                </div>
                {t.updated_at && (
                  <div className="text-[9px] text-[#80868b] pt-0.5">
                    Modified: {formatDate(t.updated_at)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* DONE COLUMN */}
          <div className="p-3.5 rounded-2xl border border-[#dadce0] bg-[#f8f9fa] flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#137333] pb-2 border-b border-[#dadce0]">
              <span className="flex items-center gap-2">
                Done
                <span className="text-[10px] bg-[#e6f4ea] text-[#137333] px-2 py-0.5 rounded-full font-mono font-bold">
                  {doneTasks.length}
                </span>
              </span>
            </div>

            {doneTasks.map((t) => (
              <div
                key={t.id || t.key}
                className="p-3.5 rounded-xl bg-white border border-[#dadce0] space-y-2.5 shadow-sm opacity-90"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <a
                    href={`https://the-ai-scrum-master.atlassian.net/browse/${t.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[#5f6368] line-through hover:underline flex items-center gap-0.5"
                  >
                    <span>{t.key}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="px-2 py-0.5 rounded bg-[#e6f4ea] text-[#137333] text-[9px] font-mono border border-[#ceead6] font-semibold">
                    Complete
                  </span>
                </div>
                <h4 className="text-xs font-medium text-[#5f6368] line-through leading-snug">{t.title}</h4>
                <div className="flex items-center justify-between pt-2 border-t border-[#f1f3f4] text-[11px] text-[#5f6368]">
                  <span className="truncate max-w-[120px]">{t.assignee_name || "Unassigned"}</span>
                  <span className="text-[#137333] flex items-center gap-1 text-[10px] font-semibold">
                    <Check className="w-3 h-3" /> Jira Verified
                  </span>
                </div>
                {t.updated_at && (
                  <div className="text-[9px] text-[#80868b] pt-0.5">
                    Modified: {formatDate(t.updated_at)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-3">
          <h3 className="text-base font-bold text-[#202124]">No Active Tasks in Sprint Board</h3>
          <p className="text-xs text-[#5f6368] max-w-md mx-auto">
            {isJiraSource
              ? `No active sprint items found in Jira project ${project?.key || 'SCRUM'}. Add tasks or stories in Jira or synthesize them in the Backlog view.`
              : `Backlog items have not been decomposed for ${project?.name} yet. Open Document Studio or Backlog tab to synthesize tasks.`}
          </p>
          <div className="pt-2 flex justify-center gap-2.5">
            <button
              onClick={() => onSwitchView('backlog')}
              className="px-4 py-2 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold text-xs shadow-sm transition"
            >
              Open Backlog Tab
            </button>
            <a
              href="https://the-ai-scrum-master.atlassian.net/jira/software/projects/SCRUM/boards"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg border border-[#dadce0] bg-white hover:bg-[#f1f3f4] text-[#3c4043] font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
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
