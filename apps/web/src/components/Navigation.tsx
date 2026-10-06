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
  Check
} from 'lucide-react';

interface NavigationProps {
  projects: any[];
  activeProject: any;
  onSelectProject: (project: any) => void;
  onCreateProject: (projectData: any) => void;
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
  const [newProjectMode, setNewProjectMode] = useState('STANDALONE');
  const [newGitRepo, setNewGitRepo] = useState('');
  const [newNotebookLMUrl, setNewNotebookLMUrl] = useState('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName || !newProjectKey) return;
    onCreateProject({
      name: newProjectName,
      key: newProjectKey.toUpperCase(),
      description: newProjectDesc || `${newProjectName} workspace`,
      mode: newProjectMode,
      git_settings: {
        enabled: true,
        repo_url: newGitRepo || undefined
      },
      notebooklm_settings: {
        enabled: true,
        notebook_url: newNotebookLMUrl || undefined,
        workspace_name: `${newProjectName} Living Knowledge Hub`
      }
    });
    setCreateModalOpen(false);
    setNewProjectName('');
    setNewProjectKey('');
    setNewProjectDesc('');
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
                {activeProject?.mode === "STANDALONE" ? "Standalone (Native)" : "Enterprise Sync"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-80 rounded-xl bg-surface-900 border border-zinc-700 shadow-2xl p-2 z-50 space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono text-zinc-500 uppercase tracking-wider flex justify-between items-center">
                  <span>Switch Workspace</span>
                  <span className="text-brand-400">Multi-Project</span>
                </div>

                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    onClick={() => {
                      onSelectProject(proj);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition ${
                      activeProject?.id === proj.id ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-300 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-brand-400 font-bold">[{proj.key}]</span>
                        <span>{proj.name}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 block">
                        {proj.mode === 'STANDALONE' ? '⚡ Native Firestore + Direct Git' : '🔗 Jira + Confluence Sync'}
                      </span>
                    </div>
                    {activeProject?.id === proj.id && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                ))}

                <div className="pt-1 border-t border-zinc-800">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setCreateModalOpen(true);
                    }}
                    className="w-full text-left p-2 rounded-lg text-xs text-brand-400 hover:bg-brand-500/10 flex items-center gap-2 font-semibold"
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

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Project Name *</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Payment Gateway Modernization"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Project Key Prefix *</label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    value={newProjectKey}
                    onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
                    placeholder="e.g. PAY, FIN, MED"
                    className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white font-mono uppercase focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Operating Mode *</label>
                  <select
                    value={newProjectMode}
                    onChange={(e) => setNewProjectMode(e.target.value)}
                    className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="STANDALONE">Standalone (Native Firestore + Git)</option>
                    <option value="ENTERPRISE_SYNC">Enterprise Sync (Jira + Confluence)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">GitHub Repository URL (Optional)</label>
                <input
                  type="text"
                  value={newGitRepo}
                  onChange={(e) => setNewGitRepo(e.target.value)}
                  placeholder="https://github.com/my-org/my-repo"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Google NotebookLM Workspace Link (Optional)</label>
                <input
                  type="text"
                  value={newNotebookLMUrl}
                  onChange={(e) => setNewNotebookLMUrl(e.target.value)}
                  placeholder="https://notebooklm.google.com/notebook/..."
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-md shadow-brand-500/20"
                >
                  Create & Launch Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
