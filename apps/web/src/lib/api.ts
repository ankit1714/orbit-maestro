// Production API Client for AI Scrum Master Backend
export const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname.includes("run.app")) {
      if (hostname.includes("cockpit")) {
        return `https://${hostname.replace("cockpit", "api")}/v1`;
      }
      return "/v1";
    }
  }
  return "http://localhost:8000/v1";
};

/**
 * Returns the exact Authorized Redirect URI for Google OAuth 2.0.
 * In Google Cloud Console, authorized URIs & JS origins must include:
 * 1) http://localhost:3000 (callback: /oauth/callback)
 * 2) https://<ai-scrum-cockpit-url> (callback: /oauth/callback)
 *
 * Normalizes 127.0.0.1, 0.0.0.0, or local dev variants to http://localhost:3000/oauth/callback
 * so Google never rejects the login with Error 400: redirect_uri_mismatch.
 */
export const getOAuthRedirectUri = (): string => {
  if (typeof window === "undefined") {
    return "http://localhost:3000/oauth/callback";
  }
  const hostname = window.location.hostname;
  if (hostname.includes("run.app")) {
    return `${window.location.origin}/oauth/callback`;
  }
  return "http://localhost:3000/oauth/callback";
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
  addGitRepo: (projectId: string, data: any) =>
    fetchApi<any>(`/projects/${projectId}/git-repos`, { method: 'POST', body: JSON.stringify(data) }),
  deleteGitRepo: (projectId: string, repoId: string) =>
    fetchApi<any>(`/projects/${projectId}/git-repos/${repoId}`, { method: 'DELETE' }),
  addConfluenceLink: (projectId: string, data: any) =>
    fetchApi<any>(`/projects/${projectId}/confluence-links`, { method: 'POST', body: JSON.stringify(data) }),
  deleteConfluenceLink: (projectId: string, linkId: string) =>
    fetchApi<any>(`/projects/${projectId}/confluence-links/${linkId}`, { method: 'DELETE' }),
  syncConfluencePage: (projectId: string, linkId: string) =>
    fetchApi<any>(`/projects/${projectId}/confluence-links/${linkId}/sync`, { method: 'POST' }),
  syncAllConfluence: (projectId: string) =>
    fetchApi<any>(`/projects/${projectId}/confluence-sync`, { method: 'POST' }),
  syncGitRepo: (projectId: string, repoId: string) =>
    fetchApi<any>(`/projects/${projectId}/git-repos/${repoId}/sync`, { method: 'POST' }),
  syncAllGit: (projectId: string) =>
    fetchApi<any>(`/projects/${projectId}/git-sync`, { method: 'POST' }),
  syncJira: (projectId: string) =>
    fetchApi<any>(`/projects/${projectId}/jira-sync`, { method: 'POST' }),
  getProjectJiraUsers: (projectId: string) =>
    fetchApi<any[]>(`/projects/${projectId}/jira-users`),
  syncProjectJiraUsers: (data: { project_key?: string; jira_link?: string; project_id?: string }) =>
    fetchApi<{ status: string; project_key?: string; synced_count: number; jira_users: any[]; users: any[] }>('/projects/sync-jira-users', { method: 'POST', body: JSON.stringify(data) }),
  updateIntegrations: (projectId: string, data: any) =>
    fetchApi<any>(`/projects/${projectId}/integrations`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Document Ingestion & Open Questions
  getRequirements: (projectId: string) => fetchApi<any>(`/ingest/${projectId}`),
  ingestPRD: (data: {
    project_id: string;
    file_name: string;
    file_text?: string;
    file_content_base64?: string;
    use_sample_doc?: boolean;
    confluence_link_id?: string;
    confluence_url?: string;
  }) =>
    fetchApi<any>('/ingest', { method: 'POST', body: JSON.stringify(data) }),
  decomposeRequirements: (projectId: string, payload?: { raw_requirements?: string; sprint_goal?: string }) =>
    fetchApi<any>(`/ingest/${projectId}/decompose`, { method: 'POST', body: JSON.stringify(payload || {}) }),
  getProjectStrategy: (projectId: string) =>
    fetchApi<any>(`/ingest/${projectId}/strategy`),
  getOpenQuestions: (projectId: string) => fetchApi<any[]>(`/backlog/questions/${projectId}`),
  resolveQuestion: (questionId: string, answer: string, resolvedBy = "Scrum Master") =>
    fetchApi<any>('/backlog/questions/resolve', { method: 'POST', body: JSON.stringify({ question_id: questionId, resolved_answer: answer, resolved_by: resolvedBy }) }),

  // Backlog
  getBacklog: (projectId: string) => fetchApi<any>(`/backlog/${projectId}`),
  generateBacklog: (projectId: string, clarifications: Record<string, string>) =>
    fetchApi<any>('/backlog/generate', { method: 'POST', body: JSON.stringify({ project_id: projectId, clarifications }) }),
  updateTaskStatus: (projectId: string, taskId: string, newStatus: string) =>
    fetchApi<any>(`/backlog/tasks/${taskId}/status?project_id=${projectId}&new_status=${newStatus}`, { method: 'PUT' }),
  getJiraStatus: () => fetchApi<any>('/backlog/jira/status'),
  uploadBacklogToJira: (projectId: string, payload?: { project_key?: string; instance_url?: string }) =>
    fetchApi<any>(`/backlog/${projectId}/upload-jira`, { method: 'POST', body: JSON.stringify(payload || {}) }),

  // Sprints
  getActiveSprint: (projectId: string) => fetchApi<any>(`/sprints/${projectId}`),
  commitSprintScope: (data: { project_id: string; sprint_id: string; goal: string; committed_story_ids: string[] }) =>
    fetchApi<any>('/sprints/commit', { method: 'POST', body: JSON.stringify(data) }),
  getSpillovers: (projectId: string) => fetchApi<any[]>(`/sprints/${projectId}/spillovers`),
  resolveSpillover: (data: { project_id: string; sprint_id: string; task_id: string; action: string }) =>
    fetchApi<any>('/sprints/spillovers/resolve', { method: 'POST', body: JSON.stringify(data) }),

  // Meetings & Intelligence
  processMeeting: (data: {
    project_id: string;
    meeting_type: string;
    transcript_text: string;
    title?: string;
    entered_by?: string;
    date?: string;
  }) => fetchApi<any>('/meetings/extract', { method: 'POST', body: JSON.stringify(data) }),
  listMeetings: (projectId: string) => fetchApi<any[]>(`/meetings/${projectId}`),
  analyzeMeetingLinks: (meetingId: string) => fetchApi<any>(`/meetings/${meetingId}/analyze-links`, { method: 'POST' }),
  deleteMeeting: (meetingId: string) => fetchApi<any>(`/meetings/${meetingId}`, { method: 'DELETE' }),

  // Google Calendar & Gemini Notes Integration
  getCalendarStatus: (userEmail?: string, accessToken?: string) => {
    const params = new URLSearchParams();
    if (userEmail) params.append('user_email', userEmail);
    if (accessToken) params.append('access_token', accessToken);
    const qs = params.toString();
    return fetchApi<any>(`/meetings/calendar/status${qs ? `?${qs}` : ''}`);
  },
  connectCalendar: (data: { user_email?: string; access_token?: string; refresh_token?: string }) =>
    fetchApi<any>('/meetings/calendar/connect', { method: 'POST', body: JSON.stringify(data) }),
  disconnectCalendar: () =>
    fetchApi<any>('/meetings/calendar/disconnect', { method: 'POST' }),
  getCalendarEvents: (projectId: string, userEmail?: string, accessToken?: string) => {
    const params = new URLSearchParams({ project_id: projectId });
    if (userEmail) params.append('user_email', userEmail);
    if (accessToken) params.append('access_token', accessToken);
    return fetchApi<any>(`/meetings/calendar/events?${params.toString()}`);
  },
  previewCalendarNotes: (eventId: string, projectId: string, docId?: string, accessToken?: string) => {
    const params = new URLSearchParams({ project_id: projectId });
    if (docId) params.append('doc_id', docId);
    if (accessToken) params.append('access_token', accessToken);
    return fetchApi<any>(`/meetings/calendar/events/${encodeURIComponent(eventId)}/notes?${params.toString()}`);
  },
  pullAndProcessCalendarMeeting: (data: { event_id: string; project_id: string; doc_id?: string; access_token?: string }) =>
    fetchApi<any>('/meetings/calendar/pull-and-process', { method: 'POST', body: JSON.stringify(data) }),
  getGoogleOAuthUrl: (redirectUri?: string, projectId?: string) => {
    const params = new URLSearchParams();
    if (redirectUri) params.append('redirect_uri', redirectUri);
    if (projectId) params.append('project_id', projectId);
    const qs = params.toString();
    return fetchApi<any>(`/meetings/calendar/oauth/url${qs ? `?${qs}` : ''}`);
  },
  exchangeOAuthCallback: (data: { code: string; redirect_uri: string; project_id?: string }) =>
    fetchApi<any>('/meetings/calendar/oauth/callback', { method: 'POST', body: JSON.stringify(data) }),

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

  // Action & Decisions Hub
  getActionsAndDecisions: (projectId: string) => fetchApi<any[]>(`/governance/actions-decisions/${projectId}`),
  createActionOrDecision: (data: any) =>
    fetchApi<any>('/governance/actions-decisions', { method: 'POST', body: JSON.stringify(data) }),
  updateActionOrDecision: (id: string, data: any) =>
    fetchApi<any>(`/governance/actions-decisions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteActionOrDecision: (id: string) =>
    fetchApi<any>(`/governance/actions-decisions/${id}`, { method: 'DELETE' }),

  // Knowledge & NotebookLM
  searchKnowledge: (projectId: string, query: string) =>
    fetchApi<any>('/knowledge/search', { method: 'POST', body: JSON.stringify({ project_id: projectId, query }) }),
  syncKnowledge: (projectId: string) =>
    fetchApi<any>(`/knowledge/sync/${projectId}`, { method: 'POST' }),
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

  // Users & Roles (Firestore DB)
  getUsers: (role?: string) => fetchApi<any[]>(`/users${role ? `?role=${role}` : ''}`),
  getUser: (id: string) => fetchApi<any>(`/users/${id}`),
  createUser: (data: { name: string; email: string; role: string; title?: string; avatar_url?: string; project_ids?: string[] }) =>
    fetchApi<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) =>
    fetchApi<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateUserRole: (id: string, role: string) =>
    fetchApi<any>(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  deleteUser: (id: string) =>
    fetchApi<any>(`/users/${id}`, { method: 'DELETE' }),
  seedDefaultUsers: () =>
    fetchApi<any[]>('/users/seed-defaults', { method: 'POST' }),
};

/**
 * Sanitizes and normalizes any Jira instance URL down to its origin (protocol + host).
 * Prevents appended paths (/jira/software/projects/... or /browse/...) from corrupting API calls or links.
 */
export const cleanJiraInstanceUrl = (rawUrl?: string): string => {
  const defaultUrl = process.env.NEXT_PUBLIC_JIRA_INSTANCE_URL || '';
  if (!rawUrl || !rawUrl.trim()) return defaultUrl;
  try {
    let clean = rawUrl.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    const parsed = new URL(clean);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return rawUrl.replace(/\/+$/, '');
  }
};

/**
 * Resolves the accurate Jira Agile Board / Project Dashboard URL for any given project.
 * Handles team-managed (next-gen) boards, company-managed boards, custom domains, and explicit links.
 */
export const getJiraBoardUrl = (project?: any, sprint?: any): string => {
  const defaultUrl = process.env.NEXT_PUBLIC_JIRA_INSTANCE_URL || '';
  if (!project) return defaultUrl;

  // 1. If explicit jira_project_link is provided, prioritize it
  if (project.jira_project_link && typeof project.jira_project_link === 'string' && project.jira_project_link.trim()) {
    return project.jira_project_link.trim();
  }

  const instanceUrl = cleanJiraInstanceUrl(project?.jira_settings?.instance_url) || defaultUrl;
  const projectKey = (project?.jira_settings?.project_key || project?.key || '').trim().toUpperCase();

  if (!projectKey) return instanceUrl;

  // Board ID discovery
  let boardId = project?.jira_settings?.board_id || sprint?.jira_board_id;

  // Normalization for known project boards
  if (projectKey === 'HM' && (boardId === '1' || boardId === 1 || !boardId)) {
    boardId = '67';
  } else if (projectKey === 'IRIS' && !boardId) {
    boardId = '1';
  }

  if (boardId && String(boardId).trim() && !isNaN(Number(boardId))) {
    return `${instanceUrl}/jira/software/c/projects/${projectKey}/boards/${boardId}`;
  }

  // Canonical fallback route for Jira Software projects
  return `${instanceUrl}/jira/software/projects/${projectKey}/boards`;
};

/**
 * Resolves the ticket browse URL for a Jira issue key.
 */
export const getJiraBrowseUrl = (ticket: string, project?: any): string => {
  const instanceUrl = cleanJiraInstanceUrl(project?.jira_settings?.instance_url);
  return `${instanceUrl}/browse/${(ticket || '').trim().toUpperCase()}`;
};

