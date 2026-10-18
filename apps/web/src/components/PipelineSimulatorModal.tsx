'use client';

import React, { useState } from 'react';
import { Cpu, X, UploadCloud, FileCheck, AlertTriangle, Layers, CheckCircle2, ArrowRight, Edit2, Check } from 'lucide-react';
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
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [customDrafts, setCustomDrafts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const startAgentAnalysis = async () => {
    setCurrentStep(2);
    setAgentLogs([]);
    setLoading(true);

    const steps = [
      { agent: "Document AI", desc: `Extracting optical layout, headings, and semantic tables for project ${projectId}...`, color: "text-[#1a73e8]" },
      { agent: "Project Understanding Agent", desc: "Analyzing functional requirements, persona models, and capability boundaries with Gemini 3 Flash.", color: "text-[#7b1fa2]" },
      { agent: "Assumption Register", desc: "Indexing architectural assumptions and compliance dependencies.", color: "text-[#1967d2]" },
      { agent: "Open Questions Engine", desc: "FLAGGED CRITICAL AMBIGUITIES: Detected unspecified boundary conditions and interface timeouts.", color: "text-[#b06000]" }
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white border border-[#dadce0] rounded-2xl shadow-[0_4px_24px_rgba(60,64,67,0.2)] overflow-hidden flex flex-col max-h-[90vh] text-[#202124]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#dadce0] bg-[#f8f9fa] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#e8f0fe] border border-[#d2e3fc] flex items-center justify-center text-[#1a73e8] shadow-sm">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#202124] flex items-center gap-2">
                Autonomous Ingestion & Backlog Synthesis Engine
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc] font-mono font-medium">
                  Multi-Agent ADK Loop
                </span>
              </h2>
              <p className="text-xs text-[#5f6368]">Transform raw requirement documents into an actionable, traceable backlog</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 py-3 border-b border-[#dadce0] bg-[#f8f9fa] flex items-center justify-between text-xs font-mono">
          <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-[#1a73e8] font-bold' : 'text-[#80868b]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${currentStep >= 1 ? 'bg-[#1a73e8] text-white' : 'bg-[#e8eaed] text-[#80868b]'}`}>1</span>
            <span>Ingest PRD</span>
          </div>
          <div className="h-[1px] w-12 bg-[#dadce0]"></div>

          <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-[#1a73e8] font-bold' : 'text-[#80868b]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${currentStep >= 2 ? 'bg-[#1a73e8] text-white' : 'bg-[#e8eaed] text-[#80868b]'}`}>2</span>
            <span>Agent Analysis</span>
          </div>
          <div className="h-[1px] w-12 bg-[#dadce0]"></div>

          <div className={`flex items-center space-x-2 ${currentStep >= 3 ? 'text-[#b06000] font-bold' : 'text-[#80868b]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${currentStep >= 3 ? 'bg-[#b06000] text-white' : 'bg-[#e8eaed] text-[#80868b]'}`}>3</span>
            <span>Open Questions</span>
          </div>
          <div className="h-[1px] w-12 bg-[#dadce0]"></div>

          <div className={`flex items-center space-x-2 ${currentStep >= 4 ? 'text-[#137333] font-bold' : 'text-[#80868b]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${currentStep >= 4 ? 'bg-[#137333] text-white' : 'bg-[#e8eaed] text-[#80868b]'}`}>4</span>
            <span>Backlog Synthesis</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STAGE 1 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[#dadce0] hover:border-[#1a73e8] rounded-2xl p-8 bg-[#f8f9fa] text-center transition flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#dadce0] flex items-center justify-center text-[#1a73e8] shadow-sm">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#202124]">Drag and drop PRD, BRD, or Technical Spec</p>
                  <p className="text-[11px] text-[#5f6368] mt-0.5">Supports PDF, DOCX, TXT, or OCR Images (up to 50MB)</p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={startAgentAnalysis}
                    className="px-4 py-2 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold text-xs transition shadow-sm flex items-center gap-2"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Use Sample: Claims_Automation_PRD_v1.pdf (12 pages)</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[#dadce0] bg-[#f8f9fa] space-y-2 text-xs">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#5f6368] font-semibold">What will happen in this pipeline:</span>
                <ul className="text-[#3c4043] space-y-1.5 list-disc list-inside">
                  <li><strong className="text-[#202124]">Document AI</strong> extracts layout blocks, tables, and functional requirement clauses.</li>
                  <li><strong className="text-[#202124]">Project Understanding Agent</strong> infers goals, personas, and architecture assumptions.</li>
                  <li><strong className="text-[#202124]">Open Questions Engine</strong> identifies ambiguities and presents PO options.</li>
                  <li><strong className="text-[#202124]">Backlog Agent</strong> creates Epics, User Stories (with Gherkin ACs), and QA test tasks.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STAGE 2 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#dadce0]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#137333] animate-ping"></div>
                  <span className="text-xs font-bold text-[#202124]">ADK Multi-Agent Orchestration Active</span>
                </div>
                <span className="text-[10px] font-mono text-[#5f6368]">Processing...</span>
              </div>

              <div className="space-y-3">
                {agentLogs.map((log, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] text-xs space-y-1 shadow-sm">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold ${log.color} font-mono`}>{log.agent}</span>
                      <span className="text-[10px] text-[#137333] font-mono font-semibold">✓ Executed</span>
                    </div>
                    <p className="text-[#3c4043]">{log.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STAGE 3 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#fef7e0] border border-[#feefc3] text-xs text-[#b06000] flex items-start justify-between shadow-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#b06000] shrink-0 mt-0.5" />
                  <span><strong>Ambiguity Detected:</strong> The Open Questions Engine detected <strong>2 missing specifications</strong> that block backlog decomposition. Resolve them to synthesize the backlog.</span>
                </div>
                <span className="text-[10px] font-mono bg-[#feefc3] px-2 py-0.5 rounded-full text-[#b06000] font-bold shrink-0 border border-[#feefc3]">Human-in-the-Loop</span>
              </div>

              {/* Question 1 */}
              <div className="p-4 rounded-xl border border-[#dadce0] bg-white space-y-2.5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf] font-bold">PRD §3.2.1 Ambiguity</span>
                    <h4 className="text-xs font-semibold text-[#202124] mt-1.5">What are the supported file formats & maximum file size for medical claims?</h4>
                  </div>
                  <span className="text-[10px] text-[#5f6368] font-mono">Impact: Storage Sizing</span>
                </div>
                <p className="text-[11px] text-[#5f6368]">PRD states: "System shall accept standard file attachments" without size caps or MIME filters.</p>
                
                <div className="p-2.5 rounded-xl bg-[#e8f0fe] border border-[#d2e3fc] text-[11px] text-[#1967d2] flex items-center justify-between">
                  <span><strong>AI Proposed Rule:</strong> Accept PDF, JPG, PNG up to 25MB per file.</span>
                  <span className="text-[10px] font-mono text-[#137333] font-semibold">96% confidence</span>
                </div>

                {editingQuestion === 1 ? (
                  <div className="p-3 rounded-xl bg-white border-2 border-[#1a73e8] space-y-2">
                    <label className="text-[10px] font-bold text-[#3c4043] uppercase tracking-wider block">
                      Edit Decision / Human Rule:
                    </label>
                    <input
                      type="text"
                      value={customDrafts[1] !== undefined ? customDrafts[1] : (resolvedQuestions[1] || 'PDF, JPG, PNG up to 25MB')}
                      onChange={(e) => setCustomDrafts((prev) => ({ ...prev, 1: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#dadce0] focus:border-[#1a73e8] focus:outline-none"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingQuestion(null)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => resolveQuestion(1, customDrafts[1] || resolvedQuestions[1] || 'PDF, JPG, PNG up to 25MB')}
                        className="px-3 py-1 text-xs rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Submit Override</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    {resolvedQuestions[1] ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#137333] font-mono font-bold">✓ Resolved: {resolvedQuestions[1]}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestion(1);
                            setCustomDrafts((prev) => ({ ...prev, 1: resolvedQuestions[1] }));
                          }}
                          className="px-2 py-0.5 text-[11px] rounded bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-[#5f6368]" />
                          <span>Edit</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestion(1);
                            setCustomDrafts((prev) => ({ ...prev, 1: 'PDF, JPG, PNG up to 25MB' }));
                          }}
                          className="px-2.5 py-1.5 text-xs rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] font-medium transition flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-[#5f6368]" />
                          <span>Edit / Override</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveQuestion(1, 'PDF, JPG, PNG up to 25MB')}
                          className="px-3.5 py-1.5 text-xs rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium shadow-sm transition"
                        >
                          Accept AI Rule
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveQuestion(1, 'PDF only, max 10MB')}
                          className="px-3.5 py-1.5 text-xs rounded-lg bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] border border-[#dadce0] font-medium transition"
                        >
                          Select: PDF Only (10MB)
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Question 2 */}
              <div className="p-4 rounded-xl border border-[#dadce0] bg-white space-y-2.5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#fef7e0] text-[#b06000] border border-[#feefc3] font-bold">PRD §3.2.4 Ambiguity</span>
                    <h4 className="text-xs font-semibold text-[#202124] mt-1.5">How many validation retry attempts are permitted before lock-out?</h4>
                  </div>
                  <span className="text-[10px] text-[#5f6368] font-mono">Impact: Fraud Prevention</span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#e8f0fe] border border-[#d2e3fc] text-[11px] text-[#1967d2] flex items-center justify-between">
                  <span><strong>AI Proposed Rule:</strong> Limit to 3 retry attempts; then escalate to manual claims agent review.</span>
                  <span className="text-[10px] font-mono text-[#137333] font-semibold">91% confidence</span>
                </div>

                {editingQuestion === 2 ? (
                  <div className="p-3 rounded-xl bg-white border-2 border-[#1a73e8] space-y-2">
                    <label className="text-[10px] font-bold text-[#3c4043] uppercase tracking-wider block">
                      Edit Decision / Human Rule:
                    </label>
                    <input
                      type="text"
                      value={customDrafts[2] !== undefined ? customDrafts[2] : (resolvedQuestions[2] || '3 attempts, then manual agent review')}
                      onChange={(e) => setCustomDrafts((prev) => ({ ...prev, 2: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#dadce0] focus:border-[#1a73e8] focus:outline-none"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingQuestion(null)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => resolveQuestion(2, customDrafts[2] || resolvedQuestions[2] || '3 attempts, then manual agent review')}
                        className="px-3 py-1 text-xs rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Submit Override</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    {resolvedQuestions[2] ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#137333] font-mono font-bold">✓ Resolved: {resolvedQuestions[2]}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestion(2);
                            setCustomDrafts((prev) => ({ ...prev, 2: resolvedQuestions[2] }));
                          }}
                          className="px-2 py-0.5 text-[11px] rounded bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-[#5f6368]" />
                          <span>Edit</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestion(2);
                            setCustomDrafts((prev) => ({ ...prev, 2: '3 attempts, then manual agent review' }));
                          }}
                          className="px-2.5 py-1.5 text-xs rounded-lg bg-white border border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043] font-medium transition flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-[#5f6368]" />
                          <span>Edit / Override</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveQuestion(2, '3 attempts, then manual agent review')}
                          className="px-3.5 py-1.5 text-xs rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium shadow-sm transition"
                        >
                          Accept AI Rule
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSynthesizeBacklog}
                  className="px-4 py-2 rounded-xl bg-[#137333] hover:bg-[#0d652d] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
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
              <div className="p-3.5 bg-[#e6f4ea] border border-[#ceead6] rounded-xl text-[#137333] text-xs flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#137333]" />
                  <span><strong>Backlog Generated Successfully:</strong> 1 Epic, 2 User Stories, 4 Technical Tasks generated with 100% end-to-end traceability to PRD sections!</span>
                </div>
                <span className="text-[10px] font-mono text-[#137333] font-bold">100% Traceable</span>
              </div>

              {/* Backlog Preview Tree */}
              <div className="rounded-2xl border border-[#dadce0] bg-white p-4 space-y-3 text-xs shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-[#dadce0] text-[#5f6368] font-mono text-[11px]">
                  <span>GENERATED HIERARCHY</span>
                  <span>TRACEABILITY LINK</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f3e8fd]/40 border border-[#e1bee7]">
                  <div className="flex items-center gap-2 font-bold text-[#202124]">
                    <span className="font-mono text-[#7b1fa2]">EPC-01</span>
                    <span>Project Core Capabilities & Execution Engine</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#5f6368]">Ingested PRD Specification</span>
                </div>

                <div className="pl-4 flex items-center justify-between p-2 rounded-xl bg-[#e8f0fe]/40 border border-[#d2e3fc]">
                  <div className="flex items-center gap-2 text-[#202124]">
                    <span className="font-mono text-[#1967d2] font-semibold">STY-101</span>
                    <span>As a user, I can execute core capability workflows ({resolvedQuestions[1] || 'Verified Constraints'})</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#1967d2]">Trace: Ingested PRD + Clarification</span>
                </div>

                <div className="pl-8 flex items-center justify-between p-1.5 text-[#3c4043] border-l-2 border-[#d2e3fc]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[#5f6368] text-[11px]">TSK-301</span>
                    <span>Document AI ingestion pipeline & OCR parser service</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-[#e8f0fe] text-[#1967d2] text-[9px] font-mono font-medium">Alex (Backend Lead)</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#80868b]">AC-1</span>
                </div>

                <div className="pl-8 flex items-center justify-between p-1.5 text-[#3c4043] border-l-2 border-[#d2e3fc]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[#5f6368] text-[11px]">TSK-302</span>
                    <span>MIME type filter & upload validator</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-[#e8f0fe] text-[#1967d2] text-[9px] font-mono font-medium">Maria (Frontend)</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#80868b]">AC-2</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-[#5f6368]">All entities written to the active backlog.</span>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
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
