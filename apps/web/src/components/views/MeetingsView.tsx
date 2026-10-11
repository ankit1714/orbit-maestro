'use client';

import React, { useState, useEffect } from 'react';
import {
  AlignLeft,
  Sparkles,
  Workflow,
  FileSearch,
  CheckCircle,
  AlertOctagon,
  Lock,
  Calendar,
  Clock,
  User,
  GitBranch,
  FileText,
  Layers,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Tag,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { api } from '@/lib/api';
import { useRole } from '@/lib/roleContext';

interface MeetingsViewProps {
  project: any;
  onSwitchView: (view: string) => void;
  onRefresh?: () => void;
}

export const MeetingsView: React.FC<MeetingsViewProps> = ({ project, onSwitchView, onRefresh }) => {
  const { can, profile } = useRole();
  
  // New Meeting Form State
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [title, setTitle] = useState('Daily Scrum');
  const [meetingType, setMeetingType] = useState<string>('STANDUP');
  const [enteredBy, setEnteredBy] = useState(profile?.name || 'Alok Kumar Maurya');
  const [meetingDate, setMeetingDate] = useState(() => {
    const now = new Date();
    // format as YYYY-MM-DDTHH:mm
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [transcript, setTranscript] = useState('');
  
  // Meeting Records & Due Diligence State
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [latestProcessed, setLatestProcessed] = useState<any>(null);

  // Sync profile name to enteredBy if available
  useEffect(() => {
    if (profile?.name && (!enteredBy || enteredBy === 'Team Member')) {
      setEnteredBy(profile.name);
    }
  }, [profile]);

  // Load Historical Meetings for Project
  const loadMeetings = async () => {
    if (!project?.id) return;
    setLoadingList(true);
    try {
      const data = await api.listMeetings(project.id);
      setMeetings(data || []);
      if (data && data.length > 0 && !expandedMeetingId) {
        setExpandedMeetingId(data[0].meeting_id);
      }
    } catch (e) {
      console.warn('Error loading meetings:', e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, [project?.id]);

  // Pre-fill sample templates
  const fillSample = (kind: 'STANDUP' | 'ARCH' | 'UNLINKED') => {
    const engineer = project?.team_members?.[0]?.name || profile?.name || "Lead Engineer";
    const collaborator = project?.team_members?.[1]?.name || "Backend Developer";

    if (kind === 'STANDUP') {
      setTitle(`Daily Scrum - Mobile & Backlog Sync`);
      setMeetingType('STANDUP');
      setTranscript(`Standup updates for ${project?.name || "the project"}:
${engineer}: Worked on HM-3 for capacitor mobile sync and updated package.json scripts. acceptance testing passed.
${collaborator}: Investigating HM-2 driver onboarding flow against the Confluence specification. Currently blocked waiting on API gateway mock.
Product Owner: Approved priority for HM-3 and will unblock API access today.`);
    } else if (kind === 'ARCH') {
      setTitle(`Architecture Sync on Deployment & Workflows`);
      setMeetingType('ARCHITECTURE');
      setTranscript(`Technical Architecture Discussion for ${project?.name || "the project"}:
- Reviewed Git repository CI/CD pipeline in .github/workflows/deploy.yml.
- Decided to adopt automated GitHub Pages distribution for the web bundle.
- Aligned driver registration flow with Confluence specification 'HiFive Tours — Driver & Traveller Platform'.
- Action: Update HM-2 task acceptance criteria with updated webhook payload schema.`);
    } else {
      setTitle(`Team Coffee & Social Sync`);
      setMeetingType('ADHOC');
      setTranscript(`Team informal coffee gathering:
- Celebrated Sarah's birthday with team cake in the cafeteria.
- Discussed weekend movie plans, outdoor camping spots, and upcoming December holiday schedules.
- No software tasks, backlog issues, or technical code was discussed.`);
    }
  };

  // Process & Ingest New Meeting Minutes
  const handleProcess = async () => {
    if (!can('canProcessMeetings')) return;
    if (!transcript.trim()) return;
    const pId = project?.id;
    if (!pId) return;

    setProcessing(true);
    try {
      const res = await api.processMeeting({
        project_id: pId,
        meeting_type: meetingType,
        transcript_text: transcript,
        title: title.trim() || 'Team Meeting',
        entered_by: enteredBy.trim() || profile?.name || 'Team Member',
        date: new Date(meetingDate).toISOString()
      });

      setLatestProcessed(res);
      // Prepend to meetings list and expand
      setMeetings((prev) => [res, ...prev.filter((m) => m.meeting_id !== res.meeting_id)]);
      setExpandedMeetingId(res.meeting_id);
      setTranscript('');
      setTitle('Daily Scrum');

      if (onRefresh) onRefresh();
    } catch (e) {
      console.error('Meeting processing error:', e);
    } finally {
      setProcessing(false);
    }
  };

  // Run On-Demand AI Due Diligence on Existing Meeting
  const handleRunDueDiligence = async (meetingId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveAnalysisId(meetingId);
    try {
      const ddResult = await api.analyzeMeetingLinks(meetingId);
      // Update item in local list
      setMeetings((prev) =>
        prev.map((m) =>
          m.meeting_id === meetingId
            ? {
                ...m,
                due_diligence: ddResult,
                is_linked: ddResult.is_linked,
                verdict_message: ddResult.verdict_message
              }
            : m
        )
      );
      setExpandedMeetingId(meetingId);
    } catch (err) {
      console.error('Due diligence error:', err);
    } finally {
      setActiveAnalysisId(null);
    }
  };

  // Delete Meeting
  const handleDelete = async (meetingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this meeting minutes record?')) return;
    try {
      await api.deleteMeeting(meetingId);
      setMeetings((prev) => prev.filter((m) => m.meeting_id !== meetingId));
      if (expandedMeetingId === meetingId) {
        setExpandedMeetingId(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Filter & Search Meetings
  const filteredMeetings = meetings.filter((m) => {
    if (filterType !== 'ALL' && m.meeting_type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (m.title || '').toLowerCase().includes(q);
      const matchNotes = (m.transcript_text || m.transcript || '').toLowerCase().includes(q);
      const matchAuthor = (m.entered_by || '').toLowerCase().includes(q);
      const matchVerdict = (m.verdict_message || '').toLowerCase().includes(q);
      return matchTitle || matchNotes || matchAuthor || matchVerdict;
    }
    return true;
  });

  const formatMeetingDate = (dateVal: string | Date | undefined) => {
    if (!dateVal) return 'Unknown Date';
    try {
      const d = new Date(dateVal);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateVal);
    }
  };

  const getMeetingTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'STANDUP':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      case 'REVIEW':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
      case 'RETROSPECTIVE':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'ARCHITECTURE':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'TRIAGE':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const linkedCount = meetings.filter((m) => m.is_linked).length;
  const unlinkedCount = meetings.filter((m) => !m.is_linked).length;

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col">
      {/* Observer Mode Persona Banner */}
      {!can('canProcessMeetings') && (
        <div className="p-3 rounded-xl border border-zinc-700/60 bg-zinc-800/60 flex items-center justify-between text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              Viewing as <strong>{profile.title}</strong> — Meeting intelligence processing is restricted to Scrum Master, Product Owner, and Workspace Admin.
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-bold">
            Observer Mode
          </span>
        </div>
      )}

      {/* Top Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-brand-400 font-bold text-sm">[{project?.key}]</span>
            <h1 className="text-xl font-bold text-white">
              Meeting Intelligence & Decision Extractor
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
              Live Cross-Artifact Due Diligence
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Log meeting minutes at any time, persist notes by author and timestamp, and run AI due diligence to correlate discussions with JIRA tickets, Git codebase files, and Confluence specifications.
          </p>
        </div>

        {/* Counters & Quick Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-900/80 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-zinc-400">Total Minutes:</span>
            <span className="font-bold text-white font-mono">{meetings.length}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-emerald-400 font-semibold">{linkedCount} Linked</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">{unlinkedCount} Unlinked</span>
          </div>

          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              isFormOpen
                ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:text-white'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-sm shadow-purple-500/20'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isFormOpen ? 'Hide Entry Form' : 'Log Meeting Minutes'}</span>
          </button>

          <button
            onClick={loadMeetings}
            disabled={loadingList}
            title="Refresh Meeting Records"
            className="p-1.5 rounded-lg bg-surface-900 border border-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Meeting Minutes Input Form */}
      {isFormOpen && (
        <div className="p-5 rounded-2xl border border-purple-500/30 bg-surface-900/80 backdrop-blur-sm space-y-4 shadow-xl shadow-purple-950/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/80 text-xs">
            <div className="flex items-center gap-2">
              <AlignLeft className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-white text-sm">New Meeting Minutes</span>
              <span className="text-[11px] text-zinc-400">· Input as many meeting notes as needed any day</span>
            </div>

            {/* Template Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold mr-1">Templates:</span>
              <button
                type="button"
                onClick={() => fillSample('STANDUP')}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] border border-zinc-700 transition"
              >
                Daily Scrum
              </button>
              <button
                type="button"
                onClick={() => fillSample('ARCH')}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] border border-zinc-700 transition"
              >
                Architecture Sync
              </button>
              <button
                type="button"
                onClick={() => fillSample('UNLINKED')}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[11px] border border-zinc-700 transition"
              >
                Casual / Off-Topic Test
              </button>
            </div>
          </div>

          {/* Form Meta Fields: Title, Type, Date & Time, Entered By */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {/* Title */}
            <div className="space-y-1 md:col-span-1">
              <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                Meeting Title / Topic
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Daily Scrum - Oct 11"
                className="w-full bg-surface-950 border border-zinc-800 rounded-lg px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Type */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-zinc-400" />
                Meeting Type
              </label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                className="w-full bg-surface-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="STANDUP">Daily Scrum</option>
                <option value="ARCHITECTURE">Architecture & Tech Sync</option>
                <option value="REVIEW">Sprint Review & Demo</option>
                <option value="RETROSPECTIVE">Retrospective</option>
                <option value="TRIAGE">Bug & Issue Triage</option>
                <option value="ADHOC">Ad-hoc Discussion</option>
              </select>
            </div>

            {/* Date and Time */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full bg-surface-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-mono text-[11px]"
              />
            </div>

            {/* Entered By */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-zinc-400" />
                Entered By (Author)
              </label>
              <input
                type="text"
                value={enteredBy}
                onChange={(e) => setEnteredBy(e.target.value)}
                placeholder="Author Name"
                className="w-full bg-surface-950 border border-zinc-800 rounded-lg px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Transcript / Minutes Area */}
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-zinc-400">
                Meeting Minutes / Discussion Points
              </label>
              <span className="text-[10px] text-zinc-500">
                AI will cross-correlate against JIRA issues, Git code files/commits, and Confluence docs
              </span>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={`Enter raw meeting notes, attendee remarks, blockers, or decisions for ${project?.name || "the project"}...`}
              rows={6}
              className="w-full bg-surface-950 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 font-mono resize-y leading-relaxed transition"
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              <span>
                Due diligence strict guardrail: Responds <em>"Not linked to any GIT/JIRA/Confluence"</em> if topics are unrelated.
              </span>
            </p>

            {can('canProcessMeetings') ? (
              <button
                type="button"
                onClick={handleProcess}
                disabled={processing || !transcript.trim()}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition ${
                  processing || !transcript.trim()
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 hover:scale-[1.01]'
                }`}
              >
                <Sparkles className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
                <span>{processing ? 'Processing & Running AI Due Diligence...' : 'Save Minutes & Run AI Due Diligence'}</span>
              </button>
            ) : (
              <div
                className="px-4 py-2 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-zinc-500 font-bold text-xs flex items-center gap-2 cursor-not-allowed opacity-75"
                title={`Role "${profile.title}" cannot process meetings (Requires SM, PO, or Admin)`}
              >
                <Lock className="w-4 h-4 text-zinc-500" />
                <span>Process Decisions (SM/PO Only)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historical Meeting Minutes Section */}
      <div className="space-y-4 flex-1 flex flex-col">
        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-900/60 border border-zinc-800 p-3 rounded-xl text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search meeting minutes, author, decisions, or ticket keys..."
                className="w-full bg-surface-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-zinc-500 font-medium">Filter Type:</span>
            {['ALL', 'STANDUP', 'ARCHITECTURE', 'REVIEW', 'RETROSPECTIVE', 'TRIAGE', 'ADHOC'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  filterType === t
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-zinc-800/70 text-zinc-400 hover:text-white'
                }`}
              >
                {t === 'ALL'
                  ? 'All'
                  : t === 'STANDUP'
                  ? 'Scrum'
                  : t === 'ARCHITECTURE'
                  ? 'Arch'
                  : t === 'REVIEW'
                  ? 'Review'
                  : t === 'RETROSPECTIVE'
                  ? 'Retro'
                  : t === 'TRIAGE'
                  ? 'Triage'
                  : 'Ad-hoc'}
              </button>
            ))}
          </div>
        </div>

        {/* Meeting Minutes Cards */}
        {loadingList ? (
          <div className="p-12 text-center text-zinc-500 text-xs space-y-2 flex flex-col items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
            <p>Loading meeting records from database...</p>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-800 bg-surface-900/30 space-y-3">
            <FileSearch className="w-10 h-10 text-zinc-600 mx-auto" />
            <p className="text-zinc-300 font-semibold text-sm">No meeting minutes recorded yet</p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Any user can input meeting minutes at any time above. Notes will be stored in the database with timestamps, author attribution, and correlated with JIRA, Git, and Confluence.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMeetings.map((m) => {
              const isExpanded = expandedMeetingId === m.meeting_id;
              const dd = m.due_diligence;
              const isLinked = m.is_linked || (dd && dd.is_linked);
              const verdict = m.verdict_message || (dd && dd.verdict_message) || 'Not linked to any GIT/JIRA/Confluence';
              const isAnalyzing = activeAnalysisId === m.meeting_id;

              return (
                <div
                  key={m.meeting_id}
                  className={`rounded-2xl border transition-all ${
                    isExpanded
                      ? 'border-purple-500/50 bg-surface-900 shadow-xl shadow-purple-950/20'
                      : 'border-zinc-800/80 bg-surface-900/60 hover:border-zinc-700/80 hover:bg-surface-900'
                  }`}
                >
                  {/* Card Header */}
                  <div
                    onClick={() => setExpandedMeetingId(isExpanded ? null : m.meeting_id)}
                    className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Type badge */}
                        <span
                          className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${getMeetingTypeBadgeColor(
                            m.meeting_type
                          )}`}
                        >
                          {m.meeting_type}
                        </span>

                        <h3 className="text-sm sm:text-base font-bold text-white truncate">
                          {m.title || 'Team Meeting'}
                        </h3>

                        {/* Due Diligence Verdict Pill */}
                        {isLinked ? (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>Linked to Project Work</span>
                          </span>
                        ) : (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1 font-semibold">
                            <ShieldAlert className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span>Not linked to any GIT/JIRA/Confluence</span>
                          </span>
                        )}
                      </div>

                      {/* Meta bar: Date, Time, Author */}
                      <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
                        <span className="flex items-center gap-1 text-zinc-300">
                          <Calendar className="w-3.5 h-3.5 text-purple-400" />
                          {formatMeetingDate(m.date || m.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-zinc-400" />
                          Entered by: <strong className="text-zinc-200">{m.entered_by || 'Team Member'}</strong>
                        </span>
                        {m.decisions && m.decisions.length > 0 && (
                          <span className="text-emerald-400 text-[11px]">
                            {m.decisions.length} Decisions Logged
                          </span>
                        )}
                        {m.blockers && m.blockers.length > 0 && (
                          <span className="text-rose-400 text-[11px]">
                            {m.blockers.length} Blockers Flagged
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-2 self-end lg:self-center">
                      <button
                        type="button"
                        onClick={(e) => handleRunDueDiligence(m.meeting_id, e)}
                        disabled={isAnalyzing}
                        title="Re-run AI Due Diligence across JIRA, Git, and Confluence"
                        className="px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin text-purple-400' : ''}`} />
                        <span>{isAnalyzing ? 'Analyzing...' : 'Run Due Diligence'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(m.meeting_id, e)}
                        title="Delete meeting record"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="p-1.5 text-zinc-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Body */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-zinc-800/80 space-y-5 text-xs">
                      {/* AI Due Diligence Section (Crucial Requirement) */}
                      <div
                        className={`p-4 rounded-xl border ${
                          isLinked
                            ? 'bg-emerald-950/20 border-emerald-500/40'
                            : 'bg-zinc-950/60 border-zinc-800'
                        } space-y-3`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Workflow className={`w-4 h-4 ${isLinked ? 'text-emerald-400' : 'text-zinc-400'}`} />
                            <span className="font-bold text-white uppercase text-[11px] tracking-wide">
                              AI Cross-Artifact Due Diligence Report
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                              isLinked
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}
                          >
                            {isLinked ? 'LINKED TO PROJECT WORK' : 'NOT LINKED'}
                          </span>
                        </div>

                        {/* Verdict Headline */}
                        <div className="p-3 rounded-lg bg-surface-950 border border-zinc-800/80">
                          <p
                            className={`font-semibold ${
                              isLinked ? 'text-emerald-300' : 'text-zinc-300'
                            }`}
                          >
                            {verdict}
                          </p>
                          {dd?.detailed_analysis && (
                            <p className="text-zinc-400 mt-1.5 text-[11px] leading-relaxed">
                              {dd.detailed_analysis}
                            </p>
                          )}
                        </div>

                        {/* If Linked: Show Linked JIRA, Git, and Confluence entities */}
                        {isLinked && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                            {/* Linked JIRA Issues */}
                            <div className="p-3 rounded-lg bg-surface-950 border border-blue-500/30 space-y-2">
                              <span className="text-[10px] font-mono text-blue-300 uppercase font-bold flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-blue-400" />
                                Linked JIRA Tickets ({dd?.linked_jira_issues?.length || 0})
                              </span>
                              {dd?.linked_jira_issues && dd.linked_jira_issues.length > 0 ? (
                                <div className="space-y-2">
                                  {dd.linked_jira_issues.map((ji: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="p-2 rounded bg-surface-900 border border-zinc-800 text-[11px] space-y-1"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-brand-400 font-mono">
                                          {ji.key}
                                        </span>
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                          {ji.status || 'To Do'}
                                        </span>
                                      </div>
                                      <p className="text-white font-medium">{ji.title}</p>
                                      <p className="text-[10px] text-zinc-400">
                                        <strong>Relation:</strong> {ji.relationship}
                                      </p>
                                      <p className="text-[10px] text-zinc-500">
                                        {ji.relevance_reason}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-zinc-500 italic">No specific JIRA tickets identified</p>
                              )}
                            </div>

                            {/* Linked Git Artifacts */}
                            <div className="p-3 rounded-lg bg-surface-950 border border-purple-500/30 space-y-2">
                              <span className="text-[10px] font-mono text-purple-300 uppercase font-bold flex items-center gap-1.5">
                                <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                                Linked Git Artifacts ({dd?.linked_git_artifacts?.length || 0})
                              </span>
                              {dd?.linked_git_artifacts && dd.linked_git_artifacts.length > 0 ? (
                                <div className="space-y-2">
                                  {dd.linked_git_artifacts.map((ga: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="p-2 rounded bg-surface-900 border border-zinc-800 text-[11px] space-y-1"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-mono text-purple-300 font-bold truncate">
                                          {ga.path_or_identifier || ga.repo_name}
                                        </span>
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                                          {ga.artifact_type}
                                        </span>
                                      </div>
                                      <p className="text-white font-medium">{ga.repo_name}</p>
                                      <p className="text-[10px] text-zinc-400">
                                        <strong>Impact:</strong> {ga.relationship}
                                      </p>
                                      <p className="text-[10px] text-zinc-500">
                                        {ga.relevance_reason}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-zinc-500 italic">No Git files/scripts referenced</p>
                              )}
                            </div>

                            {/* Linked Confluence Documentation */}
                            <div className="p-3 rounded-lg bg-surface-950 border border-emerald-500/30 space-y-2">
                              <span className="text-[10px] font-mono text-emerald-300 uppercase font-bold flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                                Linked Confluence Specs ({dd?.linked_confluence_pages?.length || 0})
                              </span>
                              {dd?.linked_confluence_pages && dd.linked_confluence_pages.length > 0 ? (
                                <div className="space-y-2">
                                  {dd.linked_confluence_pages.map((cp: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="p-2 rounded bg-surface-900 border border-zinc-800 text-[11px] space-y-1"
                                    >
                                      <p className="text-white font-bold">{cp.title}</p>
                                      <p className="text-[10px] text-emerald-400">
                                        <strong>Space:</strong> {cp.space_key || 'Project Wiki'}
                                      </p>
                                      <p className="text-[10px] text-zinc-400">
                                        <strong>Relation:</strong> {cp.relationship}
                                      </p>
                                      <p className="text-[10px] text-zinc-500">
                                        {cp.relevance_reason}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-zinc-500 italic">No Confluence pages referenced</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* If NOT Linked: Prominent Anti-Hallucination Explanatory Callout */}
                        {!isLinked && (
                          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-400">
                            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-zinc-200 font-medium">Due Diligence Audit Result</p>
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                The AI evaluated this transcript against all active JIRA tickets (Epics, Stories, Bugs, Tasks), Git repositories (README, file hierarchy tree, build scripts), and Confluence product specifications. No overlapping entities or tasks were found.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Executive Summary & Raw Notes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Executive Summary */}
                        <div className="p-4 rounded-xl bg-surface-950 border border-zinc-800 space-y-2">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold flex items-center gap-1.5">
                            <FileSearch className="w-3.5 h-3.5 text-purple-400" />
                            AI Executive Summary
                          </span>
                          <p className="text-zinc-200 leading-relaxed">
                            {m.summary || 'Summary generated from meeting transcript.'}
                          </p>
                        </div>

                        {/* Raw User Minutes */}
                        <div className="p-4 rounded-xl bg-surface-950 border border-zinc-800 space-y-2">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold flex items-center gap-1.5">
                            <AlignLeft className="w-3.5 h-3.5 text-zinc-400" />
                            Raw Minutes Entered by {m.entered_by || 'User'}
                          </span>
                          <pre className="text-zinc-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-surface-900 p-2.5 rounded-lg border border-zinc-800/80">
                            {m.transcript_text || m.transcript || 'No raw transcript recorded.'}
                          </pre>
                        </div>
                      </div>

                      {/* Decisions, Blockers & Actions */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Decisions */}
                        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                          <span className="text-[10px] font-mono text-emerald-300 uppercase font-bold flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            Decisions ({m.decisions?.length || 0})
                          </span>
                          {m.decisions && m.decisions.length > 0 ? (
                            <div className="space-y-1.5">
                              {m.decisions.map((d: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="p-2 rounded bg-surface-950 border border-emerald-500/40 text-[11px] text-zinc-200"
                                >
                                  <p className="font-semibold">{d.decision_text || d.summary}</p>
                                  {d.speaker && (
                                    <p className="text-[10px] text-zinc-400 mt-0.5">By: {d.speaker}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-zinc-500 italic">No formal decisions logged</p>
                          )}
                        </div>

                        {/* Blockers */}
                        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
                          <span className="text-[10px] font-mono text-rose-300 uppercase font-bold flex items-center gap-1.5">
                            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                            Blockers ({m.blockers?.length || 0})
                          </span>
                          {m.blockers && m.blockers.length > 0 ? (
                            <div className="space-y-1.5">
                              {m.blockers.map((b: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="p-2 rounded bg-surface-950 border border-rose-500/40 text-[11px] text-zinc-200"
                                >
                                  <p className="font-semibold text-rose-200">
                                    {b.blocker_description || b.description}
                                  </p>
                                  <p className="text-[10px] text-rose-300 mt-0.5">
                                    <strong>Impact:</strong> {b.impact || 'Requires resolution'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-zinc-500 italic">No active blockers flagged</p>
                          )}
                        </div>

                        {/* Action items */}
                        <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2">
                          <span className="text-[10px] font-mono text-purple-300 uppercase font-bold flex items-center gap-1.5">
                            <Workflow className="w-3.5 h-3.5 text-purple-400" />
                            Action Items ({m.actions?.length || 0})
                          </span>
                          {m.actions && m.actions.length > 0 ? (
                            <div className="space-y-1.5">
                              {m.actions.map((a: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="p-2 rounded bg-surface-950 border border-purple-500/40 text-[11px] text-zinc-200"
                                >
                                  <p className="font-semibold text-purple-200">{a.description}</p>
                                  <p className="text-[10px] text-zinc-400 mt-0.5">
                                    Assignee: <strong className="text-zinc-300">{a.assignee || 'Developer'}</strong>
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-zinc-500 italic">No action items assigned</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
