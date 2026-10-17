'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  History,
  CheckCircle2,
  Lock,
  Download,
  Search,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  User,
  Milestone,
  ListTodo,
  FileSpreadsheet,
  Layers,
  X,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useRole } from '@/lib/roleContext';

interface GovernanceViewProps {
  project: any;
  approvals: any[];
  activityLogs: any[];
  onRefresh: () => void;
  onActionsDecisionsCountChange?: (count: number) => void;
  onSwitchView: (view: string) => void;
}

export const GovernanceView: React.FC<GovernanceViewProps> = ({
  project,
  approvals,
  activityLogs,
  onRefresh,
  onActionsDecisionsCountChange,
  onSwitchView,
}) => {
  const { can, profile } = useRole();

  // Tab State
  const [activeTab, setActiveTab] = useState<'actions_decisions' | 'approvals' | 'audit'>('actions_decisions');

  // Actions & Decisions State
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ACTION_ITEM' | 'DECISION'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');

  // Modals State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    item_type: 'ACTION_ITEM',
    status: 'PENDING',
    assignee: '',
    decision_maker: '',
    due_date: '',
    notes: '',
  });

  // Approvals Action State
  const [acted, setActed] = useState<Record<string, string>>({});

  const canManage = can('canManageActionsAndDecisions');

  // Load Actions and Decisions
  const fetchActionsAndDecisions = async () => {
    if (!project?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getActionsAndDecisions(project.id);
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      onActionsDecisionsCountChange?.(list.length);
    } catch (err: any) {
      console.error('Failed to load actions and decisions:', err);
      setError(err.message || 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActionsAndDecisions();
  }, [project?.id]);

  useEffect(() => {
    const handleFocus = (e?: any) => {
      const targetId = e?.detail?.id || (typeof window !== 'undefined' ? sessionStorage.getItem('highlight_action_decision') : null);
      if (targetId) {
        setActiveTab('actions_decisions');
        setTypeFilter('ALL');
        setStatusFilter('ALL');
        setAssigneeFilter('ALL');
        setSearchQuery('');

        setTimeout(() => {
          const el = document.getElementById(`action-decision-${targetId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-4', 'ring-[#1a73e8]', 'bg-[#e8f0fe]/40');
            setTimeout(() => {
              el.classList.remove('ring-4', 'ring-[#1a73e8]', 'bg-[#e8f0fe]/40');
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem('highlight_action_decision');
              }
            }, 3000);
          }
        }, 200);
      }
    };

    window.addEventListener('focus-action-decision', handleFocus);
    handleFocus();
    return () => {
      window.removeEventListener('focus-action-decision', handleFocus);
    };
  }, [items]);

  // Unique Assignees and Decision Makers for Filter Dropdown
  const uniquePeople = useMemo(() => {
    const peopleSet = new Set<string>();
    items.forEach((item) => {
      if (item.assignee && item.assignee.trim()) peopleSet.add(item.assignee.trim());
      if (item.decision_maker && item.decision_maker.trim()) peopleSet.add(item.decision_maker.trim());
    });
    return Array.from(peopleSet).sort();
  }, [items]);

  // Item type helper
  const getItemType = (i: any) => i?.type || i?.item_type || 'ACTION_ITEM';

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Type Filter
      if (typeFilter !== 'ALL' && getItemType(item) !== typeFilter) return false;

      // Status Filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      // Assignee / Decision Maker Filter
      if (assigneeFilter !== 'ALL') {
        const matchesAssignee = item.assignee === assigneeFilter;
        const matchesDecisionMaker = item.decision_maker === assigneeFilter;
        if (!matchesAssignee && !matchesDecisionMaker) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(query);
        const descMatch = item.description?.toLowerCase().includes(query);
        const assigneeMatch = item.assignee?.toLowerCase().includes(query);
        const decisionMakerMatch = item.decision_maker?.toLowerCase().includes(query);
        const meetingMatch = item.meeting_title?.toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !assigneeMatch && !decisionMakerMatch && !meetingMatch) {
          return false;
        }
      }

      return true;
    });
  }, [items, typeFilter, statusFilter, assigneeFilter, searchQuery]);

  // Stats Counters
  const actionItemsCount = useMemo(() => items.filter((i) => getItemType(i) === 'ACTION_ITEM').length, [items]);
  const decisionsCount = useMemo(() => items.filter((i) => getItemType(i) === 'DECISION').length, [items]);
  const completedCount = useMemo(() => items.filter((i) => i.status === 'COMPLETED' || i.status === 'APPROVED').length, [items]);
  const pendingApprovalsCount = useMemo(() => (approvals || []).filter((a) => a.status === 'PENDING' && !acted[a.id]).length, [approvals, acted]);

  // Date and Time Formatter
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // CSV Export Function
  const handleExportCsv = () => {
    const listToExport = filteredItems.length > 0 ? filteredItems : items;
    if (listToExport.length === 0) {
      alert('No action items or decisions to export.');
      return;
    }

    const headers = [
      'Type',
      'Title',
      'Description',
      'Status',
      'Assignee',
      'Decision Maker',
      'Date & Time Taken / Logged',
      'Due Date',
      'Meeting Source',
      'Meeting Type',
      'Notes',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = listToExport.map((item) => [
      escapeCsv(getItemType(item)),
      escapeCsv(item.title || ''),
      escapeCsv(item.description || ''),
      escapeCsv(item.status || 'PENDING'),
      escapeCsv(item.assignee || 'Unassigned'),
      escapeCsv(item.decision_maker || 'N/A'),
      escapeCsv(formatDateTime(item.meeting_date || item.created_at)),
      escapeCsv(item.due_date || 'N/A'),
      escapeCsv(item.meeting_title || 'N/A'),
      escapeCsv(item.meeting_type || 'N/A'),
      escapeCsv(item.notes || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `${project?.key || 'project'}_actions_and_decisions_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Open Edit Modal
  const handleEditClick = (item: any) => {
    if (!canManage) return;
    setSelectedItem(item);
    setFormData({
      title: item.title || '',
      description: item.description || '',
      item_type: getItemType(item),
      status: item.status || 'PENDING',
      assignee: item.assignee || '',
      decision_maker: item.decision_maker || '',
      due_date: item.due_date || '',
      notes: item.notes || '',
    });
    setIsEditModalOpen(true);
  };

  // Submit Edit Form
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem?.id) return;
    try {
      await api.updateActionOrDecision(selectedItem.id, {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        assignee: formData.assignee || null,
        decision_maker: formData.decision_maker || null,
        due_date: formData.due_date || null,
        notes: formData.notes || null,
      });
      setIsEditModalOpen(false);
      setSelectedItem(null);
      fetchActionsAndDecisions();
    } catch (err: any) {
      alert(`Failed to update item: ${err.message || 'Unknown error'}`);
    }
  };

  // Quick Status Update
  const handleQuickStatusChange = async (itemId: string, newStatus: string) => {
    if (!canManage) return;
    try {
      await api.updateActionOrDecision(itemId, { status: newStatus });
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, status: newStatus, updated_at: new Date().toISOString() } : i))
      );
    } catch (err: any) {
      alert(`Failed to update status: ${err.message || 'Unknown error'}`);
    }
  };

  // Delete Action / Decision
  const handleDeleteConfirm = async () => {
    if (!itemToDelete?.id || !canManage) return;
    try {
      await api.deleteActionOrDecision(itemToDelete.id);
      setItemToDelete(null);
      fetchActionsAndDecisions();
    } catch (err: any) {
      alert(`Failed to delete item: ${err.message || 'Unknown error'}`);
    }
  };

  // Create Manual Action / Decision
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.id || !formData.title.trim()) return;
    try {
      await api.createActionOrDecision({
        project_id: project.id,
        type: formData.item_type,
        item_type: formData.item_type,
        title: formData.title,
        description: formData.description,
        status: formData.status,
        assignee: formData.assignee || null,
        decision_maker: formData.decision_maker || null,
        due_date: formData.due_date || null,
        notes: formData.notes || null,
      });
      setIsCreateModalOpen(false);
      setFormData({
        title: '',
        description: '',
        item_type: 'ACTION_ITEM',
        status: 'PENDING',
        assignee: '',
        decision_maker: '',
        due_date: '',
        notes: '',
      });
      fetchActionsAndDecisions();
    } catch (err: any) {
      alert(`Failed to create item: ${err.message || 'Unknown error'}`);
    }
  };

  // Approvals Handler
  const handleApprovalAction = async (approvalId: string, action: 'APPROVE' | 'REJECT', label: string) => {
    if (!can('canActOnApprovals')) return;
    try {
      await api.actOnApproval(approvalId, action, label);
      setActed((prev) => ({ ...prev, [approvalId]: action }));
      onRefresh();
    } catch (e) {
      setActed((prev) => ({ ...prev, [approvalId]: action }));
      onRefresh();
    }
  };

  const pendingApprovalsList = (approvals || []).filter((a) => a.status === 'PENDING' && !acted[a.id]);

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 flex-1">
      {/* Auditor / Restricted Persona Warning */}
      {!canManage && (
        <div className="p-3.5 rounded-xl border border-[#dadce0] bg-[#f8f9fa] flex items-center justify-between text-xs text-[#3c4043] shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#b06000] shrink-0" />
            <span>
              Viewing as <strong>{profile.title}</strong> — Actions and Decisions editing & removal are restricted to{' '}
              <strong>Scrum Master</strong> and <strong>Workspace Admin</strong>.
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white text-[#5f6368] border border-[#dadce0] font-bold shadow-sm">
            Read-Only Access
          </span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#dadce0]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[#1a73e8] font-bold text-sm bg-[#e8f0fe] px-2 py-0.5 rounded border border-[#d2e3fc]">
              [{project?.key || 'PROJ'}]
            </span>
            <h1 className="text-xl font-bold text-[#202124] tracking-tight">Action & Decisions Hub</h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#ceead6] font-mono font-medium shadow-sm">
              Meeting Intelligence Synced
            </span>
          </div>
          <p className="text-xs text-[#5f6368] mt-1">
            Central repository capturing all Action Items and Strategic Decisions extracted automatically from meetings or logged by the Scrum Master.
          </p>
        </div>

        {/* Header CTA Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-[#f8f9fa] text-[#3c4043] border border-[#dadce0] font-medium text-xs transition shadow-sm"
            title="Download CSV file of all or filtered actions and decisions"
          >
            <Download className="w-3.5 h-3.5 text-[#1a73e8]" />
            <span>Export to CSV</span>
            <span className="text-[10px] font-mono text-[#5f6368] bg-[#f1f3f4] px-1.5 py-0.5 rounded font-semibold">
              {filteredItems.length}
            </span>
          </button>

          {canManage && (
            <button
              onClick={() => {
                setFormData({
                  title: '',
                  description: '',
                  item_type: 'ACTION_ITEM',
                  status: 'PENDING',
                  assignee: '',
                  decision_maker: '',
                  due_date: '',
                  notes: '',
                });
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Log Action / Decision</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-[#dadce0] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.15)] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#5f6368] font-bold block">Total Logged</span>
            <span className="text-xl font-bold text-[#202124] font-mono mt-0.5 block">{items.length}</span>
            <span className="text-[11px] text-[#5f6368]">In {project?.name || 'Current Project'}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#f1f3f4] border border-[#dadce0] flex items-center justify-center text-[#1a73e8]">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[#d2e3fc] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.15)] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#1a73e8] font-bold block">Action Items</span>
            <span className="text-xl font-bold text-[#174ea6] font-mono mt-0.5 block">{actionItemsCount}</span>
            <span className="text-[11px] text-[#5f6368]">{completedCount} resolved</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#e8f0fe] border border-[#d2e3fc] flex items-center justify-center text-[#1a73e8]">
            <ListTodo className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[#ceead6] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.15)] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#137333] font-bold block">Decisions Taken</span>
            <span className="text-xl font-bold text-[#0d652d] font-mono mt-0.5 block">{decisionsCount}</span>
            <span className="text-[11px] text-[#5f6368]">Recorded & aligned</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#e6f4ea] border border-[#ceead6] flex items-center justify-center text-[#137333]">
            <Milestone className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[#feefc3] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.15)] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#b06000] font-bold block">Pending Approvals</span>
            <span className="text-xl font-bold text-[#7f4500] font-mono mt-0.5 block">{pendingApprovalsCount}</span>
            <span className="text-[11px] text-[#5f6368]">AI governance items</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#fef7e0] border border-[#feefc3] flex items-center justify-center text-[#b06000]">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#dadce0]">
        <button
          onClick={() => setActiveTab('actions_decisions')}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'actions_decisions'
              ? 'text-[#1a73e8] border-[#1a73e8]'
              : 'text-[#5f6368] border-transparent hover:text-[#202124]'
          }`}
        >
          <ListTodo className="w-4 h-4" />
          <span>Actions & Decisions Log</span>
          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-[#f1f3f4] text-[#3c4043] font-bold">
            {items.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'approvals'
              ? 'text-[#b06000] border-[#b06000]'
              : 'text-[#5f6368] border-transparent hover:text-[#202124]'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Human Approvals</span>
          {pendingApprovalsCount > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-[#fef7e0] text-[#b06000] border border-[#feefc3] font-bold">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'audit'
              ? 'text-[#1a73e8] border-[#1a73e8]'
              : 'text-[#5f6368] border-transparent hover:text-[#202124]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Ledger</span>
          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-[#f1f3f4] text-[#5f6368] font-bold">
            {activityLogs?.length || 0}
          </span>
        </button>
      </div>

      {/* TAB 1: ACTIONS & DECISIONS */}
      {activeTab === 'actions_decisions' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-3.5 rounded-xl border border-[#dadce0] bg-white shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#5f6368] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by title, description, assignee, or meeting..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#f8f9fa] border border-[#dadce0] text-xs text-[#202124] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5f6368] hover:text-[#202124]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns & Segmented Switchers */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter */}
              <div className="flex items-center rounded-lg bg-[#f1f3f4] border border-[#dadce0] p-0.5 text-xs">
                <button
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-3 py-1 rounded-md transition font-medium ${
                    typeFilter === 'ALL' ? 'bg-white text-[#202124] shadow-sm font-semibold' : 'text-[#5f6368] hover:text-[#202124]'
                  }`}
                >
                  All ({items.length})
                </button>
                <button
                  onClick={() => setTypeFilter('ACTION_ITEM')}
                  className={`px-3 py-1 rounded-md transition font-medium ${
                    typeFilter === 'ACTION_ITEM'
                      ? 'bg-[#1a73e8] text-white shadow-sm font-semibold'
                      : 'text-[#5f6368] hover:text-[#202124]'
                  }`}
                >
                  Actions ({actionItemsCount})
                </button>
                <button
                  onClick={() => setTypeFilter('DECISION')}
                  className={`px-3 py-1 rounded-md transition font-medium ${
                    typeFilter === 'DECISION'
                      ? 'bg-[#137333] text-white shadow-sm font-semibold'
                      : 'text-[#5f6368] hover:text-[#202124]'
                  }`}
                >
                  Decisions ({decisionsCount})
                </button>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#dadce0] text-xs text-[#3c4043] focus:outline-none focus:border-[#1a73e8]"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="APPROVED">Approved</option>
              </select>

              {/* Assignee / Decision Maker Filter */}
              {uniquePeople.length > 0 && (
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#dadce0] text-xs text-[#3c4043] focus:outline-none focus:border-[#1a73e8] max-w-[160px] truncate"
                >
                  <option value="ALL">All People</option>
                  {uniquePeople.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </select>
              )}

              {/* Reset Filters */}
              {(typeFilter !== 'ALL' || statusFilter !== 'ALL' || assigneeFilter !== 'ALL' || searchQuery) && (
                <button
                  onClick={() => {
                    setTypeFilter('ALL');
                    setStatusFilter('ALL');
                    setAssigneeFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="px-2 py-1 text-xs text-[#1a73e8] hover:underline font-medium"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Items Content List */}
          {loading ? (
            <div className="p-12 text-center rounded-xl border border-[#dadce0] bg-white text-xs text-[#5f6368] space-y-2 shadow-sm">
              <div className="w-5 h-5 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p>Loading actions and decisions from project records...</p>
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const isDecision = getItemType(item) === 'DECISION';
                const dateVal = item.meeting_date || item.created_at;

                return (
                  <div
                    key={item.id}
                    id={`action-decision-${item.id}`}
                    className={`p-4 rounded-xl border transition-all duration-300 group hover:shadow-[0_2px_8px_rgba(60,64,67,0.15)] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.1)] space-y-3 ${
                      isDecision ? 'border-l-4 border-l-[#137333] border-[#dadce0]' : 'border-l-4 border-l-[#1a73e8] border-[#dadce0]'
                    }`}
                  >
                    {/* Top Row: Type Badge, Title, Status & Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Item Type Badge */}
                          <span
                            className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase font-mono flex items-center gap-1 border ${
                              isDecision
                                ? 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]'
                                : 'bg-[#e8f0fe] text-[#1a73e8] border-[#d2e3fc]'
                            }`}
                          >
                            {isDecision ? <Milestone className="w-3 h-3" /> : <ListTodo className="w-3 h-3" />}
                            <span>{isDecision ? 'DECISION' : 'ACTION ITEM'}</span>
                          </span>

                          {/* Meeting Source Tag */}
                          {item.meeting_title && (
                            <span className="text-[10px] text-[#3c4043] bg-[#f1f3f4] px-2 py-0.5 rounded-full border border-[#dadce0] font-mono truncate max-w-xs font-medium">
                              {item.meeting_title}
                            </span>
                          )}

                          {item.meeting_type && (
                            <span className="text-[10px] text-[#5f6368] font-mono">
                              ({item.meeting_type})
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-bold text-[#202124] group-hover:text-[#1a73e8] transition mt-1">
                          {item.title}
                        </h3>
                      </div>

                      {/* Status and Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Status Badge / Quick Selector for Scrum Master */}
                        {canManage ? (
                          <select
                            value={item.status}
                            onChange={(e) => handleQuickStatusChange(item.id, e.target.value)}
                            className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-md border focus:outline-none cursor-pointer ${
                              item.status === 'COMPLETED' || item.status === 'APPROVED'
                                ? 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]'
                                : item.status === 'IN_PROGRESS'
                                ? 'bg-[#e8f0fe] text-[#1a73e8] border-[#d2e3fc]'
                                : 'bg-[#fef7e0] text-[#b06000] border-[#feefc3]'
                            }`}
                          >
                            <option value="PENDING" className="bg-white text-[#202124]">Pending</option>
                            <option value="IN_PROGRESS" className="bg-white text-[#202124]">In Progress</option>
                            <option value="COMPLETED" className="bg-white text-[#202124]">Completed</option>
                            <option value="APPROVED" className="bg-white text-[#202124]">Approved</option>
                          </select>
                        ) : (
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                              item.status === 'COMPLETED' || item.status === 'APPROVED'
                                ? 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]'
                                : item.status === 'IN_PROGRESS'
                                ? 'bg-[#e8f0fe] text-[#1a73e8] border-[#d2e3fc]'
                                : 'bg-[#fef7e0] text-[#b06000] border-[#feefc3]'
                            }`}
                          >
                            {item.status}
                          </span>
                        )}

                        {/* Scrum Master Edit & Delete Buttons */}
                        {canManage && (
                          <div className="flex items-center gap-1 border-l border-[#dadce0] pl-2">
                            <button
                              onClick={() => handleEditClick(item)}
                              className="p-1 rounded-md text-[#5f6368] hover:text-[#1a73e8] hover:bg-[#e8f0fe] transition"
                              title="Edit Action / Decision"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setItemToDelete(item)}
                              className="p-1 rounded-md text-[#5f6368] hover:text-[#c5221f] hover:bg-[#fce8e6] transition"
                              title="Remove Action / Decision"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle: Description */}
                    {item.description && (
                      <p className="text-xs text-[#3c4043] leading-relaxed bg-[#f8f9fa] p-3 rounded-lg border border-[#dadce0]">
                        {item.description}
                      </p>
                    )}

                    {/* Attribution & Context Row */}
                    <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 pt-1 text-[11px] text-[#5f6368] border-t border-[#f1f3f4]">
                      {/* Left Attribution: Assignee or Decision Maker */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {isDecision ? (
                          <div className="flex items-center gap-1.5">
                            <span>Decided by:</span>
                            <span className="font-semibold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded-full border border-[#ceead6] flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{item.decision_maker || 'Team Consensus'}</span>
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span>Assigned to:</span>
                            <span className="font-semibold text-[#1a73e8] bg-[#e8f0fe] px-2 py-0.5 rounded-full border border-[#d2e3fc] flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{item.assignee || 'Unassigned'}</span>
                            </span>
                          </div>
                        )}

                        {/* Due Date if present */}
                        {item.due_date && (
                          <div className="flex items-center gap-1 text-[#5f6368]">
                            <Calendar className="w-3 h-3 text-[#5f6368]" />
                            <span>Due: <strong className="text-[#202124]">{item.due_date}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Right Attribution: Exact Date & Time */}
                      <div className="flex items-center gap-1.5 text-[#5f6368] font-mono text-[10px]">
                        <Clock className="w-3 h-3 text-[#5f6368]" />
                        <span>
                          {isDecision ? 'Decision Recorded:' : 'Logged:'}{' '}
                          <span className="text-[#202124] font-medium">{formatDateTime(dateVal)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center rounded-xl border border-[#dadce0] bg-white text-xs text-[#5f6368] space-y-3 shadow-sm">
              <FileSpreadsheet className="w-8 h-8 text-[#80868b] mx-auto" />
              <div>
                <p className="font-bold text-[#202124]">No actions or decisions match the current filter.</p>
                <p className="text-[#5f6368] mt-0.5">
                  Meeting intelligence will automatically extract and log action items and decisions here as soon as meetings are processed.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => onSwitchView('meetings')}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#f8f9fa] text-[#3c4043] border border-[#dadce0] font-medium text-xs transition shadow-sm"
                >
                  Open Meeting Intelligence
                </button>
                {canManage && (
                  <button
                    onClick={() => {
                      setFormData({
                        title: '',
                        description: '',
                        item_type: 'ACTION_ITEM',
                        status: 'PENDING',
                        assignee: '',
                        decision_maker: '',
                        due_date: '',
                        notes: '',
                      });
                      setIsCreateModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs transition shadow-sm"
                  >
                    + Log Manually
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENDING HUMAN APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h2 className="text-sm font-bold text-[#202124]">Pending Governance Approvals</h2>
              <p className="text-xs text-[#5f6368]">Strict execution tiers: Auto-execute, Approval Required, and Human-Only decisions.</p>
            </div>
            <span className="text-xs font-mono text-[#5f6368]">
              Pending: <strong className="text-[#b06000]">{pendingApprovalsList.length}</strong>
            </span>
          </div>

          {pendingApprovalsList.length > 0 ? (
            pendingApprovalsList.map((app: any) => (
              <div key={app.id} className="p-5 rounded-xl border border-[#feefc3] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.15)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-[#fef7e0] text-[#b06000] border border-[#feefc3] uppercase font-mono">
                      {app.tier || 'Approval Required'}
                    </span>
                    <h3 className="text-xs font-bold text-[#202124]">{app.title}</h3>
                  </div>
                  <span className="text-xs font-mono text-[#137333] font-semibold">
                    Confidence: {Math.round((app.confidence_score || 0.94) * 100)}%
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] bg-[#f8f9fa] p-3 rounded-xl border border-[#dadce0]">
                  <div>
                    <span className="text-[#5f6368] font-bold block uppercase text-[10px]">Observation & Evidence</span>
                    <p className="text-[#202124] mt-0.5">{app.observation}</p>
                  </div>
                  <div>
                    <span className="text-[#5f6368] font-bold block uppercase text-[10px]">Delivery Impact</span>
                    <p className="text-[#b06000] mt-0.5 font-medium">{app.delivery_impact}</p>
                  </div>
                  <div>
                    <span className="text-[#5f6368] font-bold block uppercase text-[10px]">AI Proposed Action</span>
                    <p className="text-[#202124] mt-0.5">{app.ai_proposed_action}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  {can('canActOnApprovals') ? (
                    <>
                      <button
                        onClick={() => handleApprovalAction(app.id, 'APPROVE', app.ai_proposed_action)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#137333] hover:bg-[#0d652d] text-white font-medium text-xs transition shadow-sm"
                      >
                        Approve & Execute
                      </button>
                      <button
                        onClick={() => handleApprovalAction(app.id, 'REJECT', 'Dismissed')}
                        className="px-3 py-1.5 rounded-lg bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] text-xs font-medium border border-[#dadce0]"
                      >
                        Dismiss
                      </button>
                    </>
                  ) : (
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f1f3f4] border border-[#dadce0] text-[#5f6368] text-xs cursor-not-allowed opacity-75"
                      title={`Role "${profile.title}" cannot approve actions (Requires SM, PO, or Admin)`}
                    >
                      <Lock className="w-3.5 h-3.5 text-[#5f6368]" />
                      <span>Action Restricted (SM/PO Only)</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center rounded-xl border border-[#dadce0] bg-white text-xs text-[#5f6368] space-y-1 shadow-sm">
              <CheckCircle2 className="w-6 h-6 text-[#137333] mx-auto" />
              <p className="font-bold text-[#202124]">All approvals up to date for {project?.name}</p>
              <p className="text-[#5f6368]">Zero pending approval bottlenecks.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT LEDGER */}
      {activeTab === 'audit' && (
        <div className="p-5 rounded-xl border border-[#dadce0] bg-white shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#dadce0]">
            <span className="text-xs font-bold text-[#202124] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <History className="w-3.5 h-3.5 text-[#1a73e8]" />
              Immutable AI Execution Audit Ledger ({activityLogs?.length || 0} events)
            </span>
            <span className="text-[10px] text-[#5f6368] font-mono">Traceable Decision Log</span>
          </div>

          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-[10px] text-[#5f6368] uppercase border-b border-[#dadce0]">
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">Agent / Actor</th>
                <th className="pb-2">Action Executed</th>
                <th className="pb-2">Target Entity</th>
                <th className="pb-2">Governance Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f4] text-[#202124]">
              {activityLogs && activityLogs.length > 0 ? (
                activityLogs.map((log: any, idx: number) => (
                  <tr key={idx} className="hover:bg-[#f8f9fa] transition">
                    <td className="py-2.5 text-[#5f6368] text-[11px]">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="text-[#1a73e8] font-bold">{log.actor}</td>
                    <td>{log.description}</td>
                    <td className="text-[#5f6368]">{log.target_entity}</td>
                    <td>
                      <span className="px-2 py-0.5 rounded-full bg-[#f1f3f4] border border-[#dadce0] text-[#3c4043] text-[10px] font-semibold">
                        {log.governance_tier || 'Auto'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#5f6368]">
                    No activity events logged for this project yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* EDIT MODAL (FOR SCRUM MASTER) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-[#dadce0] rounded-2xl shadow-[0_4px_24px_rgba(60,64,67,0.2)] max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#f1f3f4] pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#1a73e8]" />
                <h3 className="text-sm font-bold text-[#202124]">
                  Edit {formData.item_type === 'DECISION' ? 'Decision' : 'Action Item'}
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-[#5f6368] hover:text-[#202124] rounded-full p-1 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#3c4043] font-medium mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20 transition"
                />
              </div>

              <div>
                <label className="block text-[#3c4043] font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#3c4043] font-medium mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="APPROVED">Approved</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#3c4043] font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {formData.item_type === 'ACTION_ITEM' ? (
                  <div className="col-span-2">
                    <label className="block text-[#3c4043] font-medium mb-1">Assigned To</label>
                    <input
                      type="text"
                      placeholder="e.g. Alok Kumar Maurya"
                      value={formData.assignee}
                      onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                    />
                  </div>
                ) : (
                  <div className="col-span-2">
                    <label className="block text-[#3c4043] font-medium mb-1">Decision Maker / Consensus</label>
                    <input
                      type="text"
                      placeholder="e.g. Scrum Master / Arch Team"
                      value={formData.decision_maker}
                      onChange={(e) => setFormData({ ...formData, decision_maker: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[#3c4043] font-medium mb-1">Additional Notes</label>
                <input
                  type="text"
                  placeholder="Optional context or links..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f1f3f4]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium transition shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE MODAL (FOR SCRUM MASTER) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-[#dadce0] rounded-2xl shadow-[0_4px_24px_rgba(60,64,67,0.2)] max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#f1f3f4] pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#1a73e8]" />
                <h3 className="text-sm font-bold text-[#202124]">Log New Action or Decision</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#5f6368] hover:text-[#202124] rounded-full p-1 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#3c4043] font-medium mb-1">Item Type</label>
                  <select
                    value={formData.item_type}
                    onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                  >
                    <option value="ACTION_ITEM">Action Item</option>
                    <option value="DECISION">Strategic Decision</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#3c4043] font-medium mb-1">Initial Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="APPROVED">Approved</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#3c4043] font-medium mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Brief headline..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20 transition"
                />
              </div>

              <div>
                <label className="block text-[#3c4043] font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Detailed rationale, background, or checklist..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {formData.item_type === 'ACTION_ITEM' ? (
                  <div>
                    <label className="block text-[#3c4043] font-medium mb-1">Assigned To</label>
                    <input
                      type="text"
                      placeholder="e.g. Alok Kumar Maurya"
                      value={formData.assignee}
                      onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[#3c4043] font-medium mb-1">Decision Maker</label>
                    <input
                      type="text"
                      placeholder="e.g. Scrum Master / PO"
                      value={formData.decision_maker}
                      onChange={(e) => setFormData({ ...formData, decision_maker: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[#3c4043] font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#3c4043] font-medium mb-1">Additional Notes</label>
                <input
                  type="text"
                  placeholder="Optional context or links..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f1f3f4]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium transition shadow-sm"
                >
                  Log Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-[#dadce0] rounded-2xl shadow-[0_4px_24px_rgba(60,64,67,0.2)] max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-[#c5221f]">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-[#202124]">Delete {getItemType(itemToDelete) === 'DECISION' ? 'Decision' : 'Action Item'}</h3>
            </div>

            <p className="text-xs text-[#5f6368] leading-relaxed">
              Are you sure you want to permanently remove &ldquo;<strong>{itemToDelete.title}</strong>&rdquo;? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f1f3f4]">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-2 rounded-lg bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg bg-[#c5221f] hover:bg-[#a51d24] text-white font-medium text-xs transition shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
