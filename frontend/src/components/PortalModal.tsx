'use client';

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, RefreshCw, Building, FileSpreadsheet } from 'lucide-react';
import { fetchPortalInvoices, fetchPortalRecords } from '../lib/api';

interface PortalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PortalModal({ isOpen, onClose }: PortalModalProps) {
  const [activeTab, setActiveTab] = useState<'invoices' | 'records'>('invoices');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invs, recs] = await Promise.all([
        fetchPortalInvoices(),
        fetchPortalRecords()
      ]);
      setInvoices(invs);
      setRecords(recs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-surfaceMuted/50">
          <div className="flex items-center gap-3">
            <Building className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Simulated Enterprise Company Portal</h3>
              <p className="text-xs text-slate-400">Target environment for TaskPilot AI autonomous agent</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-surface border border-border text-slate-300"
              title="Refresh Portal State"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <a
              href="http://localhost:4001"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-surface border border-border text-xs text-primary hover:text-cyan-300"
            >
              <span>Open Standalone</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-surface border border-border text-slate-400 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-slate-900/40 px-4">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'invoices' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Vendor Invoices Intake ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'records' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Internal Ledger Records ({records.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 text-xs">
          {activeTab === 'invoices' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-slate-400 text-[11px] uppercase">
                    <th className="p-2">ID</th>
                    <th className="p-2">Company</th>
                    <th className="p-2">Invoice #</th>
                    <th className="p-2">Issue Date</th>
                    <th className="p-2">Due Date</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-slate-300">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-surfaceMuted/40">
                      <td className="p-2 font-mono text-[11px] text-cyan-400">{inv.id}</td>
                      <td className="p-2 font-semibold text-slate-100">{inv.companyName}</td>
                      <td className="p-2 font-mono">{inv.invoiceNumber}</td>
                      <td className="p-2">{inv.issueDate}</td>
                      <td className="p-2">{inv.dueDate || <span className="text-rose-400">Missing</span>}</td>
                      <td className="p-2 font-semibold text-emerald-400">${inv.amount?.toFixed(2)}</td>
                      <td className="p-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300">
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-slate-400 text-[11px] uppercase">
                    <th className="p-2">Record ID</th>
                    <th className="p-2">Invoice #</th>
                    <th className="p-2">Company</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Due Date</th>
                    <th className="p-2">Recorded At</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-slate-300">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-surfaceMuted/40">
                      <td className="p-2 font-mono text-[11px] text-cyan-400">{rec.id}</td>
                      <td className="p-2 font-mono font-semibold text-slate-100">{rec.invoiceNumber}</td>
                      <td className="p-2">{rec.companyName}</td>
                      <td className="p-2 font-semibold text-emerald-400">${rec.amount?.toFixed(2)}</td>
                      <td className="p-2">{rec.dueDate}</td>
                      <td className="p-2 text-slate-400 text-[11px]">{new Date(rec.createdAt).toLocaleString()}</td>
                      <td className="p-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                          {rec.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
