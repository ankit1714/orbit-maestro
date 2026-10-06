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
  Link as LinkIcon
} from 'lucide-react';

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

  // New Project Form State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectKey, setNewProjectKey] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newJiraLink, setNewJiraLink] = useState('');
  const [newDevNames, setNewDevNames] = useState('');
  const [newProjectMode, setNewProjectMode] = useState('ENTERPRISE_SYNC');
  const [newGitRepo, setNewGitRepo] = useState('');
  const [newNotebookLMUrl, setNewNotebookLMUrl] = useState('');

  const handleJiraLinkChange = (link: string) => {
    setNewJiraLink(link);
    if (link) {
      const match = link.match(/\/(?:projects|browse)\/([A-Za-z0-9_]+)/);
      if (match && !newProjectKey) {
        setNewProjectKey(match[1].toUpperCase());
      }
      setNewProjectMode('ENTERPRISE_SYNC');
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) return;
    const finalKey = (newProjectKey || (newJiraLink.match(/\/(?:projects|browse)\/([A-Za-z0-9_]+)/)?.[1]) || 'SCRUM').toUpperCase();
    
    onCreateProject({
      name: newProjectName,
      key: finalKey,
      description: newProjectDesc || `${newProjectName} workspace`,
      jira_project_link: newJiraLink.trim() || undefined,
      developer_names: newDevNames
        ? newDevNames.split(',').map((n) => n.trim()).filter(Boolean)
        : undefined,
      mode: newProjectMode,
      git_settings: {
        enabled: true,
        repo_url: newGitRepo || undefined
      },
      notebooklm_settings: {
        enabled: true,
        notebook_url: newNotebookLMUrl || undefined,
        workspace_name: `${newProjectName} Knowledge Hub`
      }
    });

    setCreateModalOpen(false);
    setNewProjectName('');
    setNewProjectKey('');
    setNewProjectDesc('');
    setNewJiraLink('');
    setNewDevNames('');
    setNewGitRepo('');
    setNewNotebookLMUrl('');
  };

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
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                {activeProject?.jira_settings?.project_key || activeProject?.key || "SCRUM"}
              </span>
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
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-1.5 border-t border-zinc-800">
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
          <button
            onClick={onOpenSimulator}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white shadow-lg shadow-brand-500/20 text-xs font-semibold transition border border-white/10"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Run Pipeline: PRD → Backlog</span>
          </button>

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

          {/* User Avatar */}
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white border border-white/20">
            PO
          </div>
        </div>
      </header>

      {/* CREATE PROJECT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-400" />
                Create New Scrum Project
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Project Name *</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. AI Scrum Master"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium flex items-center gap-1.5">
                  <LinkIcon className="w-3 h-3 text-blue-400" />
                  <span>Jira Project Link (Auto-detects Key & Live Sync)</span>
                </label>
                <input
                  type="text"
                  value={newJiraLink}
                  onChange={(e) => handleJiraLinkChange(e.target.value)}
                  placeholder="https://the-ai-scrum-master.atlassian.net/jira/software/projects/SCRUM/summary"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white font-mono text-[11px] focus:outline-none focus:border-brand-500"
                />
                <span className="text-[10px] text-zinc-500 mt-0.5 block">
                  Paste full Jira board or project link to sync tickets, stories, points, and sprints automatically.
                </span>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-emerald-400" />
                  <span>Developer Names (Comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={newDevNames}
                  onChange={(e) => setNewDevNames(e.target.value)}
                  placeholder="e.g. Ankit Maurya, Sarah Chen, David Kim"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-brand-500"
                />
                <span className="text-[10px] text-zinc-500 mt-0.5 block">
                  Assigned developers will be registered in Firestore with capacity loading and skills tracking.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Project Key Prefix</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={newProjectKey}
                    onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
                    placeholder="e.g. SCRUM, PAY, FIN"
                    className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white font-mono uppercase focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Operating Mode</label>
                  <select
                    value={newProjectMode}
                    onChange={(e) => setNewProjectMode(e.target.value)}
                    className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="ENTERPRISE_SYNC">Enterprise Sync (Jira Cloud Direct)</option>
                    <option value="STANDALONE">Standalone (Native Firestore)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Description (Optional)</label>
                <input
                  type="text"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Workspace scope and delivery milestones"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-md shadow-brand-500/20"
                >
                  Create & Save to GCP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
