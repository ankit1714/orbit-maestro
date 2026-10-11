'use client';

import React from 'react';
import {
  LayoutDashboard,
  FileText,
  ListTree,
  Kanban,
  Mic,
  CheckCheck,
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
  actionsDecisionsCount?: number;
  hasBlocker: boolean;
  sprint?: any;
  project?: any;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSwitchView,
  openQuestionsCount,
  approvalsCount,
  actionsDecisionsCount,
  hasBlocker,
  sprint,
  project,
}) => {
  const { profile } = useRole();
  const navItemClass = (view: string) => `
    w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition
    ${currentView === view 
      ? 'text-[#1967d2] bg-[#e8f0fe] font-semibold' 
      : 'text-[#3c4043] hover:text-[#202124] hover:bg-[#f1f3f4]'}
  `;

  const capacity = sprint?.capacity;
  const devAllocs = capacity?.developer_allocations || [];
  const overallLoad = capacity?.overall_load_pct ?? 0;

  const getLoadColor = (pct: number) => {
    if (pct === 0) return { text: 'text-[#80868b] font-normal', bar: 'bg-[#dadce0]' };
    if (pct > 100) return { text: 'text-[#c5221f] font-bold', bar: 'bg-[#c5221f]' };
    if (pct >= 85) return { text: 'text-[#b06000] font-semibold', bar: 'bg-[#b06000]' };
    return { text: 'text-[#137333] font-medium', bar: 'bg-[#137333]' };
  };

  const overallStyle = getLoadColor(overallLoad);

  return (
    <aside className="w-64 border-r border-[#dadce0] bg-white flex flex-col justify-between select-none">
      <div className="p-3 space-y-5 overflow-y-auto">
        {/* Active Role Persona Badge */}
        <div className="px-3 py-2 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5 truncate">
            <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${profile.avatarBg} flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm`}>
              {profile.shortLabel}
            </div>
            <div className="truncate">
              <span className="text-xs font-bold text-[#202124] block truncate leading-tight">{profile.title}</span>
              <span className="text-[10px] text-[#5f6368] font-mono block truncate leading-tight">
                {profile.permissions.isReadOnly ? 'Read-Only Mode' : 'Interactive Access'}
              </span>
            </div>
          </div>
          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase font-bold border ${profile.badgeBg} ${profile.badgeBorder} ${profile.badgeText} shrink-0`}>
            {profile.shortLabel}
          </span>
        </div>

        {/* Strategy & Ingestion */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-bold text-[#5f6368] uppercase tracking-wider font-mono">
            Strategy & Ingestion
          </div>
          <nav className="space-y-0.5">
            <button onClick={() => onSwitchView('dashboard')} className={navItemClass('dashboard')}>
              <div className="flex items-center space-x-2.5">
                <LayoutDashboard className={`w-4 h-4 ${currentView === 'dashboard' ? 'text-[#1967d2]' : 'text-[#5f6368]'}`} />
                <span>Dashboard & Health</span>
              </div>
            </button>
            <button onClick={() => onSwitchView('documents')} className={navItemClass('documents')}>
              <div className="flex items-center space-x-2.5">
                <FileText className={`w-4 h-4 ${currentView === 'documents' ? 'text-[#1967d2]' : 'text-[#5f6368]'}`} />
                <span>Document Studio</span>
              </div>
              {openQuestionsCount > 0 && (
                <span className="text-[10px] bg-[#fef7e0] text-[#b06000] border border-[#feefc3] px-1.5 py-0.2 rounded font-mono font-medium">
                  {openQuestionsCount} Qs
                </span>
              )}
            </button>
            <button onClick={() => onSwitchView('backlog')} className={navItemClass('backlog')}>
              <div className="flex items-center space-x-2.5">
                <ListTree className={`w-4 h-4 ${currentView === 'backlog' ? 'text-[#1967d2]' : 'text-[#5f6368]'}`} />
                <span>Backlog & Traceability</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Sprint Execution */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-bold text-[#5f6368] uppercase tracking-wider font-mono">
            Sprint Execution
          </div>
          <nav className="space-y-0.5">
            <button onClick={() => onSwitchView('sprint')} className={navItemClass('sprint')}>
              <div className="flex items-center space-x-2.5">
                <Kanban className={`w-4 h-4 ${currentView === 'sprint' ? 'text-[#1967d2]' : 'text-[#5f6368]'}`} />
                <span>Sprint Board</span>
              </div>
              {hasBlocker && (
                <span className="text-[10px] bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf] px-1.5 py-0.2 rounded font-mono font-bold">
                  1 Blocker
                </span>
              )}
            </button>
            <button onClick={() => onSwitchView('meetings')} className={navItemClass('meetings')}>
              <div className="flex items-center space-x-2.5">
                <Mic className={`w-4 h-4 ${currentView === 'meetings' ? 'text-[#1967d2]' : 'text-[#5f6368]'}`} />
                <span>Meeting Intelligence</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Governance & Memory */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-bold text-[#5f6368] uppercase tracking-wider font-mono">
            Governance & Memory
          </div>
          <nav className="space-y-0.5">
            <button onClick={() => onSwitchView('governance')} className={navItemClass('governance')}>
              <div className="flex items-center space-x-2.5">
                <CheckCheck className={`w-4 h-4 ${currentView === 'governance' ? 'text-[#1967d2]' : 'text-[#5f6368]'}`} />
                <span>Action & Decisions</span>
              </div>
              <span className="text-[10px] bg-[#fef7e0] text-[#b06000] border border-[#feefc3] font-mono px-1.5 py-0.5 rounded-full font-bold">
                {actionsDecisionsCount !== undefined ? actionsDecisionsCount : approvalsCount}
              </span>
            </button>
            <button onClick={() => onSwitchView('reports')} className={navItemClass('reports')}>
              <div className="flex items-center space-x-2.5">
                <BarChart3 className={`w-4 h-4 ${currentView === 'reports' ? 'text-[#1967d2]' : 'text-[#5f6368]'}`} />
                <span>Actionable Reports</span>
              </div>
              <span className="text-[10px] bg-[#e6f4ea] text-[#137333] border border-[#ceead6] font-mono px-1.5 py-0.2 rounded font-semibold">BQ</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Capacity & Telemetry Footer */}
      <div className="p-3.5 border-t border-[#dadce0] bg-[#f8f9fa] space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#3c4043] font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#5f6368]" />
            <span>Sprint Capacity</span>
          </span>
          <span className={`font-mono text-xs ${overallStyle.text}`}>
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
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#3c4043] font-medium truncate max-w-[130px]">{dev.name}</span>
                    <span className={style.text}>
                      {dev.load_pct}% {dev.load_pct > 100 && '(Alert)'}
                    </span>
                  </div>
                  <div className="w-full bg-[#e8eaed] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`${style.bar} h-full rounded-full transition-all`}
                      style={{ width: `${Math.min(dev.load_pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-[#5f6368]">
              <span>Sprint Workload</span>
              <span className="text-[#137333] font-semibold">Optimal 🟢</span>
            </div>
            <div className="w-full bg-[#e8eaed] h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#137333] h-full rounded-full" style={{ width: '45%' }} />
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-[#dadce0] flex items-center justify-between text-[10px] text-[#5f6368] font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#137333] animate-pulse" />
            Jira Capacity Sync
          </span>
          <span className="text-[#3c4043] font-medium">{capacity?.team_total_hours ?? 0}h Total</span>
        </div>
      </div>
    </aside>
  );
};
