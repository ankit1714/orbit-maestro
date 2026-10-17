'use client';

import React, { useState } from 'react';
import { 
  Bot, 
  ChevronDown, 
  Sparkles, 
  Activity, 
  Plus, 
  ExternalLink,
  Layers,
  Check,
  Trash2,
  Users,
  Link as LinkIcon,
  Lock,
  Search,
  Orbit,
  X
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
  onToggleCopilot?: () => void;
  onSwitchView: (view: string) => void;
  onAskOrbit?: (query: string) => void;
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
  onAskOrbit,
  approvalsCount,
  flashStatus,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const { can, profile } = useRole();

  React.useEffect(() => {
    const handleOpen = () => setCreateModalOpen(true);
    window.addEventListener('open-create-project-modal', handleOpen);
    return () => window.removeEventListener('open-create-project-modal', handleOpen);
  }, []);

  // Deduplicate projects by key and ID, excluding native standalone projects
  const uniqueProjects = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const p of projects || []) {
      if (p.mode === 'STANDALONE') continue;
      const k = (p.key || p.id || '').toUpperCase();
      if (!map.has(k)) {
        map.set(k, p);
      }
    }
    return Array.from(map.values());
  }, [projects]);

  const getFlashBadge = () => {
    if (flashStatus === "OFF_TRACK") {
      return (
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#fce8e6] border border-[#fad2cf] text-[#c5221f] text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-[#c5221f] animate-pulse"></span>
          <span>Flash: Off-Track 🔴</span>
        </div>
      );
    } else if (flashStatus === "AT_RISK") {
      return (
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#fef7e0] border border-[#feefc3] text-[#b06000] text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-[#b06000]"></span>
          <span>Flash: At-Risk 🟡</span>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#e6f4ea] border border-[#ceead6] text-[#137333] text-xs font-medium">
        <span className="w-2 h-2 rounded-full bg-[#137333] animate-pulse"></span>
        <span>Flash: On-Track 🟢</span>
      </div>
    );
  };

  return (
    <>
      <header className="h-14 border-b border-[#dadce0] bg-white sticky top-0 z-40 px-4 flex items-center justify-between shadow-[0_1px_2px_0_rgba(60,64,67,0.08)]">
        {/* Left: Branding & Project Hub */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1a73e8] flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="leading-none">
              <span className="font-bold text-sm tracking-tight text-[#202124] flex items-center gap-1.5">
                Orbit Maestro AI
              </span>
              <span className="text-[11px] text-[#5f6368] font-normal">Your Intelligent Scrum Partner</span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-[#dadce0]"></div>

          {/* Project Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#f1f3f4] hover:bg-[#e8eaed] border border-transparent hover:border-[#dadce0] transition text-xs font-medium text-[#202124]"
            >
              <span className="w-2 h-2 rounded-full bg-[#137333]"></span>
              <span className="font-semibold text-[#202124]">{activeProject?.name || "Select Project"}</span>
              {activeProject && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-white text-[#3c4043] border border-[#dadce0] shadow-sm">
                  {activeProject?.jira_settings?.project_key || activeProject?.key || ""}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-[#5f6368]" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-88 rounded-xl bg-white border border-[#dadce0] shadow-[0_4px_16px_rgba(60,64,67,0.15)] p-2 z-50 space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono text-[#5f6368] uppercase tracking-wider flex justify-between items-center border-b border-[#f1f3f4] pb-1.5 mb-1 font-semibold">
                  <span>Switch Workspace ({uniqueProjects.length})</span>
                  <span className="text-[#1a73e8]">GCP Firestore Retained</span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1">
                  {uniqueProjects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => {
                        onSelectProject(proj);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center justify-between transition cursor-pointer group ${
                        activeProject?.id === proj.id ? 'bg-[#e8f0fe] text-[#1967d2] font-semibold' : 'text-[#3c4043] hover:bg-[#f8f9fa]'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[#1a73e8] font-bold">[{proj.key}]</span>
                          <span className="truncate text-[#202124]">{proj.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#5f6368] mt-0.5">
                          <span className="text-[#1a73e8] flex items-center gap-0.5">
                            🔗 Jira: {proj.jira_settings?.project_key || proj.key}
                          </span>
                          {proj.team_members && proj.team_members.length > 0 && (
                            <span className="text-[#5f6368] flex items-center gap-0.5">
                              • {proj.team_members.length} dev(s)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {activeProject?.id === proj.id && <Check className="w-3.5 h-3.5 text-[#137333] shrink-0" />}
                        {can('canDeleteProject') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Are you sure you want to permanently delete project "${proj.name}" [${proj.key}] from GCP Firestore?`)) {
                                onDeleteProject(proj.id);
                              }
                            }}
                            className="p-1 rounded opacity-60 hover:opacity-100 hover:bg-[#fce8e6] text-[#5f6368] hover:text-[#c5221f] transition"
                            title="Delete project from GCP Firestore"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-1.5 border-t border-[#f1f3f4]">
                  {can('canCreateProject') ? (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        setCreateModalOpen(true);
                      }}
                      className="w-full text-left p-2 rounded-lg text-xs text-[#1a73e8] hover:bg-[#e8f0fe] flex items-center gap-2 font-semibold transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create New Project...</span>
                    </button>
                  ) : (
                    <div 
                      className="w-full p-2 rounded-lg text-xs text-[#80868b] flex items-center gap-2 font-medium cursor-not-allowed opacity-60"
                      title="Only Scrum Master or Admin can create projects"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#80868b]" />
                      <span>Create Project (Restricted)</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Searchbox & AskOrbit Button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = headerSearchQuery.trim();
            if (onAskOrbit) {
              onAskOrbit(q);
            } else {
              onSwitchView('orbitbot');
            }
          }}
          className="flex-1 max-w-xl mx-4 flex items-center"
        >
          <div className="relative w-full flex items-center">
            <Search className="w-4 h-4 text-[#80868b] absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={headerSearchQuery}
              onChange={(e) => setHeaderSearchQuery(e.target.value)}
              placeholder="Ask Orbit Maestro anything (PRD, Jira, Git, Confluence)..."
              className="w-full bg-[#f1f3f4] hover:bg-[#e8eaed]/70 focus:bg-white border border-[#dadce0] focus:border-[#1a73e8] rounded-xl pl-9 pr-28 py-1.5 text-xs text-[#202124] placeholder-[#80868b] focus:outline-none transition-all shadow-2xs focus:shadow-xs"
            />
            {headerSearchQuery && (
              <button
                type="button"
                onClick={() => setHeaderSearchQuery('')}
                className="absolute right-24 text-[#80868b] hover:text-[#202124] p-1 transition"
                title="Clear query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1 px-3 py-1 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition active:scale-95"
              title="Ask OrbitBot"
            >
              <Orbit className="w-3.5 h-3.5" />
              <span>AskOrbit</span>
            </button>
          </div>
        </form>

        {/* Right: Governance Badges & AI Status */}
        <div className="flex items-center space-x-3 shrink-0">
          {/* GitHub Live Flash Health Indicator */}
          {getFlashBadge()}

          <div className="h-5 w-[1px] bg-[#dadce0]"></div>

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
