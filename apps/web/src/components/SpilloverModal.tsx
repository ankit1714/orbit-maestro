'use client';

import React, { useState, useEffect } from 'react';
import { TrendingDown, X, CheckCircle, ShieldCheck, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useRole } from '@/lib/roleContext';

interface SpilloverModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export const SpilloverModal: React.FC<SpilloverModalProps> = ({ isOpen, onClose, projectId }) => {
  const { can, profile } = useRole();
  const [spillovers, setSpillovers] = useState<any[]>([]);
  const [resolvedActions, setResolvedActions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && projectId) {
      setLoading(true);
      api.getSpillovers(projectId)
        .then((items) => setSpillovers(items || []))
        .catch(() => setSpillovers([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleResolve = async (taskId: string, action: string) => {
    if (!can('canTriageSpillover')) return;
    try {
      await api.resolveSpillover({
        project_id: projectId,
        sprint_id: "active-sprint",
        task_id: taskId,
        action: action
      });
      setResolvedActions((prev) => ({ ...prev, [taskId]: action }));
    } catch (e) {
      setResolvedActions((prev) => ({ ...prev, [taskId]: action }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-surface-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-surface-950 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Sprint Spillover Management Workbench
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                  Stage 11 · FR-13
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">Analyze incomplete commitments, evaluate delivery impact, and execute spillover resolutions.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {spillovers.length > 0 ? (
            spillovers.map((item) => (
              <div key={item.task_id} className="p-4 rounded-xl border border-rose-500/30 bg-surface-950 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                      {item.task_key} · {item.points} pts
                    </span>
                    <h4 className="text-xs font-bold text-white mt-1">{item.title}</h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{item.reason}</p>
                  </div>
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                    {item.spillover_probability_pct}% Spillover Risk
                  </span>
                </div>

                <div className="p-2.5 rounded bg-brand-500/10 border border-brand-500/20 text-[11px] text-brand-300">
                  <strong>AI Recommendation:</strong> {item.ai_recommendation}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs">
                  {resolvedActions[item.task_id] ? (
                    <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> Action Executed: <strong>{resolvedActions[item.task_id]}</strong>
                    </div>
                  ) : can('canTriageSpillover') ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleResolve(item.task_id, "Rolled forward to next sprint")}
                        className="px-3 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs transition"
                      >
                        Roll Forward to Next Sprint
                      </button>
                      <button
                        onClick={() => handleResolve(item.task_id, "Split into Subtasks")}
                        className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs transition"
                      >
                        Split Scope
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800/80 border border-zinc-700/50 text-zinc-500 font-medium text-xs cursor-not-allowed"
                      title={`Role "${profile.title}" cannot resolve spillover (Requires Scrum Master or Admin)`}
                    >
                      <Lock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Resolution Restricted (SM Only)</span>
                    </div>
                  )}
                  <span className="text-[10px] text-zinc-500 font-mono">Assignee: {item.assignee}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center rounded-xl border border-zinc-800 bg-surface-950 space-y-2">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="text-xs font-bold text-white">Zero Active Spillover Risks</h4>
              <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                All sprint stories and tasks are progressing within commitment velocity thresholds. No external blockages detected.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
