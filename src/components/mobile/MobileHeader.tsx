/**
 * Mobile app header for the public UI.
 *
 * Sticky, compact, and context-aware: shows a back affordance and a
 * route-specific title on inner pages, the brand lockup on the home page.
 */

import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Building2,
  ChevronLeft,
  Search,
  ShieldCheck,
  Sun,
  Moon,
  Laptop,
  Home,
  Users,
  User,
  LogIn,
  type LucideIcon,
} from 'lucide-react';
import { getSiteSettings } from '../../lib/storage';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Sheet } from './MobilePrimitives';

interface MobileHeaderProps {
  /** Optional override. When omitted, the title is derived from the route. */
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  /** Show the inline search field (directory page). */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Hide the theme toggle when the tab bar already exposes it. */
  showThemeToggle?: boolean;
  onOpenLogin: () => void;
}

/** Route metadata keyed by pathname. */
const ROUTE_META: { match: (path: string) => boolean; title: string; subtitle: string }[] = [
  { match: (p) => p === '/', title: '', subtitle: '' },
  { match: (p) => p.startsWith('/directory'), title: 'Alumni Directory', subtitle: 'Search the CSE archive' },
  { match: (p) => p.startsWith('/member-dashboard'), title: 'My Profile', subtitle: 'Self-service portal' },
  { match: (p) => p.startsWith('/admin'), title: 'Admin Panel', subtitle: 'Management console' },
];

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search alumni by name, ID, company...',
  showThemeToggle = true,
  onOpenLogin,
}) => {
  const settings = getSiteSettings();
  const { isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [themeOpen, setThemeOpen] = React.useState(false);

  const meta = ROUTE_META.find((entry) => entry.match(location.pathname));
  const isHome = location.pathname === '/';

  const heading = title || meta?.title || '';
  const subheading =
    subtitle ||
    meta?.subtitle ||
    (isHome ? settings.subtitle || 'Alumni & Directory' : 'CSE Archive');

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Laptop;

  return (
    <header className="m-topbar shrink-0">
      <div className="m-safe-x h-14 flex items-center gap-3">
        {showBack ? (
          <button
            onClick={() => navigate(-1)}
            className="m-tap -ml-1 p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : null}

        {/* Brand lockup on root, page title elsewhere */}
        <Link to="/" className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-700 via-primary-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-primary-500/20 shrink-0">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="w-5 h-5 object-contain" />
            ) : (
              <Building2 className="w-4.5 h-4.5" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold leading-tight tracking-tight text-slate-900 dark:text-white font-outfit truncate">
              {heading || settings.title || 'CSE Archive'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {subheading}
            </span>
          </div>
        </Link>

        {isAdmin && (
          <Link
            to="/admin"
            className="m-tap p-2 rounded-xl text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 shrink-0"
            aria-label="Admin panel"
          >
            <ShieldCheck className="w-5 h-5" />
          </Link>
        )}

        {showThemeToggle && (
          <>
            <button
              onClick={() => setThemeOpen(true)}
              className="m-tap p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              aria-label="Switch theme"
            >
              <ThemeIcon className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Inline search field */}
      {onSearchChange !== undefined && (
        <div className="m-safe-x pb-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white placeholder-slate-400"
            />
            {searchValue ? (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Theme picker sheet */}
      <Sheet open={themeOpen} onClose={() => setThemeOpen(false)} title="Appearance">
        <div className="space-y-2 pb-2">
          {(
            [
              { key: 'light', label: 'Light', Icon: Sun, color: 'text-amber-500' },
              { key: 'dark', label: 'Dark', Icon: Moon, color: 'text-indigo-400' },
              { key: 'system', label: 'System', Icon: Laptop, color: 'text-slate-400' },
            ] as const
          ).map(({ key, label, Icon, color }) => (
            <button
              key={key}
              onClick={() => {
                setTheme(key);
                setThemeOpen(false);
              }}
              className={`m-tap w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left ${
                theme === key
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${color}`} />
              <span className="text-sm font-semibold flex-1">{label}</span>
              {theme === key && <span className="text-[10px] font-bold uppercase tracking-wide">Active</span>}
            </button>
          ))}
        </div>
      </Sheet>
    </header>
  );
};

interface MobileTabBarProps {
  onOpenLogin: () => void;
}

interface TabItem {
  label: string;
  path: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ onOpenLogin }) => {
  const { user, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const pathname = location.pathname;

  const items: TabItem[] = [
    { label: 'Home', path: '/', icon: Home, exact: true },
    { label: 'Directory', path: '/directory', icon: Users },
  ];

  if (user) items.push({ label: 'Profile', path: '/member-dashboard', icon: User });
  if (isAdmin) items.push({ label: 'Admin', path: '/admin', icon: ShieldCheck });

  const isActive = (path: string, exact?: boolean) =>
    exact ? pathname === path : pathname.startsWith(path);

  return (
    <nav className="m-tabbar shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800">
      <div className="flex items-stretch justify-around px-1 pt-1.5 max-w-md mx-auto">
        {items.map(({ label, path, icon: Icon, exact }) => {
          const active = isActive(path, exact);
          return (
            <Link
              key={path}
              to={path}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-2xl transition-colors ${
                active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-primary-50 dark:bg-primary-950/60' : ''}`}>
                <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
              </div>
              <span className={`text-[10px] leading-none tracking-tight ${active ? 'font-bold' : 'font-medium'}`}>
                {label}
              </span>
            </Link>
          );
        })}

        {/* Trailing action: sign in, or theme toggle once authenticated */}
        {!user ? (
          <button
            onClick={onOpenLogin}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-2xl text-slate-400 dark:text-slate-500 transition-colors"
          >
            <div className="p-1.5 rounded-xl">
              <LogIn className="w-5 h-5 text-primary-500" strokeWidth={2} />
            </div>
            <span className="text-[10px] leading-none font-medium tracking-tight">Sign In</span>
          </button>
        ) : (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-2xl text-slate-400 dark:text-slate-500 transition-colors"
            aria-label="Toggle theme"
          >
            <div className="p-1.5 rounded-xl">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-indigo-400" strokeWidth={2} />
              ) : (
                <Sun className="w-5 h-5 text-amber-500" strokeWidth={2} />
              )}
            </div>
            <span className="text-[10px] leading-none font-medium tracking-tight">Theme</span>
          </button>
        )}
      </div>
    </nav>
  );
};