import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mail, KeyRound, UserCheck, ArrowRight, Loader2, RefreshCw, Lock, Sparkles, ShieldCheck, CheckCircle2, AlertCircle, UserPlus, Edit3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(8).fill(''));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let interval: any;
    if (step === 'otp' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  if (!isOpen) return null;

  const fullOtp = otpDigits.join('');

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await sendOtp(email, { isLogin: true });
    setLoading(false);

    if (res.success) {
      setStep('otp');
      setOtpDigits(Array(8).fill(''));
      setResendTimer(30);
      setCanResend(false);
      setMessage({ type: 'success', text: res.message || '8-digit OTP code sent! Please check your email inbox.' });
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    } else {
      setMessage({ type: 'error', text: res.message || 'Failed to send OTP code. Please try again.' });
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullOtp.length < 8) {
      setMessage({ type: 'error', text: 'Please enter all 8 digits of the verification code.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await verifyOtp(email, fullOtp);
    setLoading(false);

    if (res.success) {
      onClose();
    } else {
      setMessage({ type: 'error', text: res.message || 'Invalid 8-digit OTP code. Please check and retry.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      
      {/* Modal Container */}
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border border-slate-700/60 rounded-3xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9),0_0_50px_rgba(79,70,229,0.18)] overflow-hidden relative text-white backdrop-blur-2xl transition-all duration-300">
        
        {/* Ambient Radial Glowing Orbs */}
        <div className="absolute -top-24 -left-24 w-56 h-56 bg-primary-500/25 blur-[90px] pointer-events-none rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-56 h-56 bg-indigo-500/25 blur-[90px] pointer-events-none rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 blur-[100px] pointer-events-none rounded-full" />

        {/* Modal Top Header Bar */}
        <div className="p-6 pb-4 border-b border-slate-800/80 relative z-10">
          <div className="flex items-center justify-between">
            {/* Left Badge Header */}
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 via-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-primary-500/25 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950/40 backdrop-blur-sm rounded-[14px] flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-primary-300" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-[11px] font-semibold text-slate-300 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="tracking-wide">Passwordless Auth</span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60 transition-all duration-200 active:scale-95"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-2xl font-bold font-outfit text-white tracking-tight mt-4">
            {step === 'email' ? 'Welcome Back' : 'Verify Passcode'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {step === 'email'
              ? 'Enter your email to receive an instant 8-digit login code.'
              : `Enter the 8-digit verification passcode sent to ${email}`}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 relative z-10">

          {/* Stepper Progress Bar */}
          <div className="relative flex items-center justify-between px-2">
            {/* Step Line */}
            <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-slate-800 -translate-y-1/2 z-0">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 transition-all duration-300"
                style={{ width: step === 'otp' ? '100%' : '0%' }}
              />
            </div>

            {/* Step 1 Circle */}
            <div className="relative z-10 flex items-center gap-2 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step === 'otp'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-gradient-to-r from-primary-500 to-indigo-600 text-white shadow-md shadow-primary-500/30'
                }`}
              >
                {step === 'otp' ? <CheckCircle2 className="w-4 h-4" /> : '1'}
              </div>
              <span
                className={`text-xs font-semibold ${
                  step === 'email' ? 'text-primary-300' : 'text-slate-400'
                }`}
              >
                Email
              </span>
            </div>

            {/* Step 2 Circle */}
            <div className="relative z-10 flex items-center gap-2 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step === 'otp'
                    ? 'bg-gradient-to-r from-primary-500 to-indigo-600 text-white shadow-md shadow-primary-500/30'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                2
              </div>
              <span
                className={`text-xs font-semibold ${
                  step === 'otp' ? 'text-primary-300' : 'text-slate-500'
                }`}
              >
                OTP Code
              </span>
            </div>
          </div>

          {/* Feedback Toast Banner */}
          {message && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-medium flex flex-col gap-2.5 shadow-lg animate-in slide-in-from-top-2 duration-200 ${
                message.type === 'error'
                  ? 'bg-rose-950/70 text-rose-200 border border-rose-800/80 shadow-rose-950/30'
                  : 'bg-emerald-950/70 text-emerald-200 border border-emerald-800/80 shadow-emerald-950/30'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {message.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="leading-snug">{message.text}</div>
              </div>

              {message.type === 'error' && (message.text.includes('Join Application') || message.text.includes('No registered alumni')) && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/join');
                  }}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-bold rounded-xl text-[11px] transition-colors flex items-center justify-center gap-1.5 self-start mt-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Fill Out Join Application Form
                </button>
              )}
            </div>
          )}

          {/* STEP 1: EMAIL INPUT FORM */}
          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 tracking-wide uppercase text-[10px]">
                  Registered Email Address
                </label>
                <div className="relative group">
                  <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-400 transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. mohatamimhaque@outlook.com"
                    required
                    className="w-full pl-11 pr-4 py-3.5 text-sm bg-slate-800/70 border border-slate-700/80 rounded-2xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 text-white placeholder-slate-500 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Helper Tag Pills */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/40 px-2.5 py-1 rounded-lg border border-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Secure & Instant</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/40 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>No Password Needed</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-4 text-xs font-bold tracking-wide uppercase text-white bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 hover:from-primary-500 hover:via-indigo-500 hover:to-purple-500 active:scale-[0.98] rounded-2xl shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send 8-Digit OTP Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: 8-DIGIT OTP INPUT FORM */
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <label className="block text-xs font-semibold text-slate-300 tracking-wide uppercase text-[10px]">
                    8-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setMessage(null);
                    }}
                    className="text-[11px] text-primary-400 hover:text-primary-300 font-medium hover:underline flex items-center gap-1 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Change Email</span>
                  </button>
                </div>

                {/* 8-Digit Grid Input Box Layout (4 + 4) */}
                <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                  {/* First 4 Digits */}
                  <div className="flex gap-1.5 sm:gap-2 flex-1">
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
                        className={`w-full aspect-square text-center text-lg sm:text-xl font-mono font-bold rounded-xl border transition-all shadow-inner focus:outline-none ${
                          otpDigits[idx]
                            ? 'bg-primary-950/40 border-primary-500 text-primary-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                            : 'bg-slate-800/70 border-slate-700/80 text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Middle Separator */}
                  <div className="flex items-center justify-center px-1">
                    <span className="w-2 h-0.5 bg-slate-600 rounded-full" />
                  </div>

                  {/* Second 4 Digits */}
                  <div className="flex gap-1.5 sm:gap-2 flex-1">
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
                        className={`w-full aspect-square text-center text-lg sm:text-xl font-mono font-bold rounded-xl border transition-all shadow-inner focus:outline-none ${
                          otpDigits[idx]
                            ? 'bg-primary-950/40 border-primary-500 text-primary-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                            : 'bg-slate-800/70 border-slate-700/80 text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Resend Code & Timer Row */}
              <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-800/30 px-3.5 py-2.5 rounded-2xl border border-slate-800">
                <span className="text-[11px] text-slate-400">Didn't receive the code?</span>
                {canResend ? (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    className="text-xs text-primary-300 font-bold hover:text-primary-200 hover:underline flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-primary-400" />
                    <span>Resend Code</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-ping" />
                    <span>Resend in <strong className="text-primary-300">{resendTimer}s</strong></span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || fullOtp.length < 8}
                className="w-full py-4 px-4 text-xs font-bold tracking-wide uppercase text-white bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 hover:from-primary-500 hover:via-indigo-500 hover:to-purple-500 active:scale-[0.98] rounded-2xl shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Verify Passcode & Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Security Trust Footer */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>End-to-End Encrypted Supabase Passcode Auth</span>
          </div>

        </div>
      </div>
    </div>
  );
};

