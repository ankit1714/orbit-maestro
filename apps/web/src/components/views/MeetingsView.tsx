'use client';

import React, { useState } from 'react';
import { AlignLeft, Sparkles, Workflow, FileSearch, CheckCircle, AlertOctagon } from 'lucide-react';
import { api } from '@/lib/api';

interface MeetingsViewProps {
  project: any;
  onSwitchView: (view: string) => void;
  onRefresh?: () => void;
}

export const MeetingsView: React.FC<MeetingsViewProps> = ({ project, onSwitchView, onRefresh }) => {
  const [meetingType, setMeetingType] = useState<'STANDUP' | 'REVIEW' | 'RETROSPECTIVE'>('STANDUP');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fillSample = () => {
    if (meetingType === 'STANDUP') {
      setTranscript(`Engineer Alex: Finished core service API endpoints for ${project?.name || "the project"}. Today I am completing the database integration.
Engineer David: Working on external gateway, but waiting on partner API contract. Currently blocked.
Engineer Maria: Testing acceptance criteria.`);
    } else if (meetingType === 'REVIEW') {
      setTranscript(`Sprint Review Demo for ${project?.name || "Project"}:
- Demonstrated core system workflows with 98% accuracy.
- PO Feedback: Provide real-time audit event streaming.
- PO Decision: Create backlog item for enhanced telemetry.`);
    } else {
      setTranscript(`Retrospective Notes for ${project?.name || "Project"}:
What went well: Architecture baseline established cleanly.
What didn't go well: Cloud permission propagation took extra time.
Action: Automate IAM service account bindings before next sprint.`);
    }
  };

  const handleProcess = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    const pId = project?.id || "proj-claims-auto";
    try {
      const res = await api.processMeeting({
        project_id: pId,
        meeting_type: meetingType,
        transcript_text: transcript
      });
      setResult(res);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.warn("Meeting processing fallback:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-brand-400 font-bold text-sm">[{project?.key}]</span>
            <h1 className="text-lg font-bold text-white">
              Meeting Intelligence & Decision Extractor
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
              Stage 7, 8, 9 · Section 32
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time transcript processing for Daily Scrum, Sprint Review, and Retrospectives with autonomous state synchronization.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {(['STANDUP', 'REVIEW', 'RETROSPECTIVE'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setMeetingType(t); setResult(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                meetingType === t
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
              }`}
            >
              {t === 'STANDUP' ? 'Daily Scrum' : t === 'REVIEW' ? 'Sprint Review' : 'Retrospective'}
            </button>
          ))}
        </div>
      </div>

      {/* 2-Pane Meeting Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[500px]">
        {/* Left: Input Transcript */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-surface-900/60 flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <AlignLeft className="w-4 h-4 text-purple-400" />
              Meeting Notes / Transcript
            </span>
            <button
              onClick={fillSample}
              className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
            >
              <span>Load Template Notes</span>
            </button>
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={`Paste raw meeting notes, audio transcription, or standup updates for ${project?.name}...`}
            className="flex-1 w-full bg-surface-950 border border-zinc-800 rounded-lg p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono resize-none transition leading-relaxed min-h-[300px]"
          />

          <div className="flex justify-end pt-2">
            <button
              onClick={handleProcess}
              disabled={loading || !transcript.trim()}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-md transition ${
                loading || !transcript.trim()
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? "Extracting Decisions with Gemini..." : "Extract Decisions & Mutate State"}</span>
            </button>
          </div>
        </div>

        {/* Right: Extracted Intelligence */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-surface-900/60 flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Workflow className="w-4 h-4 text-emerald-400" />
              AI Extracted Intelligence & Action Registry
            </span>
            <span className="text-[10px] font-mono text-zinc-500">Autonomous Sync</span>
          </div>

          {result ? (
            <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
              {/* Summary */}
              <div className="p-3 rounded-lg bg-surface-950 border border-zinc-800/80 space-y-1">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Meeting Executive Summary</span>
                <p className="text-zinc-200">{result.summary}</p>
              </div>

              {/* Blockers Flagged */}
              {result.blockers && result.blockers.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-2">
                  <span className="text-[10px] font-mono text-rose-300 uppercase font-bold flex items-center gap-1">
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                    Detected Blockers ({result.blockers.length})
                  </span>
                  <div className="space-y-1.5">
                    {result.blockers.map((b: any, idx: number) => (
                      <div key={idx} className="p-2 rounded bg-surface-950 border border-rose-500/40 text-[11px] text-zinc-200">
                        <p><strong>{b.description}</strong></p>
                        <p className="text-[10px] text-rose-300 mt-0.5">Impact: {b.impact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions Extracted */}
              {result.decisions && result.decisions.length > 0 && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <span className="text-[10px] font-mono text-emerald-300 uppercase font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    Logged Decisions ({result.decisions.length})
                  </span>
                  <div className="space-y-1.5">
                    {result.decisions.map((d: any, idx: number) => (
                      <div key={idx} className="p-2 rounded bg-surface-950 border border-emerald-500/40 text-[11px] text-zinc-200">
                        <p><strong>{d.summary}</strong></p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">Context: {d.context} (By: {d.decided_by})</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions & State Mutations */}
              {result.actions && result.actions.length > 0 && (
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 space-y-2">
                  <span className="text-[10px] font-mono text-purple-300 uppercase font-bold flex items-center gap-1">
                    <Workflow className="w-3.5 h-3.5 text-purple-400" />
                    State Mutations Executed ({result.actions.length})
                  </span>
                  <div className="space-y-1.5">
                    {result.actions.map((a: any, idx: number) => (
                      <div key={idx} className="p-2 rounded bg-surface-950 border border-purple-500/40 text-[11px] text-zinc-200">
                        <p><strong>{a.action_type}:</strong> {a.description}</p>
                        <p className="text-[10px] text-purple-300 mt-0.5">Assignee: {a.assignee} · Priority: {a.priority}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 text-xs space-y-2">
              <FileSearch className="w-8 h-8 text-zinc-600" />
              <p>No meeting transcript parsed yet.</p>
              <p className="text-[11px] text-zinc-600 max-w-xs">
                Paste daily standup updates or demo notes on the left, then click "Extract Decisions" to automatically update blockers and the Sprint Board.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
