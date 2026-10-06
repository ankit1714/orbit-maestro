'use client';

import React from 'react';
import { Target, AlertOctagon, Zap, Play, UploadCloud, CheckCircle2 } from 'lucide-react';

interface DashboardViewProps {
  project: any;
  sprint: any;
  healthMatrix: any;
  flashHealth: any;
  activityLogs: any[];
  onSwitchView: (view: string) => void;
  onOpenSimulator: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  project,
  sprint,
  healthMatrix,
  flashHealth,
  activityLogs,
  onSwitchView,
  onOpenSimulator,
}) => {
  const isOffTrack = flashHealth?.status === "OFF_TRACK";
  const isAtRisk = flashHealth?.status === "AT_RISK";

  const totalPoints = sprint?.planned_points || 30;
  const deliveredPoints = sprint?.delivered_points || 0;
  const completionPct = totalPoints > 0 ? Math.round((deliveredPoints / totalPoints) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-brand-400 font-bold text-sm">[{project?.key || "PROJECT"}]</span>
            <h1 className="text-xl font-bold text-white">
              {project?.name || "Scrum Delivery Cockpit"}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              {sprint?.name || "Sprint 1"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Goal: <span className="text-zinc-200 font-medium">{sprint?.goal || project?.business_objective || "Establish project baseline and initial user stories."}</span>
          </p>
        </div>
        <div className="flex items-center space-x-2">
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
          <span>🟢 <strong>GitHub Flash Engine:</strong> {flashHealth?.headline || "Active commits recorded across feature branches. CI checks passing."}</span>
          <span className="font-mono text-[10px]">Auto-monitored</span>
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
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Sprint Velocity & Burndown</h3>
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
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Delivered ({deliveredPoints} pts)</span>
              <span className="text-zinc-500 font-mono">{sprint?.remaining_days || 10} days left</span>
            </div>
          </div>

          {/* Primary Risk / Blocker Card */}
          {healthMatrix?.primary_risks && healthMatrix.primary_risks.length > 0 && (
            <div className={`p-4 rounded-xl border space-y-3 ${isOffTrack ? 'border-rose-500/20 bg-rose-500/5' : 'border-zinc-800 bg-surface-900/40'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg mt-0.5 ${isOffTrack ? 'bg-rose-500/10 text-rose-400' : 'bg-brand-500/10 text-brand-400'}`}>
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">Project Risk Advisory</span>
                    <ul className="text-xs text-zinc-300 mt-1 list-disc list-inside space-y-1">
                      {healthMatrix.primary_risks.map((r: string, idx: number) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <button
                  onClick={() => onSwitchView('risks')}
                  className="px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition"
                >
                  View DAG Radar
                </button>
              </div>
            </div>
          )}
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
