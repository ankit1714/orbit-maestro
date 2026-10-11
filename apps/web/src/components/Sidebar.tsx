'use client';

import React from 'react';
import {
  LayoutDashboard,
  FileText,
  ListTree,
  Compass,
  Kanban,
  Mic,
  CheckCheck,
  BookMarked,
  BarChart3,
  Bot,
  Users
} from 'lucide-react';
import { useRole } from '@/lib/roleContext';

interface SidebarProps {
  currentView: string;
  onSwitchView: (view: string) => void;
  openQuestionsCount: number;
  approvalsCount: number;
  hasBlocker: boolean;
  sprint?: any;
  project?: any;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSwitchView,
  openQuestionsCount,
  approvalsCount,
  hasBlocker,
  sprint,
  project,
}) => {
  const { profile } = useRole();
  const navItemClass = (view: string) => `
    w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition
    ${currentView === view ? 'text-white bg-zinc-800/80 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'}
  `;

  const capacity = sprint?.capacity;
  const devAllocs = capacity?.developer_allocations || [];
  const overallLoad = capacity?.overall_load_pct ?? 0;

  const getLoadColor = (pct: number) => {
    if (pct === 0) return { text: 'text-zinc-500 font-normal', bar: 'bg-zinc-700' };
    if (pct > 100) return { text: 'text-rose-400 font-bold', bar: 'bg-rose-500' };
    if (pct >= 85) return { text: 'text-amber-400 font-semibold', bar: 'bg-amber-400' };
    return { text: 'text-emerald-400 font-medium', bar: 'bg-emerald-500' };
  };

  const overallStyle = getLoadColor(overallLoad);

  return (
    <aside className="w-64 border-r border-zinc-800 bg-surface-900 flex flex-col justify-between select-none">
      <div className="p-3 space-y-5 overflow-y-auto">
        {/* Active Role Persona Badge */}
        <div className="px-2.5 py-2 rounded-lg bg-surface-950/70 border border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2 truncate">
            <div className={`w-5 h-5 rounded-full bg-gradient-to-tr ${profile.avatarBg} flex items-center justify-center text-[9px] font-bold text-white shrink-0 shadow-sm`}>
              {profile.shortLabel}
            </div>
            <div className="truncate">
              <span className="text-[11px] font-bold text-zinc-200 block truncate leading-tight">{profile.title}</span>
              <span className="text-[9px] text-zinc-500 font-mono block truncate leading-tight">
                {profile.permissions.isReadOnly ? 'Read-Only Mode' : 'Interactive Access'}
              </span>
            </div>
          </div>
          <span className={`text-[8px] font-mono px-1.5 py-0.2 rounded uppercase font-semibold border ${profile.badgeBg} ${profile.badgeBorder} ${profile.badgeText} shrink-0`}>
            {profile.shortLabel}
          </span>
        </div>

        {/* Strategy & Ingestion */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
            Strategy & Ingestion
          </div>
          <nav className="space-y-0.5">
            <button onClick={() => onSwitchView('dashboard')} className={navItemClass('dashboard')}>
              <div className="flex items-center space-x-2.5">
                <LayoutDashboard className="w-4 h-4 text-brand-400" />
                <span>Dashboard & Health</span>
              </div>
            </button>
            <button onClick={() => onSwitchView('documents')} className={navItemClass('documents')}>
              <div className="flex items-center space-x-2.5">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Document Studio</span>
              </div>
              {openQuestionsCount > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                  {openQuestionsCount} Qs
                </span>
              )}
            </button>
            <button onClick={() => onSwitchView('backlog')} className={navItemClass('backlog')}>
              <div className="flex items-center space-x-2.5">
                <ListTree className="w-4 h-4 text-emerald-400" />
                <span>Backlog & Traceability</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Sprint Execution */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
            Sprint Execution
          </div>
          <nav className="space-y-0.5">
            <button onClick={() => onSwitchView('planning')} className={navItemClass('planning')}>
              <div className="flex items-center space-x-2.5">
                <Compass className="w-4 h-4 text-amber-400" />
                <span>Sprint Planning (FR-07)</span>
              </div>
              <span className="text-[10px] bg-brand-500/20 text-brand-300 px-1.5 py-0.2 rounded font-mono">Scope</span>
            </button>
            <button onClick={() => onSwitchView('sprint')} className={navItemClass('sprint')}>
              <div className="flex items-center space-x-2.5">
                <Kanban className="w-4 h-4 text-indigo-400" />
                <span>Sprint Board</span>
              </div>
              {hasBlocker && (
                <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.2 rounded font-mono">
                  1 Blocker
                </span>
              )}
            </button>
            <button onClick={() => onSwitchView('meetings')} className={navItemClass('meetings')}>
              <div className="flex items-center space-x-2.5">
                <Mic className="w-4 h-4 text-violet-400" />
                <span>Meeting Intelligence</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Governance & Memory */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
            Governance & Memory
          </div>
          <nav className="space-y-0.5">
            <button onClick={() => onSwitchView('governance')} className={navItemClass('governance')}>
              <div className="flex items-center space-x-2.5">
                <CheckCheck className="w-4 h-4 text-amber-400" />
                <span>Action & Approval Hub</span>
              </div>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 font-mono px-1 rounded">
                {approvalsCount}
              </span>
            </button>
            <button onClick={() => onSwitchView('knowledge')} className={navItemClass('knowledge')}>
              <div className="flex items-center space-x-2.5">
                <BookMarked className="w-4 h-4 text-teal-400" />
                <span>NotebookLM Knowledge</span>
              </div>
              <span className="text-[9px] bg-teal-500/20 text-teal-300 px-1 rounded font-mono">AI</span>
            </button>
            <button onClick={() => onSwitchView('reports')} className={navItemClass('reports')}>
              <div className="flex items-center space-x-2.5">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Actionable Reports</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-1 rounded">BQ</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Capacity & Telemetry Footer */}
      <div className="p-3 border-t border-zinc-800/80 bg-surface-950/70 space-y-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 font-medium flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-zinc-500" />
            <span>Sprint Capacity</span>
          </span>
          <span className={`font-mono text-[11px] ${overallStyle.text}`}>
            {overallLoad}% Loaded
          </span>
        </div>

        {/* Developer Workload Allocations from Jira */}
        {devAllocs.length > 0 ? (
          <div className="space-y-2 max-h-36 overflow-y-auto pr-0.5">
            {devAllocs.slice(0, 3).map((dev: any, i: number) => {
              const style = getLoadColor(dev.load_pct);
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-300 truncate max-w-[130px]">{dev.name}</span>
                    <span className={style.text}>
                      {dev.load_pct}% {dev.load_pct > 100 && '(Alert)'}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`${style.bar} h-full rounded-full transition-all`}
                      style={{ width: `${Math.min(dev.load_pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-zinc-500">
                    <span>{dev.assigned_tickets_count} tickets ({dev.assigned_story_points} pts)</span>
                    <span>{dev.allocated_hours}h / {dev.available_hours}h</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Frontend Workload</span>
              <span>{capacity?.frontend_load_pct ?? 0}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(capacity?.frontend_load_pct ?? 0, 100)}%` }} />
            </div>

            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Backend Workload</span>
              <span className="text-zinc-400 font-medium">{capacity?.backend_load_pct ?? 0}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-400 h-full rounded-full" style={{ width: `${Math.min(capacity?.backend_load_pct ?? 0, 100)}%` }} />
            </div>

            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>QA Workload</span>
              <span>{capacity?.qa_load_pct ?? 0}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-teal-500 h-full rounded-full" style={{ width: `${Math.min(capacity?.qa_load_pct ?? 0, 100)}%` }} />
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-zinc-800/40 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Jira Capacity Sync
          </span>
          <span className="text-zinc-400">{capacity?.team_total_hours ?? 0}h Total</span>
        </div>
      </div>
    </aside>
  );
};
