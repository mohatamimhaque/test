import React, { useState } from 'react';
import { getAuditLogs } from '../../lib/storage';
import { ClipboardList, Search, Eye } from 'lucide-react';
import { AuditLog } from '../../types';

export const AdminAuditLogs: React.FC = () => {
  const logs = getAuditLogs();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const filtered = logs.filter(l => {
    const q = searchQuery.toLowerCase();
    return (
      l.action?.toLowerCase().includes(q) ||
      l.actor_email?.toLowerCase().includes(q) ||
      l.target_type?.toLowerCase().includes(q) ||
      l.target_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              Security Audit Trail
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Comprehensive log tracking member edits, admin promotions, settings updates, and bulk imports.
            </p>
          </div>

          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search audit logs..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor Email</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Type</th>
                <th className="py-3 px-4">Target ID</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 text-slate-400">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{l.actor_email || 'system'}</td>
                  <td className="py-3 px-4 text-primary-600 dark:text-primary-400 font-bold">{l.action}</td>
                  <td className="py-3 px-4">{l.target_type}</td>
                  <td className="py-3 px-4">{l.target_id || '-'}</td>
                  <td className="py-3 px-4 text-right font-sans">
                    <button
                      onClick={() => setSelectedLog(l)}
                      className="p-1 text-slate-500 hover:text-primary-600"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details JSON Viewer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm font-outfit">Audit Log Details</h4>
              <button onClick={() => setSelectedLog(null)} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
            </div>

            <div className="bg-slate-950 text-slate-200 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-60">
              <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
