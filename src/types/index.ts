export type ThemeMode = 'light' | 'dark' | 'system';

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
  join_enabled: boolean;
  updated_at: string;
  updated_by?: string;
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JoinRequest {
  id: string;
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
  status: JoinRequestStatus;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
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
