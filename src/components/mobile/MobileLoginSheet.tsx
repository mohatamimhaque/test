/**
 * Mobile sign-in sheet.
 *
 * Same two-step passwordless OTP flow and the same `sendOtp` / `verifyOtp`
 * calls as the desktop `LoginModal`, presented as a bottom sheet with a
 * comfortable keypad-friendly layout.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mail, ArrowRight, Loader2, RefreshCw, ShieldCheck, AlertCircle, CheckCircle2, Edit3, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Sheet } from './MobilePrimitives';

interface MobileLoginSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * One OTP input cell.
 *
 * Hoisted out of `MobileLoginSheet` on purpose. When this was declared inside
 * the component body it became a NEW component type on every render, so React
 * unmounted and remounted all eight inputs each time — including once a second
 * while the resend countdown ticked. That destroyed the typed digits and threw
 * away keyboard focus mid-entry. Declaring it at module scope keeps its identity
 * stable across renders.
 */
const DigitCell: React.FC<{
  index: number;
  value: string;
  registerRef: (index: number, el: HTMLInputElement | null) => void;
  onChange: (index: number, value: string) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}> = ({ index, value, registerRef, onChange, onKeyDown, onPaste }) => (
  <input
    ref={(el) => registerRef(index, el)}
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    maxLength={1}
    value={value}
    onChange={(e) => onChange(index, e.target.value)}
    onKeyDown={(e) => onKeyDown(index, e)}
    onPaste={onPaste}
    aria-label={`Digit ${index + 1}`}
    className={`w-full h-[60px] text-center text-2xl font-mono font-bold rounded-2xl border-2 outline-none transition-all p-0 ${
      value
        ? 'bg-primary-50 dark:bg-primary-950/60 border-primary-500 text-primary-600 dark:text-primary-300 shadow-[0_0_0_3px_rgba(12,142,233,0.12)]'
        : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-primary-500'
    }`}
  />
);

export const MobileLoginSheet: React.FC<MobileLoginSheetProps> = ({ isOpen, onClose }) => {
  const { sendOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(8).fill(''));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Stable callbacks so the cells never re-render more than they must.
  const registerRef = useCallback((index: number, el: HTMLInputElement | null) => {
    inputRefs.current[index] = el;
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (step === 'otp' && resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, resendTimer]);

  // Reset to a clean state whenever the sheet is opened.
  useEffect(() => {
    if (isOpen) {
      setStep('email');
      setOtpDigits(Array(8).fill(''));
      setMessage(null);
      setResendTimer(30);
      setCanResend(false);
    }
  }, [isOpen]);

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

    const res = await sendOtp(email);
    setLoading(false);

    if (res.success) {
      setStep('otp');
      setOtpDigits(Array(8).fill(''));
      setResendTimer(30);
      setCanResend(false);
      setMessage({
        type: 'success',
        text: res.message || '8-digit OTP code sent! Please check your email inbox.',
      });
      setTimeout(() => inputRefs.current[0]?.focus(), 180);
    } else {
      setMessage({ type: 'error', text: res.message || 'Failed to send OTP code. Please try again.' });
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/[^0-9]/g, '');
    if (!cleanVal) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      return;
    }

    if (cleanVal.length > 1) {
      const digits = cleanVal.slice(0, 8).split('');
      const next = [...otpDigits];
      digits.forEach((d, i) => {
        if (i < 8) next[i] = d;
      });
      setOtpDigits(next);
      // Advance to the first EMPTY cell, not the last one written.
      // Math.min(7, digits.length) landed on the final filled digit.
      const nextEmpty = next.findIndex((d) => d === '');
      inputRefs.current[nextEmpty === -1 ? 7 : nextEmpty]?.focus();
      return;
    }

    const next = [...otpDigits];
    next[index] = cleanVal;
    setOtpDigits(next);
    if (index < 7 && cleanVal) inputRefs.current[index + 1]?.focus();
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
    // Same off-by-one as above: land on the first empty cell.
    const nextEmpty = next.findIndex((d) => d === '');
    inputRefs.current[nextEmpty === -1 ? 7 : nextEmpty]?.focus();
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
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={step === 'email' ? 'Welcome Back' : 'Verify Passcode'}
      subtitle={
        step === 'email'
          ? 'Enter your email to receive an instant 8-digit login code.'
          : `Enter the 8-digit code sent to ${email}`
      }
    >
      <div className="space-y-5 pb-2">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {(['email', 'otp'] as const).map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    step === s ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    step === s ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'
                  }`}
                >
                  {s === 'email' ? 'Email' : 'OTP Code'}
                </span>
              </div>
              {i === 0 && <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />}
            </React.Fragment>
          ))}
        </div>

        {message && (
          <div
            className={`p-3 rounded-2xl text-xs font-medium flex items-start gap-2 ${
              message.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            }`}
          >
            {message.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wide">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. name@email.com"
                  required
                  autoComplete="email"
                  className="m-input pl-11"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Secure
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                <KeyRound className="w-3 h-3 text-indigo-500" /> No password
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="m-tap w-full py-4 text-xs font-bold uppercase text-white bg-primary-600 active:bg-primary-700 rounded-2xl shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Sending Code...
                </>
              ) : (
                <>
                  Send 8-Digit OTP Code <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                  8-Digit Code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setMessage(null);
                  }}
                  className="text-[11px] text-primary-600 dark:text-primary-400 font-medium flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Change Email
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <DigitCell
                    key={i}
                    index={i}
                    value={otpDigits[i]}
                    registerRef={registerRef}
                    onChange={handleDigitChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/50 px-3.5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700">
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
                  <strong className="text-primary-600 dark:text-primary-400">{resendTimer}s</strong>
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || fullOtp.length < 8}
              className="m-tap w-full py-4 text-xs font-bold uppercase text-white bg-primary-600 active:bg-primary-700 rounded-2xl shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                </>
              ) : (
                'Verify and Sign In'
              )}
            </button>
          </form>
        )}
      </div>
    </Sheet>
  );
};