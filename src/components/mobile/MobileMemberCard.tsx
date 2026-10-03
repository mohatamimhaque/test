/**
 * Mobile member card.
 *
 * Deliberately denser than the desktop grid card: a circular avatar row with
 * inline contact actions, so far more results fit per screen on a phone.
 */

import React from 'react';
import { Member } from '../../types';
import { usePhotoUrl, getDefaultAvatar } from '../../lib/r2';
import { Building2, MapPin, Phone, Mail, ChevronRight, Droplet, IdCard } from 'lucide-react';
import { Avatar } from './MobilePrimitives';

interface MobileMemberCardProps {
  member: Member;
  onSelect: (member: Member) => void;
}

export const MobileMemberCard: React.FC<MobileMemberCardProps> = ({ member, onSelect }) => {
  const { url: photoUrl, loading: photoLoading } = usePhotoUrl(member.photo_url || member.photo_key);
  const defaultAvatar = getDefaultAvatar(undefined, member.name);

  const roleLine = [member.designation, member.organization].filter(Boolean).join(' \u00b7 ') || 'CSE Alumni';

  return (
    <div
      onClick={() => onSelect(member)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(member);
        }
      }}
      className="m-card m-tap p-3 flex items-center gap-3 active:bg-slate-50 dark:active:bg-slate-800/60"
    >
      <Avatar src={photoUrl || defaultAvatar} alt={member.name} loading={photoLoading} size={56} rounded="full" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-outfit truncate flex-1">
            {member.name}
          </h3>
          {member.blood && (
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shrink-0 flex items-center gap-0.5">
              <Droplet className="w-2.5 h-2.5 fill-current" />
              {member.blood}
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{roleLine}</p>

        <div className="flex items-center gap-2.5 text-[10px] text-slate-400 mt-1">
          {member.student_id && (
            <span className="flex items-center gap-1 font-mono shrink-0">
              <IdCard className="w-3 h-3" />
              {member.student_id}
            </span>
          )}
          {member.location && (
            <span className="flex items-center gap-1 truncate min-w-0">
              <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
              <span className="truncate">{member.location}</span>
            </span>
          )}
        </div>
      </div>

      {/* Inline quick actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {member.mobile && (
          <a
            href={`tel:${member.mobile}`}
            onClick={(e) => e.stopPropagation()}
            className="m-tap p-2 rounded-xl text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            aria-label={`Call ${member.name}`}
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
      </div>
    </div>
  );
};

interface MobileMemberTileProps {
  member: Member;
  onSelect: (member: Member) => void;
}

/** Compact horizontal-scroll tile used in the home page "featured" rail. */
export const MobileMemberTile: React.FC<MobileMemberTileProps> = ({ member, onSelect }) => {
  const { url: photoUrl, loading: photoLoading } = usePhotoUrl(member.photo_url || member.photo_key);
  const defaultAvatar = getDefaultAvatar(undefined, member.name);

  return (
    <button
      onClick={() => onSelect(member)}
      className="m-snap-item w-[132px] m-card m-tap p-3 flex flex-col items-center text-center gap-2"
    >
      <Avatar src={photoUrl || defaultAvatar} alt={member.name} loading={photoLoading} size={56} rounded="full" />
      <div className="w-full min-w-0">
        <p className="text-xs font-bold text-slate-900 dark:text-white font-outfit truncate">{member.name}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {member.designation || 'Alumni Member'}
        </p>
        {member.organization && (
          <p className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center justify-center gap-1">
            <Building2 className="w-2.5 h-2.5 text-primary-400 shrink-0" />
            <span className="truncate">{member.organization}</span>
          </p>
        )}
      </div>
    </button>
  );
};

interface MobileMemberRowProps {
  member: Member;
  onSelect: (member: Member) => void;
}

/** Ultra-compact row for "recently added" style lists. */
export const MobileMemberRow: React.FC<MobileMemberRowProps> = ({ member, onSelect }) => {
  const { url: photoUrl, loading: photoLoading } = usePhotoUrl(member.photo_url || member.photo_key);
  const defaultAvatar = getDefaultAvatar(undefined, member.name);

  return (
    <button
      onClick={() => onSelect(member)}
      className="m-tap w-full flex items-center gap-3 py-2.5 text-left"
    >
      <Avatar src={photoUrl || defaultAvatar} alt={member.name} loading={photoLoading} size={40} rounded="full" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{member.name}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
          {[member.designation, member.location].filter(Boolean).join(' \u00b7 ') || 'CSE Alumni'}
        </p>
      </div>
      {member.mobile && (
        <a
          href={`tel:${member.mobile}`}
          onClick={(e) => e.stopPropagation()}
          className="m-tap p-2 rounded-xl text-emerald-500 shrink-0"
          aria-label={`Call ${member.name}`}
        >
          <Phone className="w-4 h-4" />
        </a>
      )}
      {member.email && !member.mobile && (
        <a
          href={`mailto:${member.email}`}
          onClick={(e) => e.stopPropagation()}
          className="m-tap p-2 rounded-xl text-primary-500 shrink-0"
          aria-label={`Email ${member.name}`}
        >
          <Mail className="w-4 h-4" />
        </a>
      )}
    </button>
  );
};