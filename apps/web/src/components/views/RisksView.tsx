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
      <div className="flex items-center justify-between pb-3 border-b border-[#dadce0]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-[#1a73e8] font-bold text-sm">[{project?.key}]</span>
            <h1 className="text-xl font-bold text-[#202124]">
              Dependency DAG & Critical Path Risk Radar
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf] font-medium font-mono">
              Risk Radar
            </span>
          </div>
          <p className="text-xs text-[#5f6368] mt-1">Directed Acyclic Graph identifying bottlenecks, unverified contracts, and path aging.</p>
        </div>
        {agingHours > 0 ? (
          <span className="text-xs font-mono text-[#c5221f] bg-[#fce8e6] px-3 py-1.5 rounded-lg border border-[#fad2cf] flex items-center gap-1.5 font-semibold">
            <Clock className="w-3.5 h-3.5" />
            Critical Path Aging: {agingHours} hours
          </span>
        ) : (
          <span className="text-xs font-mono text-[#137333] bg-[#e6f4ea] px-3 py-1.5 rounded-lg border border-[#ceead6] flex items-center gap-1.5 font-semibold">
            <CheckCircle className="w-3.5 h-3.5" />
            Path Flow: Normal
          </span>
        )}
      </div>

      {/* Visual Dependency Graph Canvas */}
      <div className="p-6 rounded-2xl border border-[#dadce0] bg-white relative min-h-[420px] flex items-center justify-center overflow-hidden shadow-sm">
        {nodes.length > 0 ? (
          <div className="w-full flex items-center justify-between px-8 z-10 max-w-5xl overflow-x-auto gap-4">
            {nodes.map((node: any, idx: number) => {
              const isBlocked = node.is_blocked;
              const isCritical = node.is_critical_path || criticalPathIds.includes(node.id);

              return (
                <React.Fragment key={node.id}>
                  <div
                    className={`p-4 rounded-xl border text-center space-y-2 shrink-0 w-44 transition ${
                      isBlocked
                        ? 'bg-white border-2 border-[#ea4335] shadow-md animate-pulse'
                        : isCritical
                        ? 'bg-white border-2 border-[#fbbc04] shadow-md'
                        : 'bg-white border border-[#dadce0] shadow-sm hover:shadow-md'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-mono uppercase font-bold flex items-center justify-center gap-1 ${
                        isBlocked ? 'text-[#c5221f]' : isCritical ? 'text-[#b06000]' : 'text-[#5f6368]'
                      }`}
                    >
                      {isBlocked ? <AlertTriangle className="w-3 h-3 text-[#c5221f]" /> : null}
                      {node.node_type || "TASK"}
                    </span>
                    <p className="text-xs font-bold text-[#202124] truncate" title={node.label}>
                      {node.label}
                    </p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                        isBlocked
                          ? 'bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf] font-bold'
                          : node.status === 'DONE' || node.status === 'COMPLETED'
                          ? 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]'
                          : 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]'
                      }`}
                    >
                      {node.status}
                    </span>
                  </div>

                  {idx < nodes.length - 1 && (
                    <ArrowRight
                      className={`w-5 h-5 shrink-0 ${isBlocked ? 'text-[#ea4335] animate-pulse' : 'text-[#dadce0]'}`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-[#5f6368] text-xs">
            No dependencies mapped yet. Decompose backlog to generate DAG graph.
          </div>
        )}

        {/* Subtle Graph Grid Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#dadce0_1px,transparent_1px)] [background-size:16px_16px] opacity-60"></div>
      </div>
    </div>
  );
};
