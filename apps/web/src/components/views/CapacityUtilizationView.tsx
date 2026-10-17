'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Gauge,
  Users,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Clock,
  Layers,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Flame,
  Zap,
  Sprout,
  HelpCircle,
  RefreshCw,
  Sliders,
  Check,
  UserCheck,
  Inbox
} from 'lucide-react';
import { api, getJiraBoardUrl, getJiraBrowseUrl } from '@/lib/api';
import { useRole } from '@/lib/roleContext';

interface CapacityUtilizationViewProps {
  project: any;
  sprint: any;
  backlog: any;
  onSwitchView: (view: string) => void;
  onRefresh: () => void;
}

interface MemberTask {
  id: string;
  key: string;
  title: string;
  task_type: string;
  status: string;
  story_points: number;
  complexity: 'HIGH' | 'MEDIUM' | 'LOW';
  epic_title?: string;
  assignee_name: string;
  jira_url: string;
}

interface TeamMemberCapacity {
  id: string;
  name: string;
  email?: string;
  role: string;
  source: 'JIRA' | 'PROJECT' | 'FIRESTORE';
  assigned_story_points: number;
  total_tasks_count: number;
  max_story_points: number;
  utilization_pct: number;
  status: 'OVERLOADED' | 'OPTIMAL' | 'UNDERALLOCATED' | 'AVAILABLE';
  complexity_breakdown: {
    high: number;
    medium: number;
    low: number;
  };
  tasks: MemberTask[];
}

