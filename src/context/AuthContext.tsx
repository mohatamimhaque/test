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

    // Check admin authorization against the cached roster immediately so the
    // console is not gated on a network round trip, then verify with the server.
    const cached = getAdminByEmail(email);
    if (cached && cached.status === 'active') {
      setAdmin(cached);
    } else {
      setAdmin(null);
    }

    verifyAdminAgainstServer(email);
  };

  /**
   * Confirms admin status with Postgres rather than trusting localStorage.
   *
   * `getAdminByEmail()` reads a cached roster, which anyone can edit in
   * DevTools. Migration 005 is what actually protects the data — non-admin
   * rows are refused at the database — but trusting the cache alone would still
   * render a fake admin console that quietly fails on every action. Verifying
   * against the roster means the UI shows the truth.
   */
  const verifyAdminAgainstServer = async (email: string) => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionEmail = sessionData?.session?.user?.email;

      // No live session: this is a stale cached identity. Supabase is the only
      // thing that can actually authorize a write, so a cached grant here would
      // render a console where every action fails. Show the signed-out state.
      if (!sessionEmail) {
        setAdmin(null);
        return;
      }

      const { data, error } = await supabase
        .from('cse_archive_admin_users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .limit(1);

      if (error) return; // Network problem: leave the cached state alone.

      if (Array.isArray(data) && data.length > 0) {
        setAdmin(data[0] as AdminUser);
      } else {
        // Confirmed absent from the roster. Clear any cached grant.
        setAdmin(null);
      }
    } catch {
      // Network problem: keep whatever the cache said rather than locking an
      // admin out mid-session.
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
        // A live Supabase session always wins over the cached email.
        if (session?.user?.email) {
          loadUserState(session.user.email, session.user.id);
        }
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user?.email) {
          loadUserState(session.user.email, session.user.id);
        } else if (_event === 'SIGNED_OUT') {
          // Only an explicit sign-out should clear local auth state.
          //
          // Supabase also emits a null session on initial hydration, tab
          // restore and token refresh failures. Clearing on those silently
          // logged users out on every reload while their cached email was
          // still in localStorage, so the UI showed "Sign In" for someone who
          // was in fact still verified locally.
          setUser(null);
          setMember(null);
          setAdmin(null);
          localStorage.removeItem('cse_archive_auth_email');
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

    // No hardcoded super-admin identity here. The roster in
    // `cse_archive_admin_users` is the only source of admin status, so an
    // arbitrary email cannot be treated as an administrator.
    if (!member && !admin) {
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

    // Simulation mode (only reachable when Supabase is not configured).
    //
    // This accepts any 4+ digit code, which means no identity proof at all.
    // It is therefore restricted to member profiles and can never establish
    // admin: a fake sign-in that grants the admin console would be a trivial
    // bypass in any deployment that has Supabase credentials but falls through
    // to this path.
    if (otp && otp.trim().length >= 4) {
      if (getAdminByEmail(email)) {
        return {
          success: false,
          message: 'Administrator sign-in requires the configured mail service.',
        };
      }
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

    // Demo logins only exist when Supabase is not configured at all. With a
    // real backend this would mint a local admin grant that the database never
    // honoured, so it is refused rather than half-working.
    if (isSupabaseConfigured && supabase) return;

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
