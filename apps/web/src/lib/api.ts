// Production API Client for AI Scrum Master Backend
export const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    if (window.location.hostname.includes("run.app")) {
      return "https://ai-scrum-api-a355sfc3uq-uc.a.run.app/v1";
    }
  }
  return "http://localhost:8000/v1";
};

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      },
      ...options
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`API Error [${res.status}] ${url}: ${errText}`);
      throw new Error(`API ${res.status}: ${errText}`);
    }
    return res.json();
  } catch (err) {
    console.warn(`Fetch error for ${url}, handling gracefully:`, err);
    throw err;
  }
}

// Projects API
export const api = {
  getProjects: () => fetchApi<any[]>('/projects'),
  getProject: (id: string) => fetchApi<any>(`/projects/${id}`),
  createProject: (data: any) => fetchApi<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: any) => fetchApi<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) => fetchApi<any>(`/projects/${id}`, { method: 'DELETE' }),

  // Document Ingestion & Open Questions
  getRequirements: (projectId: string) => fetchApi<any>(`/ingest/${projectId}`),
  ingestPRD: (data: { project_id: string; file_name: string; file_text?: string; file_content_base64?: string; use_sample_doc?: boolean }) =>
    fetchApi<any>('/ingest', { method: 'POST', body: JSON.stringify(data) }),
  getOpenQuestions: (projectId: string) => fetchApi<any[]>(`/backlog/questions/${projectId}`),
  resolveQuestion: (questionId: string, answer: string, resolvedBy = "Product Owner") =>
    fetchApi<any>('/backlog/questions/resolve', { method: 'POST', body: JSON.stringify({ question_id: questionId, resolved_answer: answer, resolved_by: resolvedBy }) }),

  // Backlog
  getBacklog: (projectId: string) => fetchApi<any>(`/backlog/${projectId}`),
  generateBacklog: (projectId: string, clarifications: Record<string, string>) =>
    fetchApi<any>('/backlog/generate', { method: 'POST', body: JSON.stringify({ project_id: projectId, clarifications }) }),
  updateTaskStatus: (projectId: string, taskId: string, newStatus: string) =>
    fetchApi<any>(`/backlog/tasks/${taskId}/status?project_id=${projectId}&new_status=${newStatus}`, { method: 'PUT' }),
  getJiraStatus: () => fetchApi<any>('/backlog/jira/status'),
  uploadBacklogToJira: (projectId: string, payload?: { project_key?: string }) =>
    fetchApi<any>(`/backlog/${projectId}/upload-jira`, { method: 'POST', body: JSON.stringify(payload || {}) }),

  // Sprints
  getActiveSprint: (projectId: string) => fetchApi<any>(`/sprints/${projectId}`),
  commitSprintScope: (data: { project_id: string; sprint_id: string; goal: string; committed_story_ids: string[] }) =>
    fetchApi<any>('/sprints/commit', { method: 'POST', body: JSON.stringify(data) }),
  getSpillovers: (projectId: string) => fetchApi<any[]>(`/sprints/${projectId}/spillovers`),
  resolveSpillover: (data: { project_id: string; sprint_id: string; task_id: string; action: string }) =>
    fetchApi<any>('/sprints/spillovers/resolve', { method: 'POST', body: JSON.stringify(data) }),

  // Meetings
  processMeeting: (data: { project_id: string; meeting_type: string; transcript_text: string }) =>
    fetchApi<any>('/meetings/extract', { method: 'POST', body: JSON.stringify(data) }),

  // Risks & DAG
  getDependencyDAG: (projectId: string) => fetchApi<any>(`/risks/dag/${projectId}`),
  getHealthMatrix: (projectId: string) => fetchApi<any>(`/risks/health/${projectId}`),

  // Git Telemetry & Flash Health
  getFlashHealth: (projectId: string) => fetchApi<any>(`/git-tracker/${projectId}/flash`),
  getRecentCommits: (projectId: string) => fetchApi<any[]>(`/git-tracker/${projectId}/commits`),
  getPullRequests: (projectId: string) => fetchApi<any[]>(`/git-tracker/${projectId}/prs`),

  // Governance
  getPendingApprovals: (projectId: string) => fetchApi<any[]>(`/governance/approvals/${projectId}`),
  actOnApproval: (approvalId: string, action: "APPROVE" | "REJECT", notes?: string) =>
    fetchApi<any>('/governance/approvals/action', { method: 'POST', body: JSON.stringify({ approval_id: approvalId, action, review_notes: notes }) }),
  getActivityLog: (projectId: string) => fetchApi<any[]>(`/governance/activity/${projectId}`),

  // Knowledge & NotebookLM
  searchKnowledge: (projectId: string, query: string) =>
    fetchApi<any>('/knowledge/search', { method: 'POST', body: JSON.stringify({ project_id: projectId, query }) }),
  getNotebookLMDetails: (projectId: string) => fetchApi<any>(`/knowledge/notebooklm/${projectId}`),
  getKnowledgeItems: (projectId: string) => fetchApi<any[]>(`/knowledge/items/${projectId}`),

  // Reports
  getExecutiveReport: (projectId: string) => fetchApi<any>(`/reports/${projectId}/executive`),
  getSpilloverTrends: (projectId: string) => fetchApi<any[]>(`/reports/${projectId}/spillover-trends`),
  getCycleTimes: (projectId: string) => fetchApi<any>(`/reports/${projectId}/cycle-times`),

  // Simulator
  runSimulatorStage1: (projectId: string) =>
    fetchApi<any>('/simulator/run-step-1', { method: 'POST', body: JSON.stringify({ project_id: projectId, file_name: "Claims_Automation_PRD_v1.pdf", use_sample_doc: true }) }),
  runSimulatorStage4: (projectId: string, clarifications: Record<string, string>) =>
    fetchApi<any>('/simulator/run-step-4', { method: 'POST', body: JSON.stringify({ project_id: projectId, clarifications }) }),
};
