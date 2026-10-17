'use client';

import React from 'react';
import {
  LayoutDashboard,
  FileText,
  ListTree,
  Kanban,
  Mic,
  Gauge,
  CheckCheck,
  BarChart3,
  Bot,
  Orbit
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
  const { role, profile } = useRole();
  const navItemClass = (view: string) => `
    w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition
    ${currentView === view 
      ? 'text-[#1967d2] bg-[#e8f0fe] font-semibold' 
      : 'text-[#3c4043] hover:text-[#202124] hover:bg-[#f1f3f4]'}
  `;

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
            {(role === 'ADMIN' || role === 'SCRUM_MASTER') && (
              <button onClick={() => onSwitchView('capacity')} className={navItemClass('capacity')}>
                <div className="flex items-center space-x-2.5">
                  <Gauge className={`w-4 h-4 ${currentView === 'capacity' ? 'text-[#1967d2]' : 'text-[#5f6368]'}`} />
                  <span>Sprint Capacity Utilization</span>
                </div>
              </button>
            )}
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

        {/* Utilities */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-bold text-[#5f6368] uppercase tracking-wider font-mono">
            Utilities
          </div>
          <nav className="space-y-0.5">
            <button onClick={() => onSwitchView('orbitbot')} className={navItemClass('orbitbot')}>
              <div className="flex items-center space-x-2.5">
                <Orbit className={`w-4 h-4 ${currentView === 'orbitbot' ? 'text-[#1967d2]' : 'text-[#5f6368]'}`} />
                <span>OrbitBot</span>
              </div>
              <span className="text-[10px] bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc] px-1.5 py-0.2 rounded font-mono font-semibold">
                AI Bot
              </span>
            </button>
          </nav>
        </div>
      </div>
    </aside>
  );
};

