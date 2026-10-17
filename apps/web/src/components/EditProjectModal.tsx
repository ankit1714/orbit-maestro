'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Users,
  Check,
  Save,
  X,
  Link as LinkIcon,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Code,
  Bug,
  Crown,
  Database,
  ExternalLink,
  ShieldCheck,
  Clock,
  Zap
} from 'lucide-react';
import { useRole, DBUser } from '@/lib/roleContext';
import { api } from '@/lib/api';

interface EditProjectModalProps {
  isOpen: boolean;
  project: any;
  onClose: () => void;
  onProjectUpdated: (updatedProject: any) => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  isOpen,
  project,
  onClose,
  onProjectUpdated,
}) => {
  const { can } = useRole();

  // Basic Details State
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [businessObjective, setBusinessObjective] = useState('');
  const [jiraLink, setJiraLink] = useState('');
  const [sprintDurationDays, setSprintDurationDays] = useState(14);
  const [targetVelocityPoints, setTargetVelocityPoints] = useState(32);

  // Team Selection State
  const [dbUsers, setDbUsers] = useState<DBUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSyncingJira, setIsSyncingJira] = useState(false);
  const [jiraSyncMsg, setJiraSyncMsg] = useState<string | null>(null);
  const [selectedSMId, setSelectedSMId] = useState<string>('');
  const [selectedDevIds, setSelectedDevIds] = useState<string[]>([]);
  const [selectedQAIds, setSelectedQAIds] = useState<string[]>([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync Jira users particular to the project and refresh Firestore users list
  const fetchAndSyncJiraUsers = async (targetKey?: string, targetLink?: string) => {
    const k = targetKey || key || project?.key;
    const link = targetLink || jiraLink || project?.jira_project_link;
    setIsLoadingUsers(true);
    setIsSyncingJira(true);
    try {
      if (k || link) {
        const syncRes = await api.syncProjectJiraUsers({
          project_key: k,
          jira_link: link,
          project_id: project?.id,
        });
        const usersList: DBUser[] = (syncRes && (syncRes as any).users) ? (syncRes as any).users : (Array.isArray(syncRes) ? syncRes : []);
        if (usersList && usersList.length > 0) {
          setDbUsers(usersList);
          const count = (syncRes as any)?.synced_count ?? usersList.filter(u => u.is_jira_project_user).length;
          setJiraSyncMsg(`Live Jira sync: ${count} user(s) fetched for ${k || 'project'} & pushed to Firestore DB.`);
          return;
        }
      }
      const users = await api.getUsers();
      setDbUsers(users || []);
    } catch (err: any) {
      console.warn("Could not sync Jira users, falling back to Firestore users:", err);
      const fallback = await api.getUsers().catch(() => []);
      setDbUsers(fallback || []);
    } finally {
      setIsLoadingUsers(false);
      setIsSyncingJira(false);
    }
  };

  // Populate project details whenever modal opens or project changes
  useEffect(() => {
    if (project && isOpen) {
      const projKey = project.key || '';
      const projLink = project.jira_project_link || (project.jira_settings?.instance_url && project.jira_settings?.project_key ? `${project.jira_settings.instance_url}/browse/${project.jira_settings.project_key}` : '');

      setName(project.name || '');
      setKey(projKey);
      setDescription(project.description || '');
      setBusinessObjective(project.business_objective || '');
      setJiraLink(projLink);
      setSprintDurationDays(project.sprint_duration_days || 14);
      setTargetVelocityPoints(project.target_velocity_points || 32);

      // Initialize team member selections
      const sm = project.scrum_master;
      if (sm?.id) {
        setSelectedSMId(sm.id);
      } else {
        const foundSm = project.team_members?.find((m: any) => m.role?.toLowerCase().includes('scrum') || m.role?.toLowerCase().includes('lead'));
        setSelectedSMId(foundSm?.id || '');
      }

      const devs = project.developers || project.team_members?.filter((m: any) => !m.role?.toLowerCase().includes('qa') && !m.role?.toLowerCase().includes('scrum')) || [];
      setSelectedDevIds(devs.map((d: any) => d.id).filter(Boolean));

      const qas = project.qa_engineers || project.team_members?.filter((m: any) => m.role?.toLowerCase().includes('qa') || m.role?.toLowerCase().includes('test')) || [];
      setSelectedQAIds(qas.map((q: any) => q.id).filter(Boolean));

      setError(null);
      setSuccessMsg(null);
      setJiraSyncMsg(null);

      // Fetch users with live Jira sync for this project
      fetchAndSyncJiraUsers(projKey, projLink);
    }
  }, [project, isOpen]);

  const toggleDeveloper = (userId: string) => {
    setSelectedDevIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleQA = (userId: string) => {
    setSelectedQAIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleJiraLinkChange = (link: string) => {
    setJiraLink(link);
    if (link.trim()) {
      const match = link.match(/\/(?:projects|browse)\/([A-Za-z0-9_]+)/);
      if (match && !key) {
        setKey(match[1].toUpperCase());
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) {
      setError("Project Name and Project Key are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const selectedSMUser = dbUsers.find((u) => u.id === selectedSMId);
      const selectedDevs = dbUsers.filter((u) => selectedDevIds.includes(u.id));
      const selectedQAs = dbUsers.filter((u) => selectedQAIds.includes(u.id));

      const payload: any = {
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim() || `${name} agile workspace`,
        business_objective: businessObjective.trim() || undefined,
        jira_project_link: jiraLink.trim() || undefined,
        sprint_duration_days: Number(sprintDurationDays) || 14,
        target_velocity_points: Number(targetVelocityPoints) || 32,
      };

      if (selectedSMUser) {
        payload.scrum_master = {
          id: selectedSMUser.id,
          name: selectedSMUser.name,
          role: 'Scrum Master',
          email: selectedSMUser.email,
          skills: ['Sprint Planning', 'Agile Facilitation', 'Scope & PRD Ingestion', 'Risk Mitigation'],
          available_hours_per_week: 40.0,
          current_workload_hours: 0.0
        };
      }

      if (selectedDevs.length > 0 || selectedDevIds.length === 0) {
        payload.developers = selectedDevs.map((dev) => ({
          id: dev.id,
          name: dev.name,
          role: dev.title || 'Software Developer',
          email: dev.email,
          skills: ['Fullstack', 'TypeScript', 'Python', 'Cloud Services'],
          available_hours_per_week: 40.0,
          current_workload_hours: 0.0
        }));
      }

      if (selectedQAs.length > 0 || selectedQAIds.length === 0) {
        payload.qa_engineers = selectedQAs.map((qa) => ({
          id: qa.id,
          name: qa.name,
          role: qa.title || 'QA Engineer',
          email: qa.email,
          skills: ['Test Automation', 'Acceptance Testing', 'Regression Suite'],
          available_hours_per_week: 40.0,
          current_workload_hours: 0.0
        }));
      }

      const updated = await api.updateProject(project.id, payload);
      setSuccessMsg("Project configuration saved to GCP Firestore successfully!");
      onProjectUpdated(updated);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error("Failed to update project in Firestore:", err);
      setError(err.message || "Failed to persist updated project configuration to Firestore.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-[#dadce0] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#dadce0] bg-gradient-to-r from-blue-50/60 via-white to-indigo-50/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a73e8]/10 text-[#1a73e8] border border-[#d2e3fc] flex items-center justify-center font-bold">
              <Layers className="w-5 h-5 text-[#1a73e8]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#202124]">Edit Project Configuration</h2>
                <span className="font-mono text-xs bg-[#e8f0fe] text-[#1a73e8] px-2 py-0.5 rounded font-bold border border-[#d2e3fc]">
                  [{project.key}]
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200 uppercase font-mono flex items-center gap-1">
                  <Database className="w-3 h-3 text-emerald-600" />
                  Firestore Sync
                </span>
              </div>
              <p className="text-xs text-[#5f6368] mt-0.5">
                Update project metadata, Jira sync link, and team allocation retained in Firestore DB.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: Core Project Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#5f6368] font-bold border-b border-[#f1f3f4] pb-1.5 flex items-center gap-1.5">
              <span>1. Project Details & Identity</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-[#202124]">Project Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HRMS Platform"
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-[#dadce0] focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] outline-hidden text-[#202124] font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#202124]">Project Key *</label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="e.g. HRM"
                  required
                  maxLength={10}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#dadce0] focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] outline-hidden font-mono text-[#1a73e8] font-bold uppercase"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#202124]">Project Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="High-level summary of deliverables and system domain..."
                className="w-full text-xs p-2.5 rounded-xl border border-[#dadce0] focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] outline-hidden text-[#202124]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#202124]">Business Objective / Strategic Goals</label>
              <input
                type="text"
                value={businessObjective}
                onChange={(e) => setBusinessObjective(e.target.value)}
                placeholder="e.g. Deliver core HRMS workflows and employee onboarding in Q4"
                className="w-full text-xs p-2.5 rounded-xl border border-[#dadce0] focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] outline-hidden text-[#202124]"
              />
            </div>
          </div>

          {/* Section 2: Jira Cloud Integration */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#5f6368] font-bold border-b border-[#f1f3f4] pb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-[#1a73e8]" />
                <span>2. Jira Cloud Direct Sync</span>
              </span>
              <span className="text-[10px] text-[#1a73e8] font-normal lowercase">Live Agile Sync</span>
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#202124] flex items-center justify-between">
                <span>Jira Project / Board URL</span>
                {jiraLink && (
                  <a
                    href={jiraLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#1a73e8] hover:underline flex items-center gap-0.5"
                  >
                    <span>Open in Jira</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="url"
                value={jiraLink}
                onChange={(e) => handleJiraLinkChange(e.target.value)}
                placeholder="https://company.atlassian.net/jira/software/projects/HRM/boards/101"
                className="w-full text-xs p-2.5 rounded-xl border border-[#dadce0] focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] outline-hidden font-mono text-[#202124]"
              />
              <p className="text-[11px] text-[#5f6368]">
                Updating this URL automatically configures the Jira Agile board and syncs sprint backlogs directly.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl border border-[#dadce0] bg-[#f8f9fa] space-y-1">
                <span className="text-[11px] font-semibold text-[#5f6368] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#1a73e8]" />
                  Sprint Cadence
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={7}
                    max={30}
                    value={sprintDurationDays}
                    onChange={(e) => setSprintDurationDays(Number(e.target.value))}
                    className="w-16 p-1.5 text-xs font-bold rounded-lg border border-[#dadce0] bg-white text-center"
                  />
                  <span className="text-xs text-[#5f6368]">Days (2 Weeks default)</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-[#dadce0] bg-[#f8f9fa] space-y-1">
                <span className="text-[11px] font-semibold text-[#5f6368] flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-600" />
                  Target Velocity
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={targetVelocityPoints}
                    onChange={(e) => setTargetVelocityPoints(Number(e.target.value))}
                    className="w-16 p-1.5 text-xs font-bold rounded-lg border border-[#dadce0] bg-white text-center text-amber-700"
                  />
                  <span className="text-xs text-[#5f6368]">Story Points / Sprint</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Team Allocation in Firestore */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1.5 border-b border-[#f1f3f4] gap-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#5f6368] font-bold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>3. Assigned Team Members (Firestore DB)</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchAndSyncJiraUsers()}
                  disabled={isSyncingJira || isLoadingUsers}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[#1a73e8] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                  title="Fetch assignable users directly from Jira Cloud and persist to Firestore"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingJira ? 'animate-spin' : ''}`} />
                  <span>{isSyncingJira ? 'Syncing Jira...' : 'Sync Jira Team'}</span>
                </button>
                <span className="text-[10px] text-[#5f6368] font-normal">
                  {1 + selectedDevIds.length + selectedQAIds.length} members assigned
                </span>
              </div>
            </div>

            {jiraSyncMsg && (
              <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#1a73e8] shrink-0" />
                <span className="flex-1 font-medium">{jiraSyncMsg}</span>
              </div>
            )}

            {/* Scrum Master Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#202124] flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>Assigned Scrum Master</span>
              </label>
              <select
                value={selectedSMId}
                onChange={(e) => setSelectedSMId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-[#dadce0] focus:border-[#1a73e8] outline-hidden text-[#202124] bg-white font-medium"
              >
                <option value="">-- Select Scrum Master --</option>
                {dbUsers.map((u) => {
                  const isJira = u.is_jira_project_user || u.project_ids?.includes(key) || u.project_ids?.includes(project?.id);
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name} {isJira ? '⭐ [JIRA]' : ''} ({u.role || u.title || 'Team Member'}) · {u.email}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Developers Checklist */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#202124] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Software Developers ({selectedDevIds.length} selected)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const allDevIds = dbUsers.filter((u) => u.role === 'DEVELOPER' || !u.role?.includes('QA')).map((u) => u.id);
                    setSelectedDevIds(selectedDevIds.length === allDevIds.length ? [] : allDevIds);
                  }}
                  className="text-[11px] text-[#1a73e8] hover:underline"
                >
                  {selectedDevIds.length > 0 ? 'Deselect All' : 'Select All Developers'}
                </button>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-[#f8f9fa] rounded-xl border border-[#dadce0]">
                {dbUsers.map((u) => {
                  const isChecked = selectedDevIds.includes(u.id);
                  const isJira = u.is_jira_project_user || u.project_ids?.includes(key) || u.project_ids?.includes(project?.id);
                  return (
                    <label
                      key={u.id}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                          : 'bg-white border-[#dadce0] text-[#3c4043] hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDeveloper(u.id)}
                          className="rounded text-[#137333] focus:ring-[#137333] h-3.5 w-3.5"
                        />
                        <div className="truncate">
                          <div className="flex items-center gap-1">
                            <p className="truncate text-xs font-semibold">{u.name}</p>
                            {isJira && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 text-[#1a73e8] font-bold shrink-0">
                                Jira Team
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#5f6368] truncate">{u.title || u.role}</p>
                        </div>
                      </div>
                      {isChecked && <Check className="w-3.5 h-3.5 text-[#137333] shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* QA Engineers Checklist */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#202124] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Bug className="w-3.5 h-3.5 text-amber-600" />
                  <span>QA Engineers ({selectedQAIds.length} selected)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const allQAIds = dbUsers.filter((u) => u.role === 'QA_ENGINEER' || u.role?.includes('QA')).map((u) => u.id);
                    setSelectedQAIds(selectedQAIds.length === allQAIds.length ? [] : allQAIds);
                  }}
                  className="text-[11px] text-[#1a73e8] hover:underline"
                >
                  {selectedQAIds.length > 0 ? 'Deselect All' : 'Select All QA'}
                </button>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-[#f8f9fa] rounded-xl border border-[#dadce0]">
                {dbUsers.map((u) => {
                  const isChecked = selectedQAIds.includes(u.id);
                  const isJira = u.is_jira_project_user || u.project_ids?.includes(key) || u.project_ids?.includes(project?.id);
                  return (
                    <label
                      key={u.id}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition ${
                        isChecked
                          ? 'bg-amber-50 border-amber-300 text-amber-950 font-medium'
                          : 'bg-white border-[#dadce0] text-[#3c4043] hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleQA(u.id)}
                          className="rounded text-amber-700 focus:ring-amber-700 h-3.5 w-3.5"
                        />
                        <div className="truncate">
                          <div className="flex items-center gap-1">
                            <p className="truncate text-xs font-semibold">{u.name}</p>
                            {isJira && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 text-[#1a73e8] font-bold shrink-0">
                                Jira Team
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#5f6368] truncate">{u.title || u.role}</p>
                        </div>
                      </div>
                      {isChecked && <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-[#dadce0] flex items-center justify-between">
            <span className="text-[11px] text-[#5f6368] font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#137333]" />
              Synced to Firestore DB doc: <span className="font-bold text-[#202124]">{project.id}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-[#dadce0] text-xs font-semibold text-[#5f6368] hover:bg-[#f1f3f4] transition disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-[#1967d2] hover:bg-[#185abc] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Firestore...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
