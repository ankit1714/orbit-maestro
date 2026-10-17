'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole =
  | 'SCRUM_MASTER'
  | 'DEVELOPER'
  | 'QA_ENGINEER'
  | 'EXECUTIVE'
  | 'ADMIN';

export interface RolePermissions {
  canCreateProject: boolean;
  canEditProject: boolean;
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
  canManageActionsAndDecisions: boolean;
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
  SCRUM_MASTER: {
    id: 'SCRUM_MASTER',
    name: 'David Vance (SM)',
    shortLabel: 'SM',
    title: 'Scrum Master',
    description: 'Full product scope, PRD ingestion, ambiguity resolution, sprint planning & capacity allocation.',
    avatarBg: 'from-indigo-600 via-blue-600 to-indigo-700',
    badgeBg: 'bg-blue-50',
    badgeBorder: 'border-blue-200',
    badgeText: 'text-blue-700 font-semibold',
    permissions: {
      canCreateProject: true,
      canEditProject: true,
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
      canManageActionsAndDecisions: true,
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
    badgeBg: 'bg-emerald-50',
    badgeBorder: 'border-emerald-200',
    badgeText: 'text-emerald-700 font-semibold',
    permissions: {
      canCreateProject: false,
      canEditProject: false,
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
      canManageActionsAndDecisions: false,
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
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-200',
    badgeText: 'text-amber-800 font-semibold',
    permissions: {
      canCreateProject: false,
      canEditProject: false,
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
      canManageActionsAndDecisions: false,
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
    badgeBg: 'bg-rose-50',
    badgeBorder: 'border-rose-200',
    badgeText: 'text-rose-700 font-semibold',
    permissions: {
      canCreateProject: false,
      canEditProject: false,
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
      canManageActionsAndDecisions: false,
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
    badgeBg: 'bg-red-50',
    badgeBorder: 'border-red-200',
    badgeText: 'text-red-700 font-semibold',
    permissions: {
      canCreateProject: true,
      canEditProject: true,
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
      canManageActionsAndDecisions: true,
      isReadOnly: false,
    },
  },
};

// Legacy fallback mapping: Product Owner seamlessly maps to Scrum Master
(ROLE_PROFILES as any)['PRODUCT_OWNER'] = ROLE_PROFILES.SCRUM_MASTER;

export interface DBUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  avatar_url?: string;
  status?: string;
  project_ids?: string[];
  is_jira_project_user?: boolean;
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
          if ((parsed.role as string) === 'PRODUCT_OWNER') {
            parsed.role = 'SCRUM_MASTER';
            if (parsed.title === 'Product Owner') parsed.title = 'Scrum Master';
            localStorage.setItem('ai_scrum_current_user', JSON.stringify(parsed));
          }
          setCurrentUserState(parsed);
          if (parsed.role && ROLE_PROFILES[parsed.role as UserRole]) {
            setRoleState(parsed.role as UserRole);
            return;
          }
        } catch {}
      }
      let storedRole = localStorage.getItem('ai_scrum_user_role') as string;
      if (storedRole === 'PRODUCT_OWNER') {
        storedRole = 'SCRUM_MASTER';
        localStorage.setItem('ai_scrum_user_role', 'SCRUM_MASTER');
      }
      if (storedRole && ROLE_PROFILES[storedRole as UserRole]) {
        setRoleState(storedRole as UserRole);
      }
    }
  }, []);

  const setCurrentUser = (user: DBUser | null) => {
    if (user && (user.role as string) === 'PRODUCT_OWNER') {
      user = {
        ...user,
        role: 'SCRUM_MASTER',
        title: user.title === 'Product Owner' ? 'Scrum Master' : user.title,
      };
    }
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
    const effectiveRole = (newRole as string) === 'PRODUCT_OWNER' ? 'SCRUM_MASTER' : newRole;
    setRoleState(effectiveRole);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_scrum_user_role', effectiveRole);
    }
  };

  const baseProfile = ROLE_PROFILES[role] || ROLE_PROFILES.SCRUM_MASTER;
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
