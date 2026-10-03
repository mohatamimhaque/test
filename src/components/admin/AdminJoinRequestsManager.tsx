/**
 * Admin — Join Requests approval queue.
 *
 * Shows every application submitted through the public "Join Archive" page.
 * Approving promotes the row into `cse_archive_members` with
 * `approval_status = 'approved'`; rejecting keeps it out of the archive.
 * Either way the record is written to Supabase and logged to the audit trail.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { JoinRequest, JoinRequestStatus, Member } from '../../types';
import {
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  getPendingMembers,
  normalizeApproval,
} from '../../lib/storage';
import { getPhotoUrl, getDefaultAvatar } from '../../lib/r2';
import { useAuth } from '../../context/AuthContext';
import {
  UserPlus,
  Check,
  X,
  Search,
  Loader2,
  Mail,
  Phone,
  Building2,
  MapPin,
  Droplet,
  Clock,
  ShieldCheck,
  ShieldX,
  MailCheck,
  AlertCircle,
  Inbox,
} from 'lucide-react';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

interface AdminJoinRequestsManagerProps {
  onNavigateTab?: (tab: 'members' | 'join_requests') => void;
}

export const AdminJoinRequestsManager: React.FC<AdminJoinRequestsManagerProps> = ({
  onNavigateTab,
}) => {
  const { user } = useAuth();

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [pendingMembers, setPendingMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<number | string | null>(null);
  const [rejecting, setRejecting] = useState<JoinRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqs, pending] = await Promise.all([getJoinRequests(), Promise.resolve(getPendingMembers())]);
    setRequests(reqs);
    setPendingMembers(pending);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /**
   * Applications live in the staging table; anything that already reached the
   * members table but is still unapproved is merged in so nothing falls
   * through the cracks when Supabase has never been reachable.
   */
  const stagedOnly = requests.filter((r) => r.status === 'pending');

  const rows = useMemo(() => {
    const source: JoinRequest[] = [...stagedOnly];

    // Surface member-table rows that have no matching staging entry.
    for (const m of pendingMembers) {
      const status = normalizeApproval(m.approval_status);
      if (status === 'approved') continue;
      const hasStaging = source.some(
        (r) => r.email.toLowerCase().trim() === m.email.toLowerCase().trim()
      );
      if (!hasStaging) {
        source.push({
          id: -(m.id), // negative ids keep the two sources from colliding
          email: m.email,
          email_verified: Boolean(m.auth_user_id),
          name: m.name,
          mobile: m.mobile,
          student_id: m.student_id,
          blood: m.blood,
          designation: m.designation,
          organization: m.organization,
          location: m.location,
          photo_key: m.photo_key,
          photo_url: m.photo_url,
          status: status as JoinRequestStatus,
          rejection_reason: m.rejection_reason,
          reviewed_by: m.reviewed_by,
          reviewed_at: m.reviewed_at,
          created_at: m.created_at,
        });
      }
    }

    const byStatus = source.filter((r) => filter === 'all' || r.status === filter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return byStatus.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.student_id?.toLowerCase().includes(q) ||
          r.organization?.toLowerCase().includes(q) ||
          r.location?.toLowerCase().includes(q) ||
          r.designation?.toLowerCase().includes(q)
      );
    }

    return byStatus.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [stagedOnly, pendingMembers, filter, searchQuery]);

  const counts = useMemo(() => {
    const merged = [...stagedOnly];
    for (const m of pendingMembers) {
      const status = normalizeApproval(m.approval_status);
      if (status === 'approved') continue;
      if (!merged.some((r) => r.email.toLowerCase().trim() === m.email.toLowerCase().trim())) {
        merged.push({
          id: -(m.id),
          email: m.email,
          name: m.name,
          status: status as JoinRequestStatus,
          created_at: m.created_at,
        });
      }
    }
    return {
      pending: merged.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      rejected: merged.filter((r) => r.status === 'rejected').length,
    };
  }, [stagedOnly, pendingMembers, requests]);

  const handleApprove = async (request: JoinRequest) => {
    setBusyId(request.id);
    const res = await approveJoinRequest(request.id, user?.email);
    setBusyId(null);
    setToast(
      res.success
        ? { type: 'success', text: `${request.name} was approved and added to the archive.` }
        : { type: 'error', text: res.message || 'Approval failed.' }
    );
    await load();
  };

  const handleReject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    const res = await rejectJoinRequest(rejecting.id, rejectReason.trim(), user?.email);
    setBusyId(null);
    setRejecting(null);
    setRejectReason('');
    setToast(
      res.success
        ? { type: 'success', text: `Application from ${rejecting.email} was rejected.` }
        : { type: 'error', text: res.message || 'Rejection failed.' }
    );
    await load();
  };

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 border ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary-500" />
            Join Requests
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review and approve applications submitted through the public Join Archive page.
            Only approved members appear on the public site.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search applications..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>
          <button
            onClick={load}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Awaiting Review"
          value={counts.pending}
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          accent="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400"
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
        />
        <SummaryCard
          label="Approved"
          value={counts.approved}
          icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
          accent="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
          active={filter === 'approved'}
          onClick={() => setFilter('approved')}
        />
        <SummaryCard
          label="Rejected"
          value={counts.rejected}
          icon={<ShieldX className="w-5 h-5 text-rose-500" />}
          accent="bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400"
          active={filter === 'rejected'}
          onClick={() => setFilter('rejected')}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl overflow-x-auto border border-slate-200/60 dark:border-slate-700/60 w-fit">
        {(
          [
            { key: 'pending', label: `Pending (${counts.pending})` },
            { key: 'approved', label: `Approved (${counts.approved})` },
            { key: 'rejected', label: `Rejected (${counts.rejected})` },
            { key: 'all', label: 'All Requests' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
              filter === t.key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
            <span className="text-xs font-semibold">Loading applications...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600">
              <Inbox className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold font-outfit text-slate-800 dark:text-slate-200">
              No {filter === 'all' ? '' : filter} applications
            </h3>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Applications submitted through the public Join Archive page will appear here
              for review.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Designation and Organization</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-center">Email Verified</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Applied</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {rows.map((r) => {
                  const avatar = getPhotoUrl(r.photo_url || r.photo_key) || getDefaultAvatar(undefined, r.name);
                  const busy = busyId === r.id;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Applicant */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={avatar}
                            alt={r.name}
                            className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = getDefaultAvatar(undefined, r.name);
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white font-outfit truncate max-w-[160px]">
                              {r.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate max-w-[160px] flex items-center gap-1">
                              <Mail className="w-3 h-3 shrink-0" />
                              {r.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Student ID */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300">
                        {r.student_id ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                            {r.student_id}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Designation */}
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                          {r.designation || 'Alumni'}
                        </p>
                        {r.organization && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate max-w-[180px]">
                            <Building2 className="w-3 h-3 shrink-0" />
                            {r.organization}
                          </p>
                        )}
                        {r.location && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate max-w-[180px]">
                            <MapPin className="w-3 h-3 shrink-0 text-rose-400" />
                            {r.location}
                          </p>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4">
                        {r.mobile && (
                          <p className="flex items-center gap-1 font-mono text-[11px]">
                            <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                            {r.mobile}
                          </p>
                        )}
                        {r.blood && (
                          <p className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                            <Droplet className="w-3 h-3 fill-current shrink-0" />
                            {r.blood}
                          </p>
                        )}
                        {!r.mobile && !r.blood && <span className="text-slate-400">-</span>}
                      </td>

                      {/* Email verified */}
                      <td className="py-3 px-4 text-center">
                        {r.email_verified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                            <MailCheck className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 font-bold text-[10px]">
                            Unverified
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={r.status} />
                      </td>

                      {/* Applied */}
                      <td className="py-3 px-4 text-right text-[11px] text-slate-400 font-mono whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleApprove(r)}
                                disabled={busy}
                                title="Approve and add to archive"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] transition-colors disabled:opacity-50 shadow-sm"
                              >
                                {busy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejecting(r);
                                  setRejectReason(r.rejection_reason || '');
                                }}
                                disabled={busy}
                                title="Reject application"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] transition-colors disabled:opacity-50 shadow-sm"
                              >
                                <X className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              {r.reviewed_by ? `by ${r.reviewed_by}` : 'Reviewed'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-right text-xs text-slate-400">
        Displaying {rows.length} application{rows.length === 1 ? '' : 's'}
      </div>

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ShieldX className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold font-outfit text-slate-900 dark:text-white">
                  Reject Application
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-all">
                  {rejecting.name} · {rejecting.email}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Reason for rejection
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Unable to verify the student ID against the archive."
                className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 text-slate-900 dark:text-white placeholder-slate-400 resize-none"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                The applicant will see this message and may submit a corrected application.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setRejecting(null);
                  setRejectReason('');
                }}
                className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={busyId !== null}
                className="flex-1 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busyId !== null && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

const StatusBadge: React.FC<{ status: JoinRequestStatus }> = ({ status }) => {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
        <ShieldCheck className="w-3 h-3" /> Approved
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 font-bold text-[10px]">
        <ShieldX className="w-3 h-3" /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold text-[10px]">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
};

interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  active?: boolean;
  onClick?: () => void;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, icon, accent, active, onClick }) => (
  <button
    onClick={onClick}
    className={`p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm space-y-1 text-left transition-colors ${
      active ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-200 dark:border-slate-800'
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent}`}>{icon}</span>
    </div>
    <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">{value}</div>
  </button>
);

export default AdminJoinRequestsManager;