'use client';

import React from 'react';
import { Bot, ShieldCheck, Terminal, ExternalLink } from 'lucide-react';

interface NavbarProps {
  onOpenPortal: () => void;
}

export function Navbar({ onOpenPortal }: NavbarProps) {
  return (
    <header className="border-b border-border bg-surface/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-accent-blue flex items-center justify-center shadow-lg shadow-primary/20">
            <Bot className="h-6 w-6 text-background" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-slate-100 tracking-tight">TaskPilot AI</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                CentrAlign Intern Submission
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous Enterprise Task Execution Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-surfaceMuted/60 border border-border text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Engine: Autonomous Plan-Act-Observe</span>
          </div>

          <button
            onClick={onOpenPortal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surfaceMuted hover:bg-slate-700 border border-border text-xs text-slate-200 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 text-primary" />
            <span>Simulated Portal</span>
          </button>
        </div>
      </div>
    </header>
  );
}
