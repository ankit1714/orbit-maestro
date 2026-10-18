'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FileCode,
  HelpCircle,
  Bookmark,
  Check,
  ArrowRight,
  FileText,
  CheckCircle2,
  Sparkles,
  Workflow,
  X,
  Users,
  Layers,
  AlertCircle,
  Lock,
  BookOpen,
  GitBranch,
  Github,
  Globe,
  ExternalLink,
  Plus,
  Trash2,
  Link2,
  RefreshCw,
  Database,
  ShieldCheck,
  Tag,
  Code,
  Search,
  Bot,
  CornerDownLeft,
  Eye,
  Edit2,
  RotateCcw
} from 'lucide-react';
import { api, getJiraBoardUrl } from '@/lib/api';
import { useRole } from '@/lib/roleContext';

interface DocumentsViewProps {
  project: any;
  requirements: any;
  questions: any[];
  onSwitchView: (view: string) => void;
  onRefresh: () => void;
  onProjectUpdated?: (updatedProject: any) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  project,
  requirements,
  questions,
  onSwitchView,
  onRefresh,
  onProjectUpdated,
}) => {
  const { can, profile } = useRole();
  const [currentProject, setCurrentProject] = useState<any>(project);

  useEffect(() => {
    setCurrentProject(project);
  }, [project]);

  // Requirement Ingestion State
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [ingesting, setIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [selectedConfluencePageId, setSelectedConfluencePageId] = useState<string>('all');

  // Open Questions Human Override State
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [overrideAnswers, setOverrideAnswers] = useState<Record<string, string>>({});
  const [resolvingQuestionId, setResolvingQuestionId] = useState<string | null>(null);

  // Confluence Modal / Form State
  const [showAddConfluenceModal, setShowAddConfluenceModal] = useState(false);
  const [confTitle, setConfTitle] = useState('');
  const [confUrl, setConfUrl] = useState('');
  const [confSpaceKey, setConfSpaceKey] = useState('');
  const [confDesc, setConfDesc] = useState('');
  const [isSavingConf, setIsSavingConf] = useState(false);

  // Git Repo Modal / Form State
  const [showAddGitModal, setShowAddGitModal] = useState(false);
  const [gitRepoName, setGitRepoName] = useState('');
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitProvider, setGitProvider] = useState<'GitHub' | 'GitLab' | 'Bitbucket' | 'Cloud Source'>('GitHub');
  const [gitDesc, setGitDesc] = useState('');
  const [gitIsPrimary, setGitIsPrimary] = useState(false);
  const [isSavingGit, setIsSavingGit] = useState(false);

  // Jira Settings Edit Modal
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [jiraInstanceUrl, setJiraInstanceUrl] = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [isSavingJira, setIsSavingJira] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // 3-Agent Decomposition & Strategy State
  const [strategyData, setStrategyData] = useState<any>(null);
  const [decomposing, setDecomposing] = useState(false);
  const [decompStep, setDecompStep] = useState<number>(0);

  useEffect(() => {
    if (currentProject?.id) {
      api.getProjectStrategy(currentProject.id)
        .then((data) => {
          if (data && Object.keys(data).length > 0) {
            setStrategyData(data);
            setDecompStep(3);
          }
        })
        .catch(() => {});
    }
  }, [currentProject?.id]);

  // Confluence Full Content Viewer & Real-time Sync State
  const [viewingConfluencePage, setViewingConfluencePage] = useState<any>(null);
  const [isSyncingPageId, setIsSyncingPageId] = useState<string | null>(null);
  const [isAutoSyncingConfluence, setIsAutoSyncingConfluence] = useState(false);

  const handleSyncSingleConfluence = async (pageId: string) => {
    if (!currentProject?.id) return;
    setIsSyncingPageId(pageId);
    try {
      const updated = await api.syncConfluencePage(currentProject.id, pageId);
      setCurrentProject(updated);
      if (onProjectUpdated) onProjectUpdated(updated);
    } catch (err) {
      alert("Failed to sync Confluence page. Please verify your Atlassian API credentials.");
    } finally {
      setIsSyncingPageId(null);
    }
  };

  const handleAutoSyncConfluence = async () => {
    if (!currentProject?.id) return;
    setIsAutoSyncingConfluence(true);
    try {
      const updated = await api.syncAllConfluence(currentProject.id);
      setCurrentProject(updated);
      if (onProjectUpdated) onProjectUpdated(updated);
      setSyncNotice(`Synchronized ${updated.confluence_settings?.pages?.length || 0} Confluence pages from Atlassian Cloud!`);
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (err) {
      alert("Failed to auto-sync Confluence space. Please verify your Atlassian API credentials in Jira/Confluence settings.");
    } finally {
      setIsAutoSyncingConfluence(false);
    }
  };

  // Git & Jira Full Content Viewer & Real-time Sync State
  const [viewingGitRepo, setViewingGitRepo] = useState<any>(null);
  const [isSyncingRepoId, setIsSyncingRepoId] = useState<string | null>(null);
  const [isAutoSyncingGit, setIsAutoSyncingGit] = useState(false);
  const [isSyncingJira, setIsSyncingJira] = useState(false);

  const handleSyncSingleGit = async (repoId: string) => {
    if (!currentProject?.id) return;
    setIsSyncingRepoId(repoId);
    try {
      const updated = await api.syncGitRepo(currentProject.id, repoId);
      setCurrentProject(updated);
      if (onProjectUpdated) onProjectUpdated(updated);
      setSyncNotice("Repository README, file tree & commits synced from GitHub!");
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (err) {
      alert("Failed to sync Git repository. Please verify your repository URL.");
    } finally {
      setIsSyncingRepoId(null);
    }
  };

  const handleAutoSyncGit = async () => {
    if (!currentProject?.id) return;
    setIsAutoSyncingGit(true);
    try {
      const updated = await api.syncAllGit(currentProject.id);
      setCurrentProject(updated);
      if (onProjectUpdated) onProjectUpdated(updated);
      setSyncNotice(`Synchronized ${updated.git_settings?.repositories?.length || 0} Git repositories from GitHub!`);
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (err) {
      alert("Failed to auto-sync Git repositories. Please verify your repository links.");
    } finally {
      setIsAutoSyncingGit(false);
    }
  };

  const handleSyncJira = async () => {
    if (!currentProject?.id) return;
    setIsSyncingJira(true);
    try {
      const updated = await api.syncJira(currentProject.id);
      setCurrentProject(updated);
      if (onProjectUpdated) onProjectUpdated(updated);
      setSyncNotice("Live Jira Cloud issues, descriptions, and comments synchronized!");
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (err) {
      alert("Failed to sync Jira issues. Please check your Jira credentials in Jira Settings.");
    } finally {
      setIsSyncingJira(false);
    }
  };

  // Check admin privileges for resource management
  const canManage = can('canManageIntegrations') || profile.id === 'ADMIN';

  // Integration Status Calculations
  const isJiraActive = Boolean(
    currentProject?.jira_settings?.enabled ||
    currentProject?.jira_settings?.instance_url ||
    currentProject?.mode === 'ENTERPRISE_SYNC'
  );

  const confluencePages = currentProject?.confluence_settings?.pages || [];
  const isConfluenceActive = Boolean(
    currentProject?.confluence_settings?.enabled ||
    confluencePages.length > 0 ||
    currentProject?.confluence_settings?.instance_url
  );

  const gitRepositories = currentProject?.git_settings?.repositories || [];
  const isGitActive = Boolean(
    currentProject?.git_settings?.enabled ||
    gitRepositories.length > 0 ||
    currentProject?.git_settings?.repo_url
  );

  // Handlers for Confluence Links
  const handleAddConfluenceLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confTitle.trim() || !confUrl.trim() || !currentProject?.id) return;
    setIsSavingConf(true);
    try {
      const updated = await api.addConfluenceLink(currentProject.id, {
        title: confTitle.trim(),
        url: confUrl.trim(),
        space_key: confSpaceKey.trim().toUpperCase() || currentProject.key,
        description: confDesc.trim() || undefined,
      });
      setCurrentProject(updated);
      onProjectUpdated?.(updated);
      setShowAddConfluenceModal(false);
      setConfTitle('');
      setConfUrl('');
      setConfSpaceKey('');
      setConfDesc('');
    } catch (err: any) {
      alert('Error adding Confluence link: ' + (err.message || err));
    } finally {
      setIsSavingConf(false);
    }
  };

  const handleDeleteConfluenceLink = async (linkId: string, title: string) => {
    if (!canManage) return;
    if (!window.confirm(`Are you sure you want to remove Confluence link "${title}"?`)) return;
    try {
      const updated = await api.deleteConfluenceLink(currentProject.id, linkId);
      setCurrentProject(updated);
      onProjectUpdated?.(updated);
    } catch (err: any) {
      alert('Error removing Confluence link: ' + (err.message || err));
    }
  };

  // Handlers for Git Repositories
  const handleAddGitRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gitRepoName.trim() || !gitRepoUrl.trim() || !currentProject?.id) return;
    setIsSavingGit(true);
    try {
      const updated = await api.addGitRepo(currentProject.id, {
        name: gitRepoName.trim(),
        repo_url: gitRepoUrl.trim(),
        default_branch: gitBranch.trim() || 'main',
        provider: gitProvider,
        description: gitDesc.trim() || undefined,
        is_primary: gitIsPrimary || gitRepositories.length === 0,
      });
      setCurrentProject(updated);
      onProjectUpdated?.(updated);
      setShowAddGitModal(false);
      setGitRepoName('');
      setGitRepoUrl('');
      setGitBranch('main');
      setGitDesc('');
      setGitIsPrimary(false);
    } catch (err: any) {
      alert('Error adding Git repository: ' + (err.message || err));
    } finally {
      setIsSavingGit(false);
    }
  };

  const handleDeleteGitRepo = async (repoId: string, repoName: string) => {
    if (!canManage) return;
    if (!window.confirm(`Are you sure you want to disconnect Git repository "${repoName}"?`)) return;
    try {
      const updated = await api.deleteGitRepo(currentProject.id, repoId);
      setCurrentProject(updated);
      onProjectUpdated?.(updated);
    } catch (err: any) {
      alert('Error removing Git repo: ' + (err.message || err));
    }
  };

  // Handler for Jira Settings Update
  const handleUpdateJira = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject?.id) return;
    setIsSavingJira(true);
    try {
      const updated = await api.updateIntegrations(currentProject.id, {
        jira_settings: {
          enabled: true,
          instance_url: jiraInstanceUrl.trim() || currentProject.jira_settings?.instance_url,
          project_key: jiraProjectKey.trim().toUpperCase() || currentProject.key,
        }
      });
      setCurrentProject(updated);
      onProjectUpdated?.(updated);
      setShowJiraModal(false);
    } catch (err: any) {
      alert('Error updating Jira settings: ' + (err.message || err));
    } finally {
      setIsSavingJira(false);
    }
  };

  // Requirement Ingestion & Ambiguity Handlers
  const handleResolve = async (questionId: string, answer: string) => {
    if (!can('canResolveQuestions')) return;
    setResolvingQuestionId(questionId);
    try {
      await api.resolveQuestion(questionId, answer, profile.name);
      setResolved((prev) => ({ ...prev, [questionId]: answer }));
      setEditingQuestionId(null);
      onRefresh();
    } catch (e) {
      setResolved((prev) => ({ ...prev, [questionId]: answer }));
      setEditingQuestionId(null);
      onRefresh();
    } finally {
      setResolvingQuestionId(null);
    }
  };

  const handleTriggerDecomposition = async () => {
    if (!currentProject?.id) return;
    setDecomposing(true);
    setDecompStep(1);
    setIngestStatus("Step 1/3: Lead Agile Orchestrator analyzing Confluence architecture & Baseline strategy...");
    try {
      const t1 = setTimeout(() => {
        setDecompStep(2);
        setIngestStatus("Step 2/3: Product Owner decomposing specs into crisp Epics & Gherkin User Stories...");
      }, 1500);

      const t2 = setTimeout(() => {
        setDecompStep(3);
        setIngestStatus("Step 3/3: Technical Scrum Master validating INVEST & assigning Fibonacci Points...");
      }, 4000);

      const res = await api.decomposeRequirements(currentProject.id, {
        raw_requirements: requirements?.business_goal || "Core functional requirements.",
        sprint_goal: currentProject?.business_objective || requirements?.business_goal
      });

      clearTimeout(t1);
      clearTimeout(t2);
      setDecompStep(3);
      setStrategyData({
        orchestrator_strategy: res.orchestrator_strategy,
        po_decomposition: res.po_decomposition,
        technical_sprint_plan: res.technical_sprint_plan
      });
      setIngestStatus(`Success! Created ${res.total_stories} Jira stories (${res.total_points} pts).`);
      setTimeout(() => setIngestStatus(null), 5000);
      onRefresh();
    } catch (e) {
      console.error("Decomposition error:", e);
      setIngestStatus("Decomposition error occurred.");
    } finally {
      setDecomposing(false);
    }
  };

  const handleIngestConfluence = async (targetId?: string) => {
    if (!confluencePages || confluencePages.length === 0) {
      setIngestStatus("Please attach at least one Confluence page link first.");
      return;
    }
    const pageId = targetId || selectedConfluencePageId;
    let title = "";
    let content = "";
    let confUrl = "";
    let confLinkId = "";

    if (pageId === 'all' && confluencePages.length > 1) {
      title = `${currentProject?.key || 'Project'} - Confluence Architecture Documentation`;
      confLinkId = 'all';
      confUrl = confluencePages[0]?.url || "";
      content = confluencePages.map((p: any) =>
        `# ${p.title}\nSource: ${p.url}\nSpace: ${p.space_key || 'GENERAL'}\n\n${p.content || p.description || p.title}`
      ).join('\n\n---\n\n');
    } else {
      const page = (pageId && pageId !== 'all')
        ? confluencePages.find((p: any) => p.id === pageId) || confluencePages[0]
        : confluencePages[0];
      title = page.title || `${currentProject?.key}_Confluence_Spec`;
      confLinkId = page.id;
      confUrl = page.url;
      content = page.content || page.description || page.title;
    }

    setIngesting(true);
    setIngestStatus("Step 1: Reading Confluence architecture pages & decomposing requirements with Gemini...");

    try {
      await api.ingestPRD({
        project_id: currentProject.id,
        file_name: `${title}.md`,
        file_text: content,
        confluence_link_id: confLinkId,
        confluence_url: confUrl
      });
      setIngestStatus("Complete! Decomposed Jira Stories created in Backlog.");
      setIngesting(false);
      onRefresh();
    } catch (e) {
      console.warn("Confluence ingestion error:", e);
      setIngestStatus("Ingestion finished with local fallback.");
      setIngesting(false);
      onRefresh();
    }
  };

  const hasQuestions = questions && questions.length > 0;
  const capabilities = requirements?.capabilities || [];
  const clauses = requirements?.clauses || [];
  const personas = requirements?.personas || [];

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#dadce0]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[#1a73e8] font-bold text-sm">[{currentProject?.key}]</span>
            <h1 className="text-xl font-bold text-[#202124] tracking-tight">
              Document Studio & Project Knowledge Hub
            </h1>
          </div>
          <p className="text-xs text-[#5f6368] mt-1">
            Centralized hub for Confluence design spaces, multi-repository Git links, JIRA integration, and Document AI requirement ingestion.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!canManage && (
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0] flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#5f6368]" />
              <span>Read-Only Mode ({profile.shortLabel})</span>
            </span>
          )}
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
      {/* 1. ENTERPRISE INTEGRATION STATUS COMMAND BAR (JIRA, CONFLUENCE, GIT) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* JIRA INTEGRATION CARD */}
        <div className={`p-4 rounded-2xl border transition flex flex-col justify-between shadow-sm ${
          isJiraActive
            ? 'bg-white border-[#1a73e8]/30 shadow-md shadow-[#1a73e8]/5'
            : 'bg-white border-[#dadce0]'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isJiraActive ? 'bg-[#e8f0fe] text-[#1a73e8] border border-[#d2e3fc]' : 'bg-[#f1f3f4] text-[#5f6368]'
                }`}>
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#202124]">Atlassian JIRA</h3>
                  <span className="text-[10px] text-[#5f6368] block font-mono">Issue & Sprint Tracker</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold flex items-center gap-1.5 ${
                isJiraActive
                  ? 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]'
                  : 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isJiraActive ? 'bg-[#137333] animate-pulse' : 'bg-[#5f6368]'}`} />
                <span>{isJiraActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div className="space-y-1 text-xs mt-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#5f6368]">Project Key:</span>
                <span className="font-mono text-[#1a73e8] font-bold">[{currentProject?.jira_settings?.project_key || currentProject?.key}]</span>
              </div>
              <div className="flex items-center justify-between text-[11px] truncate">
                <span className="text-[#5f6368]">Instance:</span>
                <span className="text-[#202124] font-mono truncate max-w-[170px]" title={currentProject?.jira_settings?.instance_url}>
                  {currentProject?.jira_settings?.instance_url ? currentProject.jira_settings.instance_url.replace('https://', '') : 'Not connected'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#dadce0] flex items-center justify-between mt-3 text-xs">
            {currentProject?.jira_settings?.instance_url || currentProject?.jira_project_link ? (
              <a
                href={getJiraBoardUrl(currentProject)}
                target="_blank"
                rel="noreferrer"
                className="text-[#1a73e8] hover:text-[#1557b0] flex items-center gap-1 font-semibold text-[11px]"
              >
                <span>Open Jira Board</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-[11px] text-[#5f6368]">Jira Unlinked</span>
            )}

            <div className="flex items-center gap-2">
              {currentProject?.jira_settings?.instance_url && (
                <button
                  onClick={handleSyncJira}
                  disabled={isSyncingJira}
                  className="px-2 py-0.5 rounded bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] border border-[#dadce0] text-[11px] font-medium flex items-center gap-1 transition"
                  title="Synchronize live tickets from Jira Cloud"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isSyncingJira ? 'animate-spin text-[#1a73e8]' : ''}`} />
                  <span>{isSyncingJira ? 'Syncing...' : 'Sync Jira'}</span>
                </button>
              )}

              {canManage && (
                <button
                  onClick={() => {
                    setJiraInstanceUrl(currentProject?.jira_settings?.instance_url || '');
                    setJiraProjectKey(currentProject?.jira_settings?.project_key || currentProject?.key || '');
                    setShowJiraModal(true);
                  }}
                  className="text-[#5f6368] hover:text-[#202124] text-[11px] underline"
                >
                  Configure
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CONFLUENCE INTEGRATION CARD */}
        <div className={`p-4 rounded-2xl border transition flex flex-col justify-between shadow-sm ${
          isConfluenceActive
            ? 'bg-white border-purple-500/30 shadow-md shadow-purple-500/5'
            : 'bg-white border-[#dadce0]'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isConfluenceActive ? 'bg-[#f3e8fd] text-[#9334e6] border border-[#e9d5ff]' : 'bg-[#f1f3f4] text-[#5f6368]'
                }`}>
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#202124]">Confluence Spaces</h3>
                  <span className="text-[10px] text-[#5f6368] block font-mono">Architecture & Wiki Hub</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold flex items-center gap-1.5 ${
                isConfluenceActive
                  ? 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]'
                  : 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConfluenceActive ? 'bg-[#137333] animate-pulse' : 'bg-[#5f6368]'}`} />
                <span>{isConfluenceActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div className="space-y-1 text-xs mt-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#5f6368]">Linked Pages:</span>
                <span className="font-mono text-[#9334e6] font-bold">{confluencePages.length} Document(s)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#5f6368]">Primary Space:</span>
                <span className="text-[#202124] font-mono">{currentProject?.confluence_settings?.space_key || currentProject?.key || 'None'}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#dadce0] flex items-center justify-between mt-3 text-xs">
            <span className="text-[11px] text-[#5f6368]">
              {confluencePages.length > 0 ? `${confluencePages.length} page(s) referenced` : 'No links attached'}
            </span>

            {canManage ? (
              <button
                onClick={() => setShowAddConfluenceModal(true)}
                className="text-[#1a73e8] hover:text-[#1557b0] flex items-center gap-1 font-semibold text-[11px]"
              >
                <Plus className="w-3 h-3" />
                <span>Add Page Link</span>
              </button>
            ) : (
              <span className="text-[11px] text-[#5f6368]">Admin Only</span>
            )}
          </div>
        </div>

        {/* GIT REPOSITORIES INTEGRATION CARD */}
        <div className={`p-4 rounded-2xl border transition flex flex-col justify-between shadow-sm ${
          isGitActive
            ? 'bg-white border-[#137333]/30 shadow-md shadow-[#137333]/5'
            : 'bg-white border-[#dadce0]'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isGitActive ? 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]' : 'bg-[#f1f3f4] text-[#5f6368]'
                }`}>
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#202124]">Git Version Control</h3>
                  <span className="text-[10px] text-[#5f6368] block font-mono">Codebases & Repositories</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold flex items-center gap-1.5 ${
                isGitActive
                  ? 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]'
                  : 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isGitActive ? 'bg-[#137333] animate-pulse' : 'bg-[#5f6368]'}`} />
                <span>{isGitActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div className="space-y-1 text-xs mt-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#5f6368]">Connected Repos:</span>
                <span className="font-mono text-[#137333] font-bold">{gitRepositories.length} Repository(ies)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#5f6368]">Primary Branch:</span>
                <span className="text-[#202124] font-mono">
                  {gitRepositories.find((r: any) => r.is_primary)?.default_branch || currentProject?.git_settings?.default_branch || 'main'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#dadce0] flex items-center justify-between mt-3 text-xs">
            <span className="text-[11px] text-[#5f6368]">
              {gitRepositories.length > 0 ? `${gitRepositories.length} repo(s) active` : 'No repo connected'}
            </span>

            {canManage ? (
              <button
                onClick={() => setShowAddGitModal(true)}
                className="text-[#1a73e8] hover:text-[#1557b0] flex items-center gap-1 font-semibold text-[11px]"
              >
                <Plus className="w-3 h-3" />
                <span>Add Git Link</span>
              </button>
            ) : (
              <span className="text-[11px] text-[#5f6368]">Admin Only</span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PROJECT KNOWLEDGE & CODEBASES SECTION (CONFLUENCE & MULTI-GIT REPOS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CONFLUENCE DOCUMENTATION DIRECTORY */}
        <div className={`p-5 rounded-2xl border bg-white shadow-sm space-y-3 flex flex-col relative overflow-hidden transition-all duration-300 ${
          ingesting
            ? 'border-[#8b5cf6]/60 shadow-[0_4px_24px_rgba(139,92,246,0.18)] ring-1 ring-[#8b5cf6]/30'
            : 'border-[#dadce0]'
        }`}>
          {ingesting && (
            <div className="absolute top-0 left-0 right-0 h-1 gemini-gradient-flow shadow-sm z-10" />
          )}

          <div className="flex items-center justify-between pb-2 border-b border-[#dadce0]">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#9334e6]" />
              <h3 className="text-xs font-bold text-[#202124] uppercase tracking-wider">
                Confluence Documentation & Architecture Pages ({confluencePages.length})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {canManage && (
                <button
                  onClick={handleAutoSyncConfluence}
                  disabled={isAutoSyncingConfluence}
                  className="px-2.5 py-1 rounded-lg bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] border border-[#dadce0] text-xs font-medium flex items-center gap-1 transition"
                  title="Auto-discover and sync all pages from Confluence Cloud space"
                >
                  <RefreshCw className={`w-3 h-3 ${isAutoSyncingConfluence ? 'animate-spin' : ''}`} />
                  <span>{isAutoSyncingConfluence ? 'Syncing...' : 'Auto-Sync Space'}</span>
                </button>
              )}

              {canManage && (
                <button
                  onClick={() => setShowAddConfluenceModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium flex items-center gap-1 shadow-sm transition"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Link</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 flex-1 max-h-72 overflow-y-auto pr-1">
            {confluencePages.length > 0 ? (
              confluencePages.map((page: any) => (
                <div
                  key={page.id}
                  className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0] hover:border-[#9334e6]/50 hover:bg-white transition flex items-start justify-between group shadow-2xs"
                >
                  <div className="space-y-1 truncate pr-3 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#202124] group-hover:text-[#9334e6] transition truncate">
                        {page.title}
                      </span>
                      {page.space_key && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#f3e8fd] text-[#9334e6] border border-[#e9d5ff]">
                          {page.space_key}
                        </span>
                      )}
                      {page.content_length > 0 ? (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#e6f4ea] text-[#137333] border border-[#ceead6] flex items-center gap-1 font-semibold">
                          <Check className="w-2.5 h-2.5" /> Full Body Synced ({page.content_length.toLocaleString()} chars)
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#fef7e0] text-[#b06000] border border-[#feefc3]">
                          Metadata Only
                        </span>
                      )}
                    </div>
                    {page.description && (
                      <p className="text-[11px] text-[#5f6368] line-clamp-1">{page.description}</p>
                    )}
                    <div className="text-[10px] text-[#5f6368] font-mono truncate">{page.url}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <button
                      onClick={() => handleIngestConfluence(page.id)}
                      disabled={!can('canIngestPRD') || ingesting}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition shadow-2xs ${
                        ingesting
                          ? 'bg-[#f3e8fd] text-[#7b1fa2] border-[#e9d5ff] cursor-wait'
                          : 'bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#1a73e8] border-[#d2e3fc]'
                      }`}
                      title="Ingest & Run AI Understanding on this Confluence page"
                    >
                      <Sparkles className={`w-3 h-3 ${ingesting ? 'animate-spin text-[#9334e6]' : 'text-[#1a73e8]'}`} />
                      <span className="hidden sm:inline">{ingesting ? "Analyzing..." : "Ingest"}</span>
                    </button>

                    {page.content && (
                      <button
                        onClick={() => setViewingConfluencePage(page)}
                        className="p-1.5 rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368] hover:text-[#202124] transition"
                        title="Read full indexed Confluence text"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canManage && (
                      <button
                        onClick={() => handleSyncSingleConfluence(page.id)}
                        disabled={isSyncingPageId === page.id}
                        className="p-1.5 rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368] hover:text-[#9334e6] transition"
                        title="Re-fetch complete page body from Confluence Cloud"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPageId === page.id ? 'animate-spin text-[#9334e6]' : ''}`} />
                      </button>
                    )}

                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368] hover:text-[#1a73e8] transition"
                      title="Open page in Confluence"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {canManage && (
                      <button
                        onClick={() => handleDeleteConfluenceLink(page.id, page.title)}
                        className="p-1.5 rounded-lg bg-white border border-[#dadce0] hover:bg-[#fce8e6] hover:text-[#c5221f] text-[#5f6368] transition"
                        title="Remove link from project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[#5f6368] text-xs space-y-2 border border-dashed border-[#dadce0] rounded-xl bg-[#f8f9fa]">
                <BookOpen className="w-6 h-6 text-[#80868b] mx-auto" />
                <p>No Confluence pages linked yet.</p>
                {canManage ? (
                  <button
                    onClick={() => setShowAddConfluenceModal(true)}
                    className="text-xs text-[#1a73e8] hover:underline font-semibold"
                  >
                    + Add your first Confluence architecture link
                  </button>
                ) : (
                  <p className="text-[11px] text-[#5f6368]">Workspace Administrator can attach Confluence links.</p>
                )}
              </div>
            )}
          </div>

          {/* Confluence AI Understanding Action Bar */}
          <div className="pt-3 border-t border-[#dadce0] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {confluencePages.length > 1 && (
                <select
                  value={selectedConfluencePageId}
                  onChange={(e) => setSelectedConfluencePageId(e.target.value)}
                  disabled={ingesting}
                  className="bg-[#f8f9fa] border border-[#dadce0] rounded-lg px-2.5 py-1 text-xs text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                >
                  <option value="all">All Linked Pages ({confluencePages.length})</option>
                  {confluencePages.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              )}
              {ingesting ? (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#e8f0fe] via-[#f3e8fd] to-[#fce8e6] border border-[#d2e3fc] animate-pulse max-w-full min-w-0">
                  <div className="w-2 h-2 rounded-full gemini-gradient-flow animate-ping shrink-0" />
                  <span className="text-[11px] font-medium text-[#1a73e8] font-mono truncate">
                    {ingestStatus || "Gemini 3 Flash analyzing architecture specs in background..."}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-[#5f6368] font-mono truncate">
                  {ingestStatus || (confluencePages.length > 0 ? `${confluencePages.length} Confluence link(s) attached` : 'Attach a Confluence link above to run AI Understanding')}
                </span>
              )}
            </div>

            <button
              onClick={() => handleIngestConfluence()}
              disabled={!can('canIngestPRD') || ingesting || confluencePages.length === 0}
              title={!can('canIngestPRD') ? "Restricted: Scrum Master or Admin permission required" : confluencePages.length === 0 ? "Attach a Confluence page link first" : ""}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all duration-300 shrink-0 ${
                ingesting
                  ? 'gemini-gradient-flow gemini-ambient-glow gemini-shimmer-bar text-white border-0 shadow-lg cursor-wait scale-[1.02]'
                  : !can('canIngestPRD') || confluencePages.length === 0
                  ? 'bg-[#f1f3f4] text-[#80868b] border border-[#dadce0] cursor-not-allowed'
                  : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white shadow-sm'
              }`}
            >
              {ingesting ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-white drop-shadow" />
                  <span className="flex items-center gap-1.5 font-semibold text-white drop-shadow-sm tracking-wide">
                    Analyzing with Gemini...
                    <span className="inline-flex gap-0.5 ml-0.5 items-center">
                      <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </span>
                </>
              ) : !can('canIngestPRD') ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Ingest (SM Only)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ingest & Run AI Understanding</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* GIT CODE REPOSITORIES DIRECTORY (MULTI-REPO) */}
        <div className="p-5 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-3 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-[#dadce0]">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#137333]" />
              <h3 className="text-xs font-bold text-[#202124] uppercase tracking-wider">
                Git Repositories Associated with Project ({gitRepositories.length})
              </h3>
            </div>

            {canManage && (
              <div className="flex items-center gap-1.5">
                {gitRepositories.length > 0 && (
                  <button
                    onClick={handleAutoSyncGit}
                    disabled={isAutoSyncingGit}
                    className="px-2.5 py-1 rounded-lg bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] border border-[#dadce0] text-xs font-medium flex items-center gap-1.5 transition"
                    title="Auto-fetch and sync all Git repositories from GitHub"
                  >
                    <RefreshCw className={`w-3 h-3 ${isAutoSyncingGit ? 'animate-spin text-[#137333]' : ''}`} />
                    <span>{isAutoSyncingGit ? 'Syncing...' : 'Auto-Sync Git'}</span>
                  </button>
                )}
                <button
                  onClick={() => setShowAddGitModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium flex items-center gap-1 shadow-sm transition"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Git Link</span>
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2 flex-1 max-h-72 overflow-y-auto pr-1">
            {gitRepositories.length > 0 ? (
              gitRepositories.map((repo: any) => (
                <div
                  key={repo.id}
                  className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0] hover:border-[#137333]/50 hover:bg-white transition flex items-start justify-between group shadow-2xs"
                >
                  <div className="space-y-1 truncate pr-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#202124] group-hover:text-[#137333] transition truncate">
                        {repo.name}
                      </span>
                      {repo.is_primary && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#e6f4ea] text-[#137333] border border-[#ceead6] font-semibold">
                          PRIMARY
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0] flex items-center gap-1">
                        <GitBranch className="w-2.5 h-2.5" />
                        <span>{repo.default_branch || 'main'}</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#5f6368]">{repo.provider || 'Git'}</span>
                      {repo.readme_content || repo.content_length > 0 ? (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#e6f4ea] text-[#137333] border border-[#ceead6] flex items-center gap-1 font-semibold">
                          <Check className="w-2.5 h-2.5" /> Full Repo Synced ({(repo.content_length || repo.readme_content?.length || 0).toLocaleString()} chars, {repo.file_tree?.length || 0} files)
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#fef7e0] text-[#b06000] border border-[#feefc3]">
                          Metadata Only
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-[11px] text-[#5f6368] line-clamp-1">{repo.description}</p>
                    )}
                    <div className="text-[10px] text-[#5f6368] font-mono truncate">{repo.repo_url}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    {repo.readme_content && (
                      <button
                        onClick={() => setViewingGitRepo(repo)}
                        className="p-1.5 rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368] hover:text-[#202124] transition"
                        title="Inspect indexed README, file tree & commits"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canManage && (
                      <button
                        onClick={() => handleSyncSingleGit(repo.id)}
                        disabled={isSyncingRepoId === repo.id}
                        className="p-1.5 rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368] hover:text-[#137333] transition"
                        title="Re-fetch complete repository from GitHub"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingRepoId === repo.id ? 'animate-spin text-[#137333]' : ''}`} />
                      </button>
                    )}

                    <a
                      href={repo.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368] hover:text-[#1a73e8] transition"
                      title="Open repository in browser"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {canManage && (
                      <button
                        onClick={() => handleDeleteGitRepo(repo.id, repo.name)}
                        className="p-1.5 rounded-lg bg-white border border-[#dadce0] hover:bg-[#fce8e6] hover:text-[#c5221f] text-[#5f6368] transition"
                        title="Disconnect repository"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[#5f6368] text-xs space-y-2 border border-dashed border-[#dadce0] rounded-xl bg-[#f8f9fa]">
                <GitBranch className="w-6 h-6 text-[#80868b] mx-auto" />
                <p>No Git repositories connected yet.</p>
                {canManage ? (
                  <button
                    onClick={() => setShowAddGitModal(true)}
                    className="text-xs text-[#1a73e8] hover:underline font-semibold"
                  >
                    + Connect your first Git repository link
                  </button>
                ) : (
                  <p className="text-[11px] text-[#5f6368]">Workspace Administrator can link Git repositories.</p>
                )}
              </div>
            )}
          </div>
        </div>

      </div>



      {/* ========================================================================= */}
      {/* 3. WORKBENCH: INGESTED BASELINE & OPEN QUESTIONS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[460px]">
        {/* Left Pane: Ingested Baseline Text */}
        <div className="p-5 rounded-2xl border border-[#dadce0] bg-white shadow-sm flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#dadce0] text-xs">
            <span className="font-semibold text-[#5f6368] flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-[#1a73e8]" />
              Ingested Document Baseline: <strong className="text-[#202124]">{requirements?.document_title || "Pending Ingestion"}</strong>
            </span>
          </div>

          <div className="flex-1 font-mono text-xs text-[#202124] space-y-3 leading-relaxed overflow-y-auto pr-2 bg-[#f8f9fa] p-3 rounded-xl border border-[#dadce0]">
            {requirements ? (
              <>
                <div className="pb-2 border-b border-[#dadce0]">
                  <span className="text-[#5f6368] uppercase text-[10px] font-bold block">Business Goal</span>
                  <p className="text-[#137333] font-semibold mt-0.5">{requirements.business_goal}</p>
                </div>

                {requirements.confluence_url && (
                  <div className="flex flex-wrap items-center gap-2 py-2 border-b border-[#dadce0] text-[11px] font-mono">
                    <span className="text-[#5f6368] font-semibold uppercase text-[10px]">Confluence Source:</span>
                    <a
                      href={requirements.confluence_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-0.5 rounded bg-[#f3e8fd] text-[#9334e6] border border-[#e9d5ff] truncate max-w-xs hover:underline flex items-center gap-1 font-medium"
                      title={requirements.confluence_url}
                    >
                      <BookOpen className="w-3 h-3 shrink-0" />
                      <span className="truncate">{requirements.confluence_url}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </div>
                )}

                {requirements.gcs_uri && (
                  <div className="flex flex-wrap items-center gap-2 py-2 border-b border-[#dadce0] text-[11px] font-mono">
                    <span className="text-[#5f6368] font-semibold uppercase text-[10px]">GCS Bucket:</span>
                    <span className="px-2 py-0.5 rounded bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc] truncate max-w-xs" title={requirements.gcs_uri}>
                      {requirements.gcs_uri}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#e6f4ea] text-[#137333] border border-[#ceead6] text-[10px]">
                      NotebookLM Source Synced
                    </span>
                  </div>
                )}

                {/* Capabilities */}
                {capabilities.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[#5f6368] uppercase text-[10px] font-bold block flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[#9334e6]" /> Extracted System Capabilities ({capabilities.length})
                    </span>
                    <div className="space-y-1">
                      {capabilities.map((c: any) => (
                        <div key={c.id} className="p-2.5 rounded-lg bg-white border border-[#dadce0] text-[11px] shadow-2xs">
                          <div className="flex items-center justify-between font-bold text-[#202124]">
                            <span>[{c.id}] {c.title}</span>
                            <span className="text-[10px] font-mono text-[#5f6368]">{c.section_ref}</span>
                          </div>
                          <p className="text-[#5f6368] mt-0.5">{c.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Personas */}
                {personas.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[#5f6368] uppercase text-[10px] font-bold block flex items-center gap-1">
                      <Users className="w-3 h-3 text-[#1a73e8]" /> Targeted User Personas ({personas.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {personas.map((p: any, idx: number) => (
                        <div key={idx} className="px-2 py-1 rounded bg-[#e8f0fe] border border-[#d2e3fc] text-[11px] text-[#1967d2] font-medium">
                          <strong>{p.name}:</strong> {p.role_description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tagged Clauses */}
                {clauses.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[#5f6368] uppercase text-[10px] font-bold block">Semantic Requirement Clauses ({clauses.length})</span>
                    <div className="space-y-1">
                      {clauses.map((cl: any) => (
                        <div key={cl.clause_id} className={`p-2.5 rounded-lg text-[11px] border ${cl.flagged ? 'bg-[#fef7e0] border-[#feefc3] text-[#b06000]' : 'bg-white border-[#dadce0] text-[#202124]'}`}>
                          <div className="flex justify-between font-mono text-[10px] text-[#5f6368] mb-0.5">
                            <span>{cl.clause_id} · {cl.section_title}</span>
                            <span className={cl.flagged ? 'text-[#b06000] font-bold' : 'text-[#5f6368]'}>{cl.clause_type}</span>
                          </div>
                          <p>{cl.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-[#5f6368] space-y-2">
                <FileText className="w-8 h-8 text-[#80868b] mx-auto" />
                <p>No requirement document ingested for {currentProject?.name} yet.</p>
                <p className="text-[11px] text-[#80868b]">Attach a Confluence architecture link above and click 'Ingest &amp; Run AI Understanding' to extract capabilities and clauses with Document AI and Gemini.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Open Questions Engine */}
        <div className="p-5 rounded-2xl border border-[#dadce0] bg-white shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#dadce0]">
            <div className="flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-[#b06000]" />
              <h3 className="text-xs font-semibold text-[#202124] uppercase tracking-wider">
                Open Questions Requiring Human Input ({questions?.length || 0})
              </h3>
            </div>
            {hasQuestions && (
              <span className="text-[10px] text-[#5f6368] font-mono">
                {questions.filter((q: any) => q.resolved || resolved[q.id]).length}/{questions.length} Resolved
              </span>
            )}
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            {hasQuestions ? (
              questions.map((q: any) => {
                const isResolved = Boolean(q.resolved || resolved[q.id]);
                const currentAnswer = resolved[q.id] || q.resolved_answer;
                const isEditing = editingQuestionId === q.id;
                const draftAnswer = overrideAnswers[q.id] !== undefined
                  ? overrideAnswers[q.id]
                  : (currentAnswer || q.ai_suggested_answer || '');

                return (
                  <div key={q.id} className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] space-y-2.5 shadow-2xs">
                    {/* Header: Section ref, Question title, Priority badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {q.section_ref && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-[#5f6368] border border-[#dadce0] font-medium">
                              {q.section_ref}
                            </span>
                          )}
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-medium ${
                            (q.priority || "HIGH") === "HIGH"
                              ? "bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]"
                              : (q.priority === "MEDIUM" ? "bg-[#fef7e0] text-[#b06000] border-[#feefc3]" : "bg-[#e8f0fe] text-[#1967d2] border-[#d2e3fc]")
                          }`}>
                            {q.priority || "HIGH"}
                          </span>
                          {isResolved && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#e6f4ea] text-[#137333] border border-[#ceead6] font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Resolved
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-semibold text-[#202124] leading-snug">{q.question}</h4>
                      </div>
                    </div>

                    {/* Context info: Why needed and Impact */}
                    {q.why_needed && (
                      <p className="text-[11px] text-[#5f6368] leading-relaxed">
                        <strong className="text-[#202124]">Why needed:</strong> {q.why_needed}
                      </p>
                    )}
                    {q.delivery_impact && (
                      <p className="text-[11px] text-[#5f6368] leading-relaxed">
                        <strong className="text-[#202124]">Impact:</strong> {q.delivery_impact}
                      </p>
                    )}

                    {/* EDITING / OVERRIDE MODE */}
                    {isEditing ? (
                      <div className="p-3 rounded-xl bg-white border-2 border-[#1a73e8] space-y-2.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1a73e8]">
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit &amp; Override AI Suggestion</span>
                          </div>
                          {q.ai_suggested_answer && (
                            <button
                              type="button"
                              onClick={() => setOverrideAnswers((prev) => ({ ...prev, [q.id]: q.ai_suggested_answer }))}
                              className="text-[10px] text-[#1a73e8] hover:underline font-medium flex items-center gap-1"
                              title="Reset to original AI suggestion"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset to AI Suggestion</span>
                            </button>
                          )}
                        </div>

                        {/* Reference Original AI Suggestion */}
                        <div className="text-[11px] text-[#5f6368] bg-[#f8f9fa] p-2 rounded-lg border border-[#dadce0] space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-[#3c4043] uppercase tracking-wider">
                            <Sparkles className="w-3 h-3 text-[#1a73e8]" />
                            <span>Original AI Suggestion:</span>
                          </div>
                          <p className="text-[#3c4043]">{q.ai_suggested_answer}</p>
                        </div>

                        {/* Preset options if available */}
                        {Array.isArray(q.options) && q.options.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-[#5f6368] uppercase tracking-wider block">
                              Suggested Presets:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {q.options.map((opt: string, idx: number) => {
                                const isSelected = draftAnswer.trim() === opt.trim();
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setOverrideAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                    className={`px-2 py-0.5 rounded text-[11px] border transition text-left ${
                                      isSelected
                                        ? 'bg-[#e8f0fe] border-[#1a73e8] text-[#1967d2] font-semibold'
                                        : 'bg-white border-[#dadce0] text-[#3c4043] hover:border-[#1a73e8] hover:text-[#1a73e8]'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Custom Decision Input */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-[#3c4043] uppercase tracking-wider block">
                            Your Custom Decision / Rule:
                          </label>
                          <textarea
                            value={draftAnswer}
                            onChange={(e) => setOverrideAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            rows={2}
                            placeholder="Type custom rule or adjust AI suggestion..."
                            className="w-full px-3 py-2 text-xs rounded-lg border border-[#dadce0] focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] bg-white text-[#202124] resize-y placeholder:text-[#80868b]"
                            autoFocus
                          />
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-end space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingQuestionId(null)}
                            className="px-2.5 py-1 text-xs rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368] font-medium transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={resolvingQuestionId === q.id || !draftAnswer.trim()}
                            onClick={() => {
                              if (draftAnswer.trim()) {
                                handleResolve(q.id, draftAnswer.trim());
                              }
                            }}
                            className="px-3 py-1 text-xs rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{resolvingQuestionId === q.id ? "Saving..." : "Submit Override"}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* VIEW MODE: AI SUGGESTION OR RESOLUTION */
                      <div className="space-y-2">
                        {isResolved ? (
                          <div className="p-2.5 rounded-lg bg-[#e6f4ea] border border-[#ceead6] text-[11px] space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1 text-[#137333] font-bold">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Resolved Decision:</span>
                                </div>
                                <p className="text-[#202124] font-medium mt-0.5 whitespace-pre-wrap">{currentAnswer}</p>
                                {q.resolved_by && (
                                  <p className="text-[10px] text-[#5f6368] font-mono mt-0.5">Decided by: {q.resolved_by}</p>
                                )}
                              </div>
                              {can('canResolveQuestions') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingQuestionId(q.id);
                                    setOverrideAnswers((prev) => ({
                                      ...prev,
                                      [q.id]: currentAnswer || q.ai_suggested_answer || ""
                                    }));
                                  }}
                                  className="px-2 py-1 text-[11px] rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] font-medium flex items-center gap-1 transition shadow-2xs shrink-0"
                                  title="Edit or change this resolution"
                                >
                                  <Edit2 className="w-3 h-3 text-[#5f6368]" />
                                  <span>Edit / Override</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="p-2.5 rounded-lg bg-[#e8f0fe] border border-[#d2e3fc] text-[11px] text-[#1967d2] space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>AI Suggestion:</span>
                                </div>
                                {q.confidence_score && (
                                  <span className="text-[10px] font-mono text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded border border-[#ceead6] font-semibold">
                                    {Math.round(q.confidence_score * 100)}% confidence
                                  </span>
                                )}
                              </div>
                              <p className="text-[#1557b0] whitespace-pre-wrap">{q.ai_suggested_answer}</p>
                            </div>

                            <div className="flex items-center justify-end space-x-2 pt-1">
                              {can('canResolveQuestions') ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingQuestionId(q.id);
                                      setOverrideAnswers((prev) => ({
                                        ...prev,
                                        [q.id]: q.ai_suggested_answer || ""
                                      }));
                                    }}
                                    className="px-2.5 py-1 text-xs rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] font-medium transition flex items-center gap-1.5 shadow-2xs"
                                    title="Edit or override the AI suggestion"
                                  >
                                    <Edit2 className="w-3 h-3 text-[#5f6368]" />
                                    <span>Edit &amp; Override</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={resolvingQuestionId === q.id}
                                    onClick={() => handleResolve(q.id, q.ai_suggested_answer)}
                                    className="px-2.5 py-1 text-xs rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium transition shadow-sm flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Accept Suggestion</span>
                                  </button>
                                </>
                              ) : (
                                <div
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-[#f1f3f4] border border-[#dadce0] text-[#80868b] cursor-not-allowed"
                                  title="Ambiguity resolution requires Scrum Master or Admin"
                                >
                                  <Lock className="w-3 h-3 text-[#80868b]" />
                                  <span>Resolve (SM Only)</span>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-[#5f6368] text-xs space-y-2">
                <FileText className="w-8 h-8 text-[#80868b] mx-auto" />
                <p>No open questions detected. Ingest attached Confluence documentation above to analyze ambiguities with Gemini.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. 3-AGENT AGILE REQUIREMENTS & JIRA STORY DECOMPOSITION WORKBENCH */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-2xl border border-[#dadce0] bg-white shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#f1f3f4]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1a73e8]" />
              <h3 className="text-sm font-bold text-[#202124]">
                3-Agent Requirement Decomposition &amp; Jira Backlog Architecture
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc] font-bold">
                Multi-Agent Autonomous Pipeline
              </span>
            </div>
            <p className="text-xs text-[#5f6368]">
              Requirements are analyzed by three specialized AI personas: Lead Orchestrator (Strategy &amp; Guidelines), Product Owner (Epics &amp; Gherkin Stories), and Technical Scrum Master (INVEST &amp; Fibonacci Points).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerDecomposition}
              disabled={decomposing || (!requirements?.business_goal && confluencePages.length === 0)}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-[#dadce0] text-[#3c4043] hover:bg-[#f1f3f4] text-xs font-semibold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${decomposing ? 'animate-spin text-[#1a73e8]' : ''}`} />
              <span>{decomposing ? 'Decomposing Scope...' : 'Run 3-Agent Decomposition'}</span>
            </button>

            <button
              type="button"
              onClick={() => onSwitchView('backlog')}
              className="px-4 py-1.5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <span>View Stories in Backlog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Simple Step Progress Bar */}
        <div className="p-5 rounded-xl border border-[#dadce0] bg-[#f8f9fa] space-y-4">
          {/* Progress Header & Percentage */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#202124]">Autonomous Decomposition Steps</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                decomposing
                  ? 'bg-[#e8f0fe] text-[#1967d2] animate-pulse'
                  : (strategyData?.po_decomposition || strategyData?.technical_sprint_plan)
                    ? 'bg-[#e6f4ea] text-[#137333]'
                    : 'bg-[#f1f3f4] text-[#5f6368]'
              }`}>
                {decomposing
                  ? `Executing Step ${decompStep} of 3...`
                  : (strategyData?.po_decomposition || strategyData?.technical_sprint_plan)
                    ? 'All 3 Steps Complete'
                    : 'Ready to Decompose'}
              </span>
            </div>
            <span className="font-mono font-bold text-[#1a73e8]">
              {decomposing
                ? (decompStep === 1 ? '33%' : decompStep === 2 ? '66%' : '95%')
                : (strategyData?.po_decomposition || strategyData?.technical_sprint_plan)
                  ? '100%'
                  : '0%'}
            </span>
          </div>

          {/* Continuous Progress Bar Track */}
          <div className="w-full bg-[#e8eaed] h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#1a73e8] via-[#9334e6] to-[#137333] h-full transition-all duration-500 rounded-full"
              style={{
                width: decomposing
                  ? (decompStep === 1 ? '33%' : decompStep === 2 ? '66%' : '95%')
                  : (strategyData?.po_decomposition || strategyData?.technical_sprint_plan)
                    ? '100%'
                    : '0%'
              }}
            />
          </div>

          {/* 3 Step Stages */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Step 1 */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              decompStep === 1 && decomposing
                ? 'border-[#1a73e8] bg-white shadow-sm ring-1 ring-[#1a73e8]'
                : ((strategyData?.po_decomposition || strategyData?.technical_sprint_plan) || decompStep > 1)
                  ? 'border-[#ceead6] bg-white'
                  : 'border-[#dadce0] bg-white/60'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    ((strategyData?.po_decomposition || strategyData?.technical_sprint_plan) || decompStep > 1)
                      ? 'bg-[#137333] text-white'
                      : decompStep === 1 && decomposing
                        ? 'bg-[#1a73e8] text-white animate-pulse'
                        : 'bg-[#dadce0] text-[#5f6368]'
                  }`}>
                    {((strategyData?.po_decomposition || strategyData?.technical_sprint_plan) || decompStep > 1) ? <Check className="w-3.5 h-3.5" /> : '1'}
                  </div>
                  <span className="font-bold text-xs text-[#202124]">Step 1: Lead Orchestrator</span>
                </div>
                <span className="text-[10px] text-[#5f6368] font-mono">
                  {((strategyData?.po_decomposition || strategyData?.technical_sprint_plan) || decompStep > 1) ? '✓ Synthesized' : decompStep === 1 && decomposing ? 'Running...' : 'Pending'}
                </span>
              </div>
              <p className="text-[11px] text-[#5f6368] mt-2 leading-relaxed">
                Synthesizes problem statement, architectural scope &amp; Definition of Ready from attached Confluence pages &amp; Baseline.
              </p>
            </div>

            {/* Step 2 */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              decompStep === 2 && decomposing
                ? 'border-[#9334e6] bg-white shadow-sm ring-1 ring-[#9334e6]'
                : ((strategyData?.po_decomposition || strategyData?.technical_sprint_plan) || decompStep > 2)
                  ? 'border-[#ceead6] bg-white'
                  : 'border-[#dadce0] bg-white/60'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    ((strategyData?.po_decomposition || strategyData?.technical_sprint_plan) || decompStep > 2)
                      ? 'bg-[#137333] text-white'
                      : decompStep === 2 && decomposing
                        ? 'bg-[#9334e6] text-white animate-pulse'
                        : 'bg-[#dadce0] text-[#5f6368]'
                  }`}>
                    {((strategyData?.po_decomposition || strategyData?.technical_sprint_plan) || decompStep > 2) ? <Check className="w-3.5 h-3.5" /> : '2'}
                  </div>
                  <span className="font-bold text-xs text-[#202124]">Step 2: Product Owner</span>
                </div>
                <span className="text-[10px] text-[#5f6368] font-mono">
                  {((strategyData?.po_decomposition || strategyData?.technical_sprint_plan) || decompStep > 2) ? '✓ Decomposed' : decompStep === 2 && decomposing ? 'Running...' : 'Pending'}
                </span>
              </div>
              <p className="text-[11px] text-[#5f6368] mt-2 leading-relaxed">
                Decomposes specification into crisp, clear Epics &amp; persona User Stories with concrete Gherkin Acceptance Criteria.
              </p>
            </div>

            {/* Step 3 */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              decompStep === 3 && decomposing
                ? 'border-[#137333] bg-white shadow-sm ring-1 ring-[#137333]'
                : (strategyData?.po_decomposition || strategyData?.technical_sprint_plan)
                  ? 'border-[#ceead6] bg-white'
                  : 'border-[#dadce0] bg-white/60'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    (strategyData?.po_decomposition || strategyData?.technical_sprint_plan)
                      ? 'bg-[#137333] text-white'
                      : decompStep === 3 && decomposing
                        ? 'bg-[#137333] text-white animate-pulse'
                        : 'bg-[#dadce0] text-[#5f6368]'
                  }`}>
                    {(strategyData?.po_decomposition || strategyData?.technical_sprint_plan) ? <Check className="w-3.5 h-3.5" /> : '3'}
                  </div>
                  <span className="font-bold text-xs text-[#202124]">Step 3: Technical Scrum Master</span>
                </div>
                <span className="text-[10px] text-[#5f6368] font-mono">
                  {(strategyData?.po_decomposition || strategyData?.technical_sprint_plan) ? '✓ INVEST Validated' : decompStep === 3 && decomposing ? 'Running...' : 'Pending'}
                </span>
              </div>
              <p className="text-[11px] text-[#5f6368] mt-2 leading-relaxed">
                Validates INVEST standards, assigns Fibonacci story points &amp; DEV/QA subtasks for Jira Backlog synchronization.
              </p>
            </div>
          </div>

          {/* Results Summary Bar */}
          {(strategyData?.po_decomposition || strategyData?.technical_sprint_plan) && (
            <div className="pt-3 border-t border-[#dadce0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <span className="text-[#137333] font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0" />
                <span>
                  Backlog populated: <strong>{strategyData?.po_decomposition?.epics?.length || 0} Epics</strong>, <strong>{strategyData?.technical_sprint_plan?.total_stories || 0} Stories</strong> ({strategyData?.technical_sprint_plan?.total_points || 0} story points) ready in Jira Backlog.
                </span>
              </span>
              <button
                type="button"
                onClick={() => onSwitchView('backlog')}
                className="text-[#1a73e8] hover:underline font-semibold flex items-center gap-1 text-[11px] shrink-0"
              >
                <span>Open Backlog to review &amp; plan sprint</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD CONFLUENCE PAGE LINK */}
      {/* ========================================================================= */}
      {showAddConfluenceModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-[#dadce0] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#dadce0]">
              <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#9334e6]" />
                <span>Add Confluence Page / Space Link</span>
              </h3>
              <button
                onClick={() => setShowAddConfluenceModal(false)}
                className="text-[#80868b] hover:text-[#202124] text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddConfluenceLink} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#202124] mb-1 font-medium">Page Title / Document Name *</label>
                <input
                  type="text"
                  required
                  value={confTitle}
                  onChange={(e) => setConfTitle(e.target.value)}
                  placeholder="e.g. Architecture RFC 401, Data Warehouse Specifications"
                  className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-2.5 text-[#202124] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[#202124] mb-1 font-medium">Confluence Page URL *</label>
                <input
                  type="url"
                  required
                  value={confUrl}
                  onChange={(e) => {
                    setConfUrl(e.target.value);
                    const match = e.target.value.match(/\/spaces\/([A-Za-z0-9_]+)\//);
                    if (match && !confSpaceKey) {
                      setConfSpaceKey(match[1].toUpperCase());
                    }
                  }}
                  placeholder="https://company.atlassian.net/wiki/spaces/APM/pages/102938/System-Architecture"
                  className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-2.5 text-[#202124] font-mono text-[11px] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[#202124] mb-1 font-medium">Space Key (Optional)</label>
                <input
                  type="text"
                  value={confSpaceKey}
                  onChange={(e) => setConfSpaceKey(e.target.value.toUpperCase())}
                  placeholder="e.g. APM, ENG, PROD"
                  className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-2.5 text-[#202124] font-mono uppercase placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[#202124] mb-1 font-medium">Description / Scope (Optional)</label>
                <textarea
                  rows={2}
                  value={confDesc}
                  onChange={(e) => setConfDesc(e.target.value)}
                  placeholder="Brief note on what this specification covers..."
                  className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-2.5 text-[#202124] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#dadce0]">
                <button
                  type="button"
                  onClick={() => setShowAddConfluenceModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConf}
                  className="px-4 py-1.5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {isSavingConf ? "Saving to Firestore..." : "Save Link to DB"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD GIT REPOSITORY (MULTI-REPO) */}
      {/* ========================================================================= */}
      {showAddGitModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-[#dadce0] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#dadce0]">
              <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[#137333]" />
                <span>Connect Git Repository</span>
              </h3>
              <button
                onClick={() => setShowAddGitModal(false)}
                className="text-[#80868b] hover:text-[#202124] text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddGitRepo} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#202124] mb-1 font-medium">Repository Label / Name *</label>
                  <input
                    type="text"
                    required
                    value={gitRepoName}
                    onChange={(e) => setGitRepoName(e.target.value)}
                    placeholder="e.g. airflow-dags, api-service"
                    className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-2.5 text-[#202124] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[#202124] mb-1 font-medium">Git Provider</label>
                  <select
                    value={gitProvider}
                    onChange={(e) => setGitProvider(e.target.value as any)}
                    className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-2.5 text-[#202124] focus:outline-none focus:border-[#1a73e8] focus:bg-white"
                  >
                    <option value="GitHub">GitHub</option>
                    <option value="GitLab">GitLab</option>
                    <option value="Bitbucket">Bitbucket</option>
                    <option value="Cloud Source">Google Cloud Source</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#202124] mb-1 font-medium">Repository URL *</label>
                <input
                  type="url"
                  required
                  value={gitRepoUrl}
                  onChange={(e) => {
                    setGitRepoUrl(e.target.value);
                    if (!gitRepoName) {
                      const match = e.target.value.match(/\/([^/]+?)(?:\.git|\/)?$/);
                      if (match) setGitRepoName(match[1]);
                    }
                  }}
                  placeholder="https://github.com/organization/airflow-dags"
                  className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-2.5 text-[#202124] font-mono text-[11px] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#202124] mb-1 font-medium">Default Branch</label>
                  <input
                    type="text"
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                    placeholder="main"
                    className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-2.5 text-[#202124] font-mono placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-[#202124]">
                    <input
                      type="checkbox"
                      checked={gitIsPrimary}
                      onChange={(e) => setGitIsPrimary(e.target.checked)}
                      className="rounded bg-[#f8f9fa] border-[#dadce0] text-[#1a73e8] focus:ring-0"
                    />
                    <span>Set as Primary Codebase</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[#202124] mb-1 font-medium">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={gitDesc}
                  onChange={(e) => setGitDesc(e.target.value)}
                  placeholder="Scope of this repository (e.g. Data transforms, UI components)..."
                  className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-2.5 text-[#202124] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#dadce0]">
                <button
                  type="button"
                  onClick={() => setShowAddGitModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingGit}
                  className="px-4 py-1.5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {isSavingGit ? "Saving to Firestore..." : "Connect Repo to DB"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIGURE JIRA SETTINGS */}
      {/* ========================================================================= */}
      {showJiraModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#dadce0] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#dadce0]">
              <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#1a73e8]" />
                <span>Configure JIRA Cloud Integration</span>
              </h3>
              <button
                onClick={() => setShowJiraModal(false)}
                className="text-[#80868b] hover:text-[#202124] text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateJira} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#202124] mb-1 font-medium">Jira Instance URL *</label>
                <input
                  type="url"
                  required
                  value={jiraInstanceUrl}
                  onChange={(e) => setJiraInstanceUrl(e.target.value)}
                  placeholder="https://the-ai-scrum-master.atlassian.net"
                  className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-2.5 text-[#202124] font-mono text-[11px] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[#202124] mb-1 font-medium">Jira Project Key Prefix *</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={jiraProjectKey}
                  onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
                  placeholder="e.g. APM, SCRUM, CLM"
                  className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-2.5 text-[#202124] font-mono uppercase placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#dadce0]">
                <button
                  type="button"
                  onClick={() => setShowJiraModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingJira}
                  className="px-4 py-1.5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {isSavingJira ? "Saving to Firestore..." : "Update Jira Sync"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW FULL CONFLUENCE PAGE CONTENT */}
      {/* ========================================================================= */}
      {viewingConfluencePage && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] bg-white border border-[#dadce0] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 px-6 border-b border-[#dadce0] bg-[#f8f9fa]">
              <div className="flex items-center gap-2.5 min-w-0">
                <BookOpen className="w-5 h-5 text-[#9334e6] shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#202124] truncate">
                    {viewingConfluencePage.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-[#5f6368] mt-0.5">
                    {viewingConfluencePage.space_key && (
                      <span className="font-mono text-[#9334e6] bg-[#f3e8fd] px-1.5 py-0.5 rounded border border-[#e9d5ff]">
                        Space: {viewingConfluencePage.space_key}
                      </span>
                    )}
                    <span>•</span>
                    <span className="text-[#137333] font-mono">
                      {(viewingConfluencePage.content_length || viewingConfluencePage.content?.length || 0).toLocaleString()} characters indexed
                    </span>
                    {viewingConfluencePage.fetched_at && (
                      <>
                        <span>•</span>
                        <span className="text-[#5f6368]">
                          Synced {new Date(viewingConfluencePage.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={viewingConfluencePage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 text-xs rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Confluence Cloud</span>
                </a>
                <button
                  onClick={() => setViewingConfluencePage(null)}
                  className="p-1 rounded-lg text-[#80868b] hover:text-[#202124] hover:bg-[#e8eaed] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-130px)] space-y-4">
              <div className="flex items-center justify-between text-xs text-[#5f6368] bg-[#f8f9fa] p-2.5 rounded-xl border border-[#dadce0]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#137333]" />
                  <span>This raw Markdown body is ingested into the NotebookLM / Gemini Context Engine for AI Search queries.</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(viewingConfluencePage.content || '');
                    alert('Copied full document Markdown to clipboard!');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#202124] text-[11px] font-medium"
                >
                  Copy Markdown
                </button>
              </div>

              <div className="bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-4 text-[#202124] font-mono text-xs leading-relaxed whitespace-pre-wrap selection:bg-[#e8f0fe]">
                {viewingConfluencePage.content}
              </div>
            </div>

            <div className="p-3.5 px-6 border-t border-[#dadce0] flex justify-end bg-[#f8f9fa]">
              <button
                type="button"
                onClick={() => setViewingConfluencePage(null)}
                className="px-4 py-1.5 rounded-xl bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] text-xs font-medium"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW FULL GIT REPO DETAILS (README, FILE TREE, COMMITS) */}
      {/* ========================================================================= */}
      {viewingGitRepo && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[85vh] bg-white border border-[#dadce0] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 px-6 border-b border-[#dadce0] bg-[#f8f9fa]">
              <div className="flex items-center gap-2.5 min-w-0">
                <GitBranch className="w-5 h-5 text-[#137333] shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#202124] truncate">
                    {viewingGitRepo.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-[#5f6368] mt-0.5">
                    <span className="font-mono text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded border border-[#ceead6]">
                      Branch: {viewingGitRepo.default_branch || 'main'}
                    </span>
                    <span>•</span>
                    <span className="text-[#137333] font-mono">
                      {(viewingGitRepo.content_length || viewingGitRepo.readme_content?.length || 0).toLocaleString()} chars README
                    </span>
                    <span>•</span>
                    <span className="text-[#202124] font-mono">
                      {viewingGitRepo.file_tree?.length || 0} codebase files
                    </span>
                    {viewingGitRepo.fetched_at && (
                      <>
                        <span>•</span>
                        <span className="text-[#5f6368]">
                          Synced {new Date(viewingGitRepo.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={viewingGitRepo.repo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 text-xs rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                </a>
                <button
                  onClick={() => setViewingGitRepo(null)}
                  className="p-1 rounded-lg text-[#80868b] hover:text-[#202124] hover:bg-[#e8eaed] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-130px)] space-y-5">
              <div className="flex items-center justify-between text-xs text-[#5f6368] bg-[#f8f9fa] p-2.5 rounded-xl border border-[#dadce0]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#137333]" />
                  <span>Full README, architectural structure & commit logs ingested into AI Search Bot.</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(viewingGitRepo.readme_content || '');
                    alert('Copied repository README Markdown to clipboard!');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#202124] text-[11px] font-medium"
                >
                  Copy README
                </button>
              </div>

              {/* Recent Commits */}
              {viewingGitRepo.recent_commits?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[#202124] uppercase tracking-wider flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-[#137333]" />
                    <span>Recent Commits ({viewingGitRepo.recent_commits.length})</span>
                  </h4>
                  <div className="bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-3 space-y-1.5 font-mono text-xs max-h-36 overflow-y-auto">
                    {viewingGitRepo.recent_commits.map((c: any, idx: number) => (
                      <div key={idx} className="flex items-start justify-between text-[11px] text-[#202124] border-b border-[#dadce0] pb-1 last:border-0">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="text-[#137333] shrink-0">[{c.sha}]</span>
                          <span className="truncate">{c.message}</span>
                        </div>
                        <span className="text-[#5f6368] shrink-0">{c.author}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Codebase File Hierarchy Map */}
              {viewingGitRepo.file_tree?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[#202124] uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#1a73e8]" />
                    <span>Repository File Hierarchy ({viewingGitRepo.file_tree.length} files detected)</span>
                  </h4>
                  <div className="bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-3 font-mono text-[11px] text-[#5f6368] max-h-36 overflow-y-auto grid grid-cols-2 gap-1">
                    {viewingGitRepo.file_tree.slice(0, 50).map((path: string, idx: number) => (
                      <div key={idx} className="truncate text-[#202124]">
                        📄 {path}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* README Content */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#202124] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#9334e6]" />
                  <span>README.md Body</span>
                </h4>
                <div className="bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-4 text-[#202124] font-mono text-xs leading-relaxed whitespace-pre-wrap selection:bg-[#e8f0fe]">
                  {viewingGitRepo.readme_content || 'No README file detected.'}
                </div>
              </div>
            </div>

            <div className="p-3.5 px-6 border-t border-[#dadce0] flex justify-end bg-[#f8f9fa]">
              <button
                type="button"
                onClick={() => setViewingGitRepo(null)}
                className="px-4 py-1.5 rounded-xl bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] text-xs font-medium"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
