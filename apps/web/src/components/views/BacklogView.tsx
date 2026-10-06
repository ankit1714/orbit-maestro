'use client';

import React, { useState } from 'react';
import { Layers, Bookmark, CheckSquare, AlertCircle, TestTube, ChevronDown, Plus, Sparkles, Inbox, FileText, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

interface BacklogViewProps {
  project: any;
  requirements: any;
  backlog: any;
  onRefresh: () => void;
  onSwitchView: (view: string) => void;
}

export const BacklogView: React.FC<BacklogViewProps> = ({
  project,
  requirements,
  backlog,
  onRefresh,
  onSwitchView,
}) => {
  const [generating, setGenerating] = useState(false);

  const epics = backlog?.epics || [];
  const hasBacklog = epics.length > 0;
  const hasRequirements = requirements && requirements.capabilities && requirements.capabilities.length > 0;

  const handleSynthesize = async () => {
    setGenerating(true);
    try {
      await api.generateBacklog(project.id, {
        "Requirement Clarification": "Grounded in Document Studio specification"
      });
      onRefresh();
    } catch (e) {
      console.warn("Backlog synthesis:", e);
      onRefresh();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-4 flex-1">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-brand-400 font-bold text-sm">[{project?.key}]</span>
            <h1 className="text-lg font-bold text-white">
              Traceable Product Backlog
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
              Linked to: {requirements?.document_title || "Document Studio PRD"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            4-Tier Requirement Traceability Matrix with Skill-Matched Assignments ({backlog?.total_points || 0} story points).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasRequirements && (
            <button
              onClick={handleSynthesize}
              disabled={generating}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-brand-500/20 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{generating ? "Synthesizing with Gemini..." : "Synthesize Backlog from PRD"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Requirement Source Banner */}
      {!hasRequirements && (
        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span>
              <strong>Requirements Pending:</strong> No specification document has been ingested yet for <strong>{project?.name}</strong>. Backlog items should be synthesized directly from requirements.
            </span>
          </div>
          <button
            onClick={() => onSwitchView('documents')}
            className="px-3 py-1 rounded bg-amber-400 text-surface-950 font-bold hover:bg-amber-300 transition text-[11px] flex items-center gap-1"
          >
            <span>Open Document Studio</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {hasBacklog ? (
        <div className="rounded-xl border border-zinc-800 bg-surface-900/60 overflow-hidden">
          <div className="grid grid-cols-12 bg-surface-950 px-4 py-2.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono border-b border-zinc-800">
            <div className="col-span-1">Key</div>
            <div className="col-span-4">Item Title & Hierarchy</div>
            <div className="col-span-2">Origin Trace (PRD §)</div>
            <div className="col-span-2">AI Suggested Assignee</div>
            <div className="col-span-1">Effort</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          <div className="divide-y divide-zinc-800/60 text-xs">
            {epics.map((epic: any) => (
              <React.Fragment key={epic.id || epic.key}>
                {/* EPIC ROW */}
                <div className="grid grid-cols-12 px-4 py-3 bg-zinc-900/40 items-center font-medium">
                  <div className="col-span-1 font-mono text-brand-400 font-bold">{epic.key}</div>
                  <div className="col-span-4 flex items-center space-x-2 text-white font-semibold">
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>{epic.title}</span>
                  </div>
                  <div className="col-span-2 font-mono text-[11px] text-zinc-400 truncate" title={epic.requirement_origin}>
                    {epic.requirement_origin || requirements?.document_title || "PRD Specs"}
                  </div>
                  <div className="col-span-2 text-zinc-400 text-[11px]">Sprint Core Team</div>
                  <div className="col-span-1 font-mono text-zinc-300">{epic.total_points || 13} pts</div>
                  <div className="col-span-1">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px]">
                      {epic.status || "In Progress"}
                    </span>
                  </div>
                  <div className="col-span-1 text-right text-zinc-500">···</div>
                </div>

                {/* USER STORIES */}
                {epic.stories?.map((story: any) => (
                  <React.Fragment key={story.id || story.key}>
                    <div className="grid grid-cols-12 px-4 py-2.5 bg-surface-900/20 items-center hover:bg-zinc-800/30 transition">
                      <div className="col-span-1 font-mono text-zinc-400 pl-4">{story.key}</div>
                      <div className="col-span-4 flex items-center space-x-2 text-zinc-200 pl-4">
                        <Bookmark className="w-3.5 h-3.5 text-blue-400" />
                        <span>{story.title}</span>
                      </div>
                      <div className="col-span-2 font-mono text-[11px] text-zinc-400 truncate" title={story.requirement_origin}>
                        {story.requirement_origin || "PRD §1.0"}
                      </div>
                      <div className="col-span-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-[9px] font-bold flex items-center justify-center text-white">
                          {(story.assignee_name || "DEV").substring(0, 2).toUpperCase()}
                        </span>
                        <span className="text-zinc-300 text-[11px]">{story.assignee_name || "Developer"}</span>
                        <span className="text-[9px] bg-emerald-500/15 text-emerald-300 px-1 rounded font-mono">
                          {story.skill_match_percentage || 92}% match
                        </span>
                      </div>
                      <div className="col-span-1 font-mono text-zinc-400">{story.story_points || 5} pts</div>
                      <div className="col-span-1">
                        <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-300 text-[10px]">
                          {story.status || "Active"}
                        </span>
                      </div>
                      <div className="col-span-1 text-right">
                        <button className="text-zinc-400 hover:text-white text-xs">Edit</button>
                      </div>
                    </div>

                    {/* SUBTASKS */}
                    {story.tasks?.map((task: any) => {
                      const isBlocked = task.status === "BLOCKED" || task.is_blocked;
                      return (
                        <div
                          key={task.id || task.key}
                          className={`grid grid-cols-12 px-4 py-2 items-center text-[11px] transition ${
                            isBlocked ? 'bg-rose-500/5 hover:bg-rose-500/10 border-l-2 border-rose-500' : 'bg-surface-950/40 hover:bg-zinc-800/20'
                          }`}
                        >
                          <div className={`col-span-1 font-mono pl-8 ${isBlocked ? 'text-rose-300' : 'text-zinc-500'}`}>
                            {task.key}
                          </div>
                          <div className="col-span-4 flex items-center space-x-2 text-zinc-300 pl-8">
                            {isBlocked ? (
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                            ) : task.task_type === "QA" ? (
                              <TestTube className="w-3 h-3 text-teal-400" />
                            ) : (
                              <CheckSquare className="w-3 h-3 text-emerald-400" />
                            )}
                            <span className={isBlocked ? 'text-white font-medium' : ''}>{task.title}</span>
                          </div>
                          <div className="col-span-2 font-mono text-[10px] text-zinc-500">{task.trace_ref || "AC-1"}</div>
                          <div className="col-span-2 text-zinc-400">{task.assignee_name || "Developer"}</div>
                          <div className="col-span-1 font-mono text-zinc-400">{task.effort_days || 1.5} d</div>
                          <div className="col-span-1">
                            <span
                              className={`px-1 py-0.5 rounded text-[10px] font-mono ${
                                isBlocked
                                  ? 'bg-rose-500/20 text-rose-300 font-bold'
                                  : task.status === "DONE"
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {task.status || "To Do"}
                            </span>
                          </div>
                          <div className="col-span-1 text-right text-zinc-500">···</div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-zinc-800 bg-surface-900/40 space-y-3">
          <Inbox className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Backlog Items Synthesized Yet</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {hasRequirements
              ? `Requirements for '${requirements.document_title}' are ready! Click below to synthesize traceable Epics, Stories with Gherkin ACs, and Subtasks.`
              : `Upload a PRD specification in Document Studio to automatically decompose requirements into Epics, Stories, and Tasks with Gherkin acceptance criteria.`}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            {!hasRequirements ? (
              <button
                onClick={() => onSwitchView('documents')}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md shadow-brand-500/20"
              >
                Open Document Studio & Upload Spec
              </button>
            ) : (
              <button
                onClick={handleSynthesize}
                disabled={generating}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md shadow-brand-500/20"
              >
                Synthesize Backlog from Ingested Spec
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
