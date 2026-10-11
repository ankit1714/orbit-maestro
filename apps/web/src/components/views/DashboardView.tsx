'use client';

import React from 'react';
import { Target, Zap, Play, UploadCloud, CheckCircle2, ExternalLink, Layers, CheckSquare } from 'lucide-react';

interface DashboardViewProps {
  project: any;
  sprint: any;
  backlog?: any;
  healthMatrix: any;
  flashHealth: any;
  activityLogs: any[];
  onSwitchView: (view: string) => void;
  onOpenSimulator: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  project,
  sprint,
  backlog,
  healthMatrix,
  flashHealth,
  activityLogs,
  onSwitchView,
  onOpenSimulator,
}) => {
  if (!project) {
    return (
      <div className="p-8 max-w-4xl mx-auto w-full flex-1 flex flex-col items-center justify-center text-center space-y-4 my-auto">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg">
          <Layers className="w-8 h-8 text-brand-400" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-white">No Projects in Database</h2>
          <p className="text-xs text-zinc-400 max-w-md">
            All seed entries have been removed. Create a new project using the button below or &quot;+ New Project&quot; in the header to verify backend database storage and integrations.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-create-project-modal'));
            }}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md shadow-brand-500/20"
          >
            + Create First Project
          </button>
        </div>
      </div>
    );
  }

  const isOffTrack = flashHealth?.status === "OFF_TRACK";
  const isAtRisk = flashHealth?.status === "AT_RISK";

  const totalPoints = backlog?.total_points ?? sprint?.planned_points ?? 0;
  const deliveredPoints = sprint?.delivered_points ?? 0;
  const completionPct = totalPoints > 0 ? Math.round((deliveredPoints / totalPoints) * 100) : 0;
  const totalTasks = backlog?.total_tasks ?? 0;
  const totalEpics = backlog?.total_epics ?? 0;
  const isJira = Boolean(project?.mode === "ENTERPRISE_SYNC" && project?.jira_settings?.enabled);
  const jiraKey = project?.jira_settings?.project_key || project?.key || "";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            {jiraKey && <span className="font-mono text-brand-400 font-bold text-sm">[{jiraKey}]</span>}
            <h1 className="text-xl font-bold text-white">
              {project?.name || "AI Scrum Master"}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {sprint?.name || (isJira ? "Active Jira Sprint" : "Sprint 1")}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Goal: <span className="text-zinc-200 font-medium">{sprint?.goal || project?.business_objective || "Awaiting sprint goal commitment."}</span>
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {isJira && (
            <a
              href={`https://the-ai-scrum-master.atlassian.net/jira/software/projects/${jiraKey}/boards`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-md border border-blue-400/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <span>Jira Board</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={() => onSwitchView('meetings')}
            className="px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Simulate Standup</span>
          </button>
          <button
            onClick={() => onSwitchView('documents')}
            className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center space-x-1.5 transition"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Document Studio</span>
          </button>
        </div>
      </div>

      {/* GitHub Live Flash Health Banner */}
      {isOffTrack ? (
        <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-rose-200">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            <span><strong>🔴 GitHub Flash Alert (OFF-TRACK):</strong> {flashHealth?.headline || "Critical path task blocked or development stalled."}</span>
          </div>
          <button
            onClick={() => onSwitchView('governance')}
            className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 hover:bg-rose-500/30 text-[11px]"
          >
            Review Blocker Escalation
          </button>
        </div>
      ) : isAtRisk ? (
        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs text-amber-200">
          <span><strong>🟡 GitHub Flash Alert (AT-RISK):</strong> {flashHealth?.headline || "Tasks showing slowed commit rhythm in last 24h."}</span>
          <button onClick={() => onSwitchView('sprint')} className="underline text-[11px] font-bold">Check Sprint Board</button>
        </div>
      ) : (
        <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between text-xs text-emerald-300">
          <span>🟢 <strong>Jira & GitHub Live Sync:</strong> Real-time Jira Cloud metrics ({totalPoints} story points across {totalTasks} tasks in {totalEpics} epics).</span>
          <span className="font-mono text-[10px]">Live Connected</span>
        </div>
      )}

      {/* 5-Dimensional Health Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {healthMatrix?.dimensions && healthMatrix.dimensions.length > 0 ? (
          healthMatrix.dimensions.map((dim: any, i: number) => {
            const isWatch = dim.status === "Watch";
            const isRisk = dim.status === "At Risk";
            const badgeColor = isRisk ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : isWatch ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            return (
              <div key={i} className="p-3.5 rounded-xl border border-zinc-800 bg-surface-900/60">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-zinc-400 font-medium">{dim.dimension_name}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${badgeColor}`}>
                    {dim.status}
                  </span>
                </div>
                <div className="text-lg font-bold text-white mb-1">{dim.metric_label}</div>
                <p className="text-[11px] text-zinc-400 leading-tight">{dim.detail}</p>
              </div>
            );
          })
        ) : (
          <div className="col-span-5 p-4 rounded-xl border border-zinc-800 bg-surface-900/40 text-center text-xs text-zinc-400">
            Health matrix evaluating...
          </div>
        )}
      </div>

      {/* 2-Column Core Stats & Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active Sprint Progress Card */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-surface-900/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-brand-400" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Jira Sprint Velocity & Burndown</h3>
              </div>
              <span className="text-xs text-zinc-400 font-mono">
                {deliveredPoints} of {totalPoints} pts completed ({completionPct}%)
              </span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden flex mb-3">
              <div className="bg-emerald-500 h-full" style={{ width: `${completionPct}%` }}></div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Delivered from Jira ({deliveredPoints} pts)</span>
              <span className="text-zinc-500 font-mono">{sprint?.remaining_days ?? 4} days left in sprint</span>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-900/40">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Jira Epics</span>
              <div className="text-xl font-bold text-white mt-1 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>{totalEpics}</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">Top-level features</p>
            </div>
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-900/40">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Tracked Issues</span>
              <div className="text-xl font-bold text-white mt-1 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-brand-400" />
                <span>{totalTasks}</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">Active Jira tasks & subtasks</p>
            </div>
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-900/40">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Total Story Points</span>
              <div className="text-xl font-bold text-white mt-1 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>{totalPoints}</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">Live backlog estimation</p>
            </div>
          </div>
        </div>

        {/* Right Col: AI Action Timeline Feed */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-surface-900/50 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-brand-400" />
              AI Action Timeline
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">Audit Stream</span>
          </div>

          <div className="space-y-3 text-xs overflow-y-auto max-h-[360px] pr-1">
            {activityLogs && activityLogs.length > 0 ? (
              activityLogs.map((log: any, idx: number) => (
                <div key={idx} className="p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-brand-400 font-semibold font-mono">{log.actor}</span>
                    <span className="text-[10px] px-1 rounded bg-zinc-700/50 text-zinc-300 font-mono">
                      {log.governance_tier || "Auto"}
                    </span>
                  </div>
                  <p className="text-zinc-200">{log.description}</p>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-zinc-500 text-xs">
                No recent activity logged for this project yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
