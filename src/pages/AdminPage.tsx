import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getJoinRequests } from '../lib/storage';
import { AdminSidebar, AdminTab } from '../components/admin/AdminSidebar';
import { AdminDashboardOverview } from '../components/admin/AdminDashboardOverview';
import { AdminMembersManager } from '../components/admin/AdminMembersManager';
import { AdminJoinRequests } from '../components/admin/AdminJoinRequests';
import { AdminBulkImport } from '../components/admin/AdminBulkImport';
import { AdminBulkUpdate } from '../components/admin/AdminBulkUpdate';
import { AdminAdminsManager } from '../components/admin/AdminAdminsManager';
import { AdminAnalytics } from '../components/admin/AdminAnalytics';
import { AdminAppearanceSettings } from '../components/admin/AdminAppearanceSettings';
import { AdminStorageManager } from '../components/admin/AdminStorageManager';
import { AdminAuditLogs } from '../components/admin/AdminAuditLogs';
import { ShieldAlert, ShieldCheck, KeyRound } from 'lucide-react';

interface AdminPageProps {
  onOpenLoginModal: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onOpenLoginModal }) => {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(() => 
    getJoinRequests().filter(r => r.status === 'pending').length
  );

  useEffect(() => {
    const handleUpdate = () => {
      setPendingRequestsCount(getJoinRequests().filter(r => r.status === 'pending').length);
    };
    handleUpdate();
    window.addEventListener('join_requests_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('join_requests_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, []);

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">
          Administrator Access Restricted
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          You must be logged in as an authorized administrator to view this console.
        </p>
        <button
          onClick={onOpenLoginModal}
          className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors inline-flex items-center gap-2"
        >
          <KeyRound className="w-4 h-4" />
          Sign In as Administrator
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      
      {/* Top Banner */}
      <div className="bg-slate-900 text-white border-b border-slate-800 px-6 py-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span className="font-bold font-outfit">CSE Archive Management Portal</span>
          <span className="text-slate-400 hidden sm:inline">| Signed in as {user?.email}</span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-slate-950">
          {isSuperAdmin ? 'Super Administrator' : 'Administrator'}
        </span>
      </div>

      <div className="flex flex-col md:flex-row max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 gap-6">
        
        {/* Sidebar */}
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingRequestsCount={pendingRequestsCount}
        />

        {/* Tab Content View */}
        <main className="flex-1 min-w-0">
          {activeTab === 'overview' && <AdminDashboardOverview onNavigateTab={setActiveTab} />}
          {activeTab === 'members' && <AdminMembersManager />}
          {activeTab === 'join_requests' && <AdminJoinRequests />}
          {activeTab === 'bulk_import' && <AdminBulkImport />}
          {activeTab === 'bulk_update' && <AdminBulkUpdate />}
          {activeTab === 'administrators' && <AdminAdminsManager />}
          {activeTab === 'analytics' && <AdminAnalytics />}
          {activeTab === 'appearance' && <AdminAppearanceSettings />}
          {activeTab === 'storage' && <AdminStorageManager />}
          {activeTab === 'audit_logs' && <AdminAuditLogs />}
        </main>

      </div>

    </div>
  );
};
