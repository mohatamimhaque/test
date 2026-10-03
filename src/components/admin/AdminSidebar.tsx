import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileUp, 
  Layers, 
  ShieldCheck, 
  BarChart3, 
  Palette, 
  HardDrive, 
  ClipboardList,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getApprovalCounts } from '../../lib/storage';

export type AdminTab = 
  | 'overview' 
  | 'members' 
  | 'join_requests'
  | 'bulk_import' 
  | 'bulk_update' 
  | 'administrators' 
  | 'analytics' 
  | 'appearance' 
  | 'storage' 
  | 'audit_logs';

/**
 * Runtime list of every valid tab.
 *
 * `usePersistentState` validates the stored value against this, so a stale or
 * hand-edited localStorage entry can never leave the admin panel rendering an
 * unknown tab. Keep in sync with the `AdminTab` union above.
 */
export const ADMIN_TABS: readonly AdminTab[] = [
  'overview',
  'members',
  'join_requests',
  'bulk_import',
  'bulk_update',
  'administrators',
  'analytics',
  'appearance',
  'storage',
  'audit_logs',
] as const;

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, onTabChange }) => {
  const { isSuperAdmin } = useAuth();

  // Pending applications drive the nav badge, so an admin sees the queue at a glance.
  const pendingCount = getApprovalCounts().pending;

  const navItems: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number; superAdminOnly?: boolean }[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'join_requests', label: 'Join Requests', icon: UserPlus, badge: pendingCount },
    { id: 'bulk_import', label: 'Bulk Import', icon: FileUp },
    { id: 'bulk_update', label: 'Bulk Update', icon: Layers },
    { id: 'administrators', label: 'Administrators', icon: ShieldCheck, superAdminOnly: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'appearance', label: 'Appearance & Settings', icon: Palette },
    { id: 'storage', label: 'Storage & Object Metrics', icon: HardDrive },
    { id: 'audit_logs', label: 'Audit Logs', icon: ClipboardList },
  ];

  return (
    <aside className="w-full md:w-64 bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-3 md:p-4 shrink-0 transition-colors duration-200 rounded-2xl md:rounded-none">
      
      {/* Mobile Horizontal Scrollable Tab Bar */}
      <div className="md:hidden">
        <div className="px-1 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-outfit">
          Admin Control Tabs
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
          {navItems.map((item) => {
            if (item.superAdminOnly && !isSuperAdmin) return null;
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isActive ? 'bg-white text-primary-700' : 'bg-rose-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Vertical Sidebar */}
      <div className="hidden md:block space-y-2">
        <div className="px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-slate-400 font-outfit">
          Admin Navigation
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            if (item.superAdminOnly && !isSuperAdmin) return null;

            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    isActive ? 'bg-white text-primary-700' : 'bg-rose-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
