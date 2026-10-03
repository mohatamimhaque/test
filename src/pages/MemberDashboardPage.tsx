import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateMember } from '../lib/storage';
import { usePhotoUrl, processPhotoUpload } from '../lib/r2';
import { User, Upload, Save, Check, Loader2, ShieldCheck, ShieldAlert, Phone, Building2, MapPin, IdCard, Droplet, Eye } from 'lucide-react';

export const MemberDashboardPage: React.FC = () => {
  const { user, member, refreshAuth } = useAuth();
  const navigate = useNavigate();

  const currentMember = member;

  const [formData, setFormData] = useState({
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

  if (!user) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
        <User className="w-12 h-12 text-slate-400 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">Member Portal Access Required</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Please sign in with your registered member email address to access your self-service portal.
        </p>
      </div>
    );
  }

  if (user && !currentMember) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
        <ShieldAlert className="w-14 h-14 text-rose-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">No Alumni Profile Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No registered alumni profile was found for <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{user.email}</span>. Please contact an administrator.
        </p>
      </div>
    );
  }

  const activeM = currentMember!;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Enforces member self-service: update ONLY logged in member's own record!
    updateMember(activeM.id, formData, user.email);
    refreshAuth();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Calculate profile completeness
  const fields = [formData.name, activeM.email, formData.mobile, formData.student_id, formData.blood, formData.designation, formData.organization, formData.location];
  const filledCount = fields.filter(Boolean).length;
  const completeness = Math.round((filledCount / fields.length) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-primary-800 via-slate-900 to-indigo-900 p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary-200 uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Member Self-Service Portal
            </div>
            <h1 className="text-3xl font-extrabold font-outfit">
              {activeM.name || 'Alumni Dashboard'}
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Signed in as <span className="font-semibold text-white">{user.email}</span> (Member ID #{activeM.id})
            </p>
          </div>

          <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-right">
            <div className="text-[10px] font-bold text-slate-300 uppercase">Profile Completeness</div>
            <div className="text-lg font-extrabold font-outfit text-emerald-400">{completeness}%</div>
          </div>
        </div>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
          <Check className="w-4 h-4 text-emerald-500" />
          Your member profile was updated successfully in the CSE Archive!
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-6">
        
        {/* Profile Photo Card */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 border-2 border-primary-500 shadow-md shrink-0">
            <img
              src={photoUrl}
              alt={formData.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';
              }}
            />
          </div>

          <div className="space-y-2 text-center sm:text-left flex-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-outfit">
              Alumni Profile Photo
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload your official photo. High quality PNG or JPG formats supported.
            </p>
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors shadow-sm">
              {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload New Photo
              <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
            </label>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary-500" /> Full Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <IdCard className="w-3.5 h-3.5 text-primary-500" /> Student / Alumni ID
            </label>
            <input
              type="text"
              value={formData.student_id}
              onChange={e => setFormData({ ...formData, student_id: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-500" /> Mobile Phone
            </label>
            <input
              type="text"
              value={formData.mobile}
              onChange={e => setFormData({ ...formData, mobile: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Droplet className="w-3.5 h-3.5 text-rose-500" /> Blood Group
            </label>
            <select
              value={formData.blood}
              onChange={e => setFormData({ ...formData, blood: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white"
            >
              <option value="">Select Blood Group</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Job Designation</label>
            <input
              type="text"
              value={formData.designation}
              onChange={e => setFormData({ ...formData, designation: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" /> Organization / Company
            </label>
            <input
              type="text"
              value={formData.organization}
              onChange={e => setFormData({ ...formData, organization: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500" /> Current Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit"
            className="px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-2xl shadow-lg flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Profile Updates
          </button>
        </div>

      </form>

    </div>
  );
};
