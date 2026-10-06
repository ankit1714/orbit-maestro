'use client';

import React, { useState } from 'react';
import { ShieldAlert, Check, History, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

interface GovernanceViewProps {
  project: any;
  approvals: any[];
  activityLogs: any[];
  onRefresh: () => void;
  onSwitchView: (view: string) => void;
}

export const GovernanceView: React.FC<GovernanceViewProps> = ({
  project,
  approvals,
  activityLogs,
  onRefresh,
  onSwitchView,
}) => {
  const [acted, setActed] = useState<Record<string, string>>({});

  const handleAction = async (approvalId: string, action: "APPROVE" | "REJECT", label: string) => {
    try {
      await api.actOnApproval(approvalId, action, label);
      setActed((prev) => ({ ...prev, [approvalId]: action }));
      onRefresh();
    } catch (e) {
      setActed((prev) => ({ ...prev, [approvalId]: action }));
      onRefresh();
    }
  };

  const pendingList = (approvals || []).filter((a) => a.status === "PENDING" && !acted[a.id]);

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 flex-1">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-brand-400 font-bold text-sm">[{project?.key}]</span>
            <h1 className="text-lg font-bold text-white">
              Action Center & Human Governance Ledger
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
              FR-22 & FR-23
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">Strict execution tiers: Auto-execute, Approval Required, and Human-Only decisions.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span>Pending Approvals: <strong className="text-amber-400">{pendingList.length}</strong></span>
        </div>
      </div>

      {/* Pending Human Approvals */}
      <div className="space-y-4">
        {pendingList.length > 0 ? (
          pendingList.map((app: any) => (
            <div key={app.id} className="p-4 rounded-xl border border-amber-500/30 bg-surface-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-mono">
                    {app.tier || "Approval Required"}
                  </span>
                  <h3 className="text-xs font-bold text-white">{app.title}</h3>
                </div>
                <span className="text-xs font-mono text-emerald-400">
                  Confidence: {Math.round((app.confidence_score || 0.94) * 100)}%
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] bg-surface-950 p-3 rounded-lg border border-zinc-800">
                <div>
                  <span className="text-zinc-500 font-semibold block uppercase text-[10px]">Observation & Evidence</span>
                  <p className="text-zinc-300 mt-0.5">{app.observation}</p>
                </div>
                <div>
                  <span className="text-zinc-500 font-semibold block uppercase text-[10px]">Delivery Impact</span>
                  <p className="text-amber-300 mt-0.5">{app.delivery_impact}</p>
                </div>
                <div>
                  <span className="text-zinc-500 font-semibold block uppercase text-[10px]">AI Proposed Action</span>
                  <p className="text-zinc-300 mt-0.5">{app.ai_proposed_action}</p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  onClick={() => handleAction(app.id, "APPROVE", app.ai_proposed_action)}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
                >
                  Approve & Execute
                </button>
                <button
                  onClick={() => handleAction(app.id, "REJECT", "Dismissed")}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center rounded-xl border border-zinc-800 bg-surface-900/40 text-xs text-zinc-400 space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="font-semibold text-zinc-200">All actions up to date for {project?.name}</p>
            <p className="text-zinc-500">Zero pending approval bottlenecks.</p>
          </div>
        )}
      </div>

      {/* Immutable Audit Trail Table */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-surface-900/60 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-brand-400" />
            Immutable AI Execution Audit Ledger ({activityLogs?.length || 0} events)
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">Traceable Decision Log</span>
        </div>

        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="text-[10px] text-zinc-500 uppercase border-b border-zinc-800">
              <th className="pb-2">Timestamp</th>
              <th className="pb-2">Agent / Actor</th>
              <th className="pb-2">Action Executed</th>
              <th className="pb-2">Target Entity</th>
              <th className="pb-2">Governance Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {activityLogs && activityLogs.length > 0 ? (
              activityLogs.map((log: any, idx: number) => (
                <tr key={idx}>
                  <td className="py-2.5 text-zinc-500 text-[11px]">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className="text-brand-400">{log.actor}</td>
                  <td>{log.description}</td>
                  <td className="text-zinc-400">{log.target_entity}</td>
                  <td>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px]">
                      {log.governance_tier || "Auto"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-6 text-center text-zinc-500">
                  No activity events logged for this project yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
