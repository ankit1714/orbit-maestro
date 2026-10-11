'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navigation } from '@/components/Navigation';
import { Sidebar } from '@/components/Sidebar';
import { CopilotDrawer } from '@/components/CopilotDrawer';
import { CommandPalette } from '@/components/CommandPalette';
import { PipelineSimulatorModal } from '@/components/PipelineSimulatorModal';
import { SpilloverModal } from '@/components/SpilloverModal';

import { DashboardView } from '@/components/views/DashboardView';
import { DocumentsView } from '@/components/views/DocumentsView';
import { BacklogView } from '@/components/views/BacklogView';
import { PlanningView } from '@/components/views/PlanningView';
import { SprintBoardView } from '@/components/views/SprintBoardView';
import { MeetingsView } from '@/components/views/MeetingsView';
import { RisksView } from '@/components/views/RisksView';
import { GovernanceView } from '@/components/views/GovernanceView';
import { KnowledgeView } from '@/components/views/KnowledgeView';
import { ReportsView } from '@/components/views/ReportsView';
import { api } from '@/lib/api';

export default function CockpitPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [currentView, setCurrentView] = useState('dashboard');

  // Dynamic Project State
  const [requirements, setRequirements] = useState<any>(null);
  const [backlog, setBacklog] = useState<any>(null);
  const [sprint, setSprint] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [dag, setDag] = useState<any>(null);
  const [healthMatrix, setHealthMatrix] = useState<any>(null);
  const [flashHealth, setFlashHealth] = useState<any>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [notebookInfo, setNotebookInfo] = useState<any>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<any[]>([]);

  // Modals & Drawers
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [spilloverOpen, setSpilloverOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  // Load Projects on Initial Mount
  useEffect(() => {
    api.getProjects().then((projs) => {
      if (projs && projs.length > 0) {
        const map = new Map<string, any>();
        for (const p of projs) {
          const k = (p.key || p.id || '').toUpperCase();
          if (!map.has(k)) map.set(k, p);
        }
        const unique = Array.from(map.values());
        setProjects(unique);
        setActiveProject(unique[0]);
      }
    }).catch((err) => {
      console.warn("Could not fetch projects:", err);
    });
  }, []);

  // Fetch all data for the active project
  const loadProjectData = useCallback((projectId: string) => {
    if (!projectId) return;

    api.getRequirements(projectId).then(setRequirements).catch(() => setRequirements(null));
    api.getBacklog(projectId).then(setBacklog).catch(() => setBacklog({ epics: [], total_points: 0 }));
    api.getActiveSprint(projectId).then(setSprint).catch(() => {});
    api.getOpenQuestions(projectId).then(setQuestions).catch(() => setQuestions([]));
    api.getPendingApprovals(projectId).then(setApprovals).catch(() => setApprovals([]));
    api.getDependencyDAG(projectId).then(setDag).catch(() => {});
    api.getHealthMatrix(projectId).then(setHealthMatrix).catch(() => {});
    api.getFlashHealth(projectId).then(setFlashHealth).catch(() => {});
    api.getActivityLog(projectId).then(setActivityLogs).catch(() => setActivityLogs([]));
    api.getNotebookLMDetails(projectId).then(setNotebookInfo).catch(() => {});
    api.getKnowledgeItems(projectId).then(setKnowledgeItems).catch(() => setKnowledgeItems([]));
  }, []);

  useEffect(() => {
    if (activeProject?.id) {
      loadProjectData(activeProject.id);
    }
  }, [activeProject, loadProjectData]);

  const handleCreateProject = async (projectData: any) => {
    try {
      const created = await api.createProject(projectData);
      setProjects((prev) => [created, ...prev]);
      setActiveProject(created);
    } catch (e) {
      console.warn("Project creation error:", e);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await api.deleteProject(projectId);
      setProjects((prev) => {
        const remaining = prev.filter((p) => p.id !== projectId);
        if (activeProject?.id === projectId) {
          setActiveProject(remaining.length > 0 ? remaining[0] : null);
        }
        return remaining;
      });
    } catch (err) {
      console.warn("Could not delete project:", err);
    }
  };

  const handleRefresh = () => {
    if (activeProject?.id) {
      loadProjectData(activeProject.id);
    }
  };

  const openQuestionsCount = (questions || []).filter((q) => !q.resolved).length;
  const approvalsCount = (approvals || []).filter((a) => a.status === "PENDING").length;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface-950">
      {/* Top Header */}
      <Navigation
        projects={projects}
        activeProject={activeProject}
        onSelectProject={(p) => setActiveProject(p)}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onOpenSimulator={() => setSimulatorOpen(true)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onToggleCopilot={() => setCopilotOpen(!copilotOpen)}
        onSwitchView={(v) => setCurrentView(v)}
        approvalsCount={approvalsCount}
        flashStatus={flashHealth?.status || "ON_TRACK"}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentView={currentView}
          onSwitchView={(v) => setCurrentView(v)}
          openQuestionsCount={openQuestionsCount}
          approvalsCount={approvalsCount}
          hasBlocker={flashHealth?.status === "OFF_TRACK"}
          sprint={sprint}
          project={activeProject}
        />

        {/* Center Workspace Canvas */}
        <main className="flex-1 overflow-y-auto bg-surface-950 flex flex-col">
          {currentView === 'dashboard' && (
            <DashboardView
              project={activeProject}
              sprint={sprint}
              backlog={backlog}
              healthMatrix={healthMatrix}
              flashHealth={flashHealth}
              activityLogs={activityLogs}
              onSwitchView={(v) => setCurrentView(v)}
              onOpenSimulator={() => setSimulatorOpen(true)}
            />
          )}

          {currentView === 'documents' && (
            <DocumentsView
              project={activeProject}
              requirements={requirements}
              questions={questions}
              onSwitchView={(v) => setCurrentView(v)}
              onRefresh={handleRefresh}
              onProjectUpdated={(updated) => {
                setActiveProject(updated);
                setProjects((prev) => prev.map((p) => p.id === updated.id ? updated : p));
              }}
            />
          )}

          {currentView === 'backlog' && (
            <BacklogView
              project={activeProject}
              requirements={requirements}
              backlog={backlog}
              onRefresh={handleRefresh}
              onSwitchView={(v) => setCurrentView(v)}
            />
          )}

          {currentView === 'planning' && (
            <PlanningView
              project={activeProject}
              sprint={sprint}
              backlog={backlog}
              onRefresh={handleRefresh}
              onSwitchView={(v) => setCurrentView(v)}
            />
          )}

          {currentView === 'sprint' && (
            <SprintBoardView
              project={activeProject}
              sprint={sprint}
              backlog={backlog}
              onRefresh={handleRefresh}
              onSwitchView={(v) => setCurrentView(v)}
              onOpenSpilloverModal={() => setSpilloverOpen(true)}
            />
          )}

          {currentView === 'meetings' && (
            <MeetingsView
              project={activeProject}
              onSwitchView={(v) => setCurrentView(v)}
              onRefresh={handleRefresh}
            />
          )}

          {currentView === 'risks' && (
            <RisksView
              project={activeProject}
              dag={dag}
              healthMatrix={healthMatrix}
              onSwitchView={(v) => setCurrentView(v)}
            />
          )}

          {currentView === 'governance' && (
            <GovernanceView
              project={activeProject}
              approvals={approvals}
              activityLogs={activityLogs}
              onRefresh={handleRefresh}
              onSwitchView={(v) => setCurrentView(v)}
            />
          )}

          {currentView === 'knowledge' && (
            <KnowledgeView
              project={activeProject}
              notebookInfo={notebookInfo}
              knowledgeItems={knowledgeItems}
              onRefresh={handleRefresh}
              onSwitchView={(v) => setCurrentView(v)}
            />
          )}

          {currentView === 'reports' && (
            <ReportsView
              project={activeProject}
              sprint={sprint}
              onSwitchView={(v) => setCurrentView(v)}
            />
          )}
        </main>

        {/* Right Copilot Drawer (⌘J) */}
        <CopilotDrawer
          isOpen={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          projectId={activeProject?.id}
        />
      </div>

      {/* Global Command Palette (⌘K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSwitchView={(v) => setCurrentView(v)}
        approvalsCount={approvalsCount}
        activeProject={activeProject}
      />

      {/* Ingestion & Backlog Synthesis Simulator */}
      <PipelineSimulatorModal
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        projectId={activeProject?.id}
        onBacklogSynthesized={handleRefresh}
      />

      {/* Spillover Triage Workbench Modal */}
      <SpilloverModal
        isOpen={spilloverOpen}
        onClose={() => setSpilloverOpen(false)}
        projectId={activeProject?.id}
      />
    </div>
  );
}
