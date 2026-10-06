'use client';

import React from 'react';
import { ArrowRight, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface RisksViewProps {
  project: any;
  dag: any;
  healthMatrix: any;
  onSwitchView: (view: string) => void;
}

export const RisksView: React.FC<RisksViewProps> = ({
  project,
  dag,
  healthMatrix,
  onSwitchView,
}) => {
  const nodes = dag?.nodes || [];
  const criticalPathIds = dag?.critical_path_node_ids || [];
  const agingHours = dag?.critical_path_aging_hours || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-4 flex-1">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-brand-400 font-bold text-sm">[{project?.key}]</span>
            <h1 className="text-lg font-bold text-white">
              Dependency DAG & Critical Path Risk Radar
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono">
              FR-14 & FR-15
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">Directed Acyclic Graph identifying bottlenecks, unverified contracts, and path aging.</p>
        </div>
        {agingHours > 0 ? (
          <span className="text-xs font-mono text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Critical Path Aging: {agingHours} hours
          </span>
        ) : (
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            Path Flow: Normal
          </span>
        )}
      </div>

      {/* Visual Dependency Graph Canvas */}
      <div className="p-6 rounded-xl border border-zinc-800 bg-surface-900/70 relative min-h-[420px] flex items-center justify-center overflow-hidden">
        {nodes.length > 0 ? (
          <div className="w-full flex items-center justify-between px-8 z-10 max-w-5xl overflow-x-auto gap-4">
            {nodes.map((node: any, idx: number) => {
              const isBlocked = node.is_blocked;
              const isCritical = node.is_critical_path || criticalPathIds.includes(node.id);

              return (
                <React.Fragment key={node.id}>
                  <div
                    className={`p-3.5 rounded-xl border text-center space-y-1.5 shrink-0 w-44 transition ${
                      isBlocked
                        ? 'bg-surface-950 border-rose-500 shadow-xl shadow-rose-950/40 animate-pulse'
                        : isCritical
                        ? 'bg-surface-950 border-amber-500/50 shadow-md'
                        : 'bg-surface-950 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-mono uppercase font-bold flex items-center justify-center gap-1 ${
                        isBlocked ? 'text-rose-400' : isCritical ? 'text-amber-400' : 'text-zinc-500'
                      }`}
                    >
                      {isBlocked ? <AlertTriangle className="w-3 h-3" /> : null}
                      {node.node_type || "TASK"}
                    </span>
                    <p className="text-xs font-bold text-white truncate" title={node.label}>
                      {node.label}
                    </p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        isBlocked
                          ? 'bg-rose-500/20 text-rose-300 font-bold'
                          : node.status === 'DONE' || node.status === 'COMPLETED'
                          ? 'text-emerald-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {node.status}
                    </span>
                  </div>

                  {idx < nodes.length - 1 && (
                    <ArrowRight
                      className={`w-5 h-5 shrink-0 ${isBlocked ? 'text-rose-500 animate-pulse' : 'text-zinc-600'}`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-zinc-500 text-xs">
            No dependencies mapped yet. Decompose backlog to generate DAG graph.
          </div>
        )}

        {/* Subtle Graph Grid Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
      </div>
    </div>
  );
};
