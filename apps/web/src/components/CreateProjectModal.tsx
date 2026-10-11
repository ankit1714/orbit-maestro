'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Users,
  Check,
  ArrowRight,
  ArrowLeft,
  Database,
  Link as LinkIcon,
  Lock,
  Sparkles,
  Plus,
  AlertCircle,
  RefreshCw,
  UserCheck,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Code,
  Bug,
  Crown,
  Briefcase
} from 'lucide-react';
import { useRole, DBUser } from '@/lib/roleContext';
import { api } from '@/lib/api';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (createdProject: any) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const { can, activeUser, profile } = useRole();

  // Wizard Step: 1 = Details, 2 = Team Selection, 3 = Summary Review, 4 = Final Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Project Details State
  const [projectName, setProjectName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [jiraLink, setJiraLink] = useState('');
  const [projectMode, setProjectMode] = useState<'ENTERPRISE_SYNC' | 'STANDALONE'>('ENTERPRISE_SYNC');
  const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);

  // Step 2: Team Members from Firestore DB
  const [dbUsers, setDbUsers] = useState<DBUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Selected Team Assignments
  const [selectedPO, setSelectedPO] = useState<DBUser | null>(null);
  const [selectedSM, setSelectedSM] = useState<DBUser | null>(null);
  const [selectedDevIds, setSelectedDevIds] = useState<string[]>([]);
  const [selectedQAIds, setSelectedQAIds] = useState<string[]>([]);

  // Inline Quick Add User State
  const [showQuickAddUser, setShowQuickAddUser] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickRole, setQuickRole] = useState<'DEVELOPER' | 'QA_ENGINEER' | 'PRODUCT_OWNER' | 'SCRUM_MASTER'>('DEVELOPER');
  const [quickTitle, setQuickTitle] = useState('');
  const [isSubmittingQuickUser, setIsSubmittingQuickUser] = useState(false);

  // Submission & Final Summary State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdProjectSummary, setCreatedProjectSummary] = useState<any | null>(null);

  // Fetch Firestore users when modal opens or step changes to 2
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    setUsersError(null);
    try {
      const users = await api.getUsers();
      setDbUsers(users || []);

      // Auto-suggest PO and SM if not already selected
      if (!selectedSM) {
        // If logged-in user is Scrum Master or Admin, preselect them
        if (activeUser && (activeUser.role === 'SCRUM_MASTER' || activeUser.role === 'ADMIN')) {
          setSelectedSM(activeUser);
        } else {
          const sm = users.find((u: DBUser) => u.role === 'SCRUM_MASTER') || users.find((u: DBUser) => u.role === 'ADMIN');
          if (sm) setSelectedSM(sm);
        }
      }

      if (!selectedPO) {
        if (activeUser && activeUser.role === 'PRODUCT_OWNER') {
          setSelectedPO(activeUser);
        } else {
          const po = users.find((u: DBUser) => u.role === 'PRODUCT_OWNER') || users.find((u: DBUser) => u.role === 'ADMIN');
          if (po) setSelectedPO(po);
        }
      }

      // Pre-select developers if none chosen yet
      if (selectedDevIds.length === 0) {
        const devs = users.filter((u: DBUser) => u.role === 'DEVELOPER');
        if (devs.length > 0) {
          setSelectedDevIds(devs.map((d: DBUser) => d.id));
        }
      }

      // Pre-select QAs if none chosen yet
      if (selectedQAIds.length === 0) {
        const qas = users.filter((u: DBUser) => u.role === 'QA_ENGINEER');
        if (qas.length > 0) {
          setSelectedQAIds(qas.map((q: DBUser) => q.id));
        }
      }
    } catch (err: any) {
      console.warn("Could not load users from Firestore:", err);
      setUsersError("Failed to fetch users from Firestore database. Please retry.");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  // Handle Project Name changes with intelligent Key suggestion
  const handleNameChange = (name: string) => {
    setProjectName(name);
    if (!isKeyManuallyEdited && !jiraLink) {
      const words = name.trim().split(/\s+/).filter(Boolean);
      if (words.length === 1) {
        setProjectKey(words[0].substring(0, 4).toUpperCase());
      } else if (words.length > 1) {
        setProjectKey(words.map(w => w[0]).join('').substring(0, 5).toUpperCase());
      }
    }
  };

  // Handle Jira Link changes with auto-key extraction
  const handleJiraLinkChange = (link: string) => {
    setJiraLink(link);
    if (link.trim()) {
      const match = link.match(/\/(?:projects|browse)\/([A-Za-z0-9_]+)/);
      if (match) {
        setProjectKey(match[1].toUpperCase());
        setIsKeyManuallyEdited(true);
      }
      setProjectMode('ENTERPRISE_SYNC');
    }
  };

  // Quick Seed Team from defaults
  const handleSeedDefaults = async () => {
    setIsLoadingUsers(true);
    try {
      const seeded = await api.seedDefaultUsers();
      setDbUsers(seeded || []);
      // Auto-assign from newly seeded list
      const po = seeded.find((u: DBUser) => u.role === 'PRODUCT_OWNER');
      const sm = seeded.find((u: DBUser) => u.role === 'SCRUM_MASTER');
      const devs = seeded.filter((u: DBUser) => u.role === 'DEVELOPER');
      const qas = seeded.filter((u: DBUser) => u.role === 'QA_ENGINEER');
      if (po) setSelectedPO(po);
      if (sm) setSelectedSM(sm);
      if (devs.length > 0) setSelectedDevIds(devs.map((d: DBUser) => d.id));
      if (qas.length > 0) setSelectedQAIds(qas.map((q: DBUser) => q.id));
    } catch (err) {
      console.warn("Could not seed default users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Quick Create User inline
  const handleCreateQuickUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName || !quickEmail) return;
    setIsSubmittingQuickUser(true);
    try {
      const newUser = await api.createUser({
        name: quickName.trim(),
        email: quickEmail.trim(),
        role: quickRole,
        title: quickTitle.trim() || quickRole.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
      });

      // Refetch and select
      await fetchUsers();

      if (quickRole === 'PRODUCT_OWNER') {
        setSelectedPO(newUser);
      } else if (quickRole === 'SCRUM_MASTER') {
        setSelectedSM(newUser);
      } else if (quickRole === 'DEVELOPER') {
        setSelectedDevIds(prev => [...prev, newUser.id]);
      } else if (quickRole === 'QA_ENGINEER') {
        setSelectedQAIds(prev => [...prev, newUser.id]);
      }

      // Reset form
      setQuickName('');
      setQuickEmail('');
      setQuickTitle('');
      setShowQuickAddUser(false);
    } catch (err: any) {
      alert("Error adding user to Firestore: " + (err.message || err));
    } finally {
      setIsSubmittingQuickUser(false);
    }
  };

  // Toggle Developer checkbox
  const toggleDeveloper = (userId: string) => {
    setSelectedDevIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Toggle QA Engineer checkbox
  const toggleQA = (userId: string) => {
    setSelectedQAIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Final Project Creation Submission to Firestore
  const handleFinalSubmit = async () => {
    if (!projectName.trim() || !projectKey.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Build selected team structures
      const selectedDevs = dbUsers.filter(u => selectedDevIds.includes(u.id));
      const selectedQAs = dbUsers.filter(u => selectedQAIds.includes(u.id));

      const payload = {
        name: projectName.trim(),
        key: projectKey.trim().toUpperCase(),
        description: projectDesc.trim() || `${projectName} agile workspace`,
        jira_project_link: jiraLink.trim() || undefined,
        mode: projectMode,
        product_owner: selectedPO ? {
          id: selectedPO.id,
          name: selectedPO.name,
          role: 'Product Owner',
          email: selectedPO.email,
          skills: ['Product Strategy', 'Roadmapping', 'Backlog Refinement'],
          available_hours_per_week: 40.0,
          current_workload_hours: 0.0
        } : undefined,
        scrum_master: selectedSM ? {
          id: selectedSM.id,
          name: selectedSM.name,
          role: 'Scrum Master',
          email: selectedSM.email,
          skills: ['Sprint Planning', 'Agile Facilitation', 'Risk Mitigation'],
          available_hours_per_week: 40.0,
          current_workload_hours: 0.0
        } : undefined,
        developers: selectedDevs.map(dev => ({
          id: dev.id,
          name: dev.name,
          role: dev.title || 'Software Developer',
          email: dev.email,
          skills: ['Fullstack', 'TypeScript', 'Python', 'Cloud Services'],
          available_hours_per_week: 40.0,
          current_workload_hours: 0.0
        })),
        qa_engineers: selectedQAs.map(qa => ({
          id: qa.id,
          name: qa.name,
          role: qa.title || 'QA Engineer',
          email: qa.email,
          skills: ['Test Automation', 'Acceptance Testing', 'Regression Suite'],
          available_hours_per_week: 40.0,
          current_workload_hours: 0.0
        })),
        git_settings: {
          enabled: true,
        },
        notebooklm_settings: {
          enabled: true,
          workspace_name: `${projectName} Knowledge Hub`
        }
      };

      const created = await api.createProject(payload);
      setCreatedProjectSummary(created);
      onProjectCreated(created);
      // Advance to completion summary screen
      setStep(4);
    } catch (err: any) {
      console.error("Failed to create project in Firestore:", err);
      setSubmitError(err.message || "Failed to persist project in Firestore DB.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    onClose();
    // Reset state for next time
    setStep(1);
    setProjectName('');
    setProjectKey('');
    setProjectDesc('');
    setJiraLink('');
    setSelectedDevIds([]);
    setSelectedQAIds([]);
    setCreatedProjectSummary(null);
  };

  if (!isOpen) return null;

  const isEligible = can('canCreateProject');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-surface-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8">
        
        {/* Modal Header & Progress Indicator */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-surface-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Create New Scrum Project
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Firestore Live
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                {step === 1 && "Step 1 of 3: Project Essentials & Jira Integration"}
                {step === 2 && "Step 2 of 3: Select Associated Team from Firestore DB"}
                {step === 3 && "Step 3 of 3: Comprehensive Summary & Firestore Persistence"}
                {step === 4 && "Deployment Complete: Workspace Blueprint Ready"}
              </p>
            </div>
          </div>

          <button
            onClick={step === 4 ? handleFinish : onClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition text-sm"
          >
            ✕
          </button>
        </div>

        {/* Step Wizard Progress Bar */}
        <div className="px-6 pt-3 pb-2 bg-surface-900 border-b border-zinc-800/80">
          <div className="flex items-center justify-between text-xs font-medium">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-brand-400 font-semibold' : 'text-zinc-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-brand-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                1
              </span>
              <span>Project Details</span>
            </div>
            <div className={`h-[1px] flex-1 mx-3 ${step >= 2 ? 'bg-brand-500/60' : 'bg-zinc-800'}`} />

            <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-brand-400 font-semibold' : 'text-zinc-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-brand-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                2
              </span>
              <span>Team Selection</span>
            </div>
            <div className={`h-[1px] flex-1 mx-3 ${step >= 3 ? 'bg-brand-500/60' : 'bg-zinc-800'}`} />

            <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-brand-400 font-semibold' : 'text-zinc-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-brand-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                3
              </span>
              <span>Summary & Confirm</span>
            </div>
          </div>
        </div>

        {/* Creator Eligibility Notification */}
        <div className="px-6 py-2.5 bg-surface-950/40 border-b border-zinc-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <span>👤 Initiating as:</span>
            <span className="font-semibold text-white">{activeUser ? activeUser.name : profile.name}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${profile.badgeBg} ${profile.badgeText} border ${profile.badgeBorder}`}>
              {profile.title}
            </span>
          </div>

          {!isEligible && (
            <div className="flex items-center gap-1.5 text-rose-400 font-medium bg-rose-500/10 px-2.5 py-0.5 rounded border border-rose-500/20 text-[11px]">
              <Lock className="w-3 h-3" />
              <span>Creation Restricted: Requires PO, SM, or Admin</span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[65vh] space-y-5">

          {/* Ineligible State Alert */}
          {!isEligible && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Eligibility Restriction</span>
              </div>
              <p className="text-xs text-zinc-300">
                Only users with the role of <strong>Product Owner</strong>, <strong>Scrum Master</strong>, or <strong>Admin</strong> are permitted to initiate and configure new Scrum Projects.
              </p>
              <p className="text-xs text-zinc-400">
                Please switch to an eligible account using the Role Switcher at the top right before continuing.
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: PROJECT DETAILS */}
          {/* ========================================================================= */}
          {step === 1 && isEligible && (
            <div className="space-y-4">
              {/* Project Name */}
              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium text-xs">
                  Project Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Claims Automation Platform, AI Scrum Master"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-brand-500 transition shadow-inner"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  The primary workspace title visible across sprint boards, reports, and AI telemetry.
                </span>
              </div>

              {/* Jira Project Link */}
              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium text-xs flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Jira Project Link (Auto-detects Key & Configures Sync)</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={jiraLink}
                    onChange={(e) => handleJiraLinkChange(e.target.value)}
                    placeholder="https://company.atlassian.net/jira/software/projects/SCRUM/summary"
                    className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-3 text-white font-mono text-xs focus:outline-none focus:border-brand-500 transition shadow-inner pl-3 pr-8"
                  />
                  {jiraLink && (
                    <button
                      type="button"
                      onClick={() => setJiraLink('')}
                      className="absolute right-2.5 top-3 text-zinc-500 hover:text-zinc-300 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Optional: Paste Jira board or summary link. The system extracts the project key prefix and enables bi-directional ticket synchronization.
                </span>
              </div>

              {/* Project Key Prefix & Operating Mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-300 mb-1.5 font-medium text-xs flex items-center justify-between">
                    <span>Project Key Prefix <span className="text-rose-400">*</span></span>
                    {projectKey && (
                      <span className="font-mono text-[10px] text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">
                        [{projectKey}-101]
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={projectKey}
                    onChange={(e) => {
                      setProjectKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                      setIsKeyManuallyEdited(true);
                    }}
                    placeholder="e.g. SCRUM, CLM, PAY"
                    className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-3 text-white font-mono uppercase text-sm focus:outline-none focus:border-brand-500 transition shadow-inner"
                  />
                  <span className="text-[11px] text-zinc-500 mt-1 block">
                    1-10 uppercase alphanumeric characters used for task and story identifiers.
                  </span>
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1.5 font-medium text-xs">Operating Mode</label>
                  <select
                    value={projectMode}
                    onChange={(e) => setProjectMode(e.target.value as any)}
                    className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-3 text-white text-xs focus:outline-none focus:border-brand-500 transition shadow-inner"
                  >
                    <option value="ENTERPRISE_SYNC">Enterprise Sync (Jira Cloud Direct)</option>
                    <option value="STANDALONE">Standalone (Native Cloud Firestore)</option>
                  </select>
                  <span className="text-[11px] text-zinc-500 mt-1 block">
                    Choose whether epics and tasks sync directly with Atlassian Jira or remain native in Firestore.
                  </span>
                </div>
              </div>

              {/* Description (Optional) */}
              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium text-xs">
                  Description <span className="text-zinc-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Outline the project scope, business objectives, and key delivery milestones..."
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-3 text-white text-xs focus:outline-none focus:border-brand-500 transition shadow-inner"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: TEAM SELECTION (FETCHED FROM FIRESTORE DB) */}
          {/* ========================================================================= */}
          {step === 2 && isEligible && (
            <div className="space-y-5">
              {/* Header Banner */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Scrum Master: Select Project Team</span>
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Associate the Product Owner, Scrum Master, Developers, and QA Engineers from your Firestore DB.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchUsers}
                    disabled={isLoadingUsers}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1 transition"
                    title="Refresh users from Firestore"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin text-brand-400' : ''}`} />
                    <span className="text-[11px]">Sync DB</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQuickAddUser(!showQuickAddUser)}
                    className="px-2.5 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 text-xs flex items-center gap-1.5 transition font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Quick Add User</span>
                  </button>
                </div>
              </div>

              {/* Status info & helper banner */}
              {isLoadingUsers && (
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center space-y-2">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-brand-500 border-t-transparent" />
                  <p className="text-xs text-zinc-400">Querying Firestore collection <code>users</code>...</p>
                </div>
              )}

              {usersError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
                  <span>{usersError}</span>
                  <button onClick={fetchUsers} className="underline text-rose-200">Retry</button>
                </div>
              )}

              {/* Inline Quick Add User Form */}
              {showQuickAddUser && (
                <form onSubmit={handleCreateQuickUser} className="p-4 rounded-xl bg-surface-950 border border-brand-500/30 space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                      Add New Team Member to Firestore DB
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddUser(false)}
                      className="text-zinc-500 hover:text-zinc-300 text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        placeholder="e.g. Sarah Chen"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        value={quickEmail}
                        onChange={(e) => setQuickEmail(e.target.value)}
                        placeholder="sarah.chen@company.com"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1">Role *</label>
                      <select
                        value={quickRole}
                        onChange={(e) => setQuickRole(e.target.value as any)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-white"
                      >
                        <option value="DEVELOPER">DEVELOPER</option>
                        <option value="QA_ENGINEER">QA_ENGINEER</option>
                        <option value="PRODUCT_OWNER">PRODUCT_OWNER</option>
                        <option value="SCRUM_MASTER">SCRUM_MASTER</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Job Title (Optional)</label>
                      <input
                        type="text"
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        placeholder="e.g. Lead Frontend Engineer"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowQuickAddUser(false)}
                      className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingQuickUser}
                      className="px-3 py-1 rounded bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs flex items-center gap-1.5"
                    >
                      {isSubmittingQuickUser ? "Saving to Firestore..." : "Save to DB"}
                    </button>
                  </div>
                </form>
              )}

              {/* Seed Demo Team Prompt if few users */}
              {dbUsers.length < 3 && !isLoadingUsers && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                  <div className="text-zinc-300">
                    <span className="font-semibold text-amber-300">Tip: </span>
                    Firestore DB currently contains only {dbUsers.length} user(s). You can seed standard team profiles with 1 click.
                  </div>
                  <button
                    type="button"
                    onClick={handleSeedDefaults}
                    className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 font-semibold text-[11px] whitespace-nowrap ml-2"
                  >
                    ⚡ Seed Starter Team
                  </button>
                </div>
              )}

              {/* 1. PRODUCT OWNER SELECTION */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-purple-400" />
                    <span>Project Owner / Product Owner</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">1 Required</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {dbUsers.map(user => {
                    const isSelected = selectedPO?.id === user.id;
                    const isRecommended = user.role === 'PRODUCT_OWNER' || user.role === 'ADMIN';

                    return (
                      <div
                        key={`po-${user.id}`}
                        onClick={() => setSelectedPO(user)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-500/10'
                            : 'bg-surface-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="flex items-center gap-1.5 font-semibold text-white">
                            <span className="truncate">{user.name}</span>
                            {isRecommended && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                                {user.role}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5">{user.email}</div>
                        </div>

                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-purple-400 bg-purple-500 text-white' : 'border-zinc-700'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. SCRUM MASTER SELECTION */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                    <span>Scrum Master (Facilitator & Flow Lead)</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">1 Required</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {dbUsers.map(user => {
                    const isSelected = selectedSM?.id === user.id;
                    const isRecommended = user.role === 'SCRUM_MASTER' || user.role === 'ADMIN';

                    return (
                      <div
                        key={`sm-${user.id}`}
                        onClick={() => setSelectedSM(user)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10'
                            : 'bg-surface-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="flex items-center gap-1.5 font-semibold text-white">
                            <span className="truncate">{user.name}</span>
                            {isRecommended && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                                {user.role}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5">{user.email}</div>
                        </div>

                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-blue-400 bg-blue-500 text-white' : 'border-zinc-700'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. DEVELOPERS SELECTION */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Developers</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                    {selectedDevIds.length} Selected
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {dbUsers.map(user => {
                    const isSelected = selectedDevIds.includes(user.id);
                    const isDevRole = user.role === 'DEVELOPER';

                    return (
                      <div
                        key={`dev-${user.id}`}
                        onClick={() => toggleDeveloper(user.id)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-500/10'
                            : 'bg-surface-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="flex items-center gap-1.5 font-semibold text-white">
                            <span className="truncate">{user.name}</span>
                            <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                              isDevRole ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'
                            }`}>
                              {user.role}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5">{user.email}</div>
                        </div>

                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-zinc-700'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. QA ENGINEERS SELECTION */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Bug className="w-3.5 h-3.5 text-amber-400" />
                    <span>QA Engineers</span>
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono font-semibold">
                    {selectedQAIds.length} Selected
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {dbUsers.map(user => {
                    const isSelected = selectedQAIds.includes(user.id);
                    const isQARole = user.role === 'QA_ENGINEER';

                    return (
                      <div
                        key={`qa-${user.id}`}
                        onClick={() => toggleQA(user.id)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-500/10'
                            : 'bg-surface-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="flex items-center gap-1.5 font-semibold text-white">
                            <span className="truncate">{user.name}</span>
                            <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                              isQARole ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-zinc-800 text-zinc-400'
                            }`}>
                              {user.role}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5">{user.email}</div>
                        </div>

                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-amber-400 bg-amber-500 text-white' : 'border-zinc-700'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SUMMARY & REVIEW */}
          {/* ========================================================================= */}
          {step === 3 && isEligible && (
            <div className="space-y-4">
              <div className="pb-2 border-b border-zinc-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-brand-400" />
                  <span>Project Blueprint & Firestore Summary</span>
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Confirm all details below. Upon confirmation, the project and associated team records will be saved into GCP Firestore.
                </p>
              </div>

              {submitError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {submitError}
                </div>
              )}

              {/* Project Card */}
              <div className="p-4 rounded-xl bg-surface-950 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-brand-500/20 text-brand-300 border border-brand-500/30">
                      [{projectKey}]
                    </span>
                    <span className="font-bold text-sm text-white">{projectName}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {projectMode === 'ENTERPRISE_SYNC' ? '⚡ Jira Enterprise Sync' : '📦 Standalone Firestore'}
                  </span>
                </div>

                {jiraLink ? (
                  <div className="flex items-center gap-1.5 text-xs text-blue-400">
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span className="truncate">{jiraLink}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-500">
                    No Jira link specified • Native Firestore storage mode active.
                  </div>
                )}

                {projectDesc && (
                  <p className="text-xs text-zinc-300 italic border-l-2 border-brand-500/50 pl-2.5 py-0.5">
                    "{projectDesc}"
                  </p>
                )}
              </div>

              {/* Team Roster Summary Card */}
              <div className="p-4 rounded-xl bg-surface-950 border border-zinc-800 space-y-3">
                <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Assigned Scrum Team Roster</span>
                  </span>
                  <span className="text-brand-400 font-mono text-[11px]">
                    {1 + 1 + selectedDevIds.length + selectedQAIds.length} Members
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* PO */}
                  <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <div className="text-[10px] font-mono text-purple-400 uppercase font-semibold flex items-center gap-1">
                      <Crown className="w-3 h-3" /> Product Owner
                    </div>
                    <div className="font-bold text-white mt-1">{selectedPO ? selectedPO.name : 'Unassigned'}</div>
                    <div className="text-[10px] text-zinc-400">{selectedPO ? selectedPO.email : '-'}</div>
                  </div>

                  {/* SM */}
                  <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <div className="text-[10px] font-mono text-blue-400 uppercase font-semibold flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> Scrum Master
                    </div>
                    <div className="font-bold text-white mt-1">{selectedSM ? selectedSM.name : 'Unassigned'}</div>
                    <div className="text-[10px] text-zinc-400">{selectedSM ? selectedSM.email : '-'}</div>
                  </div>
                </div>

                {/* Developers Roster */}
                <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                  <div className="text-[10px] font-mono text-emerald-400 uppercase font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Code className="w-3 h-3" /> Assigned Developers ({selectedDevIds.length})
                    </span>
                    <span>40h / dev</span>
                  </div>
                  {selectedDevIds.length === 0 ? (
                    <div className="text-xs text-zinc-500 italic">No developers selected.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {dbUsers.filter(u => selectedDevIds.includes(u.id)).map(dev => (
                        <span
                          key={dev.id}
                          className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 text-[11px] border border-zinc-700 flex items-center gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>{dev.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* QA Engineers Roster */}
                <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                  <div className="text-[10px] font-mono text-amber-400 uppercase font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Bug className="w-3 h-3" /> Assigned QA Engineers ({selectedQAIds.length})
                    </span>
                    <span>40h / QA</span>
                  </div>
                  {selectedQAIds.length === 0 ? (
                    <div className="text-xs text-zinc-500 italic">No QA engineers selected.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {dbUsers.filter(u => selectedQAIds.includes(u.id)).map(qa => (
                        <span
                          key={qa.id}
                          className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 text-[11px] border border-zinc-700 flex items-center gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span>{qa.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Firestore Destination Confirmation Badge */}
              <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-300 flex items-center gap-2.5">
                <Database className="w-4 h-4 text-brand-400 shrink-0" />
                <div>
                  <strong>Firestore Persistence:</strong> This project will be saved into the <code className="text-white bg-surface-900 px-1 py-0.5 rounded">projects</code> collection in Google Cloud Project <code className="text-white bg-surface-900 px-1 py-0.5 rounded">ai-scrum-master-510116</code>, and user documents in <code className="text-white bg-surface-900 px-1 py-0.5 rounded">users</code> will be updated with this project's ID.
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: FINAL COMPLETION SUMMARY VIEW */}
          {/* ========================================================================= */}
          {step === 4 && (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white">
                  Scrum Project Successfully Created!
                </h4>
                <p className="text-xs text-zinc-400">
                  All configuration parameters and team rosters have been permanently persisted to GCP Firestore.
                </p>
              </div>

              {/* Final Summary Card */}
              <div className="p-5 rounded-2xl bg-surface-950 border border-zinc-800 text-left space-y-3.5 shadow-xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Firestore Document ID</span>
                    <div className="font-mono text-sm text-brand-400 font-bold">
                      {createdProjectSummary?.id || 'proj-generated'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Project Key Prefix</span>
                    <div className="font-mono text-sm text-emerald-400 font-bold">
                      [{createdProjectSummary?.key || projectKey}]
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 text-[10px] block uppercase font-mono">Workspace Name</span>
                    <span className="font-bold text-white">{createdProjectSummary?.name || projectName}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block uppercase font-mono">Collection Name</span>
                    <span className="font-mono text-brand-300">projects</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block uppercase font-mono">Product Owner</span>
                    <span className="text-zinc-200">{selectedPO ? selectedPO.name : 'None'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block uppercase font-mono">Scrum Master</span>
                    <span className="text-zinc-200">{selectedSM ? selectedSM.name : 'None'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block uppercase font-mono">Developers Roster</span>
                    <span className="text-zinc-200">{selectedDevIds.length} Assigned</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block uppercase font-mono">QA Engineers</span>
                    <span className="text-zinc-200">{selectedQAIds.length} Assigned</span>
                  </div>
                </div>

                {jiraLink && (
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center gap-2">
                    <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{jiraLink}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-surface-950/70 flex items-center justify-between">
          {step === 4 ? (
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
            >
              <span>Open Project Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              {/* Back / Cancel Button */}
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((step - 1) as any)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
              )}

              {/* Next / Submit Button */}
              {step === 1 && (
                <button
                  type="button"
                  disabled={!isEligible || !projectName.trim() || !projectKey.trim()}
                  onClick={() => setStep(2)}
                  className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-500/20 transition"
                >
                  <span>Next: Team Selection</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {step === 2 && (
                <button
                  type="button"
                  disabled={!isEligible || (!selectedPO && !selectedSM && selectedDevIds.length === 0)}
                  onClick={() => setStep(3)}
                  className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-500/20 transition"
                >
                  <span>Next: Review Summary</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {step === 3 && (
                <button
                  type="button"
                  disabled={!isEligible || isSubmitting}
                  onClick={handleFinalSubmit}
                  className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-brand-500/30 transition"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving to Cloud Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      <span>Confirm & Save to Cloud Firestore 🚀</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};
