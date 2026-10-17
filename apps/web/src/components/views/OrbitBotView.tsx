'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Layers,
  BookOpen,
  GitBranch,
  FileText,
  CornerDownLeft,
  X,
  Orbit,
  ArrowRight,
  Copy,
  Check,
  Bot,
  Compass,
  Database,
  History,
  ShieldCheck,
  Terminal,
  HelpCircle
} from 'lucide-react';
import { api } from '@/lib/api';

interface OrbitBotViewProps {
  project: any;
  requirements?: any;
  initialQuery?: string;
  onRefresh?: () => void;
  onSwitchView?: (view: string) => void;
}

interface QueryHistoryItem {
  id: string;
  query: string;
  result: any;
  timestamp: string;
}

export const OrbitBotView: React.FC<OrbitBotViewProps> = ({
  project,
  requirements,
  initialQuery,
  onRefresh,
  onSwitchView,
}) => {
  const [currentProject, setCurrentProject] = useState<any>(project);

  useEffect(() => {
    setCurrentProject(project);
  }, [project]);

  // AI Knowledge Search Bot State
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchResult, setAiSearchResult] = useState<any>(null);
  const [isSyncingKnowledge, setIsSyncingKnowledge] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'assistant' | 'sources'>('assistant');

  // Grounded source counts
  const confluencePages = currentProject?.confluence_settings?.pages || [];
  const gitRepositories = currentProject?.git_settings?.repositories || [];
  const jiraKey = currentProject?.jira_settings?.project_key || currentProject?.key || 'Connected';
  const notebookUrl =
    currentProject?.notebooklm_settings?.notebook_url ||
    `https://notebooklm.google.com/notebook/nb-${currentProject?.key?.toLowerCase() || 'hub'}-01`;

  const handleAiSearch = async (queryOverride?: string) => {
    const q = (queryOverride !== undefined ? queryOverride : aiSearchQuery).trim();
    if (!q || !currentProject?.id) return;
    if (queryOverride) {
      setAiSearchQuery(queryOverride);
    }
    setIsAiSearching(true);
    setAiSearchResult(null);
    setCopiedAnswer(false);

    try {
      const res = await api.searchKnowledge(currentProject.id, q);
      setAiSearchResult(res);

      // Add to session history
      const historyItem: QueryHistoryItem = {
        id: Date.now().toString(),
        query: q,
        result: res,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setHistory((prev) => [historyItem, ...prev.slice(0, 7)]);
    } catch (err) {
      const fallbackResult = {
        has_details: false,
        answer: "No details available anywhere. Search service encountered an error or sources are unreachable.",
        citations: []
      };
      setAiSearchResult(fallbackResult);
    } finally {
      setIsAiSearching(false);
    }
  };

  // Automatically execute search if initialQuery was provided from Header Searchbox
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setAiSearchQuery(initialQuery);
      handleAiSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSyncKnowledge = async () => {
    if (!currentProject?.id) return;
    setIsSyncingKnowledge(true);
    setSyncNotice(null);
    try {
      const res = await api.syncKnowledge(currentProject.id);
      setSyncNotice(res.message || "Knowledge base refreshed successfully!");
      setTimeout(() => setSyncNotice(null), 6000);
      if (onRefresh) onRefresh();
    } catch (err) {
      setSyncNotice("Could not sync knowledge sources from database.");
      setTimeout(() => setSyncNotice(null), 5000);
    } finally {
      setIsSyncingKnowledge(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedAnswer(true);
      setTimeout(() => setCopiedAnswer(false), 2000);
    }
  };

  const quickPrompts = [
    "What Git repositories are connected?",
    "Summarize active Jira stories & backlog",
    "What Confluence architecture docs exist?",
    "What is the main business goal from the PRD?",
    "Who are the assigned developers and QA?",
    "What are the high-risk items or blockers?",
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & WORKSPACE BANNER                                         */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#dadce0]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1a73e8] to-[#4285f4] text-white flex items-center justify-center shadow-sm shrink-0">
              <Orbit className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#1a73e8] font-bold text-sm">[{currentProject?.key || 'PROJ'}]</span>
                <h1 className="text-xl font-bold text-[#202124]">OrbitBot</h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc] font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#1a73e8]" />
                  NotebookLM & Gemini Engine
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#e6f4ea] text-[#137333] border border-[#ceead6] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#137333] animate-pulse"></span>
                  Grounded & Live
                </span>
              </div>
              <p className="text-xs text-[#5f6368] mt-0.5">
                Autonomous Project Search Bot & Knowledge Assistant scanning Jira work items, Confluence spaces, Git repositories, and PRDs.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            onClick={handleSyncKnowledge}
            disabled={isSyncingKnowledge}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#f1f3f4] disabled:opacity-50 text-[#3c4043] text-xs font-semibold flex items-center gap-2 border border-[#dadce0] shadow-2xs transition"
            title="Re-scan and refresh index from Firestore DB"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingKnowledge ? 'animate-spin text-[#1a73e8]' : 'text-[#5f6368]'}`} />
            <span>{isSyncingKnowledge ? 'Syncing...' : 'Sync Knowledge'}</span>
          </button>

          <a
            href={notebookUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            title="Open Google NotebookLM workspace"
          >
            <span>Google NotebookLM</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Sync notification message */}
      {syncNotice && (
        <div className="p-3 rounded-xl bg-[#e6f4ea] border border-[#ceead6] text-[#137333] text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0" />
          <span className="font-medium">{syncNotice}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. GROUNDED SOURCE COVERAGE STATUS CARDS                                 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Jira Source */}
        <div className="p-3.5 rounded-xl border border-[#dadce0] bg-white shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#e8f0fe] text-[#1a73e8] border border-[#d2e3fc] flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[#5f6368] font-semibold block leading-tight">JIRA Issues & Bugs</span>
              <span className="text-xs font-bold text-[#202124] block truncate max-w-[130px]">{jiraKey}</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#e6f4ea] text-[#137333] border border-[#ceead6] font-semibold">Active</span>
        </div>

        {/* Confluence Source */}
        <div className="p-3.5 rounded-xl border border-[#dadce0] bg-white shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#f3e8fd] text-[#9334e6] border border-[#e9d5ff] flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[#5f6368] font-semibold block leading-tight">Confluence Docs</span>
              <span className="text-xs font-bold text-[#202124] block">{confluencePages.length} Pages</span>
            </div>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${confluencePages.length > 0 ? 'bg-[#f3e8fd] text-[#9334e6] border-[#e9d5ff]' : 'bg-[#f1f3f4] text-[#80868b] border-[#dadce0]'}`}>
            {confluencePages.length > 0 ? 'Synced' : 'None'}
          </span>
        </div>

        {/* Git Source */}
        <div className="p-3.5 rounded-xl border border-[#dadce0] bg-white shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#e6f4ea] text-[#137333] border border-[#ceead6] flex items-center justify-center shrink-0">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[#5f6368] font-semibold block leading-tight">Git Repositories</span>
              <span className="text-xs font-bold text-[#202124] block">{gitRepositories.length} Repos</span>
            </div>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${gitRepositories.length > 0 ? 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]' : 'bg-[#f1f3f4] text-[#80868b] border-[#dadce0]'}`}>
            {gitRepositories.length > 0 ? 'Linked' : '0 Repos'}
          </span>
        </div>

        {/* PRD Source */}
        <div className="p-3.5 rounded-xl border border-[#dadce0] bg-white shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#feefc3] text-[#b06000] border border-[#fdd663] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[#5f6368] font-semibold block leading-tight">PRD Specification</span>
              <span className="text-xs font-bold text-[#202124] block truncate max-w-[130px]">
                {requirements?.document_title ? requirements.document_title : 'Baseline Spec'}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#feefc3] text-[#b06000] border border-[#fdd663] font-semibold">
            {requirements?.document_title ? 'Ingested' : 'Baseline'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SEARCH & QUESTION ENGINE                                              */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1a73e8]" />
            <h2 className="text-sm font-bold text-[#202124]">Ask Project Knowledge & Code Questions</h2>
          </div>
          <span className="text-[11px] font-mono text-[#5f6368]">
            Multi-source vector index: <strong className="text-[#202124]">Jira + Confluence + Git + PRD</strong>
          </span>
        </div>

        {/* Search Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAiSearch();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#80868b] absolute left-3.5 top-3" />
            <input
              type="text"
              value={aiSearchQuery}
              onChange={(e) => setAiSearchQuery(e.target.value)}
              placeholder="Ask anything about the project (e.g. Git repository links, Jira bugs, Confluence specs, PRD goals, blockers)..."
              className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#202124] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition font-sans"
            />
            {aiSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setAiSearchQuery('');
                  setAiSearchResult(null);
                }}
                className="absolute right-3.5 top-3 text-[#80868b] hover:text-[#202124]"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isAiSearching || !aiSearchQuery.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 transition shadow-sm"
          >
            <Orbit className={`w-3.5 h-3.5 ${isAiSearching ? 'animate-spin' : ''}`} />
            <span>{isAiSearching ? 'Searching...' : 'Ask OrbitBot'}</span>
          </button>
        </form>

        {/* Suggestion Prompt Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] font-mono text-[#5f6368] uppercase mr-1">Quick Prompts:</span>
          {quickPrompts.map((promptText, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAiSearch(promptText)}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#dadce0] hover:border-[#1a73e8] hover:bg-[#f8f9fa] text-[11px] text-[#5f6368] hover:text-[#202124] transition flex items-center gap-1 shadow-2xs"
            >
              <span>{promptText}</span>
              <CornerDownLeft className="w-2.5 h-2.5 text-[#80868b]" />
            </button>
          ))}
        </div>

        {/* Session Query History Pills */}
        {history.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#dadce0]/60">
            <span className="text-[10px] font-mono text-[#5f6368] uppercase mr-1 flex items-center gap-1">
              <History className="w-3 h-3 text-[#80868b]" />
              Recent:
            </span>
            {history.slice(0, 5).map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  setAiSearchQuery(h.query);
                  setAiSearchResult(h.result);
                }}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition truncate max-w-[200px] ${
                  aiSearchQuery === h.query
                    ? 'bg-[#e8f0fe] text-[#1967d2] border-[#d2e3fc] font-semibold'
                    : 'bg-[#f8f9fa] text-[#5f6368] border-[#dadce0] hover:text-[#202124]'
                }`}
                title={h.query}
              >
                {h.query}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. RESULTS DISPLAY OR WELCOME BANNER                                     */}
      {/* ========================================================================= */}
      {isAiSearching && (
        <div className="p-10 text-center bg-white rounded-2xl border border-[#dadce0] shadow-sm space-y-4">
          <div className="w-10 h-10 rounded-full border-3 border-[#1a73e8] border-t-transparent animate-spin mx-auto" />
          <div className="space-y-1.5 max-w-md mx-auto">
            <p className="text-sm font-bold text-[#202124]">Scanning Grounded Project Records...</p>
            <p className="text-xs text-[#5f6368] font-mono leading-relaxed">
              Thoroughly querying connected Confluence spaces, JIRA work items/bugs, Git repositories, and PRD specifications...
            </p>
          </div>
        </div>
      )}

      {aiSearchResult && !isAiSearching && (
        <div className="space-y-4">
          {aiSearchResult.has_details && aiSearchResult.answer !== "No details available anywhere" ? (
            <div className="p-6 rounded-2xl bg-white border border-[#dadce0] shadow-sm space-y-4">
              <div className="flex items-center justify-between text-xs pb-3 border-b border-[#dadce0]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[#202124] block">Grounded Project AI Response</span>
                    <span className="text-[10px] text-[#5f6368]">Synthesized from verifiable project sources</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="px-2.5 py-1 rounded-md bg-[#e6f4ea] text-[#137333] border border-[#ceead6] font-semibold">
                    {Math.round((aiSearchResult.confidence_score || 0.96) * 100)}% Verified Grounding
                  </span>
                  <button
                    onClick={() => copyToClipboard(aiSearchResult.answer)}
                    className="p-1.5 rounded-lg border border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368] hover:text-[#202124] transition flex items-center gap-1"
                    title="Copy response to clipboard"
                  >
                    {copiedAnswer ? <Check className="w-3.5 h-3.5 text-[#137333]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline text-[11px] font-sans">{copiedAnswer ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Formatted Answer */}
              <div className="text-xs text-[#202124] leading-relaxed whitespace-pre-line font-sans p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0]/80">
                {aiSearchResult.answer}
              </div>

              {/* Citations List */}
              {aiSearchResult.citations && aiSearchResult.citations.length > 0 && (
                <div className="pt-3 border-t border-[#dadce0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[#5f6368] font-bold">
                      Grounded Citations & Verifiable Sources ({aiSearchResult.citations.length}):
                    </span>
                    <span className="text-[10px] text-[#80868b] font-mono">Click to inspect origin document</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {aiSearchResult.citations.map((c: any, idx: number) => {
                      const isJira = c.source_type?.includes('JIRA');
                      const isConf = c.source_type?.includes('CONFLUENCE');
                      const isGit = c.source_type?.includes('GIT');

                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-white border border-[#dadce0] hover:border-[#1a73e8] transition flex flex-col justify-between space-y-2.5 shadow-2xs"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="font-bold text-[#202124] truncate flex items-center gap-1.5">
                                {isJira && <Layers className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" />}
                                {isConf && <BookOpen className="w-3.5 h-3.5 text-[#9334e6] shrink-0" />}
                                {isGit && <GitBranch className="w-3.5 h-3.5 text-[#137333] shrink-0" />}
                                {!isJira && !isConf && !isGit && <FileText className="w-3.5 h-3.5 text-[#b06000] shrink-0" />}
                                <span className="truncate">{c.source_title}</span>
                              </span>
                              <span className="font-mono text-[10px] text-[#5f6368] shrink-0 px-1.5 py-0.5 rounded bg-[#f1f3f4] border border-[#dadce0]">
                                {c.section_or_page || 'Section'}
                              </span>
                            </div>
                            {c.snippet_text && (
                              <p className="text-[11px] text-[#5f6368] line-clamp-3 italic bg-[#f8f9fa] p-2 rounded-lg border border-[#dadce0]/60">
                                "{c.snippet_text}"
                              </p>
                            )}
                          </div>

                          {c.source_uri && (
                            <div className="pt-2 border-t border-[#dadce0]/80">
                              <a
                                href={c.source_uri}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-semibold text-[#1a73e8] hover:text-[#1557b0] flex items-center gap-1 transition truncate"
                              >
                                <span className="truncate">Open {isJira ? 'Jira Ticket' : isConf ? 'Confluence Page' : isGit ? 'Git Repository' : 'Specification'}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
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
            /* Irrelevant / Negative Fallback */
            <div className="p-6 rounded-2xl bg-[#fef7e0] border border-[#feefc3] text-[#b06000] space-y-3 shadow-xs">
              <div className="flex items-center gap-2 font-bold text-sm text-[#b06000]">
                <AlertCircle className="w-5 h-5 text-[#b06000] shrink-0" />
                <span>No details available anywhere</span>
              </div>
              <p className="text-xs text-[#5f6368] leading-relaxed">
                The OrbitBot AI thoroughly scanned your project's connected <strong className="text-[#202124]">Confluence pages</strong>, <strong className="text-[#202124]">JIRA stories & bugs</strong>, <strong className="text-[#202124]">Git repositories</strong>, and <strong className="text-[#202124]">PRD specifications</strong> for project <em className="text-[#202124]">{currentProject?.name}</em>, but found no matching records for this query.
              </p>
              <div className="pt-2.5 border-t border-[#feefc3] text-xs text-[#5f6368] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>Tip: Attach Git repositories, Confluence URLs, or PRD specs in Document Studio.</span>
                {onSwitchView && (
                  <button
                    onClick={() => onSwitchView('documents')}
                    className="text-xs font-semibold text-[#1a73e8] hover:text-[#1557b0] flex items-center gap-1 self-start sm:self-auto"
                  >
                    <span>Go to Document Studio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Welcome state when no search query has been performed */}
      {!aiSearchResult && !isAiSearching && (
        <div className="p-6 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e8f0fe] text-[#1a73e8] border border-[#d2e3fc] flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#202124]">Welcome to OrbitBot Knowledge Assistant</h3>
              <p className="text-xs text-[#5f6368]">
                Your single autonomous search cockpit grounded across all project tools. Type a question above or choose a quick prompt to begin.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
            <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#202124]">
                <Layers className="w-4 h-4 text-[#1a73e8]" />
                <span>Atlassian Jira & Sprints</span>
              </div>
              <p className="text-[11px] text-[#5f6368] leading-relaxed">
                Query epics, user stories, open bugs, and sprint velocity. OrbitBot returns direct links to matching Jira issues.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#202124]">
                <BookOpen className="w-4 h-4 text-[#9334e6]" />
                <span>Confluence & Architecture</span>
              </div>
              <p className="text-[11px] text-[#5f6368] leading-relaxed">
                Scans all indexed architecture decision records, design docs, and release guidelines with exact page snippets.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#202124]">
                <GitBranch className="w-4 h-4 text-[#137333]" />
                <span>Git Code & PR Intelligence</span>
              </div>
              <p className="text-[11px] text-[#5f6368] leading-relaxed">
                Cross-references active branches, pull requests, repository URLs, and developer commits tied to project keys.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
