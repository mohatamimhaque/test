/**
 * Mobile member profile detail sheet.
 *
 * Mirrors `MemberModal` (same fields, same "Save Card" image export, same
 * `trackMemberView` analytics) but is presented as a drag-up bottom sheet.
 */

import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Member } from '../../types';
import { usePhotoUrl, getDefaultAvatar } from '../../lib/r2';
import { deriveSeriesAndBatch } from '../../lib/seriesBatch';
import { trackMemberView } from '../../lib/storage';
import { Sheet } from './MobilePrimitives';
import { isCanvasSafeImage } from '../../lib/canvasImage';
import { Download, Phone, Mail, MapPin, Building2, IdCard, Droplet, Loader2, Info } from 'lucide-react';

interface MobileMemberSheetProps {
  member: Member | null;
  onClose: () => void;
}

interface DetailRowProps {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  accent?: string;
  href?: string;
  mono?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, icon, accent = 'text-slate-400', href, mono }) => {
  if (!value) return null;

  const body = (
    <>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1.5">
        {icon && <span className={accent}>{icon}</span>}
        {label}
      </span>
      <span
        className={`text-xs font-semibold text-slate-800 dark:text-slate-100 text-right min-w-0 truncate ${
          mono ? 'font-mono' : ''
        } ${href ? 'text-primary-600 dark:text-primary-400' : ''}`}
      >
        {value}
      </span>
    </>
  );

  const className = 'flex items-center justify-between gap-3 py-2.5';

  return href ? (
    <a href={href} className={`${className} active:opacity-60`}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
};

export const MobileMemberSheet: React.FC<MobileMemberSheetProps> = ({ member, onClose }) => {
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

      // Without CORS on the bucket the photo taints the canvas and
      // toDataURL() throws. Probe first, and drop the photo from the export
      // rather than failing the whole download.
      const photoIsSafe = await isCanvasSafeImage(photoUrl || '');
      const originalSrc = cardRef.current
        ?.querySelector('img')
        ?.getAttribute('src');

      if (!photoIsSafe && originalSrc) {
        cardRef.current.querySelector('img')?.removeAttribute('src');
      }

      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#070c1a',
        useCORS: true,
        // The photo is an R2 presigned URL with no CORS headers, so html2canvas
        // must not try to re-fetch it once the src has been stripped.
        allowTaint: false,
        scale: 2,
      });

      // Restore for the next open.
      if (!photoIsSafe && originalSrc) {
        cardRef.current.querySelector('img')?.setAttribute('src', originalSrc);
      }

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `alumni_card_${member.student_id || member.id}.png`;
      link.href = dataUrl;
      link.click();

      if (!photoIsSafe) {
        setNotice('Card saved without the photo. Add CORS to the R2 bucket to include it.');
      }
    } catch (err) {
      console.error('Save card error:', err);
      setNotice('Could not save the card. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const actions = (
    <div className="grid grid-cols-2 gap-2.5">
      <button
        onClick={handleSaveCard}
        disabled={saving}
        className="m-tap flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary-600 active:bg-primary-700 text-white text-xs font-bold shadow-lg shadow-primary-500/20 disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Save Card
      </button>

      {member.mobile ? (
        <a
          href={`tel:${member.mobile}`}
          className="m-tap flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 active:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20"
        >
          <Phone className="w-4 h-4" />
          Call
        </a>
      ) : (
        <button
          onClick={onClose}
          className="m-tap flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold"
        >
          Close
        </button>
      )}
    </div>
  );

  return (
    <Sheet
      open={Boolean(member)}
      onClose={onClose}
      title="Member Profile"
      subtitle={member.student_id ? `ID ${member.student_id}` : undefined}
      footer={actions}
    >
      <div
        ref={cardRef}
        className="rounded-3xl p-5 space-y-4 relative text-white font-sans bg-gradient-to-b from-[#0f1d38] via-[#091124] to-[#060a17] border border-[#1d2d4d] shadow-2xl"
      >
        {/* Identity */}
        <div className="flex flex-col items-center text-center space-y-2.5 pt-1">
          <div className="relative w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-cyan-500/40 via-blue-500/40 to-indigo-500/40 flex items-center justify-center overflow-hidden">
            {(photoLoading || !imgLoaded) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#091124] rounded-full">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              </div>
            )}
            <img
              src={photoUrl || defaultAvatar}
              alt={member.name}
              className="w-full h-full rounded-full object-cover border-2 border-white/90"
              onLoad={() => setImgLoaded(true)}
              onError={(e) => {
                setImgLoaded(true);
                (e.target as HTMLImageElement).src = defaultAvatar;
              }}
            />
          </div>

          <div>
            <h3 className="text-lg font-bold font-outfit text-white leading-tight">{member.name}</h3>
            <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mt-1">
              {member.designation || 'Alumni Member'}
            </p>
            {member.organization && (
              <p className="text-[11px] text-slate-400 mt-0.5">{member.organization}</p>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {member.student_id && (
              <span className="px-2 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] font-mono">
                ID {member.student_id}
              </span>
            )}
            <span className="px-2 py-1 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 text-[10px] font-mono">
              {series}
            </span>
            <span className="px-2 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[10px] font-mono">
              {batch}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="bg-[#050a14]/90 border border-[#1b2a47] rounded-2xl px-4 divide-y divide-[#15233e]">
          <DetailRow
            label="Student ID"
            value={member.student_id}
            icon={<IdCard className="w-3 h-3" />}
            accent="text-amber-400"
            mono
          />
          <DetailRow label="Series / Batch" value={`${series} \u00b7 ${batch}`} />
          <DetailRow
            label="Mobile"
            value={member.mobile}
            icon={<Phone className="w-3 h-3" />}
            accent="text-emerald-400"
            href={member.mobile ? `tel:${member.mobile}` : undefined}
            mono
          />
          <DetailRow
            label="Email"
            value={member.email}
            icon={<Mail className="w-3 h-3" />}
            accent="text-cyan-400"
            href={member.email ? `mailto:${member.email}` : undefined}
          />
          <DetailRow
            label="Organization"
            value={member.organization}
            icon={<Building2 className="w-3 h-3" />}
            accent="text-indigo-400"
          />
          <DetailRow
            label="Location"
            value={member.location}
            icon={<MapPin className="w-3 h-3" />}
            accent="text-rose-400"
          />
          <DetailRow
            label="Blood Group"
            value={member.blood}
            icon={<Droplet className="w-3 h-3" />}
            accent="text-rose-400"
          />
        </div>
      </div>

      {notice && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5">
          <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300 min-w-0">{notice}</p>
        </div>
      )}
    </Sheet>
  );
};