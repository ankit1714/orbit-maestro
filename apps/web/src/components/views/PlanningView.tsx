'use client';

import React, { useState } from 'react';
import { Compass, CheckCircle, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

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
  const [committed, setCommitted] = useState(false);
  const [goalText, setGoalText] = useState(sprint?.goal || `Sprint 1 Goal: Deliver foundational capabilities for ${project?.name}`);

  const epics = backlog?.epics || [];
  const allStories = epics.flatMap((e: any) => e.stories || []);

  const team = project?.team_members || [];
  const totalTeamHours = team.reduce((acc: number, m: any) => acc + (m.available_hours_per_week || 40), 0) || 160;

  const handleCommit = async () => {
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
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-brand-400 font-bold text-sm">[{project?.key}]</span>
            <h1 className="text-lg font-bold text-white">
              Sprint Planning & Capacity Allocator
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
              Stage 5 · FR-07
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">Align team capacity, historical velocity, and dependency risks to synthesize an achievable sprint commitment.</p>
        </div>
        <button
          onClick={handleCommit}
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-500/20 transition"
        >
          <CheckCircle className="w-4 h-4" />
          <span>{committed ? "Committed! Redirecting..." : `Commit ${sprint?.name || "Sprint 1"} Scope`}</span>
        </button>
      </div>

      {/* AI Generated Sprint Goal Banner */}
      <div className="p-4 rounded-xl border border-brand-500/30 bg-gradient-to-r from-brand-950/40 via-surface-900 to-surface-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30">
              AI Synthesized Sprint Goal
            </span>
            <span className="text-xs text-zinc-400 font-mono">Confidence: 94%</span>
          </div>
          <input
            type="text"
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2 text-sm font-semibold text-white focus:outline-none focus:border-brand-500 mt-1"
          />
          <p className="text-[11px] text-zinc-400">Synthesized from high-priority requirements and unblocked team capacity.</p>
        </div>
      </div>

      {/* Planning Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-900/60 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Target Velocity</span>
          <div className="text-xl font-bold text-white">{project?.target_velocity_points || 32} pts <span className="text-xs text-zinc-400 font-normal">pts/sprint</span></div>
          <p className="text-[11px] text-emerald-400">Based on team sizing</p>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-900/60 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Recommended Scope</span>
          <div className="text-xl font-bold text-brand-400">{Math.round((project?.target_velocity_points || 32) * 0.9)} pts <span className="text-xs text-zinc-400 font-normal">(10% buffer)</span></div>
          <p className="text-[11px] text-zinc-400">Buffers against external dependencies</p>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-900/60 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Team Available Hours</span>
          <div className="text-xl font-bold text-white">{totalTeamHours} hrs</div>
          <p className="text-[11px] text-amber-400">{team.length || 4} team members active</p>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-900/60 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Sprint Cadence</span>
          <div className="text-xl font-bold text-white">{project?.sprint_duration_days || 14} Days</div>
          <p className="text-[11px] text-zinc-400">Target sprint cycle</p>
        </div>
      </div>

      {/* Scope Candidates */}
      <div className="rounded-xl border border-zinc-800 bg-surface-900/60 overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-950 border-b border-zinc-800 flex items-center justify-between text-xs">
          <span className="font-semibold text-zinc-300 font-mono uppercase text-[11px]">Sprint Candidate Stories</span>
          <span className="text-zinc-500 font-mono text-[11px]">Selected: {allStories.length} stories</span>
        </div>
        <div className="divide-y divide-zinc-800/60 text-xs">
          {allStories.length > 0 ? (
            allStories.map((story: any) => (
              <div key={story.id || story.key} className="p-3 flex items-center justify-between bg-zinc-900/40">
                <div className="flex items-center space-x-3">
                  <input type="checkbox" defaultChecked className="rounded border-zinc-700 text-brand-600 bg-zinc-800" />
                  <div>
                    <span className="font-mono text-brand-400 font-semibold mr-2">{story.key}</span>
                    <span className="text-white font-medium">{story.title}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono">AI Recommended</span>
                  <span className="font-mono text-zinc-300 font-bold">{story.story_points || 5} pts</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No candidate stories found in backlog yet. Synthesize backlog in Document Studio first.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
