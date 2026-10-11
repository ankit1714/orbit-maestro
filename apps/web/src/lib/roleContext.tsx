'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole =
  | 'PRODUCT_OWNER'
  | 'SCRUM_MASTER'
  | 'DEVELOPER'
  | 'QA_ENGINEER'
  | 'EXECUTIVE'
  | 'ADMIN';

export interface RolePermissions {
  canCreateProject: boolean;
  canDeleteProject: boolean;
  canManageIntegrations: boolean;
  canIngestPRD: boolean;
  canResolveQuestions: boolean;
  canSynthesizeBacklog: boolean;
  canUploadToJira: boolean;
  canPlanSprint: boolean;
  canCommitSprint: boolean;
  canMoveTasks: boolean;
  canTriageSpillover: boolean;
  canProcessMeetings: boolean;
  canActOnApprovals: boolean;
  canClearDatabase: boolean;
  isReadOnly: boolean;
}

export interface RoleProfile {
  id: UserRole;
  name: string;
  shortLabel: string;
  title: string;
  description: string;
  avatarBg: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  permissions: RolePermissions;
}

export const ROLE_PROFILES: Record<UserRole, RoleProfile> = {
  PRODUCT_OWNER: {
    id: 'PRODUCT_OWNER',
    name: 'Sarah Connor (PO)',
    shortLabel: 'PO',
    title: 'Product Owner',
    description: 'Scope definition, PRD ingestion, ambiguity resolution & backlog synthesis.',
    avatarBg: 'from-purple-600 via-indigo-600 to-purple-700',
    badgeBg: 'bg-purple-500/15',
    badgeBorder: 'border-purple-500/30',
    badgeText: 'text-purple-300',
    permissions: {
      canCreateProject: true,
      canDeleteProject: true,
      canManageIntegrations: true,
      canIngestPRD: true,
      canResolveQuestions: true,
      canSynthesizeBacklog: true,
      canUploadToJira: true,
      canPlanSprint: true,
      canCommitSprint: true,
      canMoveTasks: true,
      canTriageSpillover: true,
      canProcessMeetings: true,
      canActOnApprovals: true,
      canClearDatabase: true,
      isReadOnly: false,
    },
  },
  SCRUM_MASTER: {
    id: 'SCRUM_MASTER',
    name: 'David Vance (SM)',
    shortLabel: 'SM',
    title: 'Scrum Master',
    description: 'Sprint planning, capacity allocation, meeting intelligence & risk triage.',
    avatarBg: 'from-indigo-600 via-blue-600 to-indigo-700',
    badgeBg: 'bg-blue-500/15',
    badgeBorder: 'border-blue-500/30',
    badgeText: 'text-blue-300',
    permissions: {
      canCreateProject: true,
      canDeleteProject: false,
      canManageIntegrations: true,
      canIngestPRD: false,
      canResolveQuestions: false,
      canSynthesizeBacklog: true,
      canUploadToJira: true,
      canPlanSprint: true,
      canCommitSprint: true,
      canMoveTasks: true,
      canTriageSpillover: true,
      canProcessMeetings: true,
      canActOnApprovals: true,
      canClearDatabase: false,
      isReadOnly: false,
    },
  },
  DEVELOPER: {
    id: 'DEVELOPER',
    name: 'Alex Rivera (Dev)',
    shortLabel: 'DEV',
    title: 'Senior Developer',
    description: 'Sprint task delivery, status transitions, blocker flagging & Copilot access.',
    avatarBg: 'from-emerald-600 via-teal-600 to-emerald-700',
    badgeBg: 'bg-emerald-500/15',
    badgeBorder: 'border-emerald-500/30',
    badgeText: 'text-emerald-300',
    permissions: {
      canCreateProject: false,
      canDeleteProject: false,
      canManageIntegrations: false,
      canIngestPRD: false,
      canResolveQuestions: false,
      canSynthesizeBacklog: false,
      canUploadToJira: false,
      canPlanSprint: false,
      canCommitSprint: false,
      canMoveTasks: true,
      canTriageSpillover: false,
      canProcessMeetings: false,
      canActOnApprovals: false,
      canClearDatabase: false,
      isReadOnly: false,
    },
  },
  QA_ENGINEER: {
    id: 'QA_ENGINEER',
    name: 'Samira Patel (QA)',
    shortLabel: 'QA',
    title: 'QA Engineer',
    description: 'Acceptance criteria verification, QA task tracking & defect reporting.',
    avatarBg: 'from-amber-600 via-orange-600 to-amber-700',
    badgeBg: 'bg-amber-500/15',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-300',
    permissions: {
      canCreateProject: false,
      canDeleteProject: false,
      canManageIntegrations: false,
      canIngestPRD: false,
      canResolveQuestions: false,
      canSynthesizeBacklog: false,
      canUploadToJira: false,
      canPlanSprint: false,
      canCommitSprint: false,
      canMoveTasks: true,
      canTriageSpillover: false,
      canProcessMeetings: false,
      canActOnApprovals: false,
      canClearDatabase: false,
      isReadOnly: false,
    },
  },
  EXECUTIVE: {
    id: 'EXECUTIVE',
    name: 'Elena Rostova (VP)',
    shortLabel: 'EXEC',
    title: 'Executive / Stakeholder',
    description: 'High-level executive briefs, BigQuery cycle analytics & Flash Health audit.',
    avatarBg: 'from-rose-600 via-pink-600 to-rose-700',
    badgeBg: 'bg-rose-500/15',
    badgeBorder: 'border-rose-500/30',
    badgeText: 'text-rose-300',
    permissions: {
      canCreateProject: false,
      canDeleteProject: false,
      canManageIntegrations: false,
      canIngestPRD: false,
      canResolveQuestions: false,
      canSynthesizeBacklog: false,
      canUploadToJira: false,
      canPlanSprint: false,
      canCommitSprint: false,
      canMoveTasks: false,
      canTriageSpillover: false,
      canProcessMeetings: false,
      canActOnApprovals: false,
      canClearDatabase: false,
      isReadOnly: true,
    },
  },
  ADMIN: {
    id: 'ADMIN',
    name: 'Platform Admin',
    shortLabel: 'ADMIN',
    title: 'Workspace Admin',
    description: 'Full governance override, integration credentials & project management.',
    avatarBg: 'from-red-600 via-orange-600 to-red-700',
    badgeBg: 'bg-red-500/15',
    badgeBorder: 'border-red-500/30',
    badgeText: 'text-red-300',
    permissions: {
      canCreateProject: true,
      canDeleteProject: true,
      canManageIntegrations: true,
      canIngestPRD: true,
      canResolveQuestions: true,
      canSynthesizeBacklog: true,
      canUploadToJira: true,
      canPlanSprint: true,
      canCommitSprint: true,
      canMoveTasks: true,
      canTriageSpillover: true,
      canProcessMeetings: true,
      canActOnApprovals: true,
      canClearDatabase: true,
      isReadOnly: false,
    },
  },
};

