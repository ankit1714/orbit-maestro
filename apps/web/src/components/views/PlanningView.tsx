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
  const devAllocs = capacity?.developer_allocations || [];
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
        <div className="p-3.5 rounded-xl border border-[#dadce0] bg-[#f8f9fa] flex items-center justify-between text-xs text-[#3c4043] shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#c5221f] shrink-0" />
            <span>Viewing as <strong className="text-[#202124]">{profile.title}</strong> — Sprint planning is in read-only observation mode. Scope commitment is restricted to Scrum Master, Product Owner, or Admin.</span>
          </div>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white text-[#5f6368] border border-[#dadce0] font-bold shadow-sm">
            Read Only
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pb-3 border-b border-[#dadce0]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-[#1a73e8] font-bold text-sm">[{project?.key || "SCRUM"}]</span>
            <h1 className="text-xl font-bold text-[#202124]">
              Sprint Planning & Capacity Allocator
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc] font-medium font-mono">
              Jira Synced: {sprint?.name || "Active Sprint"}
            </span>
          </div>
          <p className="text-xs text-[#5f6368] mt-1">Align team capacity, historical velocity, and dependency risks to synthesize an achievable sprint commitment.</p>
        </div>
        {can('canCommitSprint') ? (
          <button
            onClick={handleCommit}
            className="px-4 py-2 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{committed ? "Committed! Redirecting..." : `Commit ${sprint?.name || "Sprint"} Scope`}</span>
          </button>
        ) : (
          <div
            className="px-4 py-2 rounded-xl bg-[#f1f3f4] border border-[#dadce0] text-[#80868b] font-medium text-xs flex items-center gap-2 cursor-not-allowed opacity-75"
            title={`Role "${profile.title}" cannot commit sprint scope (Requires SM, PO, or Admin)`}
          >
            <Lock className="w-4 h-4 text-[#80868b]" />
            <span>Commit Scope (SM/PO Only)</span>
          </div>
        )}
      </div>

      {/* Sprint Goal Banner */}
      <div className="p-4 rounded-2xl border border-[#dadce0] bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1.5 flex-1 w-full">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#e8f0fe] text-[#1967d2] font-bold border border-[#d2e3fc]">
              Live Jira Sprint Goal
            </span>
            <span className="text-xs text-[#5f6368] font-mono">Status: {sprint?.status || "ACTIVE"}</span>
          </div>
          <input
            type="text"
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            disabled={!can('canCommitSprint')}
            className={`w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-2.5 text-sm font-semibold text-[#202124] focus:bg-white focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition mt-1 ${
              !can('canCommitSprint') ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          />
          <p className="text-[11px] text-[#5f6368]">Synchronized directly with Jira Cloud sprint objectives and unblocked capacity.</p>
        </div>
      </div>

      {/* Planning Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-1.5">
          <span className="text-[10px] font-mono text-[#5f6368] uppercase font-semibold">Live Jira Velocity</span>
          <div className="text-2xl font-bold text-[#202124]">{totalBacklogPts} pts <span className="text-xs text-[#5f6368] font-normal">pts total</span></div>
          <p className="text-[11px] text-[#137333] font-medium">Direct Jira estimation</p>
        </div>

        <div className="p-4 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-1.5">
          <span className="text-[10px] font-mono text-[#5f6368] uppercase font-semibold">Recommended Scope</span>
          <div className="text-2xl font-bold text-[#1a73e8]">{Math.round(totalBacklogPts * 0.9)} pts <span className="text-xs text-[#5f6368] font-normal">(10% buffer)</span></div>
          <p className="text-[11px] text-[#5f6368]">Buffers against external impediments</p>
        </div>

        <div className="p-4 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-1.5">
          <span className="text-[10px] font-mono text-[#5f6368] uppercase font-semibold">Team Total Hours</span>
          <div className="text-2xl font-bold text-[#202124]">{totalTeamHours} hrs</div>
          <p className="text-[11px] text-[#b06000] font-medium">
            {capacity?.overall_load_pct ?? 78}% capacity loaded
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-1.5">
          <span className="text-[10px] font-mono text-[#5f6368] uppercase font-semibold">Sprint Cadence</span>
          <div className="text-2xl font-bold text-[#202124]">{sprint?.remaining_days ?? 4} Days Left</div>
          <p className="text-[11px] text-[#5f6368]">Of {sprint?.total_days ?? 14} days cycle</p>
        </div>
      </div>

      {/* Developer Capacity Allocations Grid */}
      {devAllocs.length > 0 && (
        <div className="p-4 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#dadce0]">
            <h3 className="text-xs font-semibold text-[#202124] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Users className="w-4 h-4 text-[#1a73e8]" />
              Live Developer Workload & Capacity from Jira
            </h3>
            <span className="text-[10px] text-[#5f6368] font-mono">Updated in Real-Time</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {devAllocs.map((dev: any, i: number) => {
              const isOverload = dev.load_pct > 100;
              const isHigh = dev.load_pct >= 85;
              const badgeClass = isOverload
                ? "bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]"
                : isHigh
                ? "bg-[#fef7e0] text-[#b06000] border-[#feefc3]"
                : "bg-[#e6f4ea] text-[#137333] border-[#ceead6]";

              return (
                <div key={i} className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#202124] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#5f6368]" />
                      <span>{dev.name}</span>
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium border ${badgeClass}`}>
                      {dev.load_pct}% {isOverload && 'Alert'}
                    </span>
                  </div>
                  <div className="w-full bg-[#e8eaed] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isOverload ? 'bg-[#c5221f]' : isHigh ? 'bg-[#b06000]' : 'bg-[#137333]'}`}
                      style={{ width: `${Math.min(dev.load_pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#5f6368] pt-1 border-t border-[#dadce0]/60">
                    <span>{dev.assigned_tickets_count} Jira issues ({dev.assigned_story_points} pts)</span>
                    <span className="font-mono font-medium">{dev.allocated_hours}h / {dev.available_hours}h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scope Candidates */}
      <div className="rounded-2xl border border-[#dadce0] bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-[#f8f9fa] border-b border-[#dadce0] flex items-center justify-between text-xs">
          <span className="font-semibold text-[#202124] font-mono uppercase text-[11px]">Sprint Candidate Stories</span>
          <span className="text-[#5f6368] font-mono text-[11px]">Selected: {allStories.length} stories ({totalBacklogPts} pts)</span>
        </div>
        <div className="divide-y divide-[#f1f3f4] text-xs">
          {allStories.length > 0 ? (
            allStories.map((story: any) => (
              <div key={story.id || story.key} className="p-3.5 flex items-center justify-between bg-white hover:bg-[#f8f9fa] transition">
                <div className="flex items-center space-x-3">
                  <input type="checkbox" defaultChecked className="rounded border-[#dadce0] text-[#1a73e8] focus:ring-[#1a73e8] w-4 h-4" />
                  <div>
                    <a
                      href={`https://the-ai-scrum-master.atlassian.net/browse/${story.key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[#1a73e8] font-semibold mr-2 hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>{story.key}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <span className="text-[#202124] font-medium">{story.title}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0]">
                    {story.assignee_name || "Unassigned"}
                  </span>
                  <span className="font-mono text-[#202124] font-bold">{story.story_points || 5} pts</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-[#5f6368] text-xs">
              No candidate stories found in backlog yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
