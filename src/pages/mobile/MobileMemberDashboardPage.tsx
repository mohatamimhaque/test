/**
 * Mobile member self-service portal.
 *
 * Same auth guards, same `updateMember(...)` save path and the same R2 photo
 * upload pipeline as the desktop `MemberDashboardPage`; the form is simply
 * rendered as single-column sticky-footer cards.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { updateMember } from '../../lib/storage';
import { usePhotoUrl, processPhotoUpload } from '../../lib/r2';
import {
  User,
  Camera,
  Save,
  Check,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Building2,
  MapPin,
  IdCard,
  Droplet,
  ChevronRight,
  Briefcase,
} from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface FormState {
  name: string;
  mobile: string;
  student_id: string;
  blood: string;
  designation: string;
  organization: string;
  location: string;
  photo_key: string;
  photo_url: string;
}

export const MobileMemberDashboardPage: React.FC = () => {
  const { user, member, refreshAuth } = useAuth();
  const currentMember = member;

  const [formData, setFormData] = useState<FormState>({
    name: currentMember?.name || '',
    mobile: currentMember?.mobile || '',
    student_id: currentMember?.student_id || '',
    blood: currentMember?.blood || '',
    designation: currentMember?.designation || '',
    organization: currentMember?.organization || '',
    location: currentMember?.location || '',
    photo_key: currentMember?.photo_key || '',
    photo_url: currentMember?.photo_url || '',
  });

  useEffect(() => {
    if (currentMember) {
      setFormData({
        name: currentMember.name || '',
        mobile: currentMember.mobile || '',
        student_id: currentMember.student_id || '',
        blood: currentMember.blood || '',
        designation: currentMember.designation || '',
        organization: currentMember.organization || '',
        location: currentMember.location || '',
        photo_key: currentMember.photo_key || '',
        photo_url: currentMember.photo_url || '',
      });
    }
  }, [currentMember]);

  const { url: photoUrl } = usePhotoUrl(formData.photo_url || formData.photo_key);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);
      const res = await processPhotoUpload(file);
      setFormData((prev) => ({ ...prev, photo_key: res.photo_key, photo_url: res.photo_url }));
    } catch (err: any) {
      alert(err.message || 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember || !user) return;
    // Same enforcement as desktop: only the signed-in member's own record.
    updateMember(currentMember.id, formData, user.email);
    refreshAuth();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!user) {
    return (
      <div className="m-safe-x py-10">
        <div className="m-card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
            <User className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">Member Portal Access Required</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Please sign in with your registered member email address to access your self-service portal.
          </p>
          <Link
            to="/"
            className="m-tap inline-flex items-center gap-1 text-xs font-bold text-primary-600 dark:text-primary-400"
          >
            Go to home <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  if (user && !currentMember) {
    return (
      <div className="m-safe-x py-10">
        <div className="m-card p-8 text-center space-y-4">
          <ShieldAlert className="w-14 h-14 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">No Alumni Profile Found</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            No registered alumni profile was found for{' '}
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono break-all">{user.email}</span>.
            Please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  const activeM = currentMember!;

  const fields = [
    formData.name,
    activeM.email,
    formData.mobile,
    formData.student_id,
    formData.blood,
    formData.designation,
    formData.organization,
    formData.location,
  ];
  const completeness = Math.round((fields.filter(Boolean).length / fields.length) * 100);

  const update = (key: keyof FormState, value: string) => setFormData((prev) => ({ ...prev, [key]: value }));

  return (
    <form onSubmit={handleSave} className="pb-4">
      {/* Header card */}
      <div className="m-safe-x">
        <div className="mt-4 rounded-3xl overflow-hidden bg-gradient-to-br from-primary-800 via-slate-900 to-indigo-900 p-5 text-white border border-slate-800 shadow-lg">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary-200 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Member Self-Service Portal
          </div>
          <h1 className="text-xl font-extrabold font-outfit mt-1.5 leading-tight">{activeM.name || 'Alumni Dashboard'}</h1>
          <p className="text-[10px] text-slate-300 mt-1 break-all">
            Member ID #{activeM.id} &middot; {user.email}
          </p>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] mb-1.5">
              <span className="text-slate-300 font-semibold uppercase">Profile Completeness</span>
              <span className="text-emerald-400 font-extrabold">{completeness}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Success toast */}
      {saved && (
        <div className="m-safe-x mt-3">
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            Profile updated successfully.
          </div>
        </div>
      )}

      {/* Photo */}
      <div className="m-safe-x mt-3 space-y-3">
        <div className="m-card p-4 flex items-center gap-4">
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 border-2 border-primary-500 shrink-0">
            <img
              src={photoUrl}
              alt={formData.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.visibility = 'hidden';
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white font-outfit">Profile Photo</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 mb-2 leading-relaxed">
              Upload your official photo. PNG or JPG supported.
            </p>
            <label className="m-tap inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-primary-600 active:bg-primary-700 text-white">
              {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
              <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Fields — single column with 16px inputs to avoid iOS zoom */}
      <div className="m-safe-x mt-3 space-y-3">
        <Field
          label="Full Name"
          icon={<User className="w-3.5 h-3.5 text-primary-500" />}
          required
        >
          <input
            type="text"
            value={formData.name}
            onChange={(e) => update('name', e.target.value)}
            required
            className="m-input font-bold"
          />
        </Field>

        <Field label="Student / Alumni ID" icon={<IdCard className="w-3.5 h-3.5 text-indigo-500" />}>
          <input
            type="text"
            inputMode="numeric"
            value={formData.student_id}
            onChange={(e) => update('student_id', e.target.value)}
            className="m-input font-mono"
          />
        </Field>

        <Field label="Mobile Phone" icon={<Phone className="w-3.5 h-3.5 text-emerald-500" />}>
          <input
            type="tel"
            inputMode="tel"
            value={formData.mobile}
            onChange={(e) => update('mobile', e.target.value)}
            className="m-input"
          />
        </Field>

        <Field label="Blood Group" icon={<Droplet className="w-3.5 h-3.5 text-rose-500" />}>
          <div className="flex flex-wrap gap-1.5">
            {BLOOD_GROUPS.map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => update('blood', formData.blood === bg ? '' : bg)}
                className={`m-tap px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  formData.blood === bg
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Job Designation" icon={<Briefcase className="w-3.5 h-3.5 text-slate-400" />}>
          <input
            type="text"
            value={formData.designation}
            onChange={(e) => update('designation', e.target.value)}
            placeholder="e.g. Software Engineer"
            className="m-input"
          />
        </Field>

        <Field label="Organization / Company" icon={<Building2 className="w-3.5 h-3.5 text-indigo-500" />}>
          <input
            type="text"
            value={formData.organization}
            onChange={(e) => update('organization', e.target.value)}
            placeholder="e.g. ACME Ltd."
            className="m-input"
          />
        </Field>

        <Field label="Current Location" icon={<MapPin className="w-3.5 h-3.5 text-rose-500" />}>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder="e.g. Dhaka, Bangladesh"
            className="m-input"
          />
        </Field>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 mt-5 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-4 py-3">
        <button
          type="submit"
          disabled={saving}
          className="m-tap w-full py-4 bg-primary-600 active:bg-primary-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Profile Updates
        </button>
      </div>
    </form>
  );
};

interface FieldProps {
  label: string;
  icon?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, icon, required, children }) => (
  <div className="m-card p-4">
    <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-2">
      {icon}
      {label}
      {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
  </div>
);