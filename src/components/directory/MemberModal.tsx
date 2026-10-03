import React, { useRef, useEffect, useState } from 'react';
import html2canvas from 'html2canvas';
import { Member } from '../../types';
import { usePhotoUrl, getDefaultAvatar } from '../../lib/r2';
import { deriveSeriesAndBatch } from '../../lib/seriesBatch';
import { trackMemberView } from '../../lib/storage';
import { isCanvasSafeImage } from '../../lib/canvasImage';
import { Download, X, Loader2, Info } from 'lucide-react';

interface MemberModalProps {
  member: Member | null;
  onClose: () => void;
}

export const MemberModal: React.FC<MemberModalProps> = ({ member, onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { url: photoUrl, loading: photoLoading } = usePhotoUrl(member?.photo_url || member?.photo_key);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      trackMemberView(member.id, member.name);
    }
    setImgLoaded(false);
    setSaving(false);
    setNotice(null);
  }, [member]);

  if (!member) return null;

  const { series, batch } = deriveSeriesAndBatch(member.student_id);
  const defaultAvatar = getDefaultAvatar(undefined, member.name);

  const handleSaveCard = async () => {
    if (!cardRef.current) return;
    try {
      setSaving(true);

      // The R2 bucket sends no CORS headers, so drawing the photo taints the
      // canvas and toDataURL() throws a SecurityError. Probe first and export
      // without the photo rather than failing the whole download.
      const photoIsSafe = await isCanvasSafeImage(photoUrl || '');
      const imgEl = cardRef.current.querySelector('img');
      const originalSrc = imgEl?.getAttribute('src');

      if (!photoIsSafe && originalSrc) {
        imgEl?.removeAttribute('src');
      }

      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#070c1a',
        useCORS: true,
        allowTaint: false,
        scale: 2,
      });

      if (!photoIsSafe && originalSrc) {
        imgEl?.setAttribute('src', originalSrc);
      }

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `alumni_card_${member.student_id || member.id}.png`;
      link.href = dataUrl;
      link.click();

      setNotice(
        photoIsSafe
          ? null
          : 'Card saved without the photo. Add CORS to the R2 bucket to include it.'
      );
    } catch (err) {
      console.error('Save card error:', err);
      setNotice('Could not save the card. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="min-h-full flex flex-col items-center justify-center my-auto">
        
        {/* Outer Wrapper with Action Buttons */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 max-w-2xl w-full justify-center py-6">
          
          {/* Main Member ID Card */}
          <div 
            ref={cardRef}
            className="w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#0f1d38] via-[#091124] to-[#060a17] border border-[#1d2d4d] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 relative text-white font-sans"
          >
            {/* Avatar Container */}
            <div className="flex flex-col items-center text-center space-y-3 pt-2">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-cyan-500/40 via-blue-500/40 to-indigo-500/40 shadow-xl flex items-center justify-center overflow-hidden">
                {(photoLoading || !imgLoaded) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm z-10 rounded-full">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  </div>
                )}
                <img
                  src={photoUrl || defaultAvatar}
                  alt={member.name}
                  className="w-full h-full rounded-full object-cover border-2 border-white/90 shadow-inner"
                  onLoad={() => setImgLoaded(true)}
                  onError={(e) => {
                    setImgLoaded(true);
                    (e.target as HTMLImageElement).src = defaultAvatar;
                  }}
                />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold font-outfit text-white tracking-tight">
                  {member.name}
                </h2>
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {member.designation || 'Alumni Member'}
                </p>
                <p className="text-xs text-slate-400">
                  {member.organization || 'Dhaka University of Engineering and Technology, Gazipur'}
                </p>
              </div>

              {/* Pill Badges Row */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1 text-[11px] font-semibold">
                {member.student_id && (
                  <span className="px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono">
                    ID {member.student_id}
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 font-mono">
                  {series}
                </span>
                <span className="px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                  {batch}
                </span>
                <span className="px-2.5 py-1 rounded-lg border border-slate-600 bg-slate-800/60 text-slate-300">
                  Alumni
                </span>
              </div>
            </div>

            {/* Details Inner Box */}
            <div className="bg-[#050a14]/90 border border-[#1b2a47] rounded-2xl p-4 divide-y divide-[#15233e] text-xs">
              
              {member.student_id && (
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">STUDENT ID</span>
                  <span className="font-mono font-bold text-slate-100 truncate">{member.student_id}</span>
                </div>
              )}

              <div className="py-2.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">SERIES / BATCH</span>
                <span className="font-semibold text-slate-100 truncate">{series} &middot; {batch}</span>
              </div>

              {member.mobile && (
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">MOBILE</span>
                  <a href={`tel:${member.mobile}`} className="font-mono font-bold text-slate-100 hover:text-cyan-400 transition-colors truncate">
                    {member.mobile}
                  </a>
                </div>
              )}

              {member.email && (
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">EMAIL</span>
                  <a href={`mailto:${member.email}`} className="font-medium text-cyan-400 hover:underline truncate max-w-[180px] sm:max-w-[220px]">
                    {member.email}
                  </a>
                </div>
              )}

              {member.organization && (
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">ORGANIZATION</span>
                  <span className="font-semibold text-slate-100 truncate max-w-[180px] sm:max-w-[220px] text-right">{member.organization}</span>
                </div>
              )}

              {member.location && (
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">LOCATION</span>
                  <span className="font-semibold text-slate-100 truncate max-w-[180px] sm:max-w-[220px] text-right">{member.location}</span>
                </div>
              )}

              {member.blood && (
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">BLOOD GROUP</span>
                  <span className="font-extrabold text-rose-400">{member.blood}</span>
                </div>
              )}

            </div>

            {/* Footer Subtext */}
            <div className="text-center pt-1 border-t border-[#121f38]">
              <p className="text-[9px] font-extrabold tracking-widest text-slate-400 uppercase">
                DHAKA UNIVERSITY OF ENGINEERING AND TECHNOLOGY, GAZIPUR
              </p>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex md:flex-col gap-2.5 w-full max-w-sm md:w-auto shrink-0 justify-center">
            <button
              onClick={handleSaveCard}
              disabled={saving}
              className="flex-1 md:flex-initial md:w-full md:w-40 h-11 md:h-auto md:py-3 px-4 rounded-2xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {saving ? 'Saving' : 'Save Card'}
            </button>

            <button
              onClick={onClose}
              className="flex-1 md:flex-initial md:w-full md:w-40 h-11 md:h-auto md:py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <X className="w-4 h-4" />
              Close
            </button>

            {notice && (
              <p className="md:w-56 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-2.5 py-2">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                <span className="min-w-0">{notice}</span>
              </p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