export const CapacityUtilizationView: React.FC<CapacityUtilizationViewProps> = ({
  project,
  sprint,
  backlog,
  onSwitchView,
  onRefresh,
}) => {
  const { role, profile } = useRole();
  const isAdminOrSM = role === 'ADMIN' || role === 'SCRUM_MASTER';

  // Configurable Sprint Duration (default 2 weeks / 14 days)
  const defaultWeeks = Math.max(1, Math.round(((sprint?.total_days || project?.sprint_duration_days || 14) / 7)));
  const [sprintWeeks, setSprintWeeks] = useState<number>(defaultWeeks || 2);
  const maxWeeklyCapacity = 16;
  const maxCapacityPerPerson = sprintWeeks * maxWeeklyCapacity; // e.g. 2 * 16 = 32 points

  // Interactive UI State
  const [jiraUsers, setJiraUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERLOADED' | 'OPTIMAL' | 'UNDERALLOCATED' | 'WITH_TASKS'>('ALL');
  const [sortBy, setSortBy] = useState<'POINTS_DESC' | 'LOAD_DESC' | 'NAME_ASC' | 'TASKS_DESC'>('POINTS_DESC');
  const [expandedMemberIds, setExpandedMemberIds] = useState<Record<string, boolean>>({});

  // 1. Fetch live Jira Project users + registered project roster
  useEffect(() => {
    if (project?.id) {
      setLoadingUsers(true);
      api.getProjectJiraUsers(project.id)
        .then((users) => {
          if (Array.isArray(users)) {
            setJiraUsers(users);
          }
        })
        .catch((err) => {
          console.warn('Could not load Jira project users:', err);
        })
        .finally(() => setLoadingUsers(false));
    }
  }, [project?.id]);

  // Sync sprint weeks when project changes
  useEffect(() => {
    const calculatedWeeks = Math.max(1, Math.round(((sprint?.total_days || project?.sprint_duration_days || 14) / 7)));
    setSprintWeeks(calculatedWeeks || 2);
  }, [sprint?.total_days, project?.sprint_duration_days]);

  // 2. Extract all tasks and stories from the backlog
  const allSprintItems = useMemo(() => {
    const items: MemberTask[] = [];
    const epics = backlog?.epics || [];

    epics.forEach((epic: any) => {
      (epic.stories || []).forEach((story: any) => {
        const pts = Number(story.story_points) || 3;
        let complexity: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
        if (pts >= 8) complexity = 'HIGH';
        else if (pts <= 2) complexity = 'LOW';

        const assignee = (story.assignee_name || '').trim();

        items.push({
          id: story.id || story.key,
          key: story.key,
          title: story.title,
          task_type: 'STORY',
          status: story.status || 'To Do',
          story_points: pts,
          complexity,
          epic_title: epic.title,
          assignee_name: assignee || 'Unassigned',
          jira_url: story.jira_url || getJiraBrowseUrl(story.key, project),
        });

        // Also process nested subtasks
        (story.tasks || []).forEach((task: any) => {
          const tPts = Math.max(1, Math.round(Number(task.effort_days || 1) * 2));
          let tComplexity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
          if (tPts >= 8) tComplexity = 'HIGH';
          else if (tPts >= 3) tComplexity = 'MEDIUM';

          const tAssignee = (task.assignee_name || story.assignee_name || '').trim();

          items.push({
            id: task.id || task.key,
            key: task.key,
            title: task.title,
            task_type: task.task_type || 'SUBTASK',
            status: task.status || 'To Do',
            story_points: tPts,
            complexity: tComplexity,
            epic_title: epic.title,
            assignee_name: tAssignee || 'Unassigned',
            jira_url: task.jira_url || getJiraBrowseUrl(task.key, project),
          });
        });
      });
    });

    return items;
  }, [backlog, project]);

  // 3. Synthesize Team Member Capacity Metrics
  const teamCapacityData: TeamMemberCapacity[] = useMemo(() => {
    const memberMap = new Map<string, TeamMemberCapacity>();

    const getOrInitMember = (name: string, role = 'Team Member', email = '', source: 'JIRA' | 'PROJECT' | 'FIRESTORE' = 'PROJECT') => {
      const cleanName = name.trim();
      const lower = cleanName.toLowerCase();
      if (!memberMap.has(lower)) {
        memberMap.set(lower, {
          id: `member-${lower.replace(/\s+/g, '-')}`,
          name: cleanName,
          email,
          role,
          source,
          assigned_story_points: 0,
          total_tasks_count: 0,
          max_story_points: maxCapacityPerPerson,
          utilization_pct: 0,
          status: 'AVAILABLE',
          complexity_breakdown: { high: 0, medium: 0, low: 0 },
          tasks: [],
        });
      }
      return memberMap.get(lower)!;
    };

    // Populate from live Jira Users API
    jiraUsers.forEach((u) => {
      if (u.name && u.name !== 'Unassigned') {
        getOrInitMember(u.name, u.role || 'Jira Engineer', u.email, u.source || 'JIRA');
      }
    });

    // Populate from Project Registered Team Members
    const projTeam = project?.team_members || [];
    projTeam.forEach((m: any) => {
      if (m.name && m.name !== 'Unassigned') {
        getOrInitMember(m.name, m.role || 'Developer', m.email, 'PROJECT');
      }
    });

    // Assign tasks to members
    allSprintItems.forEach((item) => {
      const rawAssignee = (item.assignee_name || '').trim();
      if (!rawAssignee || rawAssignee.toLowerCase() === 'unassigned') {
        // Collect into unassigned queue
        return;
      }

      // Fuzzy match known member or initialize
      let targetMember: TeamMemberCapacity | undefined;
      for (const [key, mem] of memberMap.entries()) {
        if (key.includes(rawAssignee.toLowerCase()) || rawAssignee.toLowerCase().includes(key)) {
          targetMember = mem;
          break;
        }
      }

      if (!targetMember) {
        targetMember = getOrInitMember(rawAssignee, 'Engineer', '', 'JIRA');
      }

      targetMember.tasks.push(item);
      targetMember.assigned_story_points += item.story_points;
      targetMember.total_tasks_count += 1;

      if (item.complexity === 'HIGH') targetMember.complexity_breakdown.high += 1;
      else if (item.complexity === 'MEDIUM') targetMember.complexity_breakdown.medium += 1;
      else targetMember.complexity_breakdown.low += 1;
    });

    // Compute utilization & health status
    const list: TeamMemberCapacity[] = [];
    memberMap.forEach((mem) => {
      const util = Math.round((mem.assigned_story_points / maxCapacityPerPerson) * 100);
      mem.utilization_pct = util;
      mem.max_story_points = maxCapacityPerPerson;

      if (util > 100) {
        mem.status = 'OVERLOADED';
      } else if (util >= 70) {
        mem.status = 'OPTIMAL';
      } else if (util > 0) {
        mem.status = 'UNDERALLOCATED';
      } else {
        mem.status = 'AVAILABLE';
      }

      list.push(mem);
    });

    return list;
  }, [jiraUsers, project?.team_members, allSprintItems, maxCapacityPerPerson]);

  // Unassigned tasks list
  const unassignedTasks = useMemo(() => {
    return allSprintItems.filter(
      (item) => !item.assignee_name || item.assignee_name.toLowerCase() === 'unassigned'
    );
  }, [allSprintItems]);

  const unassignedPoints = useMemo(() => {
    return unassignedTasks.reduce((sum, t) => sum + t.story_points, 0);
  }, [unassignedTasks]);

  // Filter & Sort
  const filteredMembers = useMemo(() => {
    return teamCapacityData
      .filter((m) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = m.name.toLowerCase().includes(q);
          const matchRole = m.role.toLowerCase().includes(q);
          const matchTask = m.tasks.some((t) => t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q));
          if (!matchName && !matchRole && !matchTask) return false;
        }

        // Status tab filter
        if (statusFilter === 'OVERLOADED') return m.status === 'OVERLOADED';
        if (statusFilter === 'OPTIMAL') return m.status === 'OPTIMAL';
        if (statusFilter === 'UNDERALLOCATED') return m.status === 'UNDERALLOCATED' || m.status === 'AVAILABLE';
        if (statusFilter === 'WITH_TASKS') return m.total_tasks_count > 0;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'POINTS_DESC') return b.assigned_story_points - a.assigned_story_points;
        if (sortBy === 'LOAD_DESC') return b.utilization_pct - a.utilization_pct;
        if (sortBy === 'TASKS_DESC') return b.total_tasks_count - a.total_tasks_count;
        return a.name.localeCompare(b.name);
      });
  }, [teamCapacityData, searchQuery, statusFilter, sortBy]);

  // High-Level Sprint Capacity Stats
  const teamStats = useMemo(() => {
    const totalMembers = teamCapacityData.length;
    const totalAssignedPts = teamCapacityData.reduce((acc, m) => acc + m.assigned_story_points, 0);
    const totalCapacityPts = totalMembers * maxCapacityPerPerson;
    const teamUtilPct = totalCapacityPts > 0 ? Math.round((totalAssignedPts / totalCapacityPts) * 100) : 0;
    const overloadedCount = teamCapacityData.filter((m) => m.status === 'OVERLOADED').length;
    const optimalCount = teamCapacityData.filter((m) => m.status === 'OPTIMAL').length;
    const underCount = teamCapacityData.filter((m) => m.status === 'UNDERALLOCATED' || m.status === 'AVAILABLE').length;

    const highComplexityCount = allSprintItems.filter((i) => i.complexity === 'HIGH').length;
    const medComplexityCount = allSprintItems.filter((i) => i.complexity === 'MEDIUM').length;
    const lowComplexityCount = allSprintItems.filter((i) => i.complexity === 'LOW').length;

    return {
      totalMembers,
      totalAssignedPts,
      totalCapacityPts,
      teamUtilPct,
      overloadedCount,
      optimalCount,
      underCount,
      highComplexityCount,
      medComplexityCount,
      lowComplexityCount,
    };
  }, [teamCapacityData, maxCapacityPerPerson, allSprintItems]);

  // Toggle Accordions
  const toggleAccordion = (memberId: string) => {
    setExpandedMemberIds((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    teamCapacityData.forEach((m) => (next[m.id] = true));
    next['unassigned'] = true;
    setExpandedMemberIds(next);
  };

  const collapseAll = () => {
    setExpandedMemberIds({});
  };

  // Status Styling Helpers
  const getStatusBadge = (status: TeamMemberCapacity['status']) => {
    switch (status) {
      case 'OVERLOADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf]">
            <Flame className="w-3.5 h-3.5 text-[#c5221f]" />
            OVERLOADED
          </span>
        );
      case 'OPTIMAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-mono bg-[#e6f4ea] text-[#137333] border border-[#ceead6]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#137333]" />
            OPTIMAL (70-100%)
          </span>
        );
      case 'UNDERALLOCATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-mono bg-[#fef7e0] text-[#b06000] border border-[#feefc3]">
            <Zap className="w-3.5 h-3.5 text-[#b06000]" />
            UNDERALLOCATED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal font-mono bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]">
            <Sprout className="w-3.5 h-3.5 text-[#5f6368]" />
            AVAILABLE (0%)
          </span>
        );
    }
  };

  const getProgressColor = (pct: number) => {
    if (pct > 100) return 'bg-gradient-to-r from-[#ea4335] to-[#c5221f]';
    if (pct >= 70) return 'bg-gradient-to-r from-[#34a853] to-[#137333]';
    if (pct > 0) return 'bg-gradient-to-r from-[#fbbc04] to-[#f29900]';
    return 'bg-[#dadce0]';
  };

  const getComplexityBadge = (complexity: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (complexity) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf]">
            <Flame className="w-3 h-3" /> High (8+ pts)
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-medium bg-[#fef7e0] text-[#b06000] border border-[#feefc3]">
            <Zap className="w-3 h-3" /> Med (3-5 pts)
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-normal bg-[#e6f4ea] text-[#137333] border border-[#ceead6]">
            <Sprout className="w-3 h-3" /> Low (1-2 pts)
          </span>
        );
    }
  };

  // Access Control Guard
  if (!isAdminOrSM) {
    return (
      <div className="p-8 max-w-xl mx-auto w-full flex-1 flex flex-col items-center justify-center text-center space-y-4 my-auto">
        <div className="w-16 h-16 rounded-2xl bg-[#fce8e6] border border-[#fad2cf] flex items-center justify-center text-[#c5221f] shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[#202124]">Access Restricted</h2>
          <p className="text-xs text-[#5f6368] leading-relaxed">
            The <strong>Sprint Capacity Utilization Dashboard</strong> contains team workload allocations, story point complexity balances, and velocity guardrails.
            Access is reserved exclusively for <strong>ADMIN</strong> and <strong>SCRUM MASTER</strong> roles.
          </p>
        </div>
        <div className="pt-2 flex gap-3">
          <button
            onClick={() => onSwitchView('dashboard')}
            className="px-4 py-2 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-semibold shadow-sm transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const jiraKey = project?.jira_settings?.project_key || project?.key || 'HM';
  const jiraBoardUrl = getJiraBoardUrl(project, sprint);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* 1. Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#dadce0]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[#1a73e8] font-bold text-sm bg-[#e8f0fe] px-2 py-0.5 rounded border border-[#d2e3fc]">
              [{jiraKey}]
            </span>
            <h1 className="text-xl font-bold text-[#202124] tracking-tight flex items-center gap-2">
              <Gauge className="w-5 h-5 text-[#1a73e8]" />
              Sprint Capacity Utilization
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#ceead6] font-medium flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#137333] animate-pulse" />
              Live Jira Sync
            </span>
          </div>
          <p className="text-xs text-[#5f6368]">
            Workload allocation & task complexity breakdown for <strong>{project?.name || 'Current Project'}</strong>.
            Standard capacity threshold: <strong>16 story points/week</strong> ({maxCapacityPerPerson} pts max for a {sprintWeeks}-week sprint).
          </p>
        </div>

        {/* Sprint Duration & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sprint Weeks Adjuster */}
          <div className="flex items-center gap-1.5 bg-white border border-[#dadce0] rounded-xl px-2.5 py-1 text-xs shadow-sm">
            <Clock className="w-3.5 h-3.5 text-[#5f6368]" />
            <span className="text-[#5f6368] font-medium">Sprint Length:</span>
            <div className="flex gap-1 ml-1">
              {[1, 2, 3, 4].map((wk) => (
                <button
                  key={wk}
                  onClick={() => setSprintWeeks(wk)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                    sprintWeeks === wk
                      ? 'bg-[#1a73e8] text-white shadow-xs'
                      : 'bg-[#f1f3f4] text-[#3c4043] hover:bg-[#e8eaed]'
                  }`}
                  title={`${wk} week${wk > 1 ? 's' : ''} = ${wk * 16} story points max per member`}
                >
                  {wk}W ({wk * 16} pts)
                </button>
              ))}
            </div>
          </div>

          <a
            href={jiraBoardUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl border border-[#d2e3fc] bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#174ea6] text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <span>Open Jira Board</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-xl border border-[#dadce0] bg-white hover:bg-[#f1f3f4] text-[#5f6368] hover:text-[#202124] shadow-sm transition"
            title="Refresh live tickets and users"
          >
            <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin text-[#1a73e8]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Executive KPI & Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Utilization */}
        <div className="p-4 rounded-2xl bg-white border border-[#dadce0] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5f6368]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Team Utilization</span>
            <Gauge className="w-4 h-4 text-[#1a73e8]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#202124]">{teamStats.teamUtilPct}%</span>
            <span className="text-xs text-[#5f6368] font-mono">
              ({teamStats.totalAssignedPts} / {teamStats.totalCapacityPts} pts)
            </span>
          </div>
          <div className="w-full bg-[#f1f3f4] h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(teamStats.teamUtilPct)}`}
              style={{ width: `${Math.min(teamStats.teamUtilPct, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-[#5f6368]">
            {teamStats.totalCapacityPts - teamStats.totalAssignedPts > 0
              ? `${teamStats.totalCapacityPts - teamStats.totalAssignedPts} pts available for commitment`
              : 'Sprint is fully loaded or over capacity'}
          </p>
        </div>

        {/* Workload Health Breakdown */}
        <div className="p-4 rounded-2xl bg-white border border-[#dadce0] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5f6368]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Workload Health</span>
            <Users className="w-4 h-4 text-[#137333]" />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="text-center p-2 rounded-xl bg-[#fce8e6] border border-[#fad2cf]">
              <span className="block text-lg font-bold font-mono text-[#c5221f]">{teamStats.overloadedCount}</span>
              <span className="text-[10px] text-[#c5221f] font-medium leading-none">Overload</span>
            </div>
            <div className="text-center p-2 rounded-xl bg-[#e6f4ea] border border-[#ceead6]">
              <span className="block text-lg font-bold font-mono text-[#137333]">{teamStats.optimalCount}</span>
              <span className="text-[10px] text-[#137333] font-medium leading-none">Optimal</span>
            </div>
            <div className="text-center p-2 rounded-xl bg-[#fef7e0] border border-[#feefc3]">
              <span className="block text-lg font-bold font-mono text-[#b06000]">{teamStats.underCount}</span>
              <span className="text-[10px] text-[#b06000] font-medium leading-none">Under</span>
            </div>
          </div>
          <p className="text-[11px] text-[#5f6368] text-center pt-0.5">
            Across {teamStats.totalMembers} discovered team members
          </p>
        </div>

        {/* Task Complexity Distribution */}
        <div className="p-4 rounded-2xl bg-white border border-[#dadce0] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5f6368]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Complexity Balance</span>
            <TrendingUp className="w-4 h-4 text-[#e37400]" />
          </div>
          <div className="space-y-1.5 pt-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[#c5221f] font-medium">
                <Flame className="w-3 h-3" /> High (8+ pts):
              </span>
              <span className="font-mono font-bold text-[#202124]">{teamStats.highComplexityCount} tasks</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[#b06000] font-medium">
                <Zap className="w-3 h-3" /> Med (3-5 pts):
              </span>
              <span className="font-mono font-bold text-[#202124]">{teamStats.medComplexityCount} tasks</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[#137333] font-medium">
                <Sprout className="w-3 h-3" /> Low (1-2 pts):
              </span>
              <span className="font-mono font-bold text-[#202124]">{teamStats.lowComplexityCount} tasks</span>
            </div>
          </div>
        </div>

        {/* Unassigned Work Queue */}
        <div className="p-4 rounded-2xl bg-white border border-[#dadce0] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5f6368]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Unassigned Queue</span>
            <Inbox className="w-4 h-4 text-[#70757a]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#202124]">{unassignedTasks.length}</span>
            <span className="text-xs text-[#5f6368] font-mono">tickets ({unassignedPoints} pts)</span>
          </div>
          <p className="text-[11px] text-[#5f6368] leading-tight">
            {unassignedTasks.length > 0
              ? 'Unassigned work needs allocation to available engineers before sprint kickoff.'
              : 'Great job! 100% of sprint tickets are assigned to active team members.'}
          </p>
          {unassignedTasks.length > 0 && (
            <button
              onClick={() => {
                setExpandedMemberIds((prev) => ({ ...prev, unassigned: true }));
                const el = document.getElementById('unassigned-queue-card');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-[11px] text-[#1a73e8] hover:underline font-semibold flex items-center gap-1 pt-1"
            >
              <span>View Unassigned Tickets</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Scrum Master AI Advisor Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#e8f0fe] to-[#f8f9fa] border border-[#d2e3fc] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white border border-[#d2e3fc] text-[#1a73e8] shadow-xs">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold text-[#174ea6] uppercase tracking-wider">
              Scrum Master Capacity Intelligence
            </h3>
            <p className="text-xs text-[#202124]">
              {teamStats.overloadedCount > 0 ? (
                <span>
                  <strong>Alert:</strong> {teamStats.overloadedCount} engineer(s) exceed the 32 pt ({sprintWeeks}-week) threshold. Rebalance complex stories to underallocated peers.
                </span>
              ) : unassignedTasks.length > 0 ? (
                <span>
                  Team capacity is healthy! You have <strong>{unassignedPoints} story points</strong> in the unassigned queue that can be absorbed by available developers.
                </span>
              ) : (
                <span>
                  Optimal workload distribution across all engineers. All members are within healthy story point limits with zero unassigned sprint blockers.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onSwitchView('backlog')}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#f1f3f4] text-[#1a73e8] border border-[#dadce0] text-xs font-semibold shadow-xs transition"
          >
            Manage Backlog
          </button>
          <button
            onClick={() => onSwitchView('sprint')}
            className="px-3 py-1.5 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-semibold shadow-xs transition"
          >
            Sprint Board
          </button>
        </div>
      </div>

      {/* 4. Controls, Filters & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: `All Members (${teamCapacityData.length})` },
            { id: 'OVERLOADED', label: `Overloaded (${teamStats.overloadedCount})` },
            { id: 'OPTIMAL', label: `Optimal (${teamStats.optimalCount})` },
            { id: 'UNDERALLOCATED', label: `Underallocated (${teamStats.underCount})` },
            { id: 'WITH_TASKS', label: 'Assigned Work' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                statusFilter === tab.id
                  ? 'bg-[#202124] text-white font-semibold shadow-sm'
                  : 'bg-white border border-[#dadce0] text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search, Sort & Expand/Collapse */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#5f6368]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name or task..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#dadce0] bg-white text-xs text-[#202124] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl border border-[#dadce0] bg-white text-xs text-[#3c4043] focus:outline-none focus:border-[#1a73e8]"
          >
            <option value="POINTS_DESC">Highest Points</option>
            <option value="LOAD_DESC">Highest Utilization</option>
            <option value="TASKS_DESC">Most Tasks</option>
            <option value="NAME_ASC">Name (A-Z)</option>
          </select>

          <button
            onClick={expandAll}
            className="px-2.5 py-1.5 rounded-xl border border-[#dadce0] bg-white hover:bg-[#f1f3f4] text-xs text-[#3c4043] font-medium transition"
            title="Expand all member task accordions"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-2.5 py-1.5 rounded-xl border border-[#dadce0] bg-white hover:bg-[#f1f3f4] text-xs text-[#3c4043] font-medium transition"
            title="Collapse all task accordions"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* 5. Team Members Capacity Accordion List */}
      <div className="space-y-3.5">
        {filteredMembers.length === 0 ? (
          <div className="p-12 text-center bg-white border border-[#dadce0] rounded-2xl space-y-2">
            <Users className="w-8 h-8 mx-auto text-[#80868b]" />
            <p className="text-sm font-semibold text-[#202124]">No team members match this filter</p>
            <p className="text-xs text-[#5f6368]">Try resetting the search query or status filter above.</p>
          </div>
        ) : (
          filteredMembers.map((member) => {
            const isExpanded = Boolean(expandedMemberIds[member.id]);
            const initials = member.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .substring(0, 2)
              .toUpperCase();

            return (
              <div
                key={member.id}
                className={`bg-white border rounded-2xl transition duration-200 shadow-sm overflow-hidden ${
                  member.status === 'OVERLOADED'
                    ? 'border-[#fad2cf] hover:border-[#ea4335]'
                    : isExpanded
                    ? 'border-[#1a73e8] ring-1 ring-[#1a73e8]/20'
                    : 'border-[#dadce0] hover:border-[#bdc1c6]'
                }`}
              >
                {/* Member Header Card */}
                <div
                  onClick={() => toggleAccordion(member.id)}
                  className="p-4 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#f8f9fa]/60 transition select-none"
                >
                  {/* Left Profile Section */}
                  <div className="flex items-center gap-3.5 min-w-[260px]">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#1a73e8] to-[#4285f4] text-white font-bold font-mono text-sm flex items-center justify-center shadow-xs shrink-0">
                      {initials}
                    </div>
                    <div className="space-y-0.5 truncate">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#202124] truncate">{member.name}</h4>
                        {getStatusBadge(member.status)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#5f6368]">
                        <span className="font-medium text-[#3c4043]">{member.role}</span>
                        {member.email && <span>• {member.email}</span>}
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-[#f1f3f4] text-[#5f6368]">
                          {member.source}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Workload Progress & Complexity */}
                  <div className="flex-1 max-w-md space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#3c4043] font-medium">
                        <strong>{member.assigned_story_points}</strong> of <strong>{member.max_story_points}</strong> pts allocated
                      </span>
                      <span className="font-mono font-bold text-xs text-[#202124]">
                        {member.utilization_pct}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-[#f1f3f4] h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getProgressColor(member.utilization_pct)}`}
                        style={{ width: `${Math.min(member.utilization_pct, 100)}%` }}
                      />
                    </div>

                    {/* Complexity Tags */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[10px] text-[#5f6368] font-medium">Complexity:</span>
                      {member.complexity_breakdown.high > 0 && (
                        <span className="text-[10px] font-mono text-[#c5221f] font-semibold bg-[#fce8e6] px-1.5 py-0.2 rounded border border-[#fad2cf]">
                          🔥 {member.complexity_breakdown.high} High
                        </span>
                      )}
                      {member.complexity_breakdown.medium > 0 && (
                        <span className="text-[10px] font-mono text-[#b06000] font-medium bg-[#fef7e0] px-1.5 py-0.2 rounded border border-[#feefc3]">
                          ⚡ {member.complexity_breakdown.medium} Med
                        </span>
                      )}
                      {member.complexity_breakdown.low > 0 && (
                        <span className="text-[10px] font-mono text-[#137333] font-medium bg-[#e6f4ea] px-1.5 py-0.2 rounded border border-[#ceead6]">
                          🌱 {member.complexity_breakdown.low} Low
                        </span>
                      )}
                      {member.total_tasks_count === 0 && (
                        <span className="text-[10px] font-mono text-[#5f6368]">No tasks assigned</span>
                      )}
                    </div>
                  </div>

                  {/* Right Action / Accordion Trigger */}
                  <div className="flex items-center gap-3 shrink-0 justify-between lg:justify-end">
                    <div className="text-right">
                      <span className="block font-mono text-xs font-bold text-[#202124]">
                        {member.total_tasks_count} {member.total_tasks_count === 1 ? 'Task' : 'Tasks'}
                      </span>
                      <span className="text-[10px] text-[#5f6368]">
                        {member.tasks.length > 0 ? 'Click to inspect' : 'Available capacity'}
                      </span>
                    </div>

                    <div className="w-8 h-8 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-center justify-center text-[#5f6368] transition">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Accordion Content: Task List */}
                {isExpanded && (
                  <div className="border-t border-[#dadce0] bg-[#fafafa]/80 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-[#3c4043] px-1">
                      <span>Tasks Assigned to {member.name} ({member.tasks.length})</span>
                      <span className="text-[11px] font-normal text-[#5f6368]">
                        Total Weight: <strong className="font-mono text-[#202124]">{member.assigned_story_points} Story Points</strong>
                      </span>
                    </div>

                    {member.tasks.length === 0 ? (
                      <div className="p-6 text-center rounded-xl bg-white border border-[#dadce0] space-y-1">
                        <Check className="w-6 h-6 mx-auto text-[#137333]" />
                        <p className="text-xs font-semibold text-[#202124]">No sprint tasks currently assigned to {member.name}</p>
                        <p className="text-[11px] text-[#5f6368]">
                          This member has <strong>{member.max_story_points} story points</strong> of available capacity for this sprint.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-[#dadce0] bg-white shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#f8f9fa] border-b border-[#dadce0] text-[10px] uppercase font-bold text-[#5f6368] font-mono">
                            <tr>
                              <th className="py-2.5 px-3">Ticket</th>
                              <th className="py-2.5 px-3">Title</th>
                              <th className="py-2.5 px-3">Type</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3 text-center">Complexity</th>
                              <th className="py-2.5 px-3 text-right">Points</th>
                              <th className="py-2.5 px-3 text-right">Jira</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f1f3f4]">
                            {member.tasks.map((task) => (
                              <tr key={task.id} className="hover:bg-[#f8f9fa] transition">
                                <td className="py-2.5 px-3 font-mono font-bold text-[#1a73e8]">
                                  <a
                                    href={task.jira_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:underline flex items-center gap-1"
                                  >
                                    <span>{task.key}</span>
                                    <ExternalLink className="w-3 h-3 text-[#1a73e8]" />
                                  </a>
                                </td>
                                <td className="py-2.5 px-3 text-[#202124] font-medium max-w-md truncate">
                                  {task.title}
                                </td>
                                <td className="py-2.5 px-3 text-[#5f6368] font-mono text-[11px]">
                                  {task.task_type}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0]">
                                    {task.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {getComplexityBadge(task.complexity)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-[#202124]">
                                  {task.story_points} pts
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <a
                                    href={task.jira_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a73e8] hover:text-[#1557b0]"
                                  >
                                    <span>Open</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* 6. Unassigned Work Queue Accordion */}
        {unassignedTasks.length > 0 && (
          <div
            id="unassigned-queue-card"
            className="bg-white border border-[#dadce0] rounded-2xl shadow-sm overflow-hidden"
          >
            <div
              onClick={() => toggleAccordion('unassigned')}
              className="p-4 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#f8f9fa]/60 transition select-none"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#f1f3f4] border border-[#dadce0] text-[#5f6368] font-bold font-mono text-sm flex items-center justify-center shrink-0">
                  <Inbox className="w-5 h-5 text-[#5f6368]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#202124]">Unassigned Sprint Backlog</h4>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#fef7e0] text-[#b06000] border border-[#feefc3]">
                      {unassignedTasks.length} Tickets Awaiting Owner
                    </span>
                  </div>
                  <p className="text-xs text-[#5f6368]">
                    Tickets committed to the project sprint that have not yet been assigned to a developer.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-[#202124] block">
                    {unassignedPoints} Story Points
                  </span>
                  <span className="text-[10px] text-[#5f6368]">Available for assignment</span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-center justify-center text-[#5f6368]">
                  {expandedMemberIds['unassigned'] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </div>

            {expandedMemberIds['unassigned'] && (
              <div className="border-t border-[#dadce0] bg-[#fafafa]/80 p-4 space-y-3">
                <div className="overflow-x-auto rounded-xl border border-[#dadce0] bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f8f9fa] border-b border-[#dadce0] text-[10px] uppercase font-bold text-[#5f6368] font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Ticket</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-center">Complexity</th>
                        <th className="py-2.5 px-3 text-right">Points</th>
                        <th className="py-2.5 px-3 text-right">Jira</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f3f4]">
                      {unassignedTasks.map((task) => (
                        <tr key={task.id} className="hover:bg-[#f8f9fa] transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#1a73e8]">
                            <a
                              href={task.jira_url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline flex items-center gap-1"
                            >
                              <span>{task.key}</span>
                              <ExternalLink className="w-3 h-3 text-[#1a73e8]" />
                            </a>
                          </td>
                          <td className="py-2.5 px-3 text-[#202124] font-medium max-w-md truncate">
                            {task.title}
                          </td>
                          <td className="py-2.5 px-3 text-[#5f6368] font-mono text-[11px]">
                            {task.task_type}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0]">
                              {task.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {getComplexityBadge(task.complexity)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#202124]">
                            {task.story_points} pts
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <a
                              href={task.jira_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a73e8] hover:text-[#1557b0]"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. Suggestions & Best Practices for Scrum Master */}
      <div className="p-5 rounded-2xl bg-white border border-[#dadce0] shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#202124]">
          <HelpCircle className="w-4 h-4 text-[#1a73e8]" />
          <span>Scrum Master Workload Guardrails & Best Practices</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#5f6368] leading-relaxed">
          <div className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0]">
            <strong className="text-[#202124] block mb-1">⚖️ Capacity Formula</strong>
            16 Story Points = 1 Full-Time Dev week (40 hrs). For 2-week sprints, cap individual allocations at 32 pts to allow 20% slack for code reviews, bugs, and ceremonies.
          </div>
          <div className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0]">
            <strong className="text-[#202124] block mb-1">🔥 Complexity Limit</strong>
            Avoid assigning more than one High-Complexity ticket (8+ pts) to a single engineer in one sprint to reduce spillover risks and context switching.
          </div>
          <div className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0]">
            <strong className="text-[#202124] block mb-1">🔄 Standup Sync</strong>
            Use this view during daily standups and sprint planning to detect underutilization early and pull tickets from the unassigned backlog into active progress.
          </div>
        </div>
      </div>
    </div>
  );
};
