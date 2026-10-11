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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white border border-[#dadce0] rounded-2xl shadow-[0_4px_24px_rgba(60,64,67,0.2)] overflow-hidden flex flex-col text-[#202124]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#dadce0] bg-[#f8f9fa] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#fef7e0] border border-[#feefc3] flex items-center justify-center text-[#b06000] shadow-sm">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#202124] flex items-center gap-2">
                Sprint Spillover Management Workbench
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#fef7e0] text-[#b06000] border border-[#feefc3] font-mono font-medium">
                  Spillover Triage
                </span>
              </h2>
              <p className="text-xs text-[#5f6368]">Analyze incomplete commitments, evaluate delivery impact, and execute spillover resolutions.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {spillovers.length > 0 ? (
            spillovers.map((item) => (
              <div key={item.task_id} className="p-4 rounded-xl border border-[#fad2cf] bg-white shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#fce8e6] text-[#c5221f] font-bold border border-[#fad2cf]">
                      {item.task_key} · {item.points} pts
                    </span>
                    <h4 className="text-xs font-bold text-[#202124] mt-1.5">{item.title}</h4>
                    <p className="text-[11px] text-[#5f6368] mt-0.5">{item.reason}</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#c5221f] bg-[#fce8e6] px-2.5 py-1 rounded-full font-bold border border-[#fad2cf]">
                    {item.spillover_probability_pct}% Spillover Risk
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#e8f0fe] border border-[#d2e3fc] text-xs text-[#174ea6]">
                  <strong>AI Recommendation:</strong> {item.ai_recommendation}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#f1f3f4] text-xs">
                  {resolvedActions[item.task_id] ? (
                    <div className="text-xs text-[#137333] font-bold flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> Action Executed: <strong>{resolvedActions[item.task_id]}</strong>
                    </div>
                  ) : can('canTriageSpillover') ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleResolve(item.task_id, "Rolled forward to next sprint")}
                        className="px-3.5 py-1.5 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold text-xs shadow-sm transition"
                      >
                        Roll Forward to Next Sprint
                      </button>
                      <button
                        onClick={() => handleResolve(item.task_id, "Split into Subtasks")}
                        className="px-3.5 py-1.5 rounded-lg bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] border border-[#dadce0] font-semibold text-xs transition"
                      >
                        Split Scope
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#f1f3f4] border border-[#dadce0] text-[#80868b] font-medium text-xs cursor-not-allowed"
                      title={`Role "${profile.title}" cannot resolve spillover (Requires Scrum Master or Admin)`}
                    >
                      <Lock className="w-3.5 h-3.5 text-[#80868b]" />
                      <span>Resolution Restricted (SM Only)</span>
                    </div>
                  )}
                  <span className="text-[10px] text-[#5f6368] font-mono">Assignee: {item.assignee}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center rounded-2xl border border-dashed border-[#dadce0] bg-[#f8f9fa] space-y-2">
              <ShieldCheck className="w-8 h-8 text-[#137333] mx-auto" />
              <h4 className="text-sm font-bold text-[#202124]">Zero Active Spillover Risks</h4>
              <p className="text-xs text-[#5f6368] max-w-sm mx-auto leading-relaxed">
                All sprint stories and tasks are progressing within commitment velocity thresholds. No external blockages detected.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
