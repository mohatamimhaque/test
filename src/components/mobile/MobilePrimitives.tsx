/**
 * Small presentational primitives shared by the mobile (public) UI.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Rendered as a sticky footer inside the sheet. */
  footer?: React.ReactNode;
}

/**
 * App-style bottom sheet. Locks body scroll, supports Escape to dismiss and
 * blocks backdrop scroll chaining so the page behind never scrolls.
 */
export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, subtitle, children, footer }) => {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  // Rendered through a portal so the sheet always anchors to the viewport.
  // Any ancestor with `backdrop-filter`, `filter`, `transform` or `contain`
  // becomes the containing block for `position: fixed` descendants. The
  // sticky header uses `backdrop-blur-xl`, so a sheet rendered inside it would
  // anchor to the header instead and get pushed off-screen.
  return createPortal(
    <>
      <div className="m-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="m-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 shrink-0">
          <div className="min-w-0">
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-3" />
            {title && (
              <h2 className="text-lg font-bold font-outfit text-slate-900 dark:text-white m-line-1">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 m-line-2">{subtitle}</p>
            )}
          </div>

          <button
            onClick={onClose}
            className="m-tap shrink-0 p-2 -mr-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>

        {footer && <div className="shrink-0 px-5 pt-3 border-t border-slate-100 dark:border-slate-800">{footer}</div>}
      </div>
    </>,
    document.body
  );
};

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`m-skeleton rounded-xl ${className}`} />
);

interface AvatarProps {
  src?: string;
  alt: string;
  loading?: boolean;
  size?: number;
  rounded?: 'lg' | 'full';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  loading = false,
  size = 48,
  rounded = 'lg',
  className = '',
}) => {
  const radius = rounded === 'full' ? 'rounded-full' : 'rounded-2xl';

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800 ${radius} ${className}`}
      style={{ width: size, height: size }}
    >
      {loading && (
        <div className={`absolute inset-0 z-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${radius}`}>
          <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
        </div>
      )}
      {src && (
        <img
          src={src}
          alt={alt}
          /*
           * Deliberately NOT loading="lazy".
           *
           * The src arrives asynchronously (usePhotoUrl presigns the R2 URL
           * after mount). When an <img> is created already carrying
           * loading="lazy", Chrome evaluates the lazy-load candidacy against
           * the *initial* URL state, and because the presigned URL is assigned
           * after the element is already in the viewport the load is never
           * re-triggered — the image stays at naturalWidth 0 and the card
           * shows its spinner forever.
           *
           * Avatars are small (40–169px) and cached in memory by
           * getPresignedPhotoUrl, so eager loading costs little.
           */
          decoding="async"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.visibility = 'hidden';
          }}
        />
      )}
    </div>
  );
};

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center text-center py-14 px-6 space-y-3">
    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600">
      {icon}
    </div>
    <h3 className="text-base font-bold font-outfit text-slate-800 dark:text-slate-200">{title}</h3>
    <p className="text-xs text-slate-400 max-w-[16rem] leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="m-tap mt-1 px-4 py-2.5 text-xs font-bold bg-primary-600 active:bg-primary-700 text-white rounded-xl shadow"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
}

export const Chip: React.FC<ChipProps> = ({ label, active = false, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`m-tap inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
      active
        ? 'bg-primary-600 border-primary-600 text-white shadow-sm shadow-primary-500/25'
        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
    }`}
  >
    {icon}
    {label}
  </button>
);

interface StatCardProps {
  value: string;
  label: string;
  icon: React.ReactNode;
  accent: string;
}

export const StatCard: React.FC<StatCardProps> = ({ value, label, icon, accent }) => (
  <div className="flex-1 m-card p-3 flex flex-col items-center text-center gap-1 min-w-0">
    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent}`}>{icon}</div>
    <div className="text-base font-extrabold font-outfit text-slate-900 dark:text-white leading-none truncate w-full">
      {value}
    </div>
    <div className="text-[10px] font-semibold text-slate-400 leading-tight m-line-2">{label}</div>
  </div>
);