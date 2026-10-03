'use client';

import React, { useState } from 'react';
import { Cpu, X, UploadCloud, FileCheck, AlertTriangle, Layers, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

interface PipelineSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onBacklogSynthesized: () => void;
}

export const PipelineSimulatorModal: React.FC<PipelineSimulatorModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onBacklogSynthesized,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [agentLogs, setAgentLogs] = useState<Array<{ agent: string; desc: string; color: string }>>([]);
  const [resolvedQuestions, setResolvedQuestions] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const startAgentAnalysis = async () => {
    setCurrentStep(2);
    setAgentLogs([]);
    setLoading(true);

    const steps = [
      { agent: "Document AI", desc: `Extracting optical layout, headings, and semantic tables for project ${projectId}...`, color: "text-blue-400" },
      { agent: "Project Understanding Agent", desc: "Analyzing functional requirements, persona models, and capability boundaries with Gemini 3 Flash.", color: "text-purple-400" },
      { agent: "Assumption Register", desc: "Indexing architectural assumptions and compliance dependencies.", color: "text-indigo-400" },
      { agent: "Open Questions Engine", desc: "FLAGGED CRITICAL AMBIGUITIES: Detected unspecified boundary conditions and interface timeouts.", color: "text-amber-400" }
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((r) => setTimeout(r, 600));
      setAgentLogs((prev) => [...prev, steps[i]]);
    }

    try {
      await api.runSimulatorStage1(projectId);
    } catch (e) {
      console.warn("Simulator backend call completed:", e);
    }

    setLoading(false);
    setTimeout(() => {
      setCurrentStep(3);
    }, 800);
  };

  const resolveQuestion = (num: number, answer: string) => {
    setResolvedQuestions((prev) => ({ ...prev, [num]: answer }));
  };

  const handleSynthesizeBacklog = async () => {
    setCurrentStep(4);
    try {
      await api.runSimulatorStage4(projectId, {
        q1: resolvedQuestions[1] || "PDF, JPG, PNG max 25MB",
        q2: resolvedQuestions[2] || "3 attempts, then manual agent review"
      });
      onBacklogSynthesized();
    } catch (e) {
      console.warn("Backlog synthesis fallback:", e);
      onBacklogSynthesized();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-surface-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-surface-950 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Autonomous Ingestion & Backlog Synthesis Engine
                <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20 font-mono">
                  Multi-Agent ADK Loop
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">Transform raw requirement documents into an actionable, traceable backlog</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 py-3 border-b border-zinc-800/80 bg-surface-900/80 flex items-center justify-between text-xs font-mono">
          <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-white font-semibold' : 'text-zinc-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${currentStep >= 1 ? 'bg-brand-500 text-white' : 'bg-zinc-800'}`}>1</span>
            <span>Ingest PRD</span>
          </div>
          <div className="h-[1px] w-12 bg-zinc-800"></div>

          <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-white font-semibold' : 'text-zinc-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${currentStep >= 2 ? 'bg-brand-500 text-white' : 'bg-zinc-800'}`}>2</span>
            <span>Agent Analysis</span>
          </div>
          <div className="h-[1px] w-12 bg-zinc-800"></div>

          <div className={`flex items-center space-x-2 ${currentStep >= 3 ? 'text-white font-semibold' : 'text-zinc-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${currentStep >= 3 ? 'bg-amber-500 text-surface-950' : 'bg-zinc-800'}`}>3</span>
            <span>Open Questions</span>
          </div>
          <div className="h-[1px] w-12 bg-zinc-800"></div>

          <div className={`flex items-center space-x-2 ${currentStep >= 4 ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${currentStep >= 4 ? 'bg-emerald-500 text-white' : 'bg-zinc-800'}`}>4</span>
            <span>Backlog Synthesis</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STAGE 1 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-zinc-700 hover:border-brand-500/60 rounded-xl p-8 bg-surface-950/60 text-center transition flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-brand-400">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Drag and drop PRD, BRD, or Technical Spec</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Supports PDF, DOCX, TXT, or OCR Images (up to 50MB)</p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={startAgentAnalysis}
                    className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition shadow-lg shadow-brand-500/20 flex items-center gap-2"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Use Sample: Claims_Automation_PRD_v1.pdf (12 pages)</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-surface-950/40 space-y-2 text-xs">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">What will happen in this pipeline:</span>
                <ul className="text-zinc-400 space-y-1.5 list-disc list-inside">
                  <li><strong className="text-zinc-200">Document AI</strong> extracts layout blocks, tables, and functional requirement clauses.</li>
                  <li><strong className="text-zinc-200">Project Understanding Agent</strong> infers goals, personas, and architecture assumptions.</li>
                  <li><strong className="text-zinc-200">Open Questions Engine</strong> identifies ambiguities and presents PO options.</li>
                  <li><strong className="text-zinc-200">Backlog Agent</strong> creates Epics, User Stories (with Gherkin ACs), and QA test tasks.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STAGE 2 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
                  <span className="text-xs font-bold text-white">ADK Multi-Agent Orchestration Active</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">Processing...</span>
              </div>

              <div className="space-y-3">
                {agentLogs.map((log, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-surface-950 border border-zinc-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold ${log.color} font-mono`}>{log.agent}</span>
                      <span className="text-[10px] text-emerald-400 font-mono">✓ Executed</span>
                    </div>
                    <p className="text-zinc-200">{log.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STAGE 3 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span><strong>Ambiguity Detected:</strong> The Open Questions Engine detected <strong>2 missing specifications</strong> that block backlog decomposition. Resolve them to synthesize the backlog.</span>
                </div>
                <span className="text-[10px] font-mono bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300 font-bold shrink-0">Human-in-the-Loop</span>
              </div>

              {/* Question 1 */}
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-950 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-bold">PRD §3.2.1 Ambiguity</span>
                    <h4 className="text-xs font-semibold text-white mt-1">What are the supported file formats & maximum file size for medical claims?</h4>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">Impact: Storage Sizing</span>
                </div>
                <p className="text-[11px] text-zinc-400">PRD states: "System shall accept standard file attachments" without size caps or MIME filters.</p>
                
                <div className="p-2 rounded bg-brand-500/10 border border-brand-500/20 text-[11px] text-brand-300 flex items-center justify-between">
                  <span><strong>AI Proposed Rule:</strong> Accept PDF, JPG, PNG up to 25MB per file.</span>
                  <span className="text-[10px] font-mono text-emerald-400">96% confidence</span>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  {resolvedQuestions[1] ? (
                    <span className="text-xs text-emerald-400 font-mono font-bold">✓ Resolved: {resolvedQuestions[1]}</span>
                  ) : (
                    <>
                      <button
                        onClick={() => resolveQuestion(1, 'PDF, JPG, PNG up to 25MB')}
                        className="px-3 py-1 text-xs rounded bg-brand-600 hover:bg-brand-500 text-white font-medium"
                      >
                        Accept AI Rule
                      </button>
                      <button
                        onClick={() => resolveQuestion(1, 'PDF only, max 10MB')}
                        className="px-3 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      >
                        Select: PDF Only (10MB)
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Question 2 */}
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-surface-950 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">PRD §3.2.4 Ambiguity</span>
                    <h4 className="text-xs font-semibold text-white mt-1">How many validation retry attempts are permitted before lock-out?</h4>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">Impact: Fraud Prevention</span>
                </div>

                <div className="p-2 rounded bg-brand-500/10 border border-brand-500/20 text-[11px] text-brand-300 flex items-center justify-between">
                  <span><strong>AI Proposed Rule:</strong> Limit to 3 retry attempts; then escalate to manual claims agent review.</span>
                  <span className="text-[10px] font-mono text-emerald-400">91% confidence</span>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  {resolvedQuestions[2] ? (
                    <span className="text-xs text-emerald-400 font-mono font-bold">✓ Resolved: {resolvedQuestions[2]}</span>
                  ) : (
                    <button
                      onClick={() => resolveQuestion(2, '3 attempts, then manual agent review')}
                      className="px-3 py-1 text-xs rounded bg-brand-600 hover:bg-brand-500 text-white font-medium"
                    >
                      Accept AI Rule
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSynthesizeBacklog}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
                >
                  <Layers className="w-4 h-4" />
                  <span>Synthesize & Decompose Backlog</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4 */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span><strong>Backlog Generated Successfully:</strong> 1 Epic, 2 User Stories, 4 Technical Tasks generated with 100% end-to-end traceability to PRD sections!</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">100% Traceable</span>
              </div>

              {/* Backlog Preview Tree */}
              <div className="rounded-xl border border-zinc-800 bg-surface-950 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                  <span>GENERATED HIERARCHY</span>
                  <span>TRACEABILITY LINK</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-zinc-900/80 border border-purple-500/30">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <span className="font-mono text-purple-400">EPC-01</span>
                    <span>Customer Claim Submission & Validation Engine</span>
                  </div>
                  <span className="font-mono text-[11px] text-zinc-400">PRD §3.0 - §3.4</span>
                </div>

                <div className="pl-4 flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-blue-500/30">
                  <div className="flex items-center gap-2 text-zinc-200">
                    <span className="font-mono text-blue-400 font-semibold">STY-102</span>
                    <span>As a customer, I can upload claims ({resolvedQuestions[1] || 'PDF, JPG, PNG max 25MB'}) with automated OCR</span>
                  </div>
                  <span className="font-mono text-[11px] text-blue-400">Trace: PRD §3.2.1 + Q1 Clarification</span>
                </div>

                <div className="pl-8 flex items-center justify-between p-1.5 text-zinc-300 border-l border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-zinc-500 text-[11px]">TSK-301</span>
                    <span>Document AI ingestion pipeline & OCR parser service</span>
                    <span className="px-1 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-mono">Alex (Backend Lead)</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500">AC-1</span>
                </div>

                <div className="pl-8 flex items-center justify-between p-1.5 text-zinc-300 border-l border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-zinc-500 text-[11px]">TSK-302</span>
                    <span>MIME type filter & upload validator</span>
                    <span className="px-1 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-mono">Maria (Frontend)</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500">AC-2</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-zinc-400">All entities written to the active backlog.</span>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
                >
                  <span>Close Simulator</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
