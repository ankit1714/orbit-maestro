'use client';

import React, { useEffect, useState } from 'react';
import { Search, LayoutDashboard, ShieldAlert, FileText, Compass, BookMarked, BarChart3 } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchView: (view: string) => void;
  approvalsCount: number;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSwitchView,
  approvalsCount,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const navigate = (view: string) => {
    onSwitchView(view);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-24">
      <div className="w-full max-w-xl bg-surface-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden">
        <div className="p-3 border-b border-zinc-800 flex items-center space-x-2">
          <Search className="w-4 h-4 text-zinc-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a view name or command..."
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none font-sans"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-800 text-zinc-400 rounded font-mono">ESC</kbd>
        </div>

        <div className="p-2 text-xs space-y-1">
          <div className="px-2 py-1 text-[10px] text-zinc-500 font-mono uppercase">Quick Navigation</div>
          <button
            onClick={() => navigate('dashboard')}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-zinc-800 flex items-center justify-between text-zinc-200"
          >
            <span className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-brand-400" /> Go to Delivery Cockpit
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Jump</span>
          </button>
          <button
            onClick={() => navigate('governance')}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-zinc-800 flex items-center justify-between text-zinc-200"
          >
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Review Approvals ({approvalsCount})
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Review</span>
          </button>
          <button
            onClick={() => navigate('documents')}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-zinc-800 flex items-center justify-between text-zinc-200"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" /> Open Questions & PRD Studio
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Docs</span>
          </button>
          <button
            onClick={() => navigate('knowledge')}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-zinc-800 flex items-center justify-between text-zinc-200"
          >
            <span className="flex items-center gap-2">
              <BookMarked className="w-4 h-4 text-teal-400" /> Google NotebookLM Knowledge Hub
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Q&A</span>
          </button>
        </div>
      </div>
    </div>
  );
};
