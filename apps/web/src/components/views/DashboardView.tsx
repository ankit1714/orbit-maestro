'use client';

import React from 'react';
import { Target, Zap, CheckCircle2, ExternalLink, Layers, CheckSquare } from 'lucide-react';

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
      <div className="p-8 max-w-lg mx-auto w-full flex-1 flex flex-col items-center justify-center text-center space-y-4 my-auto">
        <div className="w-16 h-16 rounded-2xl bg-white border border-[#dadce0] flex items-center justify-center shadow-[0_1px_3px_rgba(60,64,67,0.2)]">
          <Layers className="w-8 h-8 text-[#1a73e8]" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-[#202124]">No Projects in Database</h2>
          <p className="text-xs text-[#5f6368] max-w-md leading-relaxed">
            Create a new project using the button below or &quot;+ Create New Project&quot; in the header to initialize project tracking, Jira sync, and AI sprint workflows.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-create-project-modal'));
            }}
            className="px-4 py-2 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs shadow-sm transition"
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#dadce0]">
        <div>
          <div className="flex items-center gap-2.5">
            {jiraKey && (
              <span className="font-mono text-[#1a73e8] font-bold text-sm bg-[#e8f0fe] px-2 py-0.5 rounded border border-[#d2e3fc]">
                [{jiraKey}]
              </span>
            )}
            <h1 className="text-xl font-bold text-[#202124] tracking-tight">
              {project?.name || "AI Scrum Master"}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#e8f0fe] text-[#1a73e8] border border-[#d2e3fc] font-medium flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#137333] animate-pulse" />
              {sprint?.name || (isJira ? "Active Jira Sprint" : "Sprint 1")}
            </span>
          </div>
          <p className="text-xs text-[#5f6368] mt-1">
            Goal: <span className="text-[#202124] font-medium">{sprint?.goal || project?.business_objective || "Awaiting sprint goal commitment."}</span>
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {isJira && (
            <a
              href={`https://the-ai-scrum-master.atlassian.net/jira/software/projects/${jiraKey}/boards`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg border border-[#d2e3fc] bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#174ea6] text-xs font-medium flex items-center space-x-1.5 transition shadow-sm"
            >
              <span>Jira Board</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* GitHub Live Flash Health Banner */}
      {isOffTrack ? (
        <div className="p-3.5 rounded-xl border border-[#fad2cf] bg-[#fce8e6] flex items-center justify-between text-xs shadow-sm">
          <div className="flex items-center gap-2 text-[#c5221f]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#c5221f] animate-ping"></span>
            <span><strong>🔴 GitHub Flash Alert (OFF-TRACK):</strong> {flashHealth?.headline || "Critical path task blocked or development stalled."}</span>
          </div>
          <button
            onClick={() => onSwitchView('governance')}
            className="px-3 py-1 rounded-lg bg-[#c5221f] hover:bg-[#a51d24] text-white font-medium text-xs transition shadow-sm"
          >
            Review Blocker Escalation
          </button>
        </div>
      ) : isAtRisk ? (
        <div className="p-3.5 rounded-xl border border-[#feefc3] bg-[#fef7e0] flex items-center justify-between text-xs text-[#b06000] shadow-sm">
          <span><strong>🟡 GitHub Flash Alert (AT-RISK):</strong> {flashHealth?.headline || "Tasks showing slowed commit rhythm in last 24h."}</span>
          <button onClick={() => onSwitchView('sprint')} className="underline text-xs font-semibold hover:text-[#7f4500]">
            Check Sprint Board
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-xl border border-[#ceead6] bg-[#e6f4ea] flex items-center justify-between text-xs text-[#137333] shadow-sm">
          <span>🟢 <strong>Jira & GitHub Live Sync:</strong> Real-time Jira Cloud metrics ({totalPoints} story points across {totalTasks} tasks in {totalEpics} epics).</span>
          <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded-full border border-[#ceead6] font-semibold">Live Connected</span>
        </div>
      )}

      {/* 5-Dimensional Health Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {healthMatrix?.dimensions && healthMatrix.dimensions.length > 0 ? (
          healthMatrix.dimensions.map((dim: any, i: number) => {
            const isWatch = dim.status === "Watch";
            const isRisk = dim.status === "At Risk";
            const badgeColor = isRisk 
              ? "bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]" 
              : isWatch 
              ? "bg-[#fef7e0] text-[#b06000] border-[#feefc3]" 
              : "bg-[#e6f4ea] text-[#137333] border-[#ceead6]";
            return (
              <div 
                key={i} 
                className="p-4 rounded-xl border border-[#dadce0] bg-white shadow-[0_1px_2px_0_rgba(60,64,67,0.15)] hover:shadow-[0_2px_6px_0_rgba(60,64,67,0.15)] transition"
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-[#5f6368] font-medium truncate">{dim.dimension_name}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${badgeColor}`}>
                    {dim.status}
                  </span>
                </div>
                <div className="text-xl font-bold text-[#202124] mb-1 tracking-tight">{dim.metric_label}</div>
                <p className="text-[11px] text-[#5f6368] leading-snug line-clamp-2">{dim.detail}</p>
              </div>
            );
          })
        ) : (
          <div className="col-span-5 p-6 rounded-xl border border-[#dadce0] bg-white text-center text-xs text-[#5f6368] shadow-sm">
            Health matrix evaluating telemetry...
          </div>
        )}
      </div>

      {/* 2-Column Core Stats & Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active Sprint Progress Card */}
          <div className="p-5 rounded-xl border border-[#dadce0] bg-white shadow-[0_1px_2px_0_rgba(60,64,67,0.15)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-[#1a73e8]" />
                <h3 className="text-xs font-bold text-[#202124] uppercase tracking-wider font-mono">
                  Jira Sprint Velocity & Burndown
                </h3>
              </div>
              <span className="text-xs text-[#5f6368] font-mono font-medium">
                {deliveredPoints} of {totalPoints} pts completed ({completionPct}%)
              </span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="w-full h-3 bg-[#f1f3f4] rounded-full overflow-hidden flex border border-[#dadce0]/50">
              <div 
                className="bg-[#137333] h-full transition-all duration-500 rounded-full" 
                style={{ width: `${completionPct}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#5f6368]">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-[#137333]"></span> Delivered from Jira ({deliveredPoints} pts)
              </span>
              <span className="text-[#3c4043] font-mono font-semibold bg-[#f1f3f4] px-2 py-0.5 rounded">
                {sprint?.remaining_days ?? 4} days left in sprint
              </span>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-[#dadce0] bg-white shadow-[0_1px_2px_0_rgba(60,64,67,0.15)]">
              <span className="text-[10px] font-mono text-[#5f6368] uppercase font-bold tracking-wider">Jira Epics</span>
              <div className="text-2xl font-bold text-[#202124] mt-1 flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <span>{totalEpics}</span>
              </div>
              <p className="text-[11px] text-[#5f6368] mt-1">Top-level features</p>
            </div>

            <div className="p-4 rounded-xl border border-[#dadce0] bg-white shadow-[0_1px_2px_0_rgba(60,64,67,0.15)]">
              <span className="text-[10px] font-mono text-[#5f6368] uppercase font-bold tracking-wider">Tracked Issues</span>
              <div className="text-2xl font-bold text-[#202124] mt-1 flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <span>{totalTasks}</span>
              </div>
              <p className="text-[11px] text-[#5f6368] mt-1">Active Jira tasks & subtasks</p>
            </div>

            <div className="p-4 rounded-xl border border-[#dadce0] bg-white shadow-[0_1px_2px_0_rgba(60,64,67,0.15)]">
              <span className="text-[10px] font-mono text-[#5f6368] uppercase font-bold tracking-wider">Total Story Points</span>
              <div className="text-2xl font-bold text-[#202124] mt-1 flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#e6f4ea] text-[#137333] flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </div>
                <span>{totalPoints}</span>
              </div>
              <p className="text-[11px] text-[#5f6368] mt-1">Live backlog estimation</p>
            </div>
          </div>
        </div>

        {/* Right Col: AI Action Timeline Feed */}
        <div className="p-5 rounded-xl border border-[#dadce0] bg-white shadow-[0_1px_2px_0_rgba(60,64,67,0.15)] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#dadce0] mb-3">
            <h3 className="text-xs font-bold text-[#202124] uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#1a73e8]" />
              AI Action Timeline
            </h3>
            <span className="text-[10px] font-mono text-[#5f6368] bg-[#f1f3f4] px-1.5 py-0.5 rounded font-semibold">Audit Stream</span>
          </div>

          <div className="space-y-2.5 text-xs overflow-y-auto max-h-[360px] pr-1">
            {activityLogs && activityLogs.length > 0 ? (
              activityLogs.map((log: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg bg-[#f8f9fa] border border-[#dadce0] space-y-1 hover:border-[#bdc1c6] transition">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#1a73e8] font-bold font-mono">{log.actor}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white border border-[#dadce0] text-[#5f6368] font-mono font-medium">
                      {log.governance_tier || "Auto"}
                    </span>
                  </div>
                  <p className="text-[#3c4043] leading-relaxed">{log.description}</p>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-[#5f6368] text-xs">
                No recent activity logged for this project yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
