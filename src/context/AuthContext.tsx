import React, { createContext, useContext, useEffect, useState } from 'react';
import { Member, AdminUser, JoinRequest } from '../types';
import { getMemberByEmail, getAdminByEmail, getJoinRequests } from '../lib/storage';
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
  sendOtp: (email: string, options?: { isLogin?: boolean }) => Promise<{ success: boolean; message?: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; message?: string }>;
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

  const sendOtp = async (email: string, options: { isLogin?: boolean } = { isLogin: true }) => {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    const member = getMemberByEmail(cleanEmail);
    const admin = getAdminByEmail(cleanEmail);
    const isSuperAdmin = cleanEmail === 'mohatamimhaque@outlook.com';
    const requests = getJoinRequests();
    let joinReq = requests.find(r => r.email && r.email.toLowerCase().trim() === cleanEmail);

    if (isSupabaseConfigured && supabase) {
      const { data: dbReq } = await supabase
        .from('cse_archive_join_requests')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (dbReq) {
        joinReq = dbReq as JoinRequest;
      }
    }

    if (options.isLogin) {
      // --- SIGN-IN / LOGIN FLOW ---
      if (!member && !admin && !isSuperAdmin) {
        if (joinReq) {
          if (joinReq.status === 'pending') {
            return {
              success: false,
              message: `Your join application for ${cleanEmail} is pending administrator review. Once approved, you will be able to sign in.`
            };
          }
          if (joinReq.status === 'rejected') {
            return {
              success: false,
              message: `Your join application for ${cleanEmail} was reviewed and rejected by an administrator.${joinReq.rejection_reason ? ` Reason: ${joinReq.rejection_reason}` : ''} Please submit a new Join Application.`
            };
          }
        }

        return {
          success: false,
          message: `No registered alumni profile or account was found for ${cleanEmail}. Please submit your Join Application form first.`
        };
      }
    } else {
      // --- JOIN APPLICATION FLOW ---
      if (member) {
        return {
          success: false,
          message: `An alumni profile already exists for ${cleanEmail}. Please sign in to your member dashboard instead.`
        };
      }

      if (joinReq) {
        if (joinReq.status === 'pending') {
          return {
            success: false,
            message: `A join application for ${cleanEmail} is already submitted and pending administrator review.`
          };
        }
        if (joinReq.status === 'approved') {
          return {
            success: false,
            message: `Your join application for ${cleanEmail} has already been approved! Please sign in to your profile.`
          };
        }
      }
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
