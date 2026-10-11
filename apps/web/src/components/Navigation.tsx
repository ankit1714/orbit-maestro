'use client';

import React, { useState } from 'react';
import { 
  Bot, 
  ChevronDown, 
  Search, 
  Sparkles, 
  ShieldAlert, 
  Activity, 
  Plus, 
  ExternalLink,
  Layers,
  Check,
  Trash2,
  Users,
  Link as LinkIcon,
  Lock
} from 'lucide-react';
import { useRole } from '@/lib/roleContext';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { CreateProjectModal } from '@/components/CreateProjectModal';

interface NavigationProps {
  projects: any[];
  activeProject: any;
  onSelectProject: (project: any) => void;
  onCreateProject: (projectData: any) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenSimulator: () => void;
  onOpenCommandPalette: () => void;
  onToggleCopilot: () => void;
  onSwitchView: (view: string) => void;
  approvalsCount: number;
  flashStatus: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onOpenSimulator,
  onOpenCommandPalette,
  onToggleCopilot,
  onSwitchView,
  approvalsCount,
  flashStatus,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { can, profile } = useRole();

  React.useEffect(() => {
    const handleOpen = () => setCreateModalOpen(true);
    window.addEventListener('open-create-project-modal', handleOpen);
    return () => window.removeEventListener('open-create-project-modal', handleOpen);
  }, []);

  const getFlashBadge = () => {
    if (flashStatus === "OFF_TRACK") {
      return (
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          <span>Flash: Off-Track 🔴</span>
        </div>
      );
    } else if (flashStatus === "AT_RISK") {
      return (
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>Flash: At-Risk 🟡</span>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Flash: On-Track 🟢</span>
      </div>
    );
  };

  return (
    <>
      <header className="h-14 border-b border-zinc-800 bg-surface-900/90 backdrop-blur sticky top-0 z-40 px-4 flex items-center justify-between">
        {/* Left: Branding & Project Hub */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="leading-none">
              <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                AI Scrum Master
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">ADK Agent</span>
              </span>
              <span className="text-[11px] text-zinc-400 font-medium">Autonomous Execution Loop</span>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-zinc-800"></div>

          {/* Project Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-2 px-2.5 py-1.5 rounded-md hover:bg-zinc-800/60 border border-zinc-700/60 transition text-xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold text-zinc-100">{activeProject?.name || "Select Project"}</span>
              {activeProject && (
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {activeProject?.jira_settings?.project_key || activeProject?.key || ""}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-88 rounded-xl bg-surface-900 border border-zinc-700 shadow-2xl p-2 z-50 space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono text-zinc-500 uppercase tracking-wider flex justify-between items-center border-b border-zinc-800 pb-1.5 mb-1">
                  <span>Switch Workspace ({projects.length})</span>
                  <span className="text-brand-400">GCP Firestore Retained</span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1">
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => {
                        onSelectProject(proj);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition cursor-pointer group ${
                        activeProject?.id === proj.id ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-300 hover:bg-zinc-800/60'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-brand-400 font-bold">[{proj.key}]</span>
                          <span className="truncate">{proj.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                          {proj.jira_settings?.enabled ? (
                            <span className="text-blue-400 flex items-center gap-0.5">
                              🔗 Jira: {proj.jira_settings.project_key || proj.key}
                            </span>
                          ) : (
                            <span>⚡ Native Storage</span>
                          )}
                          {proj.team_members && proj.team_members.length > 0 && (
                            <span className="text-zinc-400 flex items-center gap-0.5">
                              • {proj.team_members.length} dev(s)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {activeProject?.id === proj.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        {can('canDeleteProject') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Are you sure you want to permanently delete project "${proj.name}" [${proj.key}] from GCP Firestore?`)) {
                                onDeleteProject(proj.id);
                              }
                            }}
                            className="p-1 rounded opacity-60 hover:opacity-100 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition"
                            title="Delete project from GCP Firestore"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-1.5 border-t border-zinc-800">
                  {can('canCreateProject') ? (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        setCreateModalOpen(true);
                      }}
                      className="w-full text-left p-2 rounded-lg text-xs text-brand-400 hover:bg-brand-500/10 flex items-center gap-2 font-semibold transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create New Project...</span>
                    </button>
                  ) : (
                    <div 
                      className="w-full p-2 rounded-lg text-xs text-zinc-500 flex items-center gap-2 font-medium cursor-not-allowed opacity-60"
                      title="Only Product Owner, Scrum Master, or Admin can create projects"
                    >
                      <Lock className="w-3.5 h-3.5 text-zinc-600" />
                      <span>Create Project (Restricted)</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Global Omnibar Command (⌘K) */}
        <div className="flex-1 max-w-xl mx-8">
          <button
            onClick={onOpenCommandPalette}
            className="w-full h-8 px-3 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 text-zinc-400 flex items-center justify-between text-xs transition group"
          >
            <div className="flex items-center space-x-2">
              <Search className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              <span>Ask AI, search requirements, stories, NotebookLM...</span>
            </div>
            <div className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono">⌘K</kbd>
            </div>
          </button>
        </div>

        {/* Right: Governance Badges & AI Status */}
        <div className="flex items-center space-x-3">
          {/* Interactive Pipeline Simulator Button */}
          {can('canIngestPRD') ? (
            <button
              onClick={onOpenSimulator}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white shadow-lg shadow-brand-500/20 text-xs font-semibold transition border border-white/10"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run Pipeline: PRD → Backlog</span>
            </button>
          ) : (
            <div
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs cursor-not-allowed opacity-75"
              title={`Role "${profile.name}" cannot trigger pipeline (Requires PO or Admin)`}
            >
              <Lock className="w-3.5 h-3.5 text-zinc-500" />
              <span>Run Pipeline (PO Only)</span>
            </div>
          )}

          {/* Approvals Badge */}
          <button
            onClick={() => onSwitchView('governance')}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition text-xs"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="font-semibold">{approvalsCount} Approvals</span>
          </button>

          {/* GitHub Live Flash Health Indicator */}
          {getFlashBadge()}

          <div className="h-4 w-[1px] bg-zinc-800"></div>

          {/* Copilot Drawer Toggle */}
          <button
            onClick={onToggleCopilot}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition"
            title="Toggle AI Copilot (⌘J)"
          >
            <Sparkles className="w-4 h-4 text-brand-400" />
          </button>

          {/* Interactive Role Switcher Dropdown */}
          <RoleSwitcher />
        </div>
      </header>

      {/* CREATE PROJECT MODAL */}
      <CreateProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onProjectCreated={(newProj) => {
          onCreateProject(newProj);
          setCreateModalOpen(false);
        }}
      />
    </>
  );
};
