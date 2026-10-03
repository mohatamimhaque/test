import React, { createContext, useContext, useEffect, useState } from 'react';
import { Member, AdminUser } from '../types';
import { getMemberByEmail, getAdminByEmail } from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  member: Member | null;
  admin: AdminUser | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  sendOtp: (email: string) => Promise<{ success: boolean; message?: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  /** Join-archive OTP: sends a code to an address with no existing account. */
  sendJoinOtp: (email: string) => Promise<{ success: boolean; message?: string }>;
  /** Verifies a join code without establishing a login session. */
  verifyJoinOtp: (
    email: string,
    otp: string
  ) => Promise<{ success: boolean; message?: string; authUserId?: string | null }>;
  loginAsDemo: (role: 'super_admin' | 'admin' | 'member', memberEmail?: string) => void;
  logout: () => Promise<void>;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadUserState = (email: string, userId?: string) => {
    const authUser: AuthUser = { id: userId || 'user-' + Date.now(), email };
    setUser(authUser);

    // Check member profile
    const m = getMemberByEmail(email);
    setMember(m || null);

    // Check admin authorization
    const a = getAdminByEmail(email);
    if (a && a.status === 'active') {
      setAdmin(a);
    } else {
      setAdmin(null);
    }
  };

  useEffect(() => {
    // Check saved session in localStorage
    const savedEmail = localStorage.getItem('cse_archive_auth_email');
    if (savedEmail) {
      loadUserState(savedEmail);
    }

    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email) {
          loadUserState(session.user.email, session.user.id);
        }
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user?.email) {
          loadUserState(session.user.email, session.user.id);
        } else {
          setUser(null);
          setMember(null);
          setAdmin(null);
        }
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const refreshAuth = () => {
    if (user?.email) {
      loadUserState(user.email, user.id);
    }
  };

  const sendOtp = async (email: string) => {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    const member = getMemberByEmail(cleanEmail);
    const admin = getAdminByEmail(cleanEmail);
    const isSuperAdmin = cleanEmail === 'mohatamimhaque@outlook.com';

    if (!member && !admin && !isSuperAdmin) {
      return {
        success: false,
        message: `No registered alumni profile or account was found for ${cleanEmail}.`
      };
    }

    // Email check passed! Proceed to send 8-digit OTP
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOtp({ email: cleanEmail });
      if (error) return { success: false, message: error.message };
      return { success: true, message: '8-digit OTP code sent to your email.' };
    }
    // Simulation mode
    return { success: true, message: 'Simulation 8-digit OTP code is 12345678' };
  };

  const verifyOtp = async (email: string, otp: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) return { success: false, message: error.message };
      if (data.user?.email) {
        localStorage.setItem('cse_archive_auth_email', data.user.email);
        loadUserState(data.user.email, data.user.id);
        return { success: true };
      }
      return { success: false, message: 'Verification failed.' };
    }

    // Simulation mode (Any 6-8 digit OTP or 12345678)
    if (otp && otp.trim().length >= 4) {
      localStorage.setItem('cse_archive_auth_email', email);
      loadUserState(email);
      return { success: true };
    }
    return { success: false, message: 'Invalid OTP code. Use 12345678' };
  };

  /**
   * Join-archive variant of sendOtp.
   *
   * Unlike `sendOtp` this does NOT require an existing member/admin record —
   * that is the whole point, since applicants are by definition new. It only
   * sends a code to an address the applicant is trying to claim.
   */
  const sendJoinOtp = async (email: string) => {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOtp({ email: cleanEmail });
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'Verification code sent. Check your inbox.' };
    }

    return { success: true, message: 'Simulation mode: use code 12345678' };
  };

  /**
   * Verifies a join-archive code WITHOUT creating a login session.
   *
   * Deliberately separate from `verifyOtp`: verifying an application must not
   * sign the applicant in, because no member record exists yet. Returns the
   * auth user id so it can be attached to the submitted request.
   */
  const verifyJoinOtp = async (
    email: string,
    otp: string
  ): Promise<{ success: boolean; message?: string; authUserId?: string | null }> => {
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanOtp = (otp || '').trim();

    if (!cleanOtp) {
      return { success: false, message: 'Please enter the verification code.' };
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: 'email',
      });

      if (error) return { success: false, message: error.message };
      if (!data.user) return { success: false, message: 'Verification failed.' };

      return { success: true, authUserId: data.user.id };
    }

    // Simulation mode: accept any 4+ digit code.
    if (cleanOtp.length >= 4) {
      return { success: true, authUserId: `sim-${Date.now()}` };
    }
    return { success: false, message: 'Invalid code. Use 12345678 in simulation mode.' };
  };

  const loginAsDemo = (role: 'super_admin' | 'admin' | 'member', memberEmail?: string) => {
    let email = 'admin@cse-archive.edu';
    if (role === 'admin') email = 'moderator@cse-archive.edu';
    if (role === 'member') email = memberEmail || 'kmfarhad.1110@gmail.com';

    localStorage.setItem('cse_archive_auth_email', email);
    loadUserState(email);
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('cse_archive_auth_email');
    setUser(null);
    setMember(null);
    setAdmin(null);
  };

  const activeMember = member || (user ? getMemberByEmail(user.email) || null : null);
  const isAdmin = Boolean(admin && admin.status === 'active');
  const isSuperAdmin = Boolean(admin && admin.status === 'active' && admin.role === 'super_admin');

  return (
    <AuthContext.Provider
      value={{
        user,
        member: activeMember,
        admin,
        isAdmin,
        isSuperAdmin,
        loading,
        sendOtp,
        verifyOtp,
        sendJoinOtp,
        verifyJoinOtp,
        loginAsDemo,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
