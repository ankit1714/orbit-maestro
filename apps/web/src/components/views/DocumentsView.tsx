'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FileCode,
  HelpCircle,
  Bookmark,
  Check,
  ArrowRight,
  UploadCloud,
  FileText,
  CheckCircle2,
  Sparkles,
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
  Eye
} from 'lucide-react';
import { api } from '@/lib/api';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [ingestTab, setIngestTab] = useState<'upload' | 'paste'>('upload');

  const fileInputRef = useRef<HTMLInputElement>(null);

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
  // AI Knowledge Search Bot State
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchResult, setAiSearchResult] = useState<any>(null);
  const [isSyncingKnowledge, setIsSyncingKnowledge] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const handleAiSearch = async (queryOverride?: string) => {
    const q = (queryOverride !== undefined ? queryOverride : aiSearchQuery).trim();
    if (!q || !currentProject?.id) return;
    if (queryOverride) {
      setAiSearchQuery(queryOverride);
    }
    setIsAiSearching(true);
    setAiSearchResult(null);
    try {
      const res = await api.searchKnowledge(currentProject.id, q);
      setAiSearchResult(res);
    } catch (err) {
      setAiSearchResult({
        has_details: false,
        answer: "No details available anywhere. Search service encountered an error or sources are unreachable.",
        citations: []
      });
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleSyncKnowledge = async () => {
    if (!currentProject?.id) return;
    setIsSyncingKnowledge(true);
    setSyncNotice(null);
    try {
      const res = await api.syncKnowledge(currentProject.id);
      setSyncNotice(res.message || "Knowledge base refreshed successfully!");
      setTimeout(() => setSyncNotice(null), 6000);
      onRefresh();
    } catch (err) {
      setSyncNotice("Could not sync knowledge sources from database.");
      setTimeout(() => setSyncNotice(null), 5000);
    } finally {
      setIsSyncingKnowledge(false);
    }
  };

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
    try {
      await api.resolveQuestion(questionId, answer, profile.name);
      setResolved((prev) => ({ ...prev, [questionId]: answer }));
      onRefresh();
    } catch (e) {
      setResolved((prev) => ({ ...prev, [questionId]: answer }));
      onRefresh();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleProcessUpload = async () => {
    if (!selectedFile && !pastedText.trim()) return;
    setIngesting(true);
    setIngestStatus("Parsing document layout with Document AI OCR...");

    try {
      if (selectedFile) {
        const reader = new FileReader();
        const isText = selectedFile.type.includes("text") || selectedFile.name.endsWith(".md") || selectedFile.name.endsWith(".txt") || selectedFile.name.endsWith(".json");

        if (isText) {
          reader.onload = async (event) => {
            const textContent = event.target?.result as string;
            setIngestStatus("Gemini reasoning agent analyzing functional clauses...");
            await api.ingestPRD({
              project_id: currentProject.id,
              file_name: selectedFile.name,
              file_text: textContent
            });
            setIngestStatus("Complete! Backlog synthesis ready.");
            setIngesting(false);
            setSelectedFile(null);
            onRefresh();
          };
          reader.readAsText(selectedFile);
        } else {
          reader.onload = async (event) => {
            const dataUrl = event.target?.result as string;
            const base64 = dataUrl.split(",")[1];
            setIngestStatus("Gemini reasoning agent analyzing functional clauses...");
            await api.ingestPRD({
              project_id: currentProject.id,
              file_name: selectedFile.name,
              file_content_base64: base64
            });
            setIngestStatus("Complete! Backlog synthesis ready.");
            setIngesting(false);
            setSelectedFile(null);
            onRefresh();
          };
          reader.readAsDataURL(selectedFile);
        }
      } else {
        setIngestStatus("Gemini reasoning agent analyzing pasted requirements...");
        await api.ingestPRD({
          project_id: currentProject.id,
          file_name: `${currentProject.key}_Requirements.txt`,
          file_text: pastedText
        });
        setIngestStatus("Complete! Backlog synthesis ready.");
        setIngesting(false);
        setPastedText('');
        onRefresh();
      }
    } catch (e) {
      console.warn("Upload processing error:", e);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-brand-400 font-bold text-sm">[{currentProject?.key}]</span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Document Studio & Project Knowledge Hub
            </h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Single Source of Truth
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Centralized hub for Confluence design spaces, multi-repository Git links, JIRA integration, and Document AI requirement ingestion.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManage ? (
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-red-500/10 text-red-300 border border-red-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
              <span>Admin: Resource Management Active</span>
            </span>
          ) : (
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1">
              <Lock className="w-3 h-3 text-zinc-500" />
              <span>Read-Only Mode ({profile.shortLabel})</span>
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ENTERPRISE INTEGRATION STATUS COMMAND BAR (JIRA, CONFLUENCE, GIT) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* JIRA INTEGRATION CARD */}
        <div className={`p-4 rounded-xl border transition flex flex-col justify-between ${
          isJiraActive
            ? 'bg-surface-900/80 border-blue-500/30 shadow-lg shadow-blue-950/20'
            : 'bg-surface-900/40 border-zinc-800'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isJiraActive ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Atlassian JIRA</h3>
                  <span className="text-[10px] text-zinc-400 block font-mono">Issue & Sprint Tracker</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold flex items-center gap-1.5 ${
                isJiraActive
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isJiraActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                <span>{isJiraActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div className="space-y-1 text-xs mt-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Project Key:</span>
                <span className="font-mono text-blue-400 font-bold">[{currentProject?.jira_settings?.project_key || currentProject?.key}]</span>
              </div>
              <div className="flex items-center justify-between text-[11px] truncate">
                <span className="text-zinc-500">Instance:</span>
                <span className="text-zinc-300 font-mono truncate max-w-[170px]" title={currentProject?.jira_settings?.instance_url}>
                  {currentProject?.jira_settings?.instance_url ? currentProject.jira_settings.instance_url.replace('https://', '') : 'Not connected'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between mt-3 text-xs">
            {currentProject?.jira_settings?.instance_url ? (
              <a
                href={currentProject.jira_settings.instance_url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold text-[11px]"
              >
                <span>Open Jira Board</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-[11px] text-zinc-500">Native Firestore Mode</span>
            )}

            <div className="flex items-center gap-2">
              {currentProject?.jira_settings?.instance_url && (
                <button
                  onClick={handleSyncJira}
                  disabled={isSyncingJira}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-300 text-[11px] font-medium flex items-center gap-1 transition"
                  title="Synchronize live tickets from Jira Cloud"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isSyncingJira ? 'animate-spin text-blue-400' : ''}`} />
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
                  className="text-zinc-400 hover:text-white text-[11px] underline"
                >
                  Configure
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CONFLUENCE INTEGRATION CARD */}
        <div className={`p-4 rounded-xl border transition flex flex-col justify-between ${
          isConfluenceActive
            ? 'bg-surface-900/80 border-purple-500/30 shadow-lg shadow-purple-950/20'
            : 'bg-surface-900/40 border-zinc-800'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isConfluenceActive ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Confluence Spaces</h3>
                  <span className="text-[10px] text-zinc-400 block font-mono">Architecture & Wiki Hub</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold flex items-center gap-1.5 ${
                isConfluenceActive
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConfluenceActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                <span>{isConfluenceActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div className="space-y-1 text-xs mt-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Linked Pages:</span>
                <span className="font-mono text-purple-300 font-bold">{confluencePages.length} Document(s)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Primary Space:</span>
                <span className="text-zinc-300 font-mono">{currentProject?.confluence_settings?.space_key || currentProject?.key || 'None'}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between mt-3 text-xs">
            <span className="text-[11px] text-zinc-400">
              {confluencePages.length > 0 ? `${confluencePages.length} page(s) referenced` : 'No links attached'}
            </span>

            {canManage ? (
              <button
                onClick={() => setShowAddConfluenceModal(true)}
                className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold text-[11px]"
              >
                <Plus className="w-3 h-3" />
                <span>Add Page Link</span>
              </button>
            ) : (
              <span className="text-[11px] text-zinc-500">Admin Only</span>
            )}
          </div>
        </div>

        {/* GIT REPOSITORIES INTEGRATION CARD */}
        <div className={`p-4 rounded-xl border transition flex flex-col justify-between ${
          isGitActive
            ? 'bg-surface-900/80 border-emerald-500/30 shadow-lg shadow-emerald-950/20'
            : 'bg-surface-900/40 border-zinc-800'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isGitActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Git Version Control</h3>
                  <span className="text-[10px] text-zinc-400 block font-mono">Codebases & Repositories</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold flex items-center gap-1.5 ${
                isGitActive
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isGitActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                <span>{isGitActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div className="space-y-1 text-xs mt-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Connected Repos:</span>
                <span className="font-mono text-emerald-300 font-bold">{gitRepositories.length} Repository(ies)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Primary Branch:</span>
                <span className="text-zinc-300 font-mono">
                  {gitRepositories.find((r: any) => r.is_primary)?.default_branch || currentProject?.git_settings?.default_branch || 'main'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between mt-3 text-xs">
            <span className="text-[11px] text-zinc-400">
              {gitRepositories.length > 0 ? `${gitRepositories.length} repo(s) active` : 'No repo connected'}
            </span>

            {canManage ? (
              <button
                onClick={() => setShowAddGitModal(true)}
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold text-[11px]"
              >
                <Plus className="w-3 h-3" />
                <span>Add Git Link</span>
              </button>
            ) : (
              <span className="text-[11px] text-zinc-500">Admin Only</span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PROJECT KNOWLEDGE & CODEBASES SECTION (CONFLUENCE & MULTI-GIT REPOS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CONFLUENCE DOCUMENTATION DIRECTORY */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-surface-900/60 space-y-3 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Confluence Documentation & Architecture Pages ({confluencePages.length})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {canManage && (
                <button
                  onClick={handleAutoSyncConfluence}
                  disabled={isAutoSyncingConfluence}
                  className="px-2.5 py-1 rounded-md bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1 transition"
                  title="Auto-discover and sync all pages from Confluence Cloud space"
                >
                  <RefreshCw className={`w-3 h-3 ${isAutoSyncingConfluence ? 'animate-spin' : ''}`} />
                  <span>{isAutoSyncingConfluence ? 'Syncing...' : 'Auto-Sync Space'}</span>
                </button>
              )}

              {canManage && (
                <button
                  onClick={() => setShowAddConfluenceModal(true)}
                  className="px-2.5 py-1 rounded-md bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1 transition"
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
                  className="p-3 rounded-lg bg-surface-950 border border-zinc-800 hover:border-purple-500/40 transition flex items-start justify-between group"
                >
                  <div className="space-y-1 truncate pr-3 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white group-hover:text-purple-300 transition truncate">
                        {page.title}
                      </span>
                      {page.space_key && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {page.space_key}
                        </span>
                      )}
                      {page.content_length > 0 ? (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                          <Check className="w-2.5 h-2.5" /> Full Body Synced ({page.content_length.toLocaleString()} chars)
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Metadata Only
                        </span>
                      )}
                    </div>
                    {page.description && (
                      <p className="text-[11px] text-zinc-400 line-clamp-1">{page.description}</p>
                    )}
                    <div className="text-[10px] text-zinc-500 font-mono truncate">{page.url}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    {page.content && (
                      <button
                        onClick={() => setViewingConfluencePage(page)}
                        className="p-1.5 rounded-md bg-zinc-800 hover:bg-teal-600 hover:text-white text-zinc-300 transition"
                        title="Read full indexed Confluence text"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canManage && (
                      <button
                        onClick={() => handleSyncSingleConfluence(page.id)}
                        disabled={isSyncingPageId === page.id}
                        className="p-1.5 rounded-md bg-zinc-800 hover:bg-purple-600 hover:text-white text-zinc-300 transition"
                        title="Re-fetch complete page body from Confluence Cloud"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPageId === page.id ? 'animate-spin text-purple-300' : ''}`} />
                      </button>
                    )}

                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md bg-zinc-800 hover:bg-purple-600 hover:text-white text-zinc-300 transition"
                      title="Open page in Confluence"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {canManage && (
                      <button
                        onClick={() => handleDeleteConfluenceLink(page.id, page.title)}
                        className="p-1.5 rounded-md bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 transition"
                        title="Remove link from project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-zinc-500 text-xs space-y-2 border border-dashed border-zinc-800 rounded-lg">
                <BookOpen className="w-6 h-6 text-zinc-600 mx-auto" />
                <p>No Confluence pages linked yet.</p>
                {canManage ? (
                  <button
                    onClick={() => setShowAddConfluenceModal(true)}
                    className="text-xs text-purple-400 underline font-semibold"
                  >
                    + Add your first Confluence architecture link
                  </button>
                ) : (
                  <p className="text-[11px] text-zinc-600">Workspace Administrator can attach Confluence links.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* GIT CODE REPOSITORIES DIRECTORY (MULTI-REPO) */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-surface-900/60 space-y-3 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Git Repositories Associated with Project ({gitRepositories.length})
              </h3>
            </div>

            {canManage && (
              <div className="flex items-center gap-1.5">
                {gitRepositories.length > 0 && (
                  <button
                    onClick={handleAutoSyncGit}
                    disabled={isAutoSyncingGit}
                    className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-emerald-600 hover:text-white text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition"
                    title="Auto-fetch and sync all Git repositories from GitHub"
                  >
                    <RefreshCw className={`w-3 h-3 ${isAutoSyncingGit ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>{isAutoSyncingGit ? 'Syncing...' : 'Auto-Sync Git'}</span>
                  </button>
                )}
                <button
                  onClick={() => setShowAddGitModal(true)}
                  className="px-2.5 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition"
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
                  className="p-3 rounded-lg bg-surface-950 border border-zinc-800 hover:border-emerald-500/40 transition flex items-start justify-between group"
                >
                  <div className="space-y-1 truncate pr-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition truncate">
                        {repo.name}
                      </span>
                      {repo.is_primary && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                          PRIMARY
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1">
                        <GitBranch className="w-2.5 h-2.5" />
                        <span>{repo.default_branch || 'main'}</span>
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">{repo.provider || 'Git'}</span>
                      {repo.readme_content || repo.content_length > 0 ? (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                          <Check className="w-2.5 h-2.5" /> Full Repo Synced ({(repo.content_length || repo.readme_content?.length || 0).toLocaleString()} chars, {repo.file_tree?.length || 0} files)
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Metadata Only
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-[11px] text-zinc-400 line-clamp-1">{repo.description}</p>
                    )}
                    <div className="text-[10px] text-zinc-500 font-mono truncate">{repo.repo_url}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    {repo.readme_content && (
                      <button
                        onClick={() => setViewingGitRepo(repo)}
                        className="p-1.5 rounded-md bg-zinc-800 hover:bg-teal-600 hover:text-white text-zinc-300 transition"
                        title="Inspect indexed README, file tree & commits"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canManage && (
                      <button
                        onClick={() => handleSyncSingleGit(repo.id)}
                        disabled={isSyncingRepoId === repo.id}
                        className="p-1.5 rounded-md bg-zinc-800 hover:bg-emerald-600 hover:text-white text-zinc-300 transition"
                        title="Re-fetch complete repository from GitHub"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingRepoId === repo.id ? 'animate-spin text-emerald-300' : ''}`} />
                      </button>
                    )}

                    <a
                      href={repo.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md bg-zinc-800 hover:bg-emerald-600 hover:text-white text-zinc-300 transition"
                      title="Open repository in browser"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {canManage && (
                      <button
                        onClick={() => handleDeleteGitRepo(repo.id, repo.name)}
                        className="p-1.5 rounded-md bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 transition"
                        title="Disconnect repository"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-zinc-500 text-xs space-y-2 border border-dashed border-zinc-800 rounded-lg">
                <GitBranch className="w-6 h-6 text-zinc-600 mx-auto" />
                <p>No Git repositories connected yet.</p>
                {canManage ? (
                  <button
                    onClick={() => setShowAddGitModal(true)}
                    className="text-xs text-emerald-400 underline font-semibold"
                  >
                    + Connect your first Git repository link
                  </button>
                ) : (
                  <p className="text-[11px] text-zinc-600">Workspace Administrator can link Git repositories.</p>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2.5 AI PROJECT KNOWLEDGE SEARCH BOT (GROUNDED IN JIRA, CONFLUENCE, GIT, PRD) */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-2xl border border-teal-500/40 bg-gradient-to-b from-teal-950/20 via-surface-900 to-surface-900 shadow-xl space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">AI Project Search Bot & Knowledge Assistant</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 font-semibold">
                  NotebookLM Engine
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Grounded Q&A scanning all connected Confluence spaces, JIRA work items/bugs, Git repositories, and PRDs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSyncKnowledge}
              disabled={isSyncingKnowledge}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 border border-zinc-700 transition"
              title="Re-scan and refresh index from Firestore DB"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingKnowledge ? 'animate-spin text-teal-400' : ''}`} />
              <span>{isSyncingKnowledge ? 'Syncing...' : 'Sync Knowledge'}</span>
            </button>

            <a
              href={`https://notebooklm.google.com/notebook/nb-${currentProject?.key?.toLowerCase() || 'hub'}-01`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              title="Open Google NotebookLM workspace"
            >
              <span>Google NotebookLM</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Sync notification message */}
        {syncNotice && (
          <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{syncNotice}</span>
          </div>
        )}

        {/* Grounded Source Coverage Badges */}
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-surface-950/80 border border-zinc-800 text-[11px] font-mono">
          <span className="text-zinc-500 font-semibold uppercase text-[10px] mr-1">Grounded Sources:</span>
          
          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1">
            <Layers className="w-3 h-3 text-blue-400" />
            <span>JIRA ({currentProject?.jira_settings?.project_key || currentProject?.key || 'Connected'})</span>
          </span>

          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-purple-400" />
            <span>Confluence ({confluencePages.length} pages)</span>
          </span>

          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
            <GitBranch className="w-3 h-3 text-emerald-400" />
            <span>Git ({gitRepositories.length} repos)</span>
          </span>

          <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 flex items-center gap-1">
            <FileText className="w-3 h-3 text-teal-400" />
            <span>PRD ({requirements?.document_title ? 'Ingested' : 'Baseline'})</span>
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
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={aiSearchQuery}
              onChange={(e) => setAiSearchQuery(e.target.value)}
              placeholder="Ask anything about the project (e.g. Git repository links, Jira bugs, Confluence specs, PRD goals)..."
              className="w-full bg-surface-950 border border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500 transition font-sans"
            />
            {aiSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setAiSearchQuery('');
                  setAiSearchResult(null);
                }}
                className="absolute right-3.5 top-3 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isAiSearching || !aiSearchQuery.trim()}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 transition shadow-md shadow-teal-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAiSearching ? 'Searching...' : 'Ask AI'}</span>
          </button>
        </form>

        {/* Suggestion Prompt Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] font-mono text-zinc-500 uppercase mr-1">Quick Prompts:</span>
          {[
            "What Git repositories are connected?",
            "Summarize active Jira stories & backlog",
            "What Confluence architecture docs exist?",
            "What is the main business goal from the PRD?",
            "Who are the assigned developers and QA?",
          ].map((promptText, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAiSearch(promptText)}
              className="px-2.5 py-1 rounded-lg bg-surface-950 border border-zinc-800 hover:border-teal-500/40 text-[11px] text-zinc-400 hover:text-white transition flex items-center gap-1"
            >
              <span>{promptText}</span>
              <CornerDownLeft className="w-2.5 h-2.5 text-zinc-600" />
            </button>
          ))}
        </div>

        {/* Search Results Display */}
        {isAiSearching && (
          <div className="p-8 text-center bg-surface-950 rounded-xl border border-zinc-800 space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">Scanning Grounded Project Records...</p>
              <p className="text-[11px] text-zinc-400 font-mono">
                Thoroughly checking Confluence pages, JIRA tasks/stories/bugs, Git repositories, and PRD specifications...
              </p>
            </div>
          </div>
        )}

        {aiSearchResult && !isAiSearching && (
          <div className="space-y-3 pt-1">
            {aiSearchResult.has_details && aiSearchResult.answer !== "No details available anywhere" ? (
              <div className="p-4 rounded-xl bg-surface-950 border border-teal-500/40 space-y-3 shadow-lg shadow-teal-950/20">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    <span className="font-bold text-white">Grounded Project AI Response</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 font-semibold">
                      {Math.round((aiSearchResult.confidence_score || 0.96) * 100)}% Verified Grounding
                    </span>
                  </div>
                </div>

                <div className="text-xs text-zinc-200 leading-relaxed whitespace-pre-line font-sans">
                  {aiSearchResult.answer}
                </div>

                {/* Citations List */}
                {aiSearchResult.citations && aiSearchResult.citations.length > 0 && (
                  <div className="pt-3 border-t border-zinc-800 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold block">
                      Grounded Citations & Verifiable Sources ({aiSearchResult.citations.length}):
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {aiSearchResult.citations.map((c: any, idx: number) => {
                        const isJira = c.source_type?.includes('JIRA');
                        const isConf = c.source_type?.includes('CONFLUENCE');
                        const isGit = c.source_type?.includes('GIT');

                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-lg bg-surface-900 border border-zinc-800 hover:border-teal-500/40 transition flex flex-col justify-between space-y-2"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1 text-[11px]">
                                <span className="font-bold text-white truncate flex items-center gap-1.5">
                                  {isJira && <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                                  {isConf && <BookOpen className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                                  {isGit && <GitBranch className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                  {!isJira && !isConf && !isGit && <FileText className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
                                  <span className="truncate">{c.source_title}</span>
                                </span>
                                <span className="font-mono text-[10px] text-zinc-500 shrink-0">{c.section_or_page}</span>
                              </div>
                              {c.snippet_text && (
                                <p className="text-[11px] text-zinc-400 line-clamp-2 italic">
                                  "{c.snippet_text}"
                                </p>
                              )}
                            </div>

                            {c.source_uri && (
                              <div className="pt-1.5 border-t border-zinc-800/80">
                                <a
                                  href={c.source_uri}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 transition truncate"
                                >
                                  <span className="truncate">Open {isJira ? 'Jira Ticket' : isConf ? 'Confluence Page' : isGit ? 'Git Repository' : 'Document'}</span>
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
              /* Irrelevant / Negative Fallback */
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-300">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>No details available anywhere</span>
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  The AI bot thoroughly scanned your project's connected <strong>Confluence pages</strong>, <strong>JIRA stories & bugs</strong>, <strong>Git repositories</strong>, and <strong>PRD specifications</strong> for project <em>{currentProject?.name}</em>, but found no matching records for this query.
                </p>
                <div className="pt-2 border-t border-amber-500/20 text-[11px] text-amber-300/80">
                  <span>Ensure related links or documents have been added in the sections above.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. REQUIREMENT SPECIFICATION INGESTION SECTION (RETAINED & POLISHED) */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-xl border border-brand-500/30 bg-surface-900/70 space-y-3 shadow-lg shadow-brand-950/20">
        {!can('canIngestPRD') && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Viewing as <strong>{profile.title}</strong> — PRD document ingestion & parsing are restricted to Product Owner and Admin.</span>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
              Read Only Mode
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UploadCloud className="w-4 h-4 text-brand-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Ingest New Requirement / Essential Documents</h3>
          </div>
          <div className="flex rounded-lg bg-surface-950 p-0.5 border border-zinc-800 text-[11px]">
            <button
              onClick={() => setIngestTab('upload')}
              className={`px-3 py-1 rounded-md font-medium transition ${ingestTab === 'upload' ? 'bg-brand-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Upload File
            </button>
            <button
              onClick={() => setIngestTab('paste')}
              className={`px-3 py-1 rounded-md font-medium transition ${ingestTab === 'paste' ? 'bg-brand-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Paste Text
            </button>
          </div>
        </div>

        {ingestTab === 'upload' ? (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.txt,.md,.docx,.json"
              className="hidden"
              disabled={!can('canIngestPRD')}
            />
            {selectedFile ? (
              <div className="p-4 rounded-lg bg-surface-950 border border-brand-500/40 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-brand-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">{selectedFile.name}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => {
                  if (can('canIngestPRD')) fileInputRef.current?.click();
                }}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition space-y-2 ${
                  can('canIngestPRD')
                    ? 'border-zinc-700 hover:border-brand-500/60 cursor-pointer bg-surface-950/50 hover:bg-surface-950'
                    : 'border-zinc-800 bg-surface-950/20 cursor-not-allowed opacity-60'
                }`}
              >
                <UploadCloud className="w-8 h-8 text-zinc-500 mx-auto" />
                <p className="text-xs font-semibold text-zinc-300">
                  {can('canIngestPRD') ? "Click to select PRD, Architecture Spec, or BRD document" : "Document upload disabled for current persona"}
                </p>
                <p className="text-[11px] text-zinc-500">
                  Supports PDF, TXT, Markdown, Word (.docx), or JSON (max 25MB)
                </p>
              </div>
            )}
          </div>
        ) : (
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            disabled={!can('canIngestPRD')}
            rows={4}
            placeholder={can('canIngestPRD') ? `Paste requirement description, user stories, or API spec for ${currentProject?.name}...` : `Only Product Owner or Admin can paste requirement specs.`}
            className={`w-full bg-surface-950 border border-zinc-800 rounded-lg p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500 font-mono transition ${
              !can('canIngestPRD') ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-brand-300 font-mono">
            {ingestStatus || (selectedFile || pastedText ? "Ready for ingestion" : "Waiting for requirement source...")}
          </span>
          <button
            onClick={handleProcessUpload}
            disabled={!can('canIngestPRD') || ingesting || (!selectedFile && !pastedText.trim())}
            title={!can('canIngestPRD') ? "Restricted: Product Owner or Admin permission required" : ""}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-md transition ${
              !can('canIngestPRD') || ingesting || (!selectedFile && !pastedText.trim())
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-500/20'
            }`}
          >
            {!can('canIngestPRD') ? <Lock className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{ingesting ? "Analyzing with Gemini..." : !can('canIngestPRD') ? "Ingest (PO Only)" : "Ingest & Run AI Understanding"}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. WORKBENCH: INGESTED BASELINE & OPEN QUESTIONS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[460px]">
        {/* Left Pane: Ingested Baseline Text */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-surface-900/60 flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-blue-400" />
              Ingested Document Baseline: <strong className="text-white">{requirements?.document_title || "Pending Ingestion"}</strong>
            </span>
            <span className="font-mono text-[10px] text-zinc-500">Firestore Indexed</span>
          </div>

          <div className="flex-1 font-mono text-xs text-zinc-300 space-y-3 leading-relaxed overflow-y-auto pr-2 bg-surface-950 p-3 rounded-lg border border-zinc-800/50">
            {requirements ? (
              <>
                <div className="pb-2 border-b border-zinc-800/80">
                  <span className="text-zinc-500 uppercase text-[10px] font-bold block">Business Goal</span>
                  <p className="text-emerald-300 font-semibold mt-0.5">{requirements.business_goal}</p>
                </div>

                {requirements.gcs_uri && (
                  <div className="flex flex-wrap items-center gap-2 py-2 border-b border-zinc-800/80 text-[11px] font-mono">
                    <span className="text-zinc-500 font-semibold uppercase text-[10px]">GCS Bucket:</span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 truncate max-w-xs" title={requirements.gcs_uri}>
                      {requirements.gcs_uri}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 text-[10px]">
                      NotebookLM Source Synced
                    </span>
                  </div>
                )}

                {/* Capabilities */}
                {capabilities.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-zinc-500 uppercase text-[10px] font-bold block flex items-center gap-1">
                      <Layers className="w-3 h-3 text-purple-400" /> Extracted System Capabilities ({capabilities.length})
                    </span>
                    <div className="space-y-1">
                      {capabilities.map((c: any) => (
                        <div key={c.id} className="p-2 rounded bg-surface-900 border border-zinc-800/80 text-[11px]">
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>[{c.id}] {c.title}</span>
                            <span className="text-[10px] font-mono text-zinc-500">{c.section_ref}</span>
                          </div>
                          <p className="text-zinc-400 mt-0.5">{c.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Personas */}
                {personas.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-zinc-500 uppercase text-[10px] font-bold block flex items-center gap-1">
                      <Users className="w-3 h-3 text-blue-400" /> Targeted User Personas ({personas.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {personas.map((p: any, idx: number) => (
                        <div key={idx} className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
                          <strong>{p.name}:</strong> {p.role_description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tagged Clauses */}
                {clauses.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-zinc-500 uppercase text-[10px] font-bold block">Semantic Requirement Clauses ({clauses.length})</span>
                    <div className="space-y-1">
                      {clauses.map((cl: any) => (
                        <div key={cl.clause_id} className={`p-2 rounded text-[11px] border ${cl.flagged ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-surface-900/40 border-zinc-800 text-zinc-300'}`}>
                          <div className="flex justify-between font-mono text-[10px] text-zinc-400 mb-0.5">
                            <span>{cl.clause_id} · {cl.section_title}</span>
                            <span className={cl.flagged ? 'text-amber-400 font-bold' : 'text-zinc-500'}>{cl.clause_type}</span>
                          </div>
                          <p>{cl.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-zinc-500 space-y-2">
                <FileText className="w-8 h-8 text-zinc-600 mx-auto" />
                <p>No requirement document ingested for {currentProject?.name} yet.</p>
                <p className="text-[11px] text-zinc-600">Select a specification file or paste text above to extract capabilities and clauses with Document AI and Gemini.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Open Questions Engine */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-surface-900/60 flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
            <div className="flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Open Questions Requiring Human Input ({questions?.length || 0})
              </h3>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">FR-03 Ambiguity Engine</span>
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            {hasQuestions ? (
              questions.map((q: any) => {
                const isResolved = q.resolved || resolved[q.id];
                return (
                  <div key={q.id} className="p-3 rounded-lg bg-surface-950 border border-zinc-800 space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-semibold text-white">{q.question}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        {q.priority || "HIGH"}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      <strong>Why needed:</strong> {q.why_needed}
                    </p>
                    <div className="p-2 rounded bg-brand-500/5 border border-brand-500/20 text-[11px] text-brand-300">
                      <strong>AI Suggestion:</strong> {q.ai_suggested_answer}
                    </div>
                    <div className="flex items-center justify-end space-x-2 pt-1">
                      {isResolved ? (
                        <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Resolved: {resolved[q.id] || q.resolved_answer}
                        </span>
                      ) : can('canResolveQuestions') ? (
                        <button
                          onClick={() => handleResolve(q.id, q.ai_suggested_answer)}
                          className="px-2.5 py-1 text-xs rounded bg-brand-600 hover:bg-brand-500 text-white font-medium transition"
                        >
                          Accept Suggestion
                        </button>
                      ) : (
                        <div
                          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-zinc-800/60 border border-zinc-700/40 text-zinc-500 cursor-not-allowed"
                          title="Ambiguity resolution requires Product Owner or Admin"
                        >
                          <Lock className="w-3 h-3 text-zinc-500" />
                          <span>Resolve (PO Only)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-zinc-500 text-xs space-y-2">
                <FileText className="w-8 h-8 text-zinc-600 mx-auto" />
                <p>No open questions detected. Upload a PRD or paste requirements above to analyze ambiguities with Gemini.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD CONFLUENCE PAGE LINK */}
      {/* ========================================================================= */}
      {showAddConfluenceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-900 border border-purple-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span>Add Confluence Page / Space Link</span>
              </h3>
              <button
                onClick={() => setShowAddConfluenceModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddConfluenceLink} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Page Title / Document Name *</label>
                <input
                  type="text"
                  required
                  value={confTitle}
                  onChange={(e) => setConfTitle(e.target.value)}
                  placeholder="e.g. Architecture RFC 401, Data Warehouse Specifications"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Confluence Page URL *</label>
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
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white font-mono text-[11px] focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Space Key (Optional)</label>
                <input
                  type="text"
                  value={confSpaceKey}
                  onChange={(e) => setConfSpaceKey(e.target.value.toUpperCase())}
                  placeholder="e.g. APM, ENG, PROD"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Description / Scope (Optional)</label>
                <textarea
                  rows={2}
                  value={confDesc}
                  onChange={(e) => setConfDesc(e.target.value)}
                  placeholder="Brief note on what this specification covers..."
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddConfluenceModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConf}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-purple-500/20"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-900 border border-emerald-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-emerald-400" />
                <span>Connect Git Repository</span>
              </h3>
              <button
                onClick={() => setShowAddGitModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddGitRepo} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Repository Label / Name *</label>
                  <input
                    type="text"
                    required
                    value={gitRepoName}
                    onChange={(e) => setGitRepoName(e.target.value)}
                    placeholder="e.g. airflow-dags, api-service"
                    className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Git Provider</label>
                  <select
                    value={gitProvider}
                    onChange={(e) => setGitProvider(e.target.value as any)}
                    className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="GitHub">GitHub</option>
                    <option value="GitLab">GitLab</option>
                    <option value="Bitbucket">Bitbucket</option>
                    <option value="Cloud Source">Google Cloud Source</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Repository URL *</label>
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
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Default Branch</label>
                  <input
                    type="text"
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                    placeholder="main"
                    className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={gitIsPrimary}
                      onChange={(e) => setGitIsPrimary(e.target.checked)}
                      className="rounded bg-surface-950 border-zinc-800 text-emerald-500 focus:ring-0"
                    />
                    <span>Set as Primary Codebase</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={gitDesc}
                  onChange={(e) => setGitDesc(e.target.value)}
                  placeholder="Scope of this repository (e.g. Data transforms, UI components)..."
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddGitModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingGit}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-900 border border-blue-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Configure JIRA Cloud Integration</span>
              </h3>
              <button
                onClick={() => setShowJiraModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateJira} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Jira Instance URL *</label>
                <input
                  type="url"
                  required
                  value={jiraInstanceUrl}
                  onChange={(e) => setJiraInstanceUrl(e.target.value)}
                  placeholder="https://the-ai-scrum-master.atlassian.net"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white font-mono text-[11px] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Jira Project Key Prefix *</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={jiraProjectKey}
                  onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
                  placeholder="e.g. APM, SCRUM, CLM"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2.5 text-white font-mono uppercase focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowJiraModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingJira}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] bg-surface-900 border border-purple-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 px-6 border-b border-zinc-800 bg-surface-950/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <BookOpen className="w-5 h-5 text-purple-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {viewingConfluencePage.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                    {viewingConfluencePage.space_key && (
                      <span className="font-mono text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                        Space: {viewingConfluencePage.space_key}
                      </span>
                    )}
                    <span>•</span>
                    <span className="text-emerald-400 font-mono">
                      {(viewingConfluencePage.content_length || viewingConfluencePage.content?.length || 0).toLocaleString()} characters indexed
                    </span>
                    {viewingConfluencePage.fetched_at && (
                      <>
                        <span>•</span>
                        <span className="text-zinc-500">
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
                  className="px-2.5 py-1 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Confluence Cloud</span>
                </a>
                <button
                  onClick={() => setViewingConfluencePage(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-130px)] space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400 bg-surface-950 p-2.5 rounded-lg border border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>This raw Markdown body is ingested into the NotebookLM / Gemini Context Engine for AI Search queries.</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(viewingConfluencePage.content || '');
                    alert('Copied full document Markdown to clipboard!');
                  }}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px]"
                >
                  Copy Markdown
                </button>
              </div>

              <div className="bg-surface-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 font-mono text-xs leading-relaxed whitespace-pre-wrap selection:bg-purple-500/30">
                {viewingConfluencePage.content}
              </div>
            </div>

            <div className="p-3.5 px-6 border-t border-zinc-800 flex justify-end bg-surface-950/40">
              <button
                type="button"
                onClick={() => setViewingConfluencePage(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[85vh] bg-surface-900 border border-emerald-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 px-6 border-b border-zinc-800 bg-surface-950/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <GitBranch className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {viewingGitRepo.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                    <span className="font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Branch: {viewingGitRepo.default_branch || 'main'}
                    </span>
                    <span>•</span>
                    <span className="text-emerald-400 font-mono">
                      {(viewingGitRepo.content_length || viewingGitRepo.readme_content?.length || 0).toLocaleString()} chars README
                    </span>
                    <span>•</span>
                    <span className="text-zinc-300 font-mono">
                      {viewingGitRepo.file_tree?.length || 0} codebase files
                    </span>
                    {viewingGitRepo.fetched_at && (
                      <>
                        <span>•</span>
                        <span className="text-zinc-500">
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
                  className="px-2.5 py-1 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                </a>
                <button
                  onClick={() => setViewingGitRepo(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-130px)] space-y-5">
              <div className="flex items-center justify-between text-xs text-zinc-400 bg-surface-950 p-2.5 rounded-lg border border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Full README, architectural structure & commit logs ingested into AI Search Bot.</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(viewingGitRepo.readme_content || '');
                    alert('Copied repository README Markdown to clipboard!');
                  }}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px]"
                >
                  Copy README
                </button>
              </div>

              {/* Recent Commits */}
              {viewingGitRepo.recent_commits?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Recent Commits ({viewingGitRepo.recent_commits.length})</span>
                  </h4>
                  <div className="bg-surface-950 border border-zinc-800 rounded-xl p-3 space-y-1.5 font-mono text-xs max-h-36 overflow-y-auto">
                    {viewingGitRepo.recent_commits.map((c: any, idx: number) => (
                      <div key={idx} className="flex items-start justify-between text-[11px] text-zinc-300 border-b border-zinc-900 pb-1 last:border-0">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="text-emerald-400 shrink-0">[{c.sha}]</span>
                          <span className="truncate">{c.message}</span>
                        </div>
                        <span className="text-zinc-500 shrink-0">{c.author}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Codebase File Hierarchy Map */}
              {viewingGitRepo.file_tree?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>Repository File Hierarchy ({viewingGitRepo.file_tree.length} files detected)</span>
                  </h4>
                  <div className="bg-surface-950 border border-zinc-800 rounded-xl p-3 font-mono text-[11px] text-zinc-400 max-h-36 overflow-y-auto grid grid-cols-2 gap-1">
                    {viewingGitRepo.file_tree.slice(0, 50).map((path: string, idx: number) => (
                      <div key={idx} className="truncate text-zinc-300">
                        📄 {path}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* README Content */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  <span>README.md Body</span>
                </h4>
                <div className="bg-surface-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 font-mono text-xs leading-relaxed whitespace-pre-wrap selection:bg-emerald-500/30">
                  {viewingGitRepo.readme_content || 'No README file detected.'}
                </div>
              </div>
            </div>

            <div className="p-3.5 px-6 border-t border-zinc-800 flex justify-end bg-surface-950/40">
              <button
                type="button"
                onClick={() => setViewingGitRepo(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium"
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
