import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSiteSettings, submitJoinRequest, submitJoinRequestToSupabase } from '../lib/storage';
import { processPhotoUpload, getPhotoUrl } from '../lib/r2';
import { useAuth } from '../context/AuthContext';
import { 
  UserPlus, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  ShieldAlert, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  ShieldCheck, 
  RefreshCw 
} from 'lucide-react';

export const JoinPage: React.FC = () => {
  const settings = getSiteSettings();
  const navigate = useNavigate();
  const { user, member, sendOtp, verifyOtp } = useAuth();

  // Verification & Form state
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationStep, setVerificationStep] = useState<'email' | 'otp'>('email');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(8).fill(''));
  const [verifyingLoading, setVerifyingLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [submitted, setSubmitted] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formData, setFormData] = useState({
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
  });

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let interval: any;
    if (verificationStep === 'otp' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [verificationStep, resendTimer]);

  if (!settings.join_enabled) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">Join System Currently Disabled</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The CSE Archive self-registration portal has been temporarily disabled by administrators.
        </p>
      </div>
    );
  }

  if (user && member) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
        <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">Already Registered Member</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          You are currently signed in as registered alumni member <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{user.email}</span>. You do not need to submit another join application.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/member-dashboard')}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
          >
            Go to Member Portal
          </button>
          <button
            onClick={() => navigate('/directory')}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Browse Member Directory
          </button>
        </div>
      </div>
    );
  }

  const handleSendVerificationOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.email || !formData.email.includes('@')) {
      setVerifyMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setVerifyingLoading(true);
    setVerifyMessage(null);

    const res = await sendOtp(formData.email, { isLogin: false });
    setVerifyingLoading(false);

    if (res.success) {
      setVerificationStep('otp');
      setOtpDigits(Array(8).fill(''));
      setResendTimer(30);
      setCanResend(false);
      setVerifyMessage({ type: 'success', text: res.message || '8-digit OTP code sent! Please check your email inbox.' });
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    } else {
      setVerifyMessage({ type: 'error', text: res.message || 'Failed to send OTP.' });
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/[^0-9]/g, '');
    if (!cleanVal) {
      const nextDigits = [...otpDigits];
      nextDigits[index] = '';
      setOtpDigits(nextDigits);
      return;
    }

    if (cleanVal.length > 1) {
      const digits = cleanVal.slice(0, 8).split('');
      const nextDigits = [...otpDigits];
      digits.forEach((d, i) => {
        if (i < 8) nextDigits[i] = d;
      });
      setOtpDigits(nextDigits);
      const nextFocusIndex = Math.min(7, digits.length);
      inputRefs.current[nextFocusIndex]?.focus();
      return;
    }

    const nextDigits = [...otpDigits];
    nextDigits[index] = cleanVal;
    setOtpDigits(nextDigits);

    if (index < 7 && cleanVal) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
    if (!pastedData) return;

    const digits = pastedData.slice(0, 8).split('');
    const nextDigits = Array(8).fill('');
    digits.forEach((d, i) => {
      nextDigits[i] = d;
    });
    setOtpDigits(nextDigits);
    const focusIndex = Math.min(7, digits.length);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerifyOtpCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('');
    if (fullOtp.length < 8) {
      setVerifyMessage({ type: 'error', text: 'Please enter all 8 digits of the OTP code.' });
      return;
    }

    setVerifyingLoading(true);
    setVerifyMessage(null);

    const res = await verifyOtp(formData.email, fullOtp);
    setVerifyingLoading(false);

    if (res.success) {
      setEmailVerified(true);
      setVerifyMessage({ type: 'success', text: 'Email address verified successfully!' });
    } else {
      setVerifyMessage({ type: 'error', text: res.message || 'Invalid 8-digit OTP code.' });
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);
      const res = await processPhotoUpload(file);
      setFormData(prev => ({
        ...prev,
        photo_key: res.photo_key,
        photo_url: res.photo_url,
      }));
    } catch (err: any) {
      alert(err.message || 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailVerified) {
      alert('You must verify your email address via OTP first.');
      return;
    }

    if (!formData.name || !formData.email) {
      alert('Name and Email are required.');
      return;
    }

    try {
      setVerifyingLoading(true);
      await submitJoinRequestToSupabase(formData);
      setSubmitted(true);
    } catch (err: any) {
      alert(err.message || 'Failed to submit application');
    } finally {
      setVerifyingLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">
          Application Submitted Successfully!
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Your join request has been verified and submitted for administrator review. Once approved, your profile will appear on the public directory.
        </p>
        <button
          onClick={() => navigate('/directory')}
          className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
        >
          Return to Member Directory
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
      
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center mx-auto shadow-sm">
          <UserPlus className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">
          Join CSE Archive Directory
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Verify your email address via 8-digit OTP passcode to submit your alumni profile for archive inclusion.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
        
        {/* Step Indicator Header */}
        <div className="flex items-center justify-center gap-4 text-xs font-bold border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className={`flex items-center gap-2 ${emailVerified ? 'text-emerald-500' : 'text-primary-600 dark:text-primary-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${emailVerified ? 'bg-emerald-500' : 'bg-primary-600'}`}>
              {emailVerified ? '✓' : '1'}
            </span>
            <span>Step 1: Email OTP Verification</span>
          </div>

          <span className="text-slate-300 dark:text-slate-700">&rarr;</span>

          <div className={`flex items-center gap-2 ${emailVerified ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${emailVerified ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
              2
            </span>
            <span>Step 2: Profile Details</span>
          </div>
        </div>

        {/* STEP 1: Email OTP Verification Box */}
        {!emailVerified ? (
          <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit">
                  Verify Email Address First
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  We send an 8-digit OTP passcode to your email to prevent spam submissions.
                </p>
              </div>
            </div>

            {verifyMessage && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium ${
                  verifyMessage.type === 'error'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                }`}
              >
                {verifyMessage.text}
              </div>
            )}

            {verificationStep === 'email' ? (
              <form onSubmit={handleSendVerificationOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Enter Your Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. mohatamimhaque@outlook.com"
                      required
                      className="w-full pl-10 pr-4 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={verifyingLoading}
                  className="w-full py-3 px-4 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {verifyingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Send 8-Digit Verification OTP
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtpCode} className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Enter 8-Digit OTP Code sent to <span className="font-bold text-primary-600 dark:text-primary-400">{formData.email}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setVerificationStep('email')}
                      className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Change Email
                    </button>
                  </div>

                  {/* 8 Digit Input Grid */}
                  <div className="flex items-center justify-between gap-1 sm:gap-2">
                    <div className="flex gap-1 sm:gap-2 flex-1 min-w-0">
                      {[0, 1, 2, 3].map((idx) => (
                        <input
                          key={idx}
                          ref={(el) => { inputRefs.current[idx] = el; }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={otpDigits[idx]}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(idx, e)}
                          onPaste={handlePaste}
                          className="w-full aspect-square text-center text-sm sm:text-xl font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white shadow-sm p-0"
                        />
                      ))}
                    </div>

                    <span className="text-slate-400 font-bold text-sm sm:text-lg px-0.5">-</span>

                    <div className="flex gap-1 sm:gap-2 flex-1 min-w-0">
                      {[4, 5, 6, 7].map((idx) => (
                        <input
                          key={idx}
                          ref={(el) => { inputRefs.current[idx] = el; }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={otpDigits[idx]}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(idx, e)}
                          onPaste={handlePaste}
                          className="w-full aspect-square text-center text-sm sm:text-xl font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white shadow-sm p-0"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Didn't receive the code?</span>
                  {canResend ? (
                    <button
                      type="button"
                      onClick={() => handleSendVerificationOtp()}
                      className="text-primary-600 dark:text-primary-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Resend Code
                    </button>
                  ) : (
                    <span className="font-mono text-slate-400">Resend in {resendTimer}s</span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={verifyingLoading || otpDigits.join('').length < 8}
                  className="w-full py-3 px-4 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {verifyingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Verify Email Address & Unlock Form
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Locked Email Verified Banner */
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <div>
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                  Email Address Verified
                </span>
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-mono">
                  {formData.email}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEmailVerified(false);
                setVerificationStep('email');
              }}
              className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold hover:underline"
            >
              Change Email
            </button>
          </div>
        )}

        {/* STEP 2: Main Application Form (Unlocked once email is verified) */}
        <form onSubmit={handleSubmit} className={`space-y-6 ${!emailVerified ? 'opacity-40 pointer-events-none select-none' : ''}`}>
          
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit">
              Step 2: Complete Profile Information
            </h3>
            {!emailVerified && (
              <span className="text-xs text-amber-500 font-semibold flex items-center gap-1">
                🔒 Locked (Verify email above first)
              </span>
            )}
          </div>

          {/* Photo Upload Section */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl flex items-center gap-4 border border-slate-200 dark:border-slate-700">
            <img
              src={getPhotoUrl(formData.photo_url || formData.photo_key)}
              alt="Preview"
              className="w-20 h-20 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Profile Photo
              </label>
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-sm">
                {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Select Photo File
                <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" disabled={!emailVerified} />
              </label>
              <p className="text-[11px] text-slate-400">Supported formats: JPG, PNG, WEBP (Max 5MB)</p>
            </div>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={!emailVerified}
                placeholder="e.g. mohatamim"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Student / Alumni ID</label>
              <input
                type="text"
                value={formData.student_id}
                onChange={e => setFormData({ ...formData, student_id: e.target.value })}
                disabled={!emailVerified}
                placeholder="e.g. 00407"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile Phone</label>
              <input
                type="text"
                value={formData.mobile}
                onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                disabled={!emailVerified}
                placeholder="e.g. 01712000000"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Job Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={e => setFormData({ ...formData, designation: e.target.value })}
                disabled={!emailVerified}
                placeholder="e.g. Software Engineer"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Organization / Company</label>
              <input
                type="text"
                value={formData.organization}
                onChange={e => setFormData({ ...formData, organization: e.target.value })}
                disabled={!emailVerified}
                placeholder="e.g. Tech Corp"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Current Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                disabled={!emailVerified}
                placeholder="e.g. Dhaka, Bangladesh"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Blood Group</label>
              <select
                value={formData.blood}
                onChange={e => setFormData({ ...formData, blood: e.target.value })}
                disabled={!emailVerified}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                <option value="">Select Blood Group</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={!emailVerified}
            className="w-full py-3.5 px-6 font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-2xl shadow-lg transition-colors text-xs disabled:opacity-40"
          >
            Submit Join Application
          </button>
        </form>

      </div>

    </div>
  );
};
