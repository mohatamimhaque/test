import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  FileUp, 
  Layers, 
  ShieldCheck, 
  BarChart3, 
  Palette, 
  HardDrive, 
  ClipboardList 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  pendingRequestsCount: number;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, onTabChange, pendingRequestsCount }) => {
  const { isSuperAdmin } = useAuth();

  const navItems: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number; superAdminOnly?: boolean }[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'join_requests', label: 'Join Requests', icon: UserPlus, badge: pendingRequestsCount },
    { id: 'bulk_import', label: 'Bulk Import', icon: FileUp },
    { id: 'bulk_update', label: 'Bulk Update', icon: Layers },
    { id: 'administrators', label: 'Administrators', icon: ShieldCheck, superAdminOnly: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'appearance', label: 'Appearance & Settings', icon: Palette },
    { id: 'storage', label: 'Storage & Object Metrics', icon: HardDrive },
    { id: 'audit_logs', label: 'Audit Logs', icon: ClipboardList },
  ];

  return (
    <aside className="w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 space-y-2 shrink-0 transition-colors duration-200">
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
    </aside>
  );
};
