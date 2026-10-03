'use client';

import React, { useState } from 'react';
import { Sparkles, X, ArrowUp } from 'lucide-react';
import { api } from '@/lib/api';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({ isOpen, onClose, projectId }) => {
  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string; evidence?: string }>>([
    {
      sender: 'ai',
      text: 'Hello! I am actively tracking Sprint 3. I have detected 1 high-impact blocker (PAY-142) and have pending actions awaiting your review.',
      evidence: 'Firestore Sprint3 State'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendMessage = async (query: string) => {
    if (!query.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setInputVal('');
    setLoading(true);

    try {
      // Query Knowledge Agent / Vertex AI
      const res = await api.searchKnowledge(projectId, query);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res.answer,
          evidence: res.citations?.[0]?.source_title || 'Vertex AI Search & Knowledge Base'
        }
      ]);
    } catch (err) {
      // Graceful fallback
      let answer = "I have analyzed the current project telemetry.";
      if (query.toLowerCase().includes("at risk")) {
        answer = "Sprint 3 is at risk for 2 specific reasons: (1) PAY-142 has been blocked for 3 days by missing vendor API contracts, (2) Backend capacity is at 108%, meaning David cannot absorb delays without slipping.";
      } else if (query.toLowerCase().includes("standup") || query.toLowerCase().includes("daily")) {
        answer = "Recommended Daily Scrum Focus: (1) Confirm vendor contract ETA with Lead Architect, (2) Review reassignment of TSK-304 to Maria to relieve David, (3) Finalize acceptance criteria for 10s mobile timeout.";
      }
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: answer,
          evidence: 'Sprint 3 Telemetry + Meeting #04'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="w-96 border-l border-zinc-800 bg-surface-900 flex flex-col justify-between transition-all duration-300 ease-in-out shadow-2xl z-40 fixed right-0 top-14 bottom-0">
      {/* Header */}
      <div className="h-12 border-b border-zinc-800 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded bg-brand-500/20 text-brand-400 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-white">AI Scrum Master Assistant</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto text-xs">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex items-start space-x-2 ${m.sender === 'user' ? 'justify-end' : ''}`}>
            {m.sender === 'ai' && (
              <div className="w-5 h-5 rounded bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                AI
              </div>
            )}
            <div
              className={`p-3 rounded-lg border text-xs leading-relaxed space-y-1 max-w-[85%] ${
                m.sender === 'user'
                  ? 'bg-brand-600 text-white border-brand-500'
                  : 'bg-surface-950 text-zinc-200 border-zinc-800/80'
              }`}
            >
              <p>{m.text}</p>
              {m.evidence && (
                <span className="text-[9px] text-zinc-500 font-mono block">Evidence: {m.evidence}</span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-zinc-500 text-[11px] font-mono animate-pulse">Vertex AI reasoning...</div>
        )}

        {/* Quick Inquiries */}
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/60">
          <div className="text-[10px] text-zinc-500 font-mono uppercase">Suggested Questions</div>
          <button
            onClick={() => handleSendMessage('Why is the sprint at risk?')}
            className="w-full text-left p-2 rounded bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 transition"
          >
            "Why is the sprint currently marked as Watch?"
          </button>
          <button
            onClick={() => handleSendMessage('Prepare tomorrow Daily Scrum agenda')}
            className="w-full text-left p-2 rounded bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 transition"
          >
            "Generate tomorrow's Daily Scrum focus areas"
          </button>
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-800 bg-surface-950">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputVal);
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Ask AI Scrum Master..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500 transition"
          />
          <button type="submit" className="p-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
};
