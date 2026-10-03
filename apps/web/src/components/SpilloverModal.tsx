'use client';

import React, { useState } from 'react';
import { TrendingDown, X, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface SpilloverModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export const SpilloverModal: React.FC<SpilloverModalProps> = ({ isOpen, onClose, projectId }) => {
  const [resolvedActions, setResolvedActions] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleResolve = async (taskId: string, action: string) => {
    try {
      await api.resolveSpillover({
        project_id: projectId,
        sprint_id: "sprint-3",
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
          {/* Item 1 */}
          <div className="p-4 rounded-xl border border-rose-500/30 bg-surface-950 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">PAY-142 · 3 pts</span>
                <h4 className="text-xs font-bold text-white mt-1">Payment Gateway Vendor Webhook Connector</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">Blocked by missing external vendor schema contract (3 days idle).</p>
              </div>
              <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">High Blocker Impact</span>
            </div>

            <div className="p-2.5 rounded bg-brand-500/10 border border-brand-500/20 text-[11px] text-brand-300">
              <strong>AI Recommendation:</strong> Move PAY-142 into Sprint 4 backlog. External vendor dependencies should not artificially distort team velocity metrics.
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              {resolvedActions["PAY-142"] ? (
                <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Action Executed: <strong>{resolvedActions["PAY-142"]}</strong>
                </span>
              ) : (
                <>
                  <button
                    onClick={() => handleResolve("PAY-142", "Rolled forward to Sprint 4")}
                    className="px-3 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition"
                  >
                    Roll Forward to Sprint 4
                  </button>
                  <button
                    onClick={() => handleResolve("PAY-142", "Split into Subtasks")}
                    className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
                  >
                    Split Story
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Item 2 */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-surface-950 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold">QA-401 · 1.5 pts</span>
                <h4 className="text-xs font-bold text-white mt-1">Boundary Test Suites for Payment Validation</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">Dependent on PAY-142 completion.</p>
              </div>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Dependent Work</span>
            </div>

            <div className="p-2.5 rounded bg-brand-500/10 border border-brand-500/20 text-[11px] text-brand-300">
              <strong>AI Recommendation:</strong> De-scope from Sprint 3 and link to Sprint 4 test plan.
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              {resolvedActions["QA-401"] ? (
                <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Action Executed: <strong>{resolvedActions["QA-401"]}</strong>
                </span>
              ) : (
                <button
                  onClick={() => handleResolve("QA-401", "De-scoped to Sprint 4")}
                  className="px-3 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition"
                >
                  De-scope to Sprint 4
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-surface-950 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold">
            Close Workbench
          </button>
        </div>
      </div>
    </div>
  );
};
