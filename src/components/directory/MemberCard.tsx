import React, { useState } from 'react';
import { Member } from '../../types';
import { usePhotoUrl, getDefaultAvatar } from '../../lib/r2';
import { Building2, MapPin, Mail, Phone, Droplet, User, IdCard, Loader2 } from 'lucide-react';

interface MemberCardProps {
  member: Member;
  layout?: 'grid' | 'list';
  onSelect: (member: Member) => void;
}

export const MemberCard: React.FC<MemberCardProps> = ({ member, layout = 'grid', onSelect }) => {
  const { url: photoUrl, loading: photoLoading } = usePhotoUrl(member.photo_url || member.photo_key);
  const [imgLoaded, setImgLoaded] = useState(false);
  const defaultAvatar = getDefaultAvatar(undefined, member.name);

  if (layout === 'list') {
    return (
      <div 
        onClick={() => onSelect(member)}
        className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4 hover:shadow-lg hover:border-primary-500/40 transition-all duration-200"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 group-hover:scale-105 transition-transform duration-200 flex items-center justify-center">
            {(photoLoading || !imgLoaded) && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 z-10">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            )}
            <img 
              src={photoUrl || defaultAvatar} 
              alt={member.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={(e) => {
                setImgLoaded(true);
                (e.target as HTMLImageElement).src = defaultAvatar;
              }}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate font-outfit group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {member.name}
              </h3>
              {member.blood && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shrink-0">
                  {member.blood}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {[member.designation, member.organization].filter(Boolean).join(' at ') || 'CSE Alumni'}
            </p>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
              {member.student_id && (
                <span className="flex items-center gap-1 font-mono">
                  <IdCard className="w-3 h-3 text-slate-400" />
                  {member.student_id}
                </span>
              )}
              {member.location && (
                <span className="flex items-center gap-1 truncate max-w-[150px]">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {member.location}
                </span>
              )}
            </div>
          </div>
        </div>

        <button className="hidden sm:inline-flex px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-primary-600 group-hover:text-white transition-colors shrink-0">
          View Profile
        </button>
      </div>
    );
  }

  return (
    <div 
      onClick={() => onSelect(member)}
      className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/90 rounded-2xl overflow-hidden hover:shadow-xl hover:border-primary-500/40 transition-all duration-300 flex flex-col"
    >
      {/* Photo Header Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
        {(photoLoading || !imgLoaded) && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm z-10">
            <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
          </div>
        )}
        <img 
          src={photoUrl || defaultAvatar} 
          alt={member.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={(e) => {
            setImgLoaded(true);
            (e.target as HTMLImageElement).src = defaultAvatar;
          }}
        />
        
        {/* Overlay Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          {member.student_id ? (
            <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white font-mono text-[11px] font-semibold border border-white/10 shadow-sm">
              ID: {member.student_id}
            </span>
          ) : <span />}

          {member.blood && (
            <span className="px-2.5 py-1 rounded-lg bg-rose-600/90 backdrop-blur-md text-white text-[11px] font-extrabold shadow-sm flex items-center gap-1">
              <Droplet className="w-3 h-3 fill-current" />
              {member.blood}
            </span>
          )}
        </div>
      </div>

      {/* Content Details */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
            {member.name}
          </h3>

          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 line-clamp-1">
            {member.designation || 'Alumni Member'}
          </p>

          {member.organization && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-1">
              <Building2 className="w-3.5 h-3.5 text-primary-500 shrink-0" />
              <span className="truncate">{member.organization}</span>
            </div>
          )}

          {member.location && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="truncate">{member.location}</span>
            </div>
          )}
        </div>

        {/* Footer Contact Preview */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium text-slate-500 dark:text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            View Details &rarr;
          </span>
          
          <div className="flex items-center gap-1">
            {member.mobile && (
              <a 
                href={`tel:${member.mobile}`}
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                title={`Call ${member.mobile}`}
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
            {member.email && (
              <a 
                href={`mailto:${member.email}`}
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                title={`Email ${member.email}`}
              >
                <Mail className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
