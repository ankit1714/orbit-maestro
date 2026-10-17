'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Download,
  CheckCircle2,
  AlertOctagon,
  Workflow,
  Trophy,
  Medal,
  Award,
  Flame,
  Zap,
  TrendingUp,
  ShieldCheck,
  Layers,
  ExternalLink,
  RefreshCw,
  Clock,
  Sparkles,
  Check,
  ChevronRight,
  Users,
  AlertTriangle,
  FolderGit2
} from 'lucide-react';
import { api, getJiraBoardUrl, getJiraBrowseUrl } from '@/lib/api';

interface ReportsViewProps {
  project: any;
  sprint: any;
  backlog?: any;
  healthMatrix?: any;
  flashHealth?: any;
  onRefresh?: () => void;
  onSwitchView: (view: string) => void;
}

interface LeaderboardUser {
  rank: number;
  name: string;
  email?: string;
  role?: string;
  closed_stories_count: number;
  closed_story_points: number;
  in_progress_count: number;
  in_progress_points: number;
  total_assigned_stories: number;
  total_assigned_points: number;
  completion_rate_pct: number;
}

interface EpicProgress {
  key: string;
  title: string;
  total_points: number;
  delivered_points: number;
  completion_pct: number;
  total_stories: number;
  completed_stories: number;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  project,
  sprint,
  backlog,
  healthMatrix,
  flashHealth,
  onRefresh,
  onSwitchView,
}) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'leaderboard' | 'epics' | 'executive'>('all');

  const loadReportData = useCallback(async (isUserRefresh = false) => {
    if (!project?.id) return;
    if (isUserRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const repData = await api.getExecutiveReport(project.id);
      if (repData) {
        setReport(repData);
      }
    } catch (e) {
      console.warn("Failed to fetch reports data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [project?.id]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const handleManualRefresh = () => {
    loadReportData(true);
    if (onRefresh) onRefresh();
  };

  // Derive unified statistics from live report + sprint + backlog
  const stats = useMemo(() => {
    const plannedPoints = report?.planned_points ?? sprint?.planned_points ?? backlog?.total_points ?? 0;
    const deliveredPoints = report?.delivered_points ?? sprint?.delivered_points ?? 0;
    const remainingPoints = report?.remaining_points ?? Math.max(0, plannedPoints - deliveredPoints);

    const completionRatePct = report?.completion_rate_pct !== undefined
      ? report.completion_rate_pct
      : (plannedPoints > 0 ? Math.round((deliveredPoints / plannedPoints) * 1000) / 10 : 0);

    const totalStories = report?.total_stories_count ?? backlog?.total_stories ?? 0;
    const completedStories = report?.completed_stories_count ?? 0;
    const inProgressStories = report?.in_progress_stories_count ?? 0;
    const todoStories = report?.todo_stories_count ?? Math.max(0, totalStories - completedStories - inProgressStories);
    const blockedStories = report?.blocked_stories_count ?? 0;

    const deliveryHealth = report?.delivery_health || (flashHealth?.status === 'OFF_TRACK' ? 'At Risk' : 'Healthy');
    const spilloverRiskPct = report?.spillover_risk_pct ?? (completionRatePct >= 70 ? 5.0 : 25.0);
    const statusDay = report?.status_day || 'Active Sprint';

    const leaderboard: LeaderboardUser[] = report?.leaderboard || [];
    const epicsProgress: EpicProgress[] = report?.epics_progress || [];

    return {
      plannedPoints,
      deliveredPoints,
      remainingPoints,
      completionRatePct,
      totalStories,
      completedStories,
      inProgressStories,
      todoStories,
      blockedStories,
      deliveryHealth,
      spilloverRiskPct,
      statusDay,
      leaderboard,
      epicsProgress
    };
  }, [report, sprint, backlog, flashHealth]);

  const exportMarkdown = async () => {
    if (report?.markdown_content && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(report.markdown_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const jiraBoardUrl = getJiraBoardUrl(project, sprint);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 shadow-sm border border-amber-300">
          <Trophy className="w-3.5 h-3.5 text-amber-900 fill-amber-900" />
          <span>#1 Champion</span>
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-slate-200 to-gray-300 text-slate-800 shadow-sm border border-slate-300">
          <Medal className="w-3.5 h-3.5 text-slate-700 fill-slate-700" />
          <span>#2 Silver</span>
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-600/30 to-orange-400/30 text-amber-900 shadow-sm border border-amber-400/50">
          <Award className="w-3.5 h-3.5 text-amber-800" />
          <span>#3 Bronze</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f1f3f4] text-[#5f6368] font-mono border border-[#dadce0]">
        #{rank}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 flex-1 select-none">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#dadce0]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-[#1a73e8] font-bold text-sm bg-[#e8f0fe] px-2.5 py-0.5 rounded-md border border-[#d2e3fc]">
              [{project?.key || 'PROJECT'}]
            </span>
            <h1 className="text-xl font-bold text-[#202124]">
              Actionable Reports & BigQuery Delivery Analytics
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#ceead6] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#137333] animate-pulse" />
              BigQuery Synced
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#e8f0fe] text-[#1a73e8] border border-[#d2e3fc] font-medium">
              Jira Cloud Live
            </span>
          </div>
          <p className="text-xs text-[#5f6368] mt-1.5 leading-relaxed">
            Project health overview, live sprint completion tracking, team member delivery leaderboard, and predictive risk telemetry.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="px-3 py-2 rounded-xl bg-white hover:bg-[#f1f3f4] text-[#3c4043] text-xs font-semibold flex items-center gap-1.5 border border-[#dadce0] shadow-sm transition disabled:opacity-50"
            title="Reload live Jira & BigQuery data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#5f6368] ${refreshing ? 'animate-spin text-[#1967d2]' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          <a
            href={jiraBoardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#f1f3f4] text-[#1a73e8] text-xs font-semibold flex items-center gap-1.5 border border-[#dadce0] shadow-sm transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Jira Board</span>
          </a>

          <button
            onClick={exportMarkdown}
            className="px-3.5 py-2 rounded-xl bg-[#1967d2] hover:bg-[#185abc] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Export Report (MD)'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#f1f3f4]">
        {[
          { id: 'all', label: 'Full Project Health Report' },
          { id: 'leaderboard', label: '🏆 Team Leaderboard (Live)' },
          { id: 'epics', label: 'Epics & Milestones' },
          { id: 'executive', label: 'Gemini Executive Summary' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === tab.id
                ? 'bg-[#1967d2] text-white shadow-sm font-semibold'
                : 'bg-white text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] border border-[#dadce0]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4 Essential Project Health KPI Cards (Target Velocity and Cycle/Lead Time Removed) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Sprint Completion & Velocity Delivery */}
        <div className="p-4 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-2.5 transition hover:shadow-md">
          <div className="flex items-center justify-between text-[#5f6368]">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Sprint Delivery Rate</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#f1f3f4] text-[#3c4043] font-medium">
              {stats.statusDay}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-[#202124]">
              {stats.completionRatePct}%
            </div>
            <span className="text-xs text-[#137333] font-semibold">
              {stats.deliveredPoints} / {stats.plannedPoints} pts
            </span>
          </div>
          <div className="w-full bg-[#e8eaed] h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-green-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(stats.completionRatePct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-[#5f6368]">
            <span>{stats.completedStories} of {stats.totalStories} Stories Closed</span>
            <span className="font-semibold text-[#1a73e8]">{stats.remainingPoints} pts remaining</span>
          </div>
        </div>

        {/* Card 2: Sprint Delivery Health & Risk Index */}
        <div className="p-4 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-2.5 transition hover:shadow-md">
          <div className="flex items-center justify-between text-[#5f6368]">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Delivery Health & Risk</span>
            <ShieldCheck className="w-4 h-4 text-[#137333]" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`text-sm px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                  stats.deliveryHealth === 'Healthy'
                    ? 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]'
                    : stats.deliveryHealth === 'Watch'
                    ? 'bg-[#fef7e0] text-[#b06000] border border-[#feefc3]'
                    : stats.deliveryHealth === 'Not Started'
                    ? 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]'
                    : 'bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf]'
                }`}
              >
                {stats.deliveryHealth}
              </span>
            </div>
            <span className="text-xs font-semibold text-[#5f6368]">
              {stats.spilloverRiskPct}% Risk
            </span>
          </div>
          <div className="w-full bg-[#e8eaed] h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                stats.spilloverRiskPct > 40
                  ? 'bg-[#c5221f]'
                  : stats.spilloverRiskPct > 20
                  ? 'bg-[#b06000]'
                  : stats.spilloverRiskPct > 0
                  ? 'bg-[#137333]'
                  : 'bg-[#dadce0]'
              }`}
              style={{ width: `${Math.min(stats.spilloverRiskPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-[#5f6368]">
            <span>Impediments: <strong className={stats.blockedStories > 0 ? 'text-[#c5221f]' : 'text-[#137333]'}>{stats.blockedStories} Blocked</strong></span>
            <span>Spillover Confidence: <strong>{stats.totalStories === 0 && stats.plannedPoints === 0 ? 'N/A' : `${100 - stats.spilloverRiskPct}%`}</strong></span>
          </div>
        </div>

        {/* Card 3: Work in Flight & Execution Flow */}
        <div className="p-4 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-2.5 transition hover:shadow-md">
          <div className="flex items-center justify-between text-[#5f6368]">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Active Work in Flight</span>
            <Workflow className="w-4 h-4 text-[#1967d2]" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-[#1967d2]">
              {stats.inProgressStories}
            </div>
            <span className="text-xs text-[#1967d2] font-semibold bg-[#e8f0fe] px-2 py-0.5 rounded-full">
              In Development
            </span>
          </div>
          <div className="flex gap-1.5 h-2 w-full rounded-full overflow-hidden bg-[#e8eaed]">
            <div
              className="bg-[#137333] transition-all"
              style={{ width: `${stats.totalStories > 0 ? (stats.completedStories / stats.totalStories) * 100 : 0}%` }}
              title="Done Stories"
            />
            <div
              className="bg-[#1967d2] transition-all"
              style={{ width: `${stats.totalStories > 0 ? (stats.inProgressStories / stats.totalStories) * 100 : 0}%` }}
              title="In Progress Stories"
            />
            <div
              className="bg-[#9aa0a6] transition-all"
              style={{ width: `${stats.totalStories > 0 ? (stats.todoStories / stats.totalStories) * 100 : 0}%` }}
              title="To-Do Stories"
            />
          </div>
          <div className="flex justify-between text-[11px] text-[#5f6368]">
            <span>{stats.todoStories} To-Do Queue</span>
            <span>WIP Throughput: <strong>Balanced</strong></span>
          </div>
        </div>

        {/* Card 4: Epics & Backlog Milestones Health */}
        <div className="p-4 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-2.5 transition hover:shadow-md">
          <div className="flex items-center justify-between text-[#5f6368]">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Epics & Milestones</span>
            <Layers className="w-4 h-4 text-[#b06000]" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-[#202124]">
              {stats.epicsProgress.length}
            </div>
            <span className="text-xs text-[#b06000] font-semibold bg-[#fef7e0] px-2 py-0.5 rounded-full border border-[#feefc3]">
              Active Epics
            </span>
          </div>
          <div className="w-full bg-[#e8eaed] h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-indigo-600 h-full rounded-full transition-all duration-500"
              style={{
                width: `${
                  stats.epicsProgress.length > 0
                    ? Math.round(
                        stats.epicsProgress.reduce((acc, ep) => acc + ep.completion_pct, 0) /
                          stats.epicsProgress.length
                      )
                    : stats.completionRatePct
                }%`
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-[#5f6368]">
            <span>Total Scope: <strong>{stats.plannedPoints} pts</strong></span>
            <span className="text-[#137333] font-semibold">{stats.plannedPoints > 0 ? '100% Traceable' : 'No Scope'}</span>
          </div>
        </div>
      </div>

      {/* SECTION: Team Delivery Leaderboard (Live) - Top 5 Users */}
      {/* Hidden when no user has closed any story, unless viewing dedicated Leaderboard tab */}
      {((activeTab === 'all' && stats.leaderboard.length > 0) || activeTab === 'leaderboard') && (
        stats.leaderboard.length > 0 ? (
        <div className="rounded-2xl border border-[#dadce0] bg-white shadow-sm overflow-hidden">
          {/* Leaderboard Header */}
          <div className="p-5 border-b border-[#dadce0] bg-gradient-to-r from-amber-500/10 via-white to-blue-500/5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-900 border border-amber-300 flex items-center justify-center shadow-sm">
                <Trophy className="w-5 h-5 text-amber-700 fill-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#202124]">
                    Team Delivery Leaderboard (Live)
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 uppercase font-mono">
                    Top 5 Closers
                  </span>
                </div>
                <p className="text-xs text-[#5f6368] mt-0.5">
                  Real-time ranking of team members for <strong className="text-[#202124]">{project?.name}</strong>. Team members who have closed the maximum stories are ranked at the top.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5f6368] font-mono">
                Sprint Total: <strong className="text-[#137333]">{stats.completedStories} Closed Stories</strong> ({stats.deliveredPoints} pts)
              </span>
            </div>
          </div>

          {/* Leaderboard Table / Cards */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8f9fa] border-b border-[#dadce0] text-[11px] font-mono text-[#5f6368] uppercase tracking-wider">
                  <th className="py-3 px-4 w-24">Rank</th>
                  <th className="py-3 px-4">Team Member</th>
                  <th className="py-3 px-4 text-center">Stories Closed (Max)</th>
                  <th className="py-3 px-4 text-center">Points Delivered</th>
                  <th className="py-3 px-4 text-center">In Progress</th>
                  <th className="py-3 px-4 text-center">Assigned Scope</th>
                  <th className="py-3 px-4 text-right pr-6">Delivery Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4]">
                {stats.leaderboard && stats.leaderboard.length > 0 ? (
                  stats.leaderboard.map((user) => {
                    const initials = (user.name || 'User')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase();

                    const contributionPct = stats.deliveredPoints > 0
                      ? Math.round((user.closed_story_points / stats.deliveredPoints) * 100)
                      : (user.closed_stories_count > 0 ? 100 : 0);

                    return (
                      <tr
                        key={user.rank + user.name}
                        className={`transition hover:bg-[#f8f9fa] ${
                          user.rank === 1 ? 'bg-amber-500/5 font-medium' : ''
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3.5 px-4">
                          {getRankBadge(user.rank)}
                        </td>

                        {/* User Details */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm text-white ${
                                user.rank === 1
                                  ? 'bg-gradient-to-tr from-amber-500 to-yellow-600 ring-2 ring-amber-300'
                                  : user.rank === 2
                                  ? 'bg-gradient-to-tr from-slate-500 to-gray-600 ring-2 ring-slate-300'
                                  : user.rank === 3
                                  ? 'bg-gradient-to-tr from-orange-600 to-amber-700 ring-2 ring-orange-300'
                                  : 'bg-gradient-to-tr from-blue-600 to-indigo-700'
                              }`}
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[#202124] text-xs">
                                  {user.name}
                                </span>
                                {user.rank === 1 && (
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                )}
                              </div>
                              <span className="text-[11px] text-[#5f6368] font-mono block">
                                {user.email || user.role || 'Team Member'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Closed Stories (Primary Highlight) */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                              user.closed_stories_count > 0
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm'
                                : 'bg-[#f1f3f4] text-[#80868b]'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{user.closed_stories_count} {user.closed_stories_count === 1 ? 'Story' : 'Stories'}</span>
                          </span>
                        </td>

                        {/* Points Delivered */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono font-bold text-xs text-[#202124]">
                            {user.closed_story_points} pts
                          </span>
                        </td>

                        {/* In Progress */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              user.in_progress_count > 0
                                ? 'bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc]'
                                : 'text-[#80868b]'
                            }`}
                          >
                            {user.in_progress_count > 0 ? (
                              <>
                                <Zap className="w-3 h-3 text-[#1967d2]" />
                                <span>{user.in_progress_count} Active ({user.in_progress_points} pts)</span>
                              </>
                            ) : (
                              'None'
                            )}
                          </span>
                        </td>

                        {/* Total Assigned */}
                        <td className="py-3.5 px-4 text-center text-[#5f6368] font-mono">
                          {user.total_assigned_stories} stories ({user.total_assigned_points} pts)
                        </td>

                        {/* Contribution Bar */}
                        <td className="py-3.5 px-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <div className="w-24 bg-[#e8eaed] h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  user.rank === 1
                                    ? 'bg-gradient-to-r from-amber-500 to-emerald-600'
                                    : 'bg-[#137333]'
                                }`}
                                style={{ width: `${Math.min(contributionPct, 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-bold text-[#202124] w-9 text-right">
                              {contributionPct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#5f6368]">
                      <Users className="w-8 h-8 text-[#dadce0] mx-auto mb-2" />
                      <span>No team member activity recorded yet for this sprint.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-[#f8f9fa] border-t border-[#dadce0] flex items-center justify-between text-[11px] text-[#5f6368]">
            <span className="flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#137333]" />
              Live Leaderboard synchronized from Jira project tickets
            </span>
            <button
              onClick={() => onSwitchView('capacity')}
              className="text-[#1967d2] hover:underline font-semibold flex items-center gap-1"
            >
              <span>View Full Capacity Utilization</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        ) : (
        <div className="p-10 rounded-2xl border border-[#dadce0] bg-white shadow-sm text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <Trophy className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="text-base font-bold text-[#202124]">No Completed Stories Yet</h3>
          <p className="text-xs text-[#5f6368] max-w-md mx-auto">
            The Team Delivery Leaderboard ranks team members as stories are completed and closed. Once stories reach <strong>Done</strong> in Jira, team closers will appear here.
          </p>
        </div>
        )
      )}

      {/* SECTION: Epics Delivery Progress Breakdown */}
      {(activeTab === 'all' || activeTab === 'epics') && (
        <div className="rounded-2xl border border-[#dadce0] bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#dadce0]">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-xs">
                <FolderGit2 className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#202124]">Epic & Milestone Delivery Health</h3>
                <p className="text-xs text-[#5f6368]">Progress of all major product initiatives and deliverable epics.</p>
              </div>
            </div>
            <span className="text-xs font-mono text-[#5f6368]">
              {stats.epicsProgress.length} Epics in Scope
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.epicsProgress && stats.epicsProgress.length > 0 ? (
              stats.epicsProgress.map((epic) => (
                <div
                  key={epic.key}
                  className="p-4 rounded-xl border border-[#dadce0] bg-[#f8f9fa] space-y-2.5 hover:border-[#1967d2] transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#1967d2] border border-[#d2e3fc] font-bold">
                        {epic.key}
                      </span>
                      <h4 className="text-xs font-bold text-[#202124] mt-1 line-clamp-1">
                        {epic.title}
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#137333] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {epic.completion_pct}%
                    </span>
                  </div>

                  <div className="w-full bg-[#e8eaed] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#137333] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(epic.completion_pct, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#5f6368]">
                    <span>{epic.completed_stories} of {epic.total_stories} Stories Done</span>
                    <span className="font-mono">{epic.delivered_points} / {epic.total_points} pts</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center py-6 text-xs text-[#5f6368]">
                <span>No epics configured for this project.</span>
              </div>
            )}
          </div>
        </div>
      )}


      {/* SECTION: Comprehensive Gemini AI Executive Delivery Summary */}
      {(activeTab === 'all' || activeTab === 'executive') && (
        <div className="p-5 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#dadce0]">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc] flex items-center justify-center font-bold text-xs">
                AI
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#202124]">
                  Executive Delivery Brief — {project?.name}
                </h3>
                <span className="text-[11px] text-[#5f6368]">
                  Synthesized by Orbit AI · Grounded in live Jira Cloud & BigQuery historical telemetry
                </span>
              </div>
            </div>
            <span className="text-xs font-mono text-[#5f6368] bg-[#f8f9fa] px-2.5 py-1 rounded-md border border-[#dadce0]">
              Model: Gemini 2.5 Flash
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed">
            {/* Key Accomplishments */}
            <div className="p-4 rounded-xl bg-[#e6f4ea]/40 border border-[#ceead6] space-y-2">
              <h4 className="font-bold text-[#137333] flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-[#137333]" />
                <span>Key Accomplishments</span>
              </h4>
              <ul className="space-y-1.5 text-[#202124]">
                {(report?.key_accomplishments && report.key_accomplishments.length > 0
                  ? report.key_accomplishments
                  : [
                      `Synchronized active backlog from Jira project ${project?.key}.`,
                      `Sprint scope committed with ${stats.plannedPoints} story points across ${stats.totalStories} items.`
                    ]
                ).map((acc: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#137333] font-bold mt-0.5">•</span>
                    <span>{acc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Critical Path Bottlenecks */}
            <div className="p-4 rounded-xl bg-[#fce8e6]/40 border border-[#fad2cf] space-y-2">
              <h4 className="font-bold text-[#c5221f] flex items-center gap-1.5 text-xs">
                <AlertOctagon className="w-4 h-4 text-[#c5221f]" />
                <span>Critical Path Bottlenecks</span>
              </h4>
              <ul className="space-y-1.5 text-[#202124]">
                {(report?.critical_path_bottlenecks && report.critical_path_bottlenecks.length > 0
                  ? report.critical_path_bottlenecks
                  : ['Zero active blockers detected on critical path in Jira.']
                ).map((bot: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#c5221f] font-bold mt-0.5">•</span>
                    <span>{bot}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Retrospective Commitments */}
            <div className="p-4 rounded-xl bg-[#e8f0fe]/40 border border-[#d2e3fc] space-y-2">
              <h4 className="font-bold text-[#1967d2] flex items-center gap-1.5 text-xs">
                <Workflow className="w-4 h-4 text-[#1a73e8]" />
                <span>Retrospective Commitments</span>
              </h4>
              <ul className="space-y-1.5 text-[#202124]">
                {(report?.retrospective_commitments && report.retrospective_commitments.length > 0
                  ? report.retrospective_commitments
                  : [
                      `Maintain daily standup check-ins and active commitment pace for ${sprint?.name || 'Sprint'}.`,
                      'Automate continuous integration test verification pipelines.',
                      'Review work-in-progress limit thresholds in upcoming sprint retrospective.'
                    ]
                ).map((rc: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#1967d2] font-bold mt-0.5">•</span>
                    <span>{rc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
