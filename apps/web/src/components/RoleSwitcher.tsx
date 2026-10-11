'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRole, ROLE_PROFILES, UserRole } from '@/lib/roleContext';
import { api } from '@/lib/api';
import { 
  UserCheck, 
  ChevronDown, 
  Check, 
  Eye, 
  Briefcase, 
  Plus, 
  Trash2, 
  Database, 
  RefreshCw, 
  UserPlus, 
  Users
} from 'lucide-react';

export const RoleSwitcher: React.FC = () => {
  const { role, profile, currentUser, setCurrentUser, setRole } = useRole();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'db_users' | 'create'>('db_users');
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('DEVELOPER');
  const [newTitle, setNewTitle] = useState('');
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchDbUsers = async () => {
    setLoadingUsers(true);
    try {
      const users = await api.getUsers();
      setDbUsers(users || []);
      
      // If no currentUser is selected but users exist in DB, default to the first one
      if (!currentUser && users && users.length > 0) {
        const found = users.find((u: any) => u.role === role) || users[0];
        setCurrentUser(found);
      }
    } catch (e) {
      console.warn("Could not fetch DB users:", e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchDbUsers();
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDbUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    setCreating(true);
    setCreateMsg(null);
    try {
      const created = await api.createUser({
        name: newName.trim(),
        email: newEmail.trim(),
        role: newRole,
        title: newTitle.trim() || undefined,
      });
      setCreateMsg(`User "${created.name}" created in Firestore DB!`);
      setNewName('');
      setNewEmail('');
      setNewTitle('');
      await fetchDbUsers();
      setCurrentUser(created);
      setRole(created.role);
      setTimeout(() => {
        setActiveTab('db_users');
        setCreateMsg(null);
      }, 800);
    } catch (err: any) {
      setCreateMsg(`Error creating user: ${err.message || 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Permanently delete this user from Firestore DB?")) return;
    try {
      await api.deleteUser(userId);
      if (currentUser?.id === userId) {
        setCurrentUser(null);
      }
      await fetchDbUsers();
    } catch (err: any) {
      console.warn("Delete user error:", err);
    }
  };

  const displayName = currentUser?.name || profile.name;
  const displayRoleTitle = currentUser?.title || profile.title;
  const displayShortLabel = currentUser
    ? currentUser.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : profile.shortLabel;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Role Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 pl-1.5 pr-2.5 py-1 rounded-full bg-surface-900/90 hover:bg-surface-800/90 border border-zinc-700/60 hover:border-zinc-600 transition shadow-sm group"
        title={`Logged in as ${displayName} (${displayRoleTitle}). Click to switch user or manage accounts.`}
      >
        {/* Avatar Circle */}
        <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${profile.avatarBg} flex items-center justify-center text-[10px] font-bold text-white shadow-sm border border-white/20`}>
          {displayShortLabel}
        </div>

        {/* Role Name */}
        <div className="flex items-center gap-1.5 text-left max-w-[160px] truncate">
          <span className="text-[11px] font-semibold text-zinc-200 group-hover:text-white transition truncate">
            {displayName}
          </span>
          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono uppercase font-semibold border ${profile.badgeBg} ${profile.badgeBorder} ${profile.badgeText} shrink-0`}>
            {profile.shortLabel}
          </span>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Role Switcher Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[400px] rounded-2xl bg-surface-900/95 backdrop-blur-xl border border-zinc-700/80 shadow-2xl p-3 z-50 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-2 py-1 border-b border-zinc-800 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-brand-400" />
                <span>Switch Active User Account</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <Database className="w-2.5 h-2.5" />
                Firestore DB
              </span>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex rounded-lg bg-surface-950 p-0.5 border border-zinc-800 text-[11px] mt-2">
              <button
                onClick={() => setActiveTab('db_users')}
                className={`flex-1 py-1 rounded-md font-medium transition text-center flex items-center justify-center gap-1.5 ${
                  activeTab === 'db_users' ? 'bg-zinc-800 text-white font-semibold shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Firestore Users</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-brand-500/20 text-brand-300 font-mono">
                  {dbUsers.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-1 rounded-md font-medium transition text-center flex items-center justify-center gap-1.5 ${
                  activeTab === 'create' ? 'bg-brand-600 text-white font-semibold shadow-sm' : 'text-brand-400 hover:text-brand-300'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create User</span>
              </button>
            </div>
          </div>

          {/* TAB: FIRESTORE DB USERS */}
          {activeTab === 'db_users' && (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              <div className="flex items-center justify-between px-1 text-[11px] text-zinc-400">
                <span>Stored in collection: <code className="text-brand-300 font-mono">users</code></span>
                <button
                  onClick={fetchDbUsers}
                  className="hover:text-white flex items-center gap-1 text-[10px] text-zinc-500"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingUsers ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {dbUsers.length > 0 ? (
                dbUsers.map((u) => {
                  const rProfile = ROLE_PROFILES[u.role as UserRole] || ROLE_PROFILES.DEVELOPER;
                  const isSelected = currentUser ? currentUser.id === u.id : rProfile.id === role;
                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        setCurrentUser(u);
                        setRole(u.role as UserRole);
                        setIsOpen(false);
                      }}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between group ${
                        isSelected
                          ? 'bg-zinc-800/80 border-brand-500/60 shadow-md shadow-brand-500/10'
                          : 'bg-surface-950/50 hover:bg-zinc-800/50 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-tr ${rProfile.avatarBg} flex items-center justify-center text-[11px] font-bold text-white shadow-sm border border-white/20 shrink-0`}>
                          {u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || rProfile.shortLabel}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-xs font-bold text-white truncate">{u.name}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase font-semibold border ${rProfile.badgeBg} ${rProfile.badgeBorder} ${rProfile.badgeText} shrink-0`}>
                              {u.title || rProfile.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono block truncate">{u.email}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/40 flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                        <button
                          onClick={(e) => handleDeleteUser(u.id, e)}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 transition"
                          title="Delete user from Firestore DB"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center rounded-xl border border-zinc-800/80 bg-surface-950/40 text-xs text-zinc-400 space-y-2">
                  <Users className="w-7 h-7 text-zinc-600 mx-auto" />
                  <p>No user documents found in Firestore collection <code className="text-brand-300">users</code>.</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md transition"
                  >
                    + Create First User in DB
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: CREATE USER IN FIRESTORE */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateUser} className="space-y-2.5 p-1 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium text-[11px]">User Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Shiv Mahadev"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium text-[11px]">Corporate Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. shiv.mahadev@company.com"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium text-[11px]">Assign Organizational Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-brand-500 font-mono text-[11px]"
                >
                  <option value="PRODUCT_OWNER">👑 Product Owner (Scope & PRD)</option>
                  <option value="SCRUM_MASTER">🎛️ Scrum Master (Ceremonies & Planning)</option>
                  <option value="DEVELOPER">💻 Senior Developer (Task Delivery)</option>
                  <option value="QA_ENGINEER">🧪 QA Engineer (Quality & Verification)</option>
                  <option value="EXECUTIVE">👁️ Executive / VP (Read-Only Briefs)</option>
                  <option value="ADMIN">🛡️ Workspace Admin (Full Control)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium text-[11px]">Job Title (Optional)</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Workspace Administrator"
                  className="w-full bg-surface-950 border border-zinc-800 rounded-lg p-2 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {createMsg && (
                <div className="p-2 rounded bg-brand-500/10 border border-brand-500/30 text-brand-300 text-[11px]">
                  {createMsg}
                </div>
              )}

              <div className="pt-1 flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-mono">Persists to Firestore DB</span>
                <button
                  type="submit"
                  disabled={creating || !newName.trim() || !newEmail.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-brand-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{creating ? "Saving to DB..." : "Create User in DB"}</span>
                </button>
              </div>
            </form>
          )}

          {/* Footer Notice */}
          <div className="px-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
            <span>Logged in: <strong className="text-zinc-300">{displayName}</strong></span>
            {profile.permissions.isReadOnly ? (
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <Eye className="w-3 h-3" /> Read-Only Mode
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <UserCheck className="w-3 h-3" /> Operational Write
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
