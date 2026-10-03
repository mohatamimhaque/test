export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Admin moderation state for a member record.
 * - `approved` → visible on the public site (the default for all legacy records)
 * - `pending`  → submitted via the Join Archive form, awaiting admin review
 * - `rejected` → declined by an admin, hidden from the public site
 */
export type MemberApprovalStatus = 'approved' | 'pending' | 'rejected';

export interface Member {
  id: number;
  legacy_id: number;
  name: string;
  email: string;
  mobile: string;
  student_id: string;
  blood: string;
  designation: string;
  organization: string;
  location: string;
  photo_key: string;
  photo_url: string;
  visible: boolean;
  /** Admin moderation state. Absent on legacy rows → treated as `approved`. */
  approval_status?: MemberApprovalStatus;
  /** Admin who approved/rejected the record. */
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  /** Why a request was rejected, shown to the applicant. */
  rejection_reason?: string | null;
  /** Supabase auth user id that submitted a Join request. */
  auth_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type AdminRole = 'admin' | 'super_admin';
export type AdminStatus = 'active' | 'disabled';

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SiteSettings {
  id: number;
  title: string;
  subtitle: string;
  header_title: string;
  description: string;
  logo_url: string;
  footer_text: string;
  contact_email: string;
  contact_phone: string;
  updated_at: string;
  updated_by?: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  actor_email?: string;
  action: string;
  target_type: string;
  target_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface PageView {
  id: number;
  path: string;
  ip_hash?: string;
  user_agent?: string;
  country?: string;
  city?: string;
  created_at: string;
}

export interface MemberView {
  id: number;
  member_id: number;
  member_name?: string;
  ip_hash?: string;
  user_agent?: string;
  country?: string;
  city?: string;
  created_at: string;
}

/** A single directory search, with how many results it returned. */
export interface SearchView {
  id: number;
  /** The raw text the visitor typed. */
  query: string;
  /** How many alumni matched (0 for no-match searches). */
  results_count: number;
  /** Which UI performed the search. */
  source: 'mobile' | 'desktop';
  /** Optional filter context, e.g. `blood=A+&sort=recent`. */
  filters?: string;
  ip_hash?: string;
  user_agent?: string;
  country?: string;
  city?: string;
  created_at: string;
}

// ============================================================================
// Join Archive request workflow
// ============================================================================

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * An application to join the archive, staged in
 * `cse_archive_join_requests` until an admin approves it.
 * On approval the data is promoted into `cse_archive_members`.
 */
export interface JoinRequest {
  id: number;
  auth_user_id?: string | null;
  email: string;
  /** True once the applicant proved control of `email` via Supabase OTP. */
  email_verified?: boolean;
  name: string;
  mobile?: string;
  student_id?: string;
  blood?: string;
  designation?: string;
  organization?: string;
  location?: string;
  photo_key?: string;
  photo_url?: string;
  status: JoinRequestStatus;
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

/** Shape accepted by `submitJoinRequest` (server assigns id/status/timestamps). */
export type JoinRequestInput = Omit<
  JoinRequest,
  'id' | 'status' | 'created_at' | 'updated_at' | 'email_verified' | 'reviewed_by' | 'reviewed_at' | 'rejection_reason'
>;
