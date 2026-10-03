/**
 * Join the Archive — public application page.
 *
 * Flow:
 *   1. Applicant enters their email.
 *   2. An 8-digit Supabase OTP code proves they own that address.
 *   3. Only after verification can the profile form be filled in and submitted.
 *   4. Submission writes a `pending` row; an admin approves or rejects it.
 *      Pending/rejected members never appear anywhere on the public site.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  submitJoinRequest,
  getJoinRequestByEmail,
  getMemberByEmail,
  normalizeApproval,
} from '../lib/storage';
import { usePhotoUrl, processPhotoUpload } from '../lib/r2';
import {
  UserPlus,
  Mail,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  User,
  Phone,
  Building2,
  MapPin,
  IdCard,
  Droplet,
  Upload,
  Info,
} from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface FormState {
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
}

type Step = 'email' | 'otp' | 'form' | 'done';

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  mobile: '',
  student_id: '',
  blood: '',
  designation: '',
  organization: '',
  location: '',
  photo_key: '',
  photo_url: '',
};

export const JoinArchivePage: React.FC = () => {
  const { sendJoinOtp, verifyJoinOtp } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const [otpDigits, setOtpDigits] = useState<string[]>(Array(8).fill(''));
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);

  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const { url: photoUrl } = usePhotoUrl(form.photo_url || form.photo_key);

  // Resend countdown.
  useEffect(() => {
    if (step !== 'otp' || resendTimer <= 0) {
      if (resendTimer === 0) setCanResend(true);
      return;
    }
    const t = setInterval(() => setResendTimer((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [step, resendTimer]);

  // If this email already has a request on record, show its status up front.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const clean = email.toLowerCase().trim();
      if (!clean.includes('@')) return;

      const member = getMemberByEmail(clean);
      const status = member ? normalizeApproval(member.approval_status) : null;

      if (status === 'approved') {
        if (!cancelled) {
          setStep('done');
          setMessage({ type: 'success', text: 'You are already a verified member of the archive.' });
        }
        return;
      }

      const existing = await getJoinRequestByEmail(clean);
      if (cancelled || !existing) return;

      // `cancelled` must be re-checked after every await. The branches below
      // overwrite step and form fields, so firing one after the applicant has
      // already moved on (they typed another email, or started filling the
      // form) would wipe what they typed.
      if (existing.status === 'pending') {
        if (cancelled) return;
        setStep('done');
        setMessage({
          type: 'info',
          text: 'Your application is already submitted and awaiting administrator review.',
        });
      } else if (existing.status === 'rejected') {
        if (cancelled) return;
        setStep('form');
        setVerifiedEmail(clean);
        setForm((f) => ({ ...f, email: clean, name: existing.name || '', student_id: existing.student_id || '' }));
        setMessage({
          type: 'error',
          text: `Your previous application was not accepted${existing.rejection_reason ? `: ${existing.rejection_reason}` : '.'} You may update your details and submit again.`,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = email.toLowerCase().trim();
    if (!clean.includes('@')) {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setLoading(true);
    setMessage(null);
    const res = await sendJoinOtp(clean);
    setLoading(false);

    if (res.success) {
      setStep('otp');
      setOtpDigits(Array(8).fill(''));
      setResendTimer(30);
      setCanResend(false);
      setMessage({ type: 'success', text: res.message || 'Verification code sent.' });
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    } else {
      setMessage({ type: 'error', text: res.message || 'Failed to send the code. Try again.' });
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/[^0-9]/g, '');
    if (!clean) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      return;
    }
    if (clean.length > 1) {
      const digits = clean.slice(0, 8).split('');
      const next = [...otpDigits];
      digits.forEach((d, i) => {
        if (i < 8) next[i] = d;
      });
      setOtpDigits(next);
      inputRefs.current[Math.min(7, digits.length)]?.focus();
      return;
    }
    const next = [...otpDigits];
    next[index] = clean;
    setOtpDigits(next);
    if (index < 7) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) inputRefs.current[index - 1]?.focus();
    else if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    else if (e.key === 'ArrowRight' && index < 7) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
    if (!pasted) return;
    const digits = pasted.slice(0, 8).split('');
    const next = Array(8).fill('');
    digits.forEach((d, i) => {
      next[i] = d;
    });
    setOtpDigits(next);
    inputRefs.current[Math.min(7, digits.length)]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 8) {
      setMessage({ type: 'error', text: 'Please enter all 8 digits of the code.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await verifyJoinOtp(verifiedEmail || email, code);
    setLoading(false);

    if (res.success) {
      const clean = (verifiedEmail || email).toLowerCase().trim();
      setVerifiedEmail(clean);
      setAuthUserId(res.authUserId ?? null);
      setForm((f) => ({ ...f, email: clean }));
      setStep('form');
      setMessage({ type: 'success', text: 'Email verified. You can now complete your profile.' });
    } else {
      setMessage({ type: 'error', text: res.message || 'Invalid code. Please try again.' });
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const res = await processPhotoUpload(file);
      setForm((f) => ({ ...f, photo_key: res.photo_key, photo_url: res.photo_url }));
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Photo upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setMessage({ type: 'error', text: 'Please enter your full name.' });
      return;
    }
    if (!form.student_id.trim()) {
      setMessage({ type: 'error', text: 'Please enter your student / alumni ID.' });
      return;
    }
    if (!verifiedEmail) {
      setMessage({ type: 'error', text: 'Your email must be verified before submitting.' });
      setStep('otp');
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await submitJoinRequest(
      {
        email: verifiedEmail,
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        student_id: form.student_id.trim(),
        blood: form.blood,
        designation: form.designation.trim(),
        organization: form.organization.trim(),
        location: form.location.trim(),
        photo_key: form.photo_key,
        photo_url: form.photo_url,
      },
      { emailVerified: true, authUserId }
    );

    setLoading(false);

    if (res.success) {
      setStep('done');
      setMessage({
        type: 'success',
        text: res.message || 'Your application has been submitted for review.',
      });
    } else {
      setMessage({ type: 'error', text: res.message || 'Submission failed. Please try again.' });
    }
  };

  const update = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const fullOtp = otpDigits.join('');

  return (
    <div className="w-full py-10 px-4 sm:px-6 transition-colors duration-200">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-500 text-white shadow-lg shadow-primary-500/25">
            <UserPlus className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit tracking-tight">
            Join the CSE Archive
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Register as an alumni member. Your email must be verified before your
            application can be reviewed by an administrator.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          {(
            [
              { key: 'email', label: 'Email' },
              { key: 'otp', label: 'Verify' },
              { key: 'form', label: 'Details' },
              { key: 'done', label: 'Review' },
            ] as const
          ).map((s, i) => {
            const order = ['email', 'otp', 'form', 'done'];
            const currentIndex = order.indexOf(step);
            const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'todo';
            return (
              <React.Fragment key={s.key}>
                {i > 0 && <div className={`flex-1 h-0.5 ${state !== 'todo' ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      state === 'done'
                        ? 'bg-emerald-500 text-white'
                        : state === 'active'
                          ? 'bg-primary-600 text-white ring-4 ring-primary-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {state === 'done' ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-[10px] font-semibold ${state === 'active' ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">

            {message && (
              <div
                className={`p-4 rounded-2xl text-xs font-medium flex items-start gap-2.5 border ${
                  message.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : message.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
              >
                {message.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                ) : message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
                ) : (
                  <Clock className="w-4 h-4 shrink-0 mt-px" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            {/* ---------------- STEP 1: EMAIL ---------------- */}
            {step === 'email' && (
              <form onSubmit={handleSendOtp} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Your Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. name@example.com"
                      required
                      autoComplete="email"
                      className="w-full pl-11 pr-4 py-3.5 text-base bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    We will send an 8-digit verification code to confirm you own this address.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 text-sm font-bold bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-2xl shadow-lg shadow-primary-500/25 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send Verification Code
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            )}

            {/* ---------------- STEP 2: OTP ---------------- */}
            {step === 'otp' && (
              <form onSubmit={handleVerify} className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      8-Digit Verification Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('email');
                        setMessage(null);
                      }}
                      className="text-[11px] text-primary-600 dark:text-primary-400 font-medium flex items-center gap-1 hover:underline"
                    >
                      <Edit3 className="w-3 h-3" /> Change Email
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {otpDigits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          inputRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={d}
                        onChange={(e) => handleDigitChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={handlePaste}
                        className={`w-full aspect-square text-center text-xl font-mono font-bold rounded-2xl border outline-none transition-all p-0 ${
                          d
                            ? 'bg-primary-50 dark:bg-primary-950/50 border-primary-500 text-primary-600 dark:text-primary-300'
                            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-primary-500'
                        }`}
                      />
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2.5 text-center">
                    Code sent to <span className="font-semibold text-slate-600 dark:text-slate-300">{verifiedEmail || email}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/50 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500">Didn't receive the code?</span>
                  {canResend ? (
                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      className="text-xs text-primary-600 dark:text-primary-400 font-bold flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Resend
                    </button>
                  ) : (
                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-ping" />
                      Resend in <strong className="text-primary-600 dark:text-primary-400">{resendTimer}s</strong>
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || fullOtp.length < 8}
                  className="w-full py-4 text-sm font-bold bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-2xl shadow-lg shadow-primary-500/25 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Verify and Continue
                </button>
              </form>
            )}

            {/* ---------------- STEP 3: FORM ---------------- */}
            {step === 'form' && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                    Email verified: <span className="font-mono">{verifiedEmail}</span>
                  </p>
                </div>

                {/* Photo */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 border-2 border-primary-500 shrink-0">
                    <img
                      src={photoUrl}
                      alt={form.name || 'Your photo'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.visibility = 'hidden';
                      }}
                    />
                  </div>
                  <div className="text-center sm:text-left flex-1 space-y-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white font-outfit">Profile Photo</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Optional. A clear, recent photo helps classmates find you.
                    </p>
                    <label className="inline-flex cursor-pointer items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading ? 'Uploading...' : 'Upload Photo'}
                      <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Full Name" icon={<User className="w-3.5 h-3.5 text-primary-500" />} required>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => update('name', e.target.value)}
                      required
                      placeholder="e.g. Md. Abdul Karim"
                      className="w-full px-4 py-3 text-base bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                  </Field>

                  <Field label="Student / Alumni ID" icon={<IdCard className="w-3.5 h-3.5 text-indigo-500" />} required>
                    <input
                      type="text"
                      value={form.student_id}
                      onChange={(e) => update('student_id', e.target.value)}
                      required
                      placeholder="e.g. 12345"
                      className="w-full px-4 py-3 text-base font-mono bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                  </Field>

                  <Field label="Mobile Number" icon={<Phone className="w-3.5 h-3.5 text-emerald-500" />}>
                    <input
                      type="tel"
                      value={form.mobile}
                      onChange={(e) => update('mobile', e.target.value)}
                      placeholder="e.g. 01712345678"
                      className="w-full px-4 py-3 text-base bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                  </Field>

                  <Field label="Blood Group" icon={<Droplet className="w-3.5 h-3.5 text-rose-500" />}>
                    <select
                      value={form.blood}
                      onChange={(e) => update('blood', e.target.value)}
                      className="w-full px-4 py-3 text-base bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 text-slate-900 dark:text-white"
                    >
                      <option value="">Select Blood Group</option>
                      {BLOOD_GROUPS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Current Designation" icon={<User className="w-3.5 h-3.5 text-slate-400" />}>
                    <input
                      type="text"
                      value={form.designation}
                      onChange={(e) => update('designation', e.target.value)}
                      placeholder="e.g. Software Engineer"
                      className="w-full px-4 py-3 text-base bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                  </Field>

                  <Field label="Organization" icon={<Building2 className="w-3.5 h-3.5 text-indigo-500" />}>
                    <input
                      type="text"
                      value={form.organization}
                      onChange={(e) => update('organization', e.target.value)}
                      placeholder="e.g. ACME Ltd."
                      className="w-full px-4 py-3 text-base bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                  </Field>

                  <div className="sm:col-span-2">
                    <Field label="Current Location" icon={<MapPin className="w-3.5 h-3.5 text-rose-500" />}>
                      <input
                        type="text"
                        value={form.location}
                        onChange={(e) => update('location', e.target.value)}
                        placeholder="e.g. Dhaka, Bangladesh"
                        className="w-full px-4 py-3 text-base bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 text-slate-900 dark:text-white placeholder-slate-400"
                      />
                    </Field>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    Your profile will be reviewed by an administrator. You will not appear in
                    the public directory until your application is approved.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setStep('otp')}
                    className="sm:w-auto w-full py-3.5 px-5 text-xs font-bold rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3.5 px-6 text-sm font-bold bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-2xl shadow-lg shadow-primary-500/25 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Submit Application
                  </button>
                </div>
              </form>
            )}

            {/* ---------------- STEP 4: DONE ---------------- */}
            {step === 'done' && (
              <div className="text-center space-y-5 py-4">
                <div
                  className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
                    message?.type === 'success'
                      ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                      : message?.type === 'info'
                        ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                        : 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {message?.type === 'success' ? (
                    <CheckCircle2 className="w-8 h-8" />
                  ) : message?.type === 'info' ? (
                    <Clock className="w-8 h-8" />
                  ) : (
                    <XCircle className="w-8 h-8" />
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold font-outfit text-slate-900 dark:text-white">
                    {message?.type === 'success' ? 'Application Submitted' : 'Application Status'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                    {message?.text}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-left space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">What happens next</p>
                  <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside">
                    <li>An administrator reviews your submitted details.</li>
                    <li>Once approved, your profile appears in the public directory.</li>
                    <li>You can then sign in with your verified email to update your record.</li>
                  </ol>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Link
                    to="/directory"
                    className="py-3 px-6 text-xs font-bold rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Browse Directory
                  </Link>
                  <Link
                    to="/"
                    className="py-3 px-6 text-xs font-bold rounded-2xl bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/25 transition-colors"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Trust footer */}
          <div className="px-6 sm:px-8 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Email verification secured by Supabase Auth</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  icon?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, icon, required, children }) => (
  <div>
    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
      {icon}
      {label}
      {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
  </div>
);

export default JoinArchivePage;