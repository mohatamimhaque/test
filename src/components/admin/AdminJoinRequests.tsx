import React, { useState, useEffect } from 'react';
import { JoinRequest } from '../../types';
import { getJoinRequests, reviewJoinRequest, reviewJoinRequestInSupabase, getJoinRequestsFromSupabase } from '../../lib/storage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getPhotoUrl, getDefaultAvatar } from '../../lib/r2';
import { Check, X, Clock, AlertCircle, Building2, MapPin, Mail, Phone, IdCard } from 'lucide-react';

export const AdminJoinRequests: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<JoinRequest[]>(() => getJoinRequests());
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [rejectingReq, setRejectingReq] = useState<JoinRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const refreshRequests = () => {
    getJoinRequestsFromSupabase().then(setRequests).catch(() => {});
  };

  useEffect(() => {
    refreshRequests();

    // Setup Supabase Realtime Channel Subscription for live updates!
    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel('realtime_admin_join_requests_live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cse_archive_join_requests' },
          () => {
            refreshRequests();
          }
        )
        .subscribe();
    }

    const handleUpdate = () => refreshRequests();
    window.addEventListener('join_requests_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener('join_requests_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, []);

  const filtered = requests.filter(r => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  const handleApprove = async (req: JoinRequest) => {
    if (window.confirm(`Approve join request from ${req.name}? This will automatically add them to the official member directory.`)) {
      await reviewJoinRequestInSupabase(req.id, 'approved', user?.email || 'admin@cse-archive.edu');
      refreshRequests();
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReq) return;

    await reviewJoinRequestInSupabase(rejectingReq.id, 'rejected', user?.email || 'admin@cse-archive.edu', rejectionReason);
    setRejectingReq(null);
    setRejectionReason('');
    refreshRequests();
  };

  return (
    <div className="space-y-4">
      
      {/* Header Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit">
            Public Join Applications Queue
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review and approve member registration requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                filterStatus === s
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {s} ({requests.filter(r => s === 'all' || r.status === s).length})
            </button>
          ))}
        </div>
      </div>

      {/* Requests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length > 0 ? (
          filtered.map(req => {
            const photoUrl = getPhotoUrl(req.photo_url || req.photo_key);
            return (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={photoUrl || getDefaultAvatar(undefined, req.name)}
                        alt={req.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getDefaultAvatar(undefined, req.name);
                        }}
                      />
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white font-outfit text-sm">{req.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{req.designation || 'Applicant'}</p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      req.status === 'pending'
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        : req.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {req.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 truncate">
                      <IdCard className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                      <span className="truncate">{req.student_id || 'No ID'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">{req.organization || 'N/A'}</span>
                    </div>
                    <a 
                      href={`mailto:${req.email}`}
                      className="flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                    >
                      <Mail className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                      <span className="truncate">{req.email}</span>
                    </a>
                    {req.mobile ? (
                      <a 
                        href={`tel:${req.mobile}`}
                        className="flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline font-mono"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">{req.mobile}</span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-1.5 truncate text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">N/A</span>
                      </div>
                    )}
                  </div>

                  {req.rejection_reason && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-800">
                      <strong>Rejection Reason:</strong> {req.rejection_reason}
                    </div>
                  )}
                </div>

                {req.status === 'pending' && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setRejectingReq(req)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-100 transition-colors flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(req)}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve & Add Member
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="md:col-span-2 p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-400 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold">No join requests found in this category.</p>
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">
              Reject Application for {rejectingReq.name}
            </h3>

            <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Provide reason for rejecting application..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingReq(null)}
                  className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
