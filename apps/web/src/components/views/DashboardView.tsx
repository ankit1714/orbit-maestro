'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Zap,
  CheckCircle2,
  ExternalLink,
  Layers,
  CheckSquare,
  Clock,
  Calendar,
  Milestone,
  ListTodo,
  ArrowUpRight,
} from 'lucide-react';
import { api, getJiraBoardUrl, getJiraBrowseUrl } from '@/lib/api';

interface DashboardViewProps {
  project: any;
  sprint: any;
  backlog?: any;
  healthMatrix: any;
  flashHealth: any;
  activityLogs: any[];
  actionsDecisions?: any[];
  onSwitchView: (view: string) => void;
  onOpenSimulator: () => void;
}

const extractJiraTicket = (item: any, backlog?: any, project?: any): string => {
  if (item.jira_ticket) return item.jira_ticket;
  if (item.target_entity_id && /^[A-Z]{2,10}-\d+$/.test(item.target_entity_id)) {
    return item.target_entity_id;
  }
  const combined = `${item.title || ''} ${item.description || ''} ${item.notes || ''} ${item.target_entity || ''}`;
  const match = combined.match(/\b([A-Z]{2,10}-\d+)\b/);
  if (match) return match[1];

  // Try matching backlog stories
  const allStories: any[] = [];
  if (backlog?.epics) {
    for (const epic of backlog.epics) {
      if (Array.isArray(epic.stories)) {
        allStories.push(...epic.stories);
      }
    }
  }

  if (allStories.length > 0) {
    const textLower = combined.toLowerCase();
    for (const story of allStories) {
      const words = (story.title || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
      if (words.filter((w: string) => textLower.includes(w)).length >= 2) {
        return story.key;
      }
    }
    if (textLower.includes('navigation') || textLower.includes('map')) {
      const s = allStories.find((st) => (st.title || '').toLowerCase().includes('map') || (st.title || '').toLowerCase().includes('navigation'));
      if (s) return s.key;
    }
    if (textLower.includes('connection') || textLower.includes('conn_src')) {
      const s = allStories.find((st) => (st.title || '').toLowerCase().includes('connection'));
      if (s) return s.key;
    }
    if (textLower.includes('confluence') || textLower.includes('martin')) {
      const s = allStories.find((st) => (st.title || '').toLowerCase().includes('confluence'));
      if (s) return s.key;
    }
    if (textLower.includes('driver') || textLower.includes('mobile') || textLower.includes('capacitor')) {
      const s = allStories.find((st) => (st.key || '').includes('2'));
      if (s) return s.key;
    }
    if (allStories[0]?.key) return allStories[0].key;
  }

  const pKey = project?.jira_settings?.project_key || project?.key || 'HM';
  return `${pKey}-1`;
};

const formatActionDate = (rawDate?: string) => {
  if (!rawDate) return 'Recent';
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return rawDate;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return rawDate;
  }
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  project,
  sprint,
  backlog,
  healthMatrix,
  flashHealth,
  activityLogs,
  actionsDecisions,
  onSwitchView,
  onOpenSimulator,
}) => {
  const isOffTrack = flashHealth?.status === "OFF_TRACK";
  const isAtRisk = flashHealth?.status === "AT_RISK";

  const totalPoints = backlog?.total_points ?? sprint?.planned_points ?? 0;
  const deliveredPoints = sprint?.delivered_points ?? 0;
  const completionPct = totalPoints > 0 ? Math.round((deliveredPoints / totalPoints) * 100) : 0;
  const totalTasks = backlog?.total_tasks ?? 0;
  const totalEpics = backlog?.total_epics ?? 0;
  const isJira = Boolean(
    (project?.mode === "ENTERPRISE_SYNC" && project?.jira_settings?.enabled) ||
    project?.jira_settings?.instance_url ||
    project?.jira_settings?.project_key ||
    project?.jira_project_link
  );
  const jiraKey = project?.jira_settings?.project_key || project?.key || "";

  const [actionsList, setActionsList] = useState<any[]>(actionsDecisions || []);

  useEffect(() => {
    if (actionsDecisions && actionsDecisions.length > 0) {
      setActionsList(actionsDecisions);
      return;
    }
    if (project?.id) {
      api.getActionsAndDecisions(project.id)
        .then((items) => {
          if (Array.isArray(items)) setActionsList(items);
        })
        .catch(() => {});
    }
  }, [project?.id, actionsDecisions]);

  const handleGoToActionDecision = (item: any) => {
    if (typeof window !== 'undefined' && item?.id) {
      sessionStorage.setItem('highlight_action_decision', item.id);
      window.dispatchEvent(new CustomEvent('focus-action-decision', { detail: { id: item.id } }));
    }
    onSwitchView('governance');
  };

  const timelineItems = useMemo(() => {
    if (actionsList && actionsList.length > 0) {
      return [...actionsList].sort((a: any, b: any) => {
        const timeA = new Date(a.meeting_date || a.created_at || a.updated_at || 0).getTime();
        const timeB = new Date(b.meeting_date || b.created_at || b.updated_at || 0).getTime();
        return timeB - timeA;
      });
    }

    if (activityLogs && activityLogs.length > 0) {
      return activityLogs.map((log: any) => {
        const isDec = log.action_type === 'APPROVAL_REJECTED' || (log.description || '').toLowerCase().includes('decision');
        const isPend = log.action_type === 'APPROVAL_REQUESTED';
        return {
          id: log.id,
          type: isDec ? 'DECISION' : 'ACTION_ITEM',
          status: isPend ? 'PENDING' : 'COMPLETED',
          title: log.description,
          description: log.description,
          created_at: log.timestamp,
          timestamp: log.timestamp,
          target_entity_id: log.target_entity,
        };
      });
    }

    return [];
  }, [actionsList, activityLogs]);

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
              href={getJiraBoardUrl(project, sprint)}
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

        {/* Right Col: Action & Decision Timeline Feed */}
        <div className="p-5 rounded-xl border border-[#dadce0] bg-white shadow-[0_1px_2px_0_rgba(60,64,67,0.15)] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#dadce0] mb-3">
            <h3 className="text-xs font-bold text-[#202124] uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#1a73e8]" />
              Action & Decision Timeline
            </h3>
            <span className="text-[10px] font-mono text-[#5f6368] bg-[#f1f3f4] px-1.5 py-0.5 rounded font-semibold">
              Live Stream
            </span>
          </div>

          <div className="space-y-2.5 text-xs overflow-y-auto max-h-[360px] pr-1">
            {timelineItems && timelineItems.length > 0 ? (
              timelineItems.map((item: any, idx: number) => {
                const isDecision = (item.type || item.item_type) === 'DECISION';
                const isPending = item.status === 'PENDING' || !item.status;
                const jiraTicket = extractJiraTicket(item, backlog, project);
                const jiraUrl = getJiraBrowseUrl(jiraTicket, project);
                const rawDate = item.meeting_date || item.created_at || item.updated_at || item.timestamp;
                const formattedDate = formatActionDate(rawDate);
                const actionTypeLabel = isDecision ? 'Decision' : 'Action';
                const statusLabel = isPending ? 'pending' : 'taken';
                const itemPhrase = `${actionTypeLabel} ${statusLabel} on ${jiraTicket}`;

                return (
                  <div
                    key={item.id || idx}
                    className="p-3.5 rounded-lg bg-[#f8f9fa] border border-[#dadce0] space-y-2 hover:border-[#bdc1c6] hover:bg-white hover:shadow-sm transition"
                  >
                    {/* Top Row: Type Badge, Status & Date of Action/Decision */}
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase font-mono border flex items-center gap-1 ${
                            isDecision
                              ? 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]'
                              : 'bg-[#e8f0fe] text-[#1a73e8] border-[#d2e3fc]'
                          }`}
                        >
                          {isDecision ? <Milestone className="w-2.5 h-2.5" /> : <ListTodo className="w-2.5 h-2.5" />}
                          <span>{isDecision ? 'Decision' : 'Action'}</span>
                        </span>

                        <span
                          className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border ${
                            isPending
                              ? 'bg-[#fef7e0] text-[#b06000] border-[#feefc3]'
                              : 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]'
                          }`}
                        >
                          {isPending ? 'Pending' : 'Taken'}
                        </span>
                      </div>

                      {/* Date of Action / Decision */}
                      <div className="flex items-center gap-1 text-[10px] text-[#5f6368] font-mono">
                        <Clock className="w-3 h-3 text-[#80868b]" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>

                    {/* Middle Row: Action/Decision pending/taken on <JIRA Ticket num> as link */}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleGoToActionDecision(item)}
                        className="group/link text-left text-xs font-bold text-[#1a73e8] hover:text-[#1557b0] transition flex items-center gap-1"
                        title="Go to this action/decision in Governance hub"
                      >
                        <span className="underline decoration-[#1a73e8]/30 group-hover/link:decoration-[#1a73e8]">
                          {itemPhrase}
                        </span>
                        <ArrowUpRight className="w-3 h-3 text-[#1a73e8] opacity-70 group-hover/link:opacity-100 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition" />
                      </button>

                      {jiraUrl && (
                        <a
                          href={jiraUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[#5f6368] hover:text-[#174ea6] bg-white hover:bg-[#e8f0fe] px-1.5 py-0.5 rounded border border-[#dadce0] hover:border-[#d2e3fc] transition shadow-2xs"
                          title={`View ${jiraTicket} in Jira`}
                        >
                          <span>{jiraTicket}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    {/* Bottom Row: Detailed description / note */}
                    <p className="text-[#3c4043] text-xs leading-relaxed line-clamp-2">
                      {item.description || item.title}
                    </p>

                    {/* Source meeting if present */}
                    {item.meeting_title && (
                      <div className="text-[10px] text-[#5f6368] font-mono flex items-center gap-1 pt-0.5 border-t border-[#dadce0]/50 truncate">
                        <span className="text-[#80868b]">Source:</span>
                        <span className="truncate">{item.meeting_title}</span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-[#5f6368] text-xs">
                No recent actions or decisions logged for this project yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
