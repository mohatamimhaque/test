import React, { useState } from 'react';
import { AdminUser } from '../../types';
import { getAdminUsers, addAdminUser, toggleAdminStatus } from '../../lib/storage';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Plus, UserX, UserCheck, Lock } from 'lucide-react';

export const AdminAdminsManager: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>(() => getAdminUsers());
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'super_admin'>('admin');

  const refresh = () => setAdmins(getAdminUsers());

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    addAdminUser(newEmail, newRole, user?.email || 'super_admin');
    setNewEmail('');
    refresh();
  };

  const handleToggle = (id: string, currentStatus: 'active' | 'disabled') => {
    const nextStatus = currentStatus === 'active' ? 'disabled' : 'active';
    toggleAdminStatus(id, nextStatus, user?.email || 'super_admin');
    refresh();
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
        <Lock className="w-8 h-8 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">Super Admin Access Required</h3>
        <p className="text-xs text-slate-400">Only Super Administrators can manage administrative user authorizations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            Administrator Authorizations
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Database-driven authorization separated strictly from identity authentication.
          </p>
        </div>

        {/* Add Admin Form */}
        <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row items-end gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
          <div className="flex-1 w-full">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">User Email Address</label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="e.g. mohatamim@cse-archive.edu"
              required
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="w-full sm:w-44">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Role</label>
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as any)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Grant Admin Role
          </button>
        </form>

        {/* Admins Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Administrator Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {admins.map(a => (
                <tr key={a.id}>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{a.email}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      a.role === 'super_admin' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                    }`}>
                      {a.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      a.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleToggle(a.id, a.status)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        a.status === 'active'
                          ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400'
                      }`}
                    >
                      {a.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
