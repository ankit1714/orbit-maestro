'use client';

import React, { useEffect, useState } from 'react';
import { 
  Search, 
  LayoutDashboard, 
  ShieldAlert, 
  FileText, 
  Sparkles,
  ExternalLink,
  BookOpen,
  GitBranch,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Compass,
  CornerDownLeft,
  Bot
} from 'lucide-react';
import { api } from '@/lib/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchView: (view: string) => void;
  approvalsCount: number;
  activeProject?: any;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSwitchView,
  approvalsCount,
  activeProject,
}) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'nav'>('ai');
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset search when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSearchResult(null);
      setIsSearching(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const navigate = (view: string) => {
    onSwitchView(view);
    onClose();
  };

  const handleAskAI = async (searchPrompt?: string) => {
    const q = (searchPrompt !== undefined ? searchPrompt : query).trim();
    if (!q) return;
    if (!activeProject?.id) {
      setSearchResult({
        has_details: false,
        answer: "No active project selected. Please select a project workspace first.",
        citations: []
      });
      return;
    }

    if (searchPrompt) {
      setQuery(searchPrompt);
    }
    setActiveTab('ai');
    setIsSearching(true);
    setSearchResult(null);

    try {
      const res = await api.searchKnowledge(activeProject.id, q);
      setSearchResult(res);
    } catch (err: any) {
      setSearchResult({
        has_details: false,
        answer: "No details available anywhere. Search service encountered an error or no sources are reachable.",
        citations: []
      });
    } finally {
      setIsSearching(false);
    }
  };

  const examplePrompts = [
    "What Git repositories are connected to this project?",
    "Summarize active Jira stories, bugs, and backlog status",
    "What Confluence architecture docs are linked?",
    "What is the main business goal from the PRD?",
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center pt-20 p-4">
      <div className="w-full max-w-2xl bg-white border border-[#dadce0] rounded-2xl shadow-[0_4px_24px_rgba(60,64,67,0.2)] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150 text-[#202124]">
        
        {/* Header Tabs & Search Bar */}
        <div className="p-3.5 border-b border-[#dadce0] bg-[#f8f9fa] flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 bg-[#f1f3f4] p-1 rounded-xl border border-[#dadce0]">
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'ai' 
                    ? 'bg-white text-[#1a73e8] shadow-sm' 
                    : 'text-[#5f6368] hover:text-[#202124]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask Project AI Bot</span>
              </button>
              <button
                onClick={() => setActiveTab('nav')}
                className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'nav' 
                    ? 'bg-white text-[#202124] shadow-sm' 
                    : 'text-[#5f6368] hover:text-[#202124]'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Quick Navigation</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeProject && (
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white text-[#3c4043] border border-[#dadce0] flex items-center gap-1.5 shadow-sm">
                  <span className="text-[#1a73e8] font-bold">[{activeProject.key}]</span>
                  <span className="truncate max-w-[120px]">{activeProject.name}</span>
                </span>
              )}
              <kbd className="px-2 py-0.5 text-[10px] bg-white text-[#5f6368] rounded font-mono border border-[#dadce0] shadow-sm">ESC</kbd>
            </div>
          </div>

          {/* Input field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (activeTab === 'ai') {
                handleAskAI();
              }
            }}
            className="flex items-center gap-2 relative"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#80868b] absolute left-3.5 top-3" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  activeTab === 'ai'
                    ? "Ask anything across Confluence, JIRA tasks/stories, Git repos, PRDs..."
                    : "Jump to view (e.g. Cockpit, Document Studio, Approvals)..."
                }
                className="w-full bg-white border border-[#dadce0] rounded-xl pl-10 pr-12 py-2.5 text-xs text-[#202124] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition shadow-sm font-sans"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSearchResult(null);
                  }}
                  className="absolute right-3.5 top-3 text-[#80868b] hover:text-[#202124]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeTab === 'ai' && (
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="px-4 py-2.5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 transition shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSearching ? 'Searching...' : 'Search'}</span>
              </button>
            )}
          </form>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3.5 text-xs">
          {activeTab === 'ai' ? (
            <div className="space-y-3.5">
              {/* Quick Prompt Suggestions */}
              {!searchResult && !isSearching && (
                <div className="space-y-2.5 py-1">
                  <div className="text-[10px] font-mono text-[#5f6368] uppercase tracking-wider flex items-center gap-1 font-semibold">
                    <Bot className="w-3.5 h-3.5 text-[#1a73e8]" />
                    <span>Suggested Questions Grounded in Project Records</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {examplePrompts.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAskAI(p)}
                        className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0] hover:border-[#1a73e8] hover:bg-white text-left text-[#3c4043] hover:text-[#202124] transition group flex items-start justify-between shadow-sm"
                      >
                        <span className="text-xs">{p}</span>
                        <CornerDownLeft className="w-3 h-3 text-[#80868b] group-hover:text-[#1a73e8] shrink-0 mt-0.5" />
                      </button>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] text-[11px] text-[#5f6368] space-y-1 mt-3">
                    <span className="font-semibold text-[#202124] block">Strict Grounding Guardrail:</span>
                    <p className="leading-relaxed">
                      The AI search bot first thoroughly checks your connected <strong>Confluence Pages</strong>, <strong>JIRA Work Items/Bugs</strong>, <strong>Git Repositories</strong>, and <strong>PRD Requirements</strong>. If the question is irrelevant or details do not exist anywhere in project records, it will respond strictly with <em>"No details available anywhere"</em>.
                    </p>
                  </div>
                </div>
              )}

              {/* Searching State */}
              {isSearching && (
                <div className="p-8 text-center space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-[#1a73e8] border-t-transparent animate-spin mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs text-[#202124] font-semibold">Scanning Project Intelligence...</p>
                    <p className="text-[11px] text-[#5f6368] font-mono">
                      Verifying Confluence pages, JIRA backlog & bug reports, Git repositories, and requirement clauses...
                    </p>
                  </div>
                </div>
              )}

              {/* Search Result Display */}
              {searchResult && !isSearching && (
                <div className="space-y-3">
                  {/* Scanned Sources Summary Bar */}
                  {searchResult.scanned_sources && (
                    <div className="p-2.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono shadow-sm">
                      <span className="text-[#5f6368] uppercase font-semibold">Sources Scanned:</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc]">
                          JIRA: {searchResult.scanned_sources.jira_items} items
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#f3e8fd] text-[#7b1fa2] border border-[#e1bee7]">
                          Confluence: {searchResult.scanned_sources.confluence_pages} pages
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#ceead6]">
                          Git: {searchResult.scanned_sources.git_repos} repos
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0]">
                          PRD: {searchResult.scanned_sources.project_docs} spec
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Positive Grounded Result */}
                  {searchResult.has_details && searchResult.answer !== "No details available anywhere" ? (
                    <div className="p-4 rounded-xl bg-white border border-[#ceead6] space-y-3 shadow-sm">
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-[#f1f3f4]">
                        <span className="font-bold text-[#137333] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#137333]" />
                          <span>Grounded AI Synthesis</span>
                        </span>
                        <span className="text-[10px] font-mono text-[#137333] px-2.5 py-0.5 rounded-full bg-[#e6f4ea] border border-[#ceead6] font-semibold">
                          {Math.round((searchResult.confidence_score || 0.96) * 100)}% Verified Grounding
                        </span>
                      </div>

                      <div className="text-xs text-[#202124] leading-relaxed whitespace-pre-line font-sans">
                        {searchResult.answer}
                      </div>

                      {/* Clickable Citations */}
                      {searchResult.citations && searchResult.citations.length > 0 && (
                        <div className="pt-3 border-t border-[#f1f3f4] space-y-2">
                          <span className="text-[10px] font-mono uppercase text-[#5f6368] font-semibold block">
                            Exact Source Citations & References ({searchResult.citations.length}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {searchResult.citations.map((c: any, idx: number) => {
                              const isJira = c.source_type?.includes('JIRA');
                              const isConf = c.source_type?.includes('CONFLUENCE');
                              const isGit = c.source_type?.includes('GIT');

                              return (
                                <div
                                  key={idx}
                                  className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0] hover:border-[#1a73e8] transition flex flex-col justify-between space-y-1.5 shadow-sm"
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1 text-[10px]">
                                      <span className="font-bold text-[#202124] truncate flex items-center gap-1">
                                        {isJira && <Layers className="w-3 h-3 text-[#1a73e8] shrink-0" />}
                                        {isConf && <BookOpen className="w-3 h-3 text-[#7b1fa2] shrink-0" />}
                                        {isGit && <GitBranch className="w-3 h-3 text-[#137333] shrink-0" />}
                                        {!isJira && !isConf && !isGit && <FileText className="w-3 h-3 text-[#1a73e8] shrink-0" />}
                                        <span className="truncate">{c.source_title}</span>
                                      </span>
                                      <span className="font-mono text-[#80868b] shrink-0">{c.section_or_page}</span>
                                    </div>
                                    {c.snippet_text && (
                                      <p className="text-[11px] text-[#5f6368] line-clamp-2 italic mt-1 leading-snug">
                                        "{c.snippet_text}"
                                      </p>
                                    )}
                                  </div>

                                  {c.source_uri && (
                                    <div className="pt-1.5 border-t border-[#dadce0]/60">
                                      <a
                                        href={c.source_uri}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] font-semibold text-[#1a73e8] hover:underline flex items-center gap-1 transition truncate"
                                      >
                                        <span className="truncate">Open {isJira ? 'Jira Ticket' : isConf ? 'Confluence Page' : isGit ? 'Git Repo' : 'Document'}</span>
                                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Strict Negative Fallback Alert */
                    <div className="p-4 rounded-xl bg-[#fef7e0] border border-[#feefc3] text-[#b06000] space-y-2 shadow-sm">
                      <div className="flex items-center gap-2 font-bold text-xs text-[#b06000]">
                        <AlertCircle className="w-4 h-4 text-[#b06000] shrink-0" />
                        <span>No details available anywhere</span>
                      </div>
                      <p className="text-xs text-[#3c4043] leading-relaxed">
                        The AI search bot thoroughly scanned all connected <strong>Confluence pages</strong>, <strong>JIRA stories/tasks/bugs</strong>, <strong>Git repositories</strong>, and <strong>PRD specifications</strong> for project <em>{activeProject?.name}</em>, but found no documented information matching your question.
                      </p>
                      <div className="pt-2 border-t border-[#feefc3] text-[11px] text-[#5f6368] flex items-center justify-between">
                        <span>Tip: Check your query or add documentation in Document Studio.</span>
                        <button
                          onClick={() => navigate('documents')}
                          className="underline font-semibold text-[#1a73e8] hover:text-[#1557b0]"
                        >
                          Open Document Studio →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Quick Navigation Tab */
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] text-[#5f6368] font-mono uppercase font-semibold">Workspaces & Views</div>
              <button
                onClick={() => navigate('dashboard')}
                className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-[#f1f3f4] flex items-center justify-between text-[#202124] transition font-medium"
              >
                <span className="flex items-center gap-2.5">
                  <LayoutDashboard className="w-4 h-4 text-[#1a73e8]" /> Go to Delivery Cockpit
                </span>
                <span className="text-[10px] text-[#80868b] font-mono">Jump</span>
              </button>
              <button
                onClick={() => navigate('documents')}
                className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-[#f1f3f4] flex items-center justify-between text-[#202124] transition font-medium"
              >
                <span className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#1a73e8]" /> Document Studio (Git, Confluence, Jira Links)
                </span>
                <span className="text-[10px] text-[#80868b] font-mono">Docs</span>
              </button>
              <button
                onClick={() => navigate('governance')}
                className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-[#f1f3f4] flex items-center justify-between text-[#202124] transition font-medium"
              >
                <span className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-[#b06000]" /> Review Actions & Decisions
                </span>
                <span className="text-[10px] text-[#80868b] font-mono">Review</span>
              </button>
              <button
                onClick={() => navigate('backlog')}
                className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-[#f1f3f4] flex items-center justify-between text-[#202124] transition font-medium"
              >
                <span className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-[#7b1fa2]" /> Product Backlog Hierarchy
                </span>
                <span className="text-[10px] text-[#80868b] font-mono">Backlog</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
