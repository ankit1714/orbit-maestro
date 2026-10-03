'use client';

import React from 'react';
import {
  LayoutDashboard,
  FileText,
  ListTree,
  Compass,
  Kanban,
  Mic,
  GitMerge,
  CheckCheck,
  BookMarked,
  BarChart3,
  Bot
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onSwitchView: (view: string) => void;
  openQuestionsCount: number;
  approvalsCount: number;
  hasBlocker: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSwitchView,
  openQuestionsCount,
  approvalsCount,
  hasBlocker,
}) => {
  const navItemClass = (view: string) => `
    w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition
    ${currentView === view ? 'text-white bg-zinc-800/80 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'}
  `;

  return (
    <aside className="w-64 border-r border-zinc-800 bg-surface-900 flex flex-col justify-between select-none">
      <div className="p-3 space-y-6 overflow-y-auto">
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
            <button onClick={() => onSwitchView('risks')} className={navItemClass('risks')}>
              <div className="flex items-center space-x-2.5">
                <GitMerge className="w-4 h-4 text-rose-400" />
                <span>Dependency & DAG</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
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
      <div className="p-3 border-t border-zinc-800/80 bg-surface-950/50 space-y-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 font-medium">Sprint Capacity</span>
          <span className="text-amber-400 font-mono font-semibold">92% Loaded</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Frontend (Alex, Maria)</span>
            <span>72%</span>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full" style={{ width: "72%" }}></div>
          </div>

          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Backend (David, Ken)</span>
            <span className="text-rose-400 font-semibold">108% (Alert)</span>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full" style={{ width: "100%" }}></div>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-800/40 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Vertex Agent: Online
          </span>
          <span>280ms</span>
        </div>
      </div>
    </aside>
  );
};
