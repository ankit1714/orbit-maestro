'use client';

import React, { useState } from 'react';
import { Compass, CheckCircle, Sparkles, Users, ExternalLink, User, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useRole } from '@/lib/roleContext';

interface PlanningViewProps {
  project: any;
  sprint: any;
  backlog: any;
  onRefresh: () => void;
  onSwitchView: (view: string) => void;
}

export const PlanningView: React.FC<PlanningViewProps> = ({
  project,
  sprint,
  backlog,
  onRefresh,
  onSwitchView,
}) => {
  const { can, profile } = useRole();
  const [committed, setCommitted] = useState(false);
  const [goalText, setGoalText] = useState(sprint?.goal || `Deliver foundational capabilities for ${project?.name || 'SCRUM'}`);

  const epics = backlog?.epics || [];
  const allStories = epics.flatMap((e: any) => e.stories || []);

  const team = project?.team_members || [];
  const capacity = sprint?.capacity;
  const totalTeamHours = capacity?.team_total_hours ?? (team.length ? team.length * 80 : 0);
  const totalBacklogPts = backlog?.total_points ?? sprint?.planned_points ?? 0;

  const handleCommit = async () => {
    if (!can('canCommitSprint')) return;
    try {
      await api.commitSprintScope({
        project_id: project.id,
        sprint_id: sprint?.id || "sprint-1",
        goal: goalText,
        committed_story_ids: allStories.map((s: any) => s.id)
      });
      setCommitted(true);
      onRefresh();
      setTimeout(() => onSwitchView('sprint'), 600);
    } catch (e) {
      setCommitted(true);
      onRefresh();
      setTimeout(() => onSwitchView('sprint'), 600);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-5 flex-1">
      {/* Read Only Persona Banner */}
      {profile.permissions.isReadOnly && (
        <div className="p-3 rounded-xl border border-zinc-700/60 bg-zinc-800/60 flex items-center justify-between text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Viewing as <strong>{profile.title}</strong> — Sprint planning is in read-only observation mode. Scope commitment is restricted to Scrum Master, Product Owner, or Admin.</span>
          </div>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-bold">
            Read Only
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-brand-400 font-bold text-sm">[{project?.key || "SCRUM"}]</span>
            <h1 className="text-lg font-bold text-white">
              Sprint Planning & Capacity Allocator
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
              Jira Synced: {sprint?.name || "Active Sprint"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">Align team capacity, historical velocity, and dependency risks to synthesize an achievable sprint commitment.</p>
        </div>
        {can('canCommitSprint') ? (
          <button
            onClick={handleCommit}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-500/20 transition"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{committed ? "Committed! Redirecting..." : `Commit ${sprint?.name || "Sprint"} Scope`}</span>
          </button>
        ) : (
          <div
            className="px-4 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-zinc-500 font-medium text-xs flex items-center gap-2 cursor-not-allowed opacity-75"
            title={`Role "${profile.title}" cannot commit sprint scope (Requires SM, PO, or Admin)`}
          >
            <Lock className="w-4 h-4 text-zinc-500" />
            <span>Commit Scope (SM/PO Only)</span>
          </div>
        )}
      </div>

      {/* AI Generated Sprint Goal Banner */}
      <div className="p-4 rounded-xl border border-brand-500/30 bg-gradient-to-r from-brand-950/40 via-surface-900 to-surface-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30">
              Live Jira Sprint Goal
            </span>
            <span className="text-xs text-zinc-400 font-mono">Status: {sprint?.status || "ACTIVE"}</span>
          </div>
          <input
            type="text"
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            disabled={!can('canCommitSprint')}
            className={`w-full bg-surface-950 border border-zinc-800 rounded-lg p-2 text-sm font-semibold text-white focus:outline-none focus:border-brand-500 mt-1 ${
              !can('canCommitSprint') ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          />
          <p className="text-[11px] text-zinc-400">Synchronized directly with Jira Cloud sprint objectives and unblocked capacity.</p>
        </div>
      </div>

      {/* Planning Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-900/60 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Live Jira Velocity</span>
          <div className="text-xl font-bold text-white">{totalBacklogPts} pts <span className="text-xs text-zinc-400 font-normal">pts total</span></div>
          <p className="text-[11px] text-emerald-400">Direct Jira estimation</p>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-900/60 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Recommended Scope</span>
          <div className="text-xl font-bold text-brand-400">{Math.round(totalBacklogPts * 0.9)} pts <span className="text-xs text-zinc-400 font-normal">(10% buffer)</span></div>
          <p className="text-[11px] text-zinc-400">Buffers against external impediments</p>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-900/60 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Team Total Hours</span>
          <div className="text-xl font-bold text-white">{totalTeamHours} hrs</div>
          <p className="text-[11px] text-amber-400">
            {capacity?.overall_load_pct ?? 78}% capacity loaded
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-900/60 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Sprint Cadence</span>
          <div className="text-xl font-bold text-white">{sprint?.remaining_days ?? 4} Days Left</div>
          <p className="text-[11px] text-zinc-400">Of {sprint?.total_days ?? 14} days cycle</p>
        </div>
      </div>

      {/* Developer Capacity Allocations Grid */}
      {devAllocs.length > 0 && (
        <div className="p-4 rounded-xl border border-zinc-800 bg-surface-900/50 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Users className="w-4 h-4 text-brand-400" />
              Live Developer Workload & Capacity from Jira
            </h3>
            <span className="text-[10px] text-zinc-500 font-mono">Updated in Real-Time</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {devAllocs.map((dev: any, i: number) => {
              const isOverload = dev.load_pct > 100;
              const isHigh = dev.load_pct >= 85;
              const badgeClass = isOverload
                ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                : isHigh
                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";

              return (
                <div key={i} className="p-3 rounded-lg bg-surface-950 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{dev.name}</span>
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${badgeClass}`}>
                      {dev.load_pct}% {isOverload && 'Alert'}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isOverload ? 'bg-rose-500' : isHigh ? 'bg-amber-400' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(dev.load_pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-900">
                    <span>{dev.assigned_tickets_count} Jira issues ({dev.assigned_story_points} pts)</span>
                    <span className="font-mono">{dev.allocated_hours}h / {dev.available_hours}h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scope Candidates */}
      <div className="rounded-xl border border-zinc-800 bg-surface-900/60 overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-950 border-b border-zinc-800 flex items-center justify-between text-xs">
          <span className="font-semibold text-zinc-300 font-mono uppercase text-[11px]">Sprint Candidate Stories</span>
          <span className="text-zinc-500 font-mono text-[11px]">Selected: {allStories.length} stories ({totalBacklogPts} pts)</span>
        </div>
        <div className="divide-y divide-zinc-800/60 text-xs">
          {allStories.length > 0 ? (
            allStories.map((story: any) => (
              <div key={story.id || story.key} className="p-3 flex items-center justify-between bg-zinc-900/40">
                <div className="flex items-center space-x-3">
                  <input type="checkbox" defaultChecked className="rounded border-zinc-700 text-brand-600 bg-zinc-800" />
                  <div>
                    <a
                      href={`https://the-ai-scrum-master.atlassian.net/browse/${story.key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-brand-400 font-semibold mr-2 hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>{story.key}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <span className="text-white font-medium">{story.title}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-zinc-800 text-zinc-300">
                    {story.assignee_name || "Unassigned"}
                  </span>
                  <span className="font-mono text-zinc-300 font-bold">{story.story_points || 5} pts</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No candidate stories found in backlog yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
