'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building,
  RefreshCw,
  ArrowLeft,
  FileSpreadsheet,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  ExternalLink,
  Code
} from 'lucide-react';
import { fetchPortalInvoices, fetchPortalRecords } from '../../lib/api';

export default function StandalonePortalPage() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'records'>('invoices');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invs, recs] = await Promise.all([
        fetchPortalInvoices(),
        fetchPortalRecords()
      ]);
      setInvoices(invs);
      setRecords(recs);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load portal data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRecords = records.filter(
    (rec) =>
      rec.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalInvoicedAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const totalRecordedAmount = records.reduce((sum, rec) => sum + (rec.amount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-cyan-400" />
            <span>TaskPilot AI Dashboard</span>
          </Link>
          <div className="h-5 w-px bg-slate-800" />
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Building className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-slate-100 tracking-tight">Simulated Enterprise ERP Portal</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live System
                </span>
              </div>
              <p className="text-xs text-slate-400">Target environment for TaskPilot autonomous task execution</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Synced: {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh State</span>
          </button>
          <Link
            href="/demo"
            className="px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 text-xs text-cyan-300 transition-colors"
          >
            Evaluation Demo
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Vendor Invoices</span>
              <Receipt className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-100">{invoices.length}</div>
            <div className="text-xs text-slate-500 mt-1">Available in intake repository</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Ledger Records</span>
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-400">{records.length}</div>
            <div className="text-xs text-slate-500 mt-1">Entered into accounting ledger</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Invoiced</span>
              <span className="text-xs font-mono text-slate-400">$</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-100">${totalInvoicedAmount.toFixed(2)}</div>
            <div className="text-xs text-slate-500 mt-1">Across all vendor accounts</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Recorded Value</span>
              <CheckCircle2 className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-cyan-400">${totalRecordedAmount.toFixed(2)}</div>
            <div className="text-xs text-slate-500 mt-1">Verified internal ledger balance</div>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'invoices'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'bg-slate-800/40 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Vendor Invoices Intake ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'records'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'bg-slate-800/40 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Internal Ledger Records ({records.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter by company, invoice #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <a
                href="/api/portal/invoices"
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
                title="View Invoices Raw JSON"
              >
                <Code className="h-4 w-4" />
              </a>
              <a
                href="/api/portal/records"
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                title="View Ledger Raw JSON"
              >
                <FileSpreadsheet className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {activeTab === 'invoices' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="p-3.5">ID</th>
                    <th className="p-3.5">Vendor Company</th>
                    <th className="p-3.5">Invoice #</th>
                    <th className="p-3.5">Issue Date</th>
                    <th className="p-3.5">Due Date</th>
                    <th className="p-3.5">Currency</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        {searchQuery ? 'No matching invoices found.' : 'No invoices available in intake.'}
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 font-mono text-[11px] text-cyan-400">{inv.id}</td>
                        <td className="p-3.5 font-semibold text-slate-100">{inv.companyName}</td>
                        <td className="p-3.5 font-mono text-slate-200">{inv.invoiceNumber}</td>
                        <td className="p-3.5 text-slate-300">{inv.issueDate}</td>
                        <td className="p-3.5">
                          {inv.dueDate ? (
                            <span className="text-slate-300">{inv.dueDate}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                              <AlertTriangle className="h-3 w-3" /> Missing
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-slate-400">{inv.currency || 'USD'}</td>
                        <td className="p-3.5 font-semibold text-emerald-400">${inv.amount?.toFixed(2)}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="p-3.5">Record ID</th>
                    <th className="p-3.5">Invoice #</th>
                    <th className="p-3.5">Vendor Company</th>
                    <th className="p-3.5">Due Date</th>
                    <th className="p-3.5">Currency</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">Recorded At</th>
                    <th className="p-3.5">Ledger Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        {searchQuery ? 'No matching ledger records found.' : 'No records entered yet. Run an autonomous task from TaskPilot AI to record an invoice.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 font-mono text-[11px] text-cyan-400">{rec.id}</td>
                        <td className="p-3.5 font-mono font-semibold text-slate-100">{rec.invoiceNumber}</td>
                        <td className="p-3.5 text-slate-300">{rec.companyName}</td>
                        <td className="p-3.5 text-slate-300">{rec.dueDate}</td>
                        <td className="p-3.5 font-mono text-slate-400">{rec.currency || 'USD'}</td>
                        <td className="p-3.5 font-semibold text-emerald-400">${rec.amount?.toFixed(2)}</td>
                        <td className="p-3.5 text-slate-400 text-[11px]">
                          {rec.createdAt ? new Date(rec.createdAt).toLocaleString() : 'N/A'}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                            {rec.status?.toUpperCase() || 'ENTERED'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info note */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="font-semibold text-slate-200">Independent Verification Target:</span> The verification engine reads from this internal ledger independently via HTTP GET after any tool action to certify postconditions.
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/portal/invoices"
              className="text-cyan-400 hover:underline flex items-center gap-1"
              target="_blank"
              rel="noreferrer"
            >
              <span>API Invoices</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="/api/portal/records"
              className="text-emerald-400 hover:underline flex items-center gap-1"
              target="_blank"
              rel="noreferrer"
            >
              <span>API Records</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
