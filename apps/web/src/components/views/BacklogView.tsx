'use client';

import React, { useState } from 'react';
import { Layers, Bookmark, CheckSquare, AlertCircle, TestTube, ChevronDown, Plus, Sparkles, Inbox, FileText, ArrowRight, UploadCloud, ExternalLink, CheckCircle2, X, RefreshCw, User, Calendar, Clock, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useRole } from '@/lib/roleContext';

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
  const { can, profile } = useRole();
  const [generating, setGenerating] = useState(false);
  const [uploadingJira, setUploadingJira] = useState(false);
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [targetJiraKey, setTargetJiraKey] = useState(
    project?.jira_settings?.project_key || "SCRUM"
  );
  const [jiraSyncResult, setJiraSyncResult] = useState<any>(null);
  const [jiraError, setJiraError] = useState<string | null>(null);

  const epics = backlog?.epics || [];
  const hasBacklog = epics.length > 0;
  const hasRequirements = requirements && requirements.capabilities && requirements.capabilities.length > 0;
  const isJiraSource = backlog?.source === "JIRA";

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

  const handleUploadJira = async () => {
    setUploadingJira(true);
    setJiraError(null);
    setJiraSyncResult(null);
    try {
      const res = await api.uploadBacklogToJira(project.id, {
        project_key: targetJiraKey.trim().toUpperCase()
      });
      setJiraSyncResult(res);
      onRefresh();
    } catch (err: any) {
      setJiraError(err?.message || "Failed to upload backlog to Jira.");
    } finally {
      setUploadingJira(false);
    }
  };

  const isJiraKey = (key?: string) => {
    if (!key) return false;
    return !key.startsWith("EPC-") && !key.startsWith("STY-") && !key.startsWith("TSK-") && key.includes("-");
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-4 flex-1">
      {/* Read Only Persona Banner */}
      {profile.permissions.isReadOnly && (
        <div className="p-3.5 rounded-xl border border-[#dadce0] bg-[#f8f9fa] flex items-center justify-between text-xs text-[#3c4043] shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#c5221f] shrink-0" />
            <span>Viewing as <strong className="text-[#202124]">{profile.title}</strong> — Backlog is in read-only observation mode. Backlog mutations and Jira sync are disabled.</span>
          </div>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white text-[#5f6368] border border-[#dadce0] font-bold shadow-sm">
            Read Only
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#dadce0]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-[#1a73e8] font-bold text-sm">[{project?.key || "SCRUM"}]</span>
            <h1 className="text-xl font-bold text-[#202124]">
              Traceable Product Backlog
            </h1>
            {isJiraSource ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc] font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#137333] animate-pulse" />
                Live Jira Sync: {backlog?.jira_project_key || "SCRUM"}
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#ceead6] font-medium">
                Linked to: {requirements?.document_title || "Document Studio PRD"}
              </span>
            )}
          </div>
          <p className="text-xs text-[#5f6368] mt-1">
            4-Tier Requirement Traceability Matrix with Skill-Matched Assignments ({backlog?.total_points || 0} story points, {backlog?.total_tasks || 0} tasks).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isJiraSource && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-lg border border-[#dadce0] bg-white hover:bg-[#f1f3f4] text-[#3c4043] text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Jira</span>
            </button>
          )}
          {hasBacklog && (
            can('canUploadToJira') ? (
              <button
                onClick={() => setShowJiraModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload to Jira</span>
              </button>
            ) : (
              <div
                className="px-3 py-1.5 rounded-lg bg-[#f1f3f4] border border-[#dadce0] text-[#80868b] text-xs flex items-center gap-1.5 cursor-not-allowed opacity-75"
                title={`Role "${profile.title}" cannot upload to Jira (Requires PO, SM, or Admin)`}
              >
                <Lock className="w-3.5 h-3.5 text-[#80868b]" />
                <span>Upload to Jira (PO/SM Only)</span>
              </div>
            )
          )}
          {hasRequirements && (
            can('canSynthesizeBacklog') ? (
              <button
                onClick={handleSynthesize}
                disabled={generating}
                className="px-3.5 py-1.5 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{generating ? "Synthesizing with Gemini..." : "Synthesize Backlog from PRD"}</span>
              </button>
            ) : (
              <div
                className="px-3 py-1.5 rounded-lg bg-[#f1f3f4] border border-[#dadce0] text-[#80868b] text-xs flex items-center gap-1.5 cursor-not-allowed opacity-75"
                title={`Role "${profile.title}" cannot synthesize backlog (Requires PO, SM, or Admin)`}
              >
                <Lock className="w-3.5 h-3.5 text-[#80868b]" />
                <span>Synthesize Backlog (PO/SM Only)</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Jira Live Source Banner */}
      {isJiraSource && (
        <div className="p-3.5 rounded-xl border border-[#d2e3fc] bg-[#e8f0fe] flex items-center justify-between text-xs text-[#1967d2] shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#137333] animate-pulse shrink-0" />
            <span>
              <strong>Direct Jira Cloud Sync:</strong> Displaying real-time issues from <strong>{backlog?.jira_project_key || "SCRUM"}</strong> ({backlog?.total_epics} Epics, {backlog?.total_stories} Stories, {backlog?.total_tasks} Tasks). Live status, assignees, created, and modified timestamps.
            </span>
          </div>
          <a
            href="https://the-ai-scrum-master.atlassian.net/jira/software/projects/SCRUM/boards"
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 rounded-lg border border-[#1a73e8] hover:bg-[#d2e3fc] text-[#1a73e8] font-semibold text-[11px] flex items-center gap-1 shrink-0 bg-white shadow-sm"
          >
            <span>Open in Jira</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Jira Sync Success Alert */}
      {jiraSyncResult && (
        <div className="p-4 rounded-xl border border-[#ceead6] bg-[#e6f4ea] text-[#137333] text-xs flex items-start justify-between shadow-sm">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#137333] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[#137333]">
                Backlog Uploaded Successfully to Jira [{jiraSyncResult.jira_project_key}]
              </p>
              <p className="text-[#3c4043]">
                Created: {jiraSyncResult.total_epics_synced} Epic(s), {jiraSyncResult.total_stories_synced} Story(ies), {jiraSyncResult.total_tasks_synced} Task(s).
              </p>
              <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                {jiraSyncResult.epics?.map((e: any) => (
                  <a
                    key={e.key}
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-[#1a73e8] border border-[#d2e3fc] hover:bg-[#e8f0fe] transition shadow-sm font-semibold"
                  >
                    <span>{e.key}: {e.title}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => setJiraSyncResult(null)} className="text-[#5f6368] hover:text-[#202124]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Requirement Source Banner */}
      {!hasRequirements && !isJiraSource && (
        <div className="p-3.5 rounded-xl border border-[#feefc3] bg-[#fef7e0] flex items-center justify-between text-xs text-[#b06000] shadow-sm">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#b06000]" />
            <span>
              <strong>Requirements Pending:</strong> No specification document has been ingested yet for <strong>{project?.name}</strong>. Backlog items should be synthesized directly from requirements.
            </span>
          </div>
          <button
            onClick={() => onSwitchView('documents')}
            className="px-3 py-1 rounded-lg bg-[#b06000] text-white font-bold hover:bg-[#8d4d00] transition text-[11px] flex items-center gap-1 shadow-sm"
          >
            <span>Open Document Studio</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {hasBacklog ? (
        <div className="rounded-2xl border border-[#dadce0] bg-white overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 bg-[#f8f9fa] px-4 py-3 text-[11px] font-semibold text-[#5f6368] uppercase tracking-wider font-mono border-b border-[#dadce0]">
            <div className="col-span-1">Key</div>
            <div className="col-span-3">Item Title & Hierarchy</div>
            <div className="col-span-2">Assigned To</div>
            <div className="col-span-1">Effort</div>
            <div className="col-span-2">Created Date</div>
            <div className="col-span-2">Last Modified</div>
            <div className="col-span-1 text-right">Status</div>
          </div>

          <div className="divide-y divide-[#f1f3f4] text-xs">
            {epics.map((epic: any) => (
              <React.Fragment key={epic.id || epic.key}>
                {/* EPIC ROW */}
                <div className="grid grid-cols-12 px-4 py-3 bg-[#f8f9fa]/80 items-center font-medium border-t border-[#dadce0]">
                  <div className="col-span-1 font-mono text-[#1a73e8] font-bold flex items-center gap-1">
                    {isJiraKey(epic.key) ? (
                      <a
                        href={`https://the-ai-scrum-master.atlassian.net/browse/${epic.key}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline flex items-center gap-0.5 text-[#1a73e8] font-bold"
                        title="View Epic in Jira"
                      >
                        <span>{epic.key}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      epic.key
                    )}
                  </div>
                  <div className="col-span-3 flex items-center space-x-2 text-[#202124] font-bold">
                    <ChevronDown className="w-3.5 h-3.5 text-[#5f6368] shrink-0" />
                    <Layers className="w-4 h-4 text-[#7b1fa2] shrink-0" />
                    <span className="truncate">{epic.title}</span>
                  </div>
                  <div className="col-span-2 text-[#5f6368] text-[11px]">Sprint Core Team</div>
                  <div className="col-span-1 font-mono text-[#202124] font-semibold">{epic.total_points || 0} pts</div>
                  <div className="col-span-2 text-[#5f6368] font-mono text-[11px] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#80868b]" />
                    <span>{formatDate(epic.created_at)}</span>
                  </div>
                  <div className="col-span-2 text-[#5f6368] font-mono text-[11px] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#80868b]" />
                    <span>{formatDate(epic.updated_at)}</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="px-2 py-0.5 rounded-full bg-[#f3e8fd] text-[#7b1fa2] border border-[#e1bee7] text-[10px] font-mono font-medium">
                      {epic.status || "Active"}
                    </span>
                  </div>
                </div>

                {/* USER STORIES */}
                {epic.stories?.map((story: any) => (
                  <React.Fragment key={story.id || story.key}>
                    <div className="grid grid-cols-12 px-4 py-2.5 bg-white items-center hover:bg-[#f8f9fa] transition">
                      <div className="col-span-1 font-mono text-[#5f6368] pl-4 flex items-center gap-1">
                        {isJiraKey(story.key) ? (
                          <a
                            href={`https://the-ai-scrum-master.atlassian.net/browse/${story.key}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline flex items-center gap-0.5 text-[#1a73e8] font-semibold"
                            title="View Story in Jira"
                          >
                            <span>{story.key}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          story.key
                        )}
                      </div>
                      <div className="col-span-3 flex items-center space-x-2 text-[#202124] pl-4">
                        <Bookmark className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" />
                        <span className="truncate font-medium">{story.title}</span>
                      </div>
                      <div className="col-span-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#1a73e8] text-[9px] font-bold flex items-center justify-center text-white shrink-0">
                          {(story.assignee_name || "DEV").substring(0, 2).toUpperCase()}
                        </span>
                        <span className="text-[#202124] text-[11px] truncate">{story.assignee_name || "Unassigned"}</span>
                        <span className="text-[9px] bg-[#e6f4ea] text-[#137333] border border-[#ceead6] px-1.5 py-0.2 rounded font-mono shrink-0 font-medium" title={story.skill_match_rationale || "AI Skill-Matched assignment"}>
                          {story.skill_match_percentage || 94}% match
                        </span>
                      </div>
                      <div className="col-span-1 font-mono text-[#5f6368]">{story.story_points || 5} pts</div>
                      <div className="col-span-2 text-[#5f6368] font-mono text-[11px]">
                        {formatDate(story.created_at)}
                      </div>
                      <div className="col-span-2 text-[#5f6368] font-mono text-[11px]">
                        {formatDate(story.updated_at)}
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-[#fef7e0] text-[#b06000] border border-[#feefc3] text-[10px] font-mono font-medium">
                          {story.status || "To Do"}
                        </span>
                      </div>
                    </div>

                    {/* SUBTASKS */}
                    {story.tasks?.map((task: any) => {
                      const isBlocked = task.status === "BLOCKED" || task.is_blocked;
                      return (
                        <div
                          key={task.id || task.key}
                          className={`grid grid-cols-12 px-4 py-2 items-center text-[11px] transition ${
                            isBlocked ? 'bg-[#fce8e6]/30 hover:bg-[#fce8e6]/50 border-l-2 border-[#c5221f]' : 'bg-[#fafafa] hover:bg-[#f1f3f4]'
                          }`}
                        >
                          <div className={`col-span-1 font-mono pl-8 flex items-center gap-1 ${isBlocked ? 'text-[#c5221f]' : 'text-[#80868b]'}`}>
                            {isJiraKey(task.key) ? (
                              <a
                                href={`https://the-ai-scrum-master.atlassian.net/browse/${task.key}`}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline flex items-center gap-0.5 text-[#1a73e8] font-semibold"
                                title="View Subtask in Jira"
                              >
                                <span>{task.key}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              task.key
                            )}
                          </div>
                          <div className="col-span-3 flex items-center space-x-2 text-[#3c4043] pl-8">
                            {isBlocked ? (
                              <AlertCircle className="w-3.5 h-3.5 text-[#c5221f] shrink-0" />
                            ) : task.task_type === "QA" ? (
                              <TestTube className="w-3.5 h-3.5 text-[#007b83] shrink-0" />
                            ) : (
                              <CheckSquare className="w-3.5 h-3.5 text-[#137333] shrink-0" />
                            )}
                            <span className={`truncate ${isBlocked ? 'text-[#c5221f] font-semibold' : ''}`}>{task.title}</span>
                          </div>
                          <div className="col-span-2 text-[#5f6368] truncate flex items-center gap-1.5">
                            <span className="truncate">{task.assignee_name || "Unassigned"}</span>
                            {task.assignee_name && task.assignee_name !== "Unassigned" && (
                              <span className="text-[9px] bg-[#e6f4ea] text-[#137333] border border-[#ceead6] px-1 rounded font-mono shrink-0 font-medium" title={task.skill_match_rationale || "AI Skill-Matched"}>
                                {task.skill_match_percentage || 92}%
                              </span>
                            )}
                          </div>
                          <div className="col-span-1 font-mono text-[#5f6368]">{task.effort_days || 1.5} d</div>
                          <div className="col-span-2 text-[#5f6368] font-mono text-[11px]">
                            {formatDate(task.created_at)}
                          </div>
                          <div className="col-span-2 text-[#5f6368] font-mono text-[11px]">
                            {formatDate(task.updated_at)}
                          </div>
                          <div className="col-span-1 text-right">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                                isBlocked
                                  ? 'bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf] font-bold'
                                  : task.status === "DONE" || task.status === "Done"
                                  ? 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]'
                                  : task.status === "In Progress"
                                  ? 'bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc]'
                                  : 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]'
                              }`}
                            >
                              {task.status || "To Do"}
                            </span>
                          </div>
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
        <div className="p-12 text-center rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-3">
          <Inbox className="w-10 h-10 text-[#80868b] mx-auto" />
          <h3 className="text-base font-bold text-[#202124]">No Backlog Items Synthesized Yet</h3>
          <p className="text-xs text-[#5f6368] max-w-md mx-auto">
            {hasRequirements
              ? `Requirements for '${requirements.document_title}' are ready! Click below to synthesize traceable Epics, Stories with Gherkin ACs, and Subtasks.`
              : `Upload a PRD specification in Document Studio to automatically decompose requirements into Epics, Stories, and Tasks with Gherkin acceptance criteria.`}
          </p>
          <div className="pt-2 flex justify-center gap-2.5">
            {!hasRequirements ? (
              <button
                onClick={() => onSwitchView('documents')}
                className="px-4 py-2 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold text-xs shadow-sm transition"
              >
                Open Document Studio & Upload Spec
              </button>
            ) : (
              <button
                onClick={handleSynthesize}
                disabled={generating}
                className="px-4 py-2 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold text-xs shadow-sm transition"
              >
                Synthesize Backlog from Ingested Spec
              </button>
            )}
          </div>
        </div>
      )}

      {/* Jira Upload Modal */}
      {showJiraModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#dadce0] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#dadce0]">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-[#1a73e8]" />
                <h3 className="font-bold text-[#202124] text-sm">Upload Backlog to Jira</h3>
              </div>
              <button
                onClick={() => setShowJiraModal(false)}
                className="text-[#5f6368] hover:text-[#202124]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#5f6368] leading-relaxed">
              Synchronize this 4-tier backlog hierarchy (Epics, Stories, Gherkin Acceptance Criteria, Subtasks) directly into your Jira Cloud workspace.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#5f6368] mb-1 font-medium">Jira Instance</label>
                <input
                  type="text"
                  disabled
                  value="https://the-ai-scrum-master.atlassian.net"
                  className="w-full px-3 py-2 rounded-xl bg-[#f8f9fa] border border-[#dadce0] text-[#5f6368] font-mono text-xs cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[#5f6368] mb-1 font-medium">Target Jira Project Key</label>
                <input
                  type="text"
                  value={targetJiraKey}
                  onChange={(e) => setTargetJiraKey(e.target.value)}
                  placeholder="e.g. SCRUM"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#dadce0] text-[#202124] font-mono text-xs focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
                />
                <span className="text-[11px] text-[#80868b] mt-1 block">
                  Suggested key: <strong>SCRUM</strong>.
                </span>
              </div>
            </div>

            {jiraError && (
              <div className="p-3 rounded-xl bg-[#fce8e6] border border-[#fad2cf] text-[#c5221f] text-xs">
                {jiraError}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                onClick={() => setShowJiraModal(false)}
                className="px-3.5 py-2 rounded-xl border border-[#dadce0] bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleUploadJira();
                  setShowJiraModal(false);
                }}
                disabled={uploadingJira || !targetJiraKey.trim()}
                className="px-4 py-2 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{uploadingJira ? "Uploading..." : "Confirm & Upload"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
