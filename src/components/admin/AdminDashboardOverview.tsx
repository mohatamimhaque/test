import React from 'react';
import { 
  Users, 
  Eye, 
  ShieldCheck, 
  HardDrive, 
  Activity, 
  Clock, 
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { getMembers, getAuditLogs, getAnalyticsStats } from '../../lib/storage';

interface AdminDashboardOverviewProps {
  onNavigateTab: (tab: any) => void;
}

export const AdminDashboardOverview: React.FC<AdminDashboardOverviewProps> = ({ onNavigateTab }) => {
  const members = getMembers();
  const auditLogs = getAuditLogs().slice(0, 8);
  const analytics = getAnalyticsStats();

  const totalMembers = members.length;
  const visibleMembers = members.filter(m => m.visible).length;
  const membersWithPhoto = members.filter(m => m.photo_url || m.photo_key).length;

  return (
    <div className="space-y-6">
      
      {/* Header Greeting Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-primary-700 via-primary-600 to-indigo-600 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary-200 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-300" />
            Admin Overview & Analytics
          </div>
          <h2 className="text-2xl font-bold font-outfit">
            CSE Archive Management Console
          </h2>
          <p className="text-xs text-primary-100 mt-1 max-w-xl">
            922 CSE alumni records imported and synchronized with secure object storage.
          </p>
        </div>

        <button
          onClick={() => onNavigateTab('members')}
          className="px-4 py-2.5 bg-white text-primary-700 font-bold text-xs rounded-xl shadow-md hover:bg-primary-50 transition-colors shrink-0 flex items-center gap-1.5"
        >
          Manage All Members
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Members</span>
            <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">{totalMembers}</div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {visibleMembers} active / visible publicly
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Verified Photos</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">{membersWithPhoto}</div>
          <p className="text-[11px] text-slate-400 font-medium">
            100% synchronized with storage
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Page Views</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">
            {analytics.totalPageViews + analytics.totalMemberViews}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {analytics.totalMemberViews} member profile views
          </p>
        </div>

      </div>

      {/* Two Column Section: Top Viewed Alumni & Recent Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Viewed Alumni */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary-500" />
              Most Viewed Alumni Profiles
            </h3>
            <button
              onClick={() => onNavigateTab('analytics')}
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              Full Analytics
            </button>
          </div>

          <div className="space-y-2.5">
            {analytics.topViewedMembers.length > 0 ? (
              analytics.topViewedMembers.slice(0, 5).map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-[11px]">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 font-bold">
                    {item.views} views
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No profile views recorded yet.</p>
            )}
          </div>
        </div>

        {/* Recent Audit Logs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Recent Audit Log Feed
            </h3>
            <button
              onClick={() => onNavigateTab('audit_logs')}
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              View All Logs
            </button>
          </div>

          <div className="space-y-2.5">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-primary-600 dark:text-primary-400">
                    {log.action}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{log.actor_email}</span> — {log.target_type} ({log.target_id})
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
