'use client';

import React from 'react';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Layers } from 'lucide-react';
import type { DashboardStats as StatsType } from '../types';

interface DashboardStatsProps {
  stats: StatsType | null;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const cards = [
    {
      label: 'Total Tasks',
      value: stats?.totalTasks ?? '--',
      icon: Layers,
      color: 'text-slate-300',
      bg: 'bg-slate-800/40',
      border: 'border-slate-700/60'
    },
    {
      label: 'Verified Success',
      value: stats?.verified ?? '--',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/20',
      border: 'border-emerald-800/40'
    },
    {
      label: 'Failed / Halted',
      value: stats?.failed ?? '--',
      icon: XCircle,
      color: 'text-rose-400',
      bg: 'bg-rose-950/20',
      border: 'border-rose-800/40'
    },
    {
      label: 'Pending Approvals',
      value: stats?.pendingApproval ?? '--',
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-950/20',
      border: 'border-amber-800/40'
    },
    {
      label: 'Awaiting Clarification',
      value: stats?.pendingClarification ?? '--',
      icon: Clock,
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/20',
      border: 'border-cyan-800/40'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-3.5 rounded-lg border ${card.border} ${card.bg} flex items-center justify-between shadow-sm`}
          >
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{card.label}</p>
              <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
            </div>
            <Icon className={`h-6 w-6 ${card.color} opacity-80`} />
          </div>
        );
      })}
    </div>
  );
}