export interface DBUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  avatar_url?: string;
  status?: string;
  project_ids?: string[];
}

interface RoleContextType {
  role: UserRole;
  profile: RoleProfile;
  currentUser: DBUser | null;
  setCurrentUser: (user: DBUser | null) => void;
  setRole: (role: UserRole) => void;
  can: (action: keyof RolePermissions) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>('ADMIN');
  const [currentUser, setCurrentUserState] = useState<DBUser | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('ai_scrum_current_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setCurrentUserState(parsed);
          if (parsed.role && ROLE_PROFILES[parsed.role as UserRole]) {
            setRoleState(parsed.role as UserRole);
            return;
          }
        } catch {}
      }
      const storedRole = localStorage.getItem('ai_scrum_user_role') as UserRole;
      if (storedRole && ROLE_PROFILES[storedRole]) {
        setRoleState(storedRole);
      }
    }
  }, []);

  const setCurrentUser = (user: DBUser | null) => {
    setCurrentUserState(user);
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('ai_scrum_current_user', JSON.stringify(user));
        setRoleState(user.role);
        localStorage.setItem('ai_scrum_user_role', user.role);
      } else {
        localStorage.removeItem('ai_scrum_current_user');
      }
    }
  };

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_scrum_user_role', newRole);
    }
  };

  const baseProfile = ROLE_PROFILES[role] || ROLE_PROFILES.ADMIN;
  const profile: RoleProfile = currentUser
    ? {
        ...baseProfile,
        name: currentUser.name,
        title: currentUser.title || baseProfile.title,
        shortLabel: currentUser.name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase() || baseProfile.shortLabel,
      }
    : baseProfile;

  const can = (action: keyof RolePermissions): boolean => {
    return Boolean(profile.permissions[action]);
  };

  return (
    <RoleContext.Provider value={{ role, profile, currentUser, setCurrentUser, setRole, can }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = (): RoleContextType => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
