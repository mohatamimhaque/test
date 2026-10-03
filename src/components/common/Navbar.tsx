import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Building2, 
  Search, 
  Sun, 
  Moon, 
  Laptop, 
  ShieldCheck, 
  User, 
  LogOut, 
  LogIn, 
  Menu, 
  X,
  Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getSiteSettings } from '../../lib/storage';

interface NavbarProps {
  onSearchQueryChange?: (query: string) => void;
  onOpenLoginModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onSearchQueryChange, onOpenLoginModal }) => {
  const { user, member, isAdmin, isSuperAdmin, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const settings = getSiteSettings();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (onSearchQueryChange) {
      onSearchQueryChange(val);
    }
    if (location.pathname !== '/directory') {
      navigate(`/directory?q=${encodeURIComponent(val)}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-700 via-primary-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-primary-500/20 group-hover:scale-105 transition-transform duration-200">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="w-6 h-6 object-contain" />
            ) : (
              <Building2 className="w-5 h-5" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-tight tracking-tight text-slate-900 dark:text-white font-outfit">
              {settings.title || 'CSE Archive'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {settings.subtitle || 'Alumni & Directory'}
            </span>
          </div>
        </Link>

        {/* Global Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-4 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search alumni by name, ID, company, location..."
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-150"
          />
        </div>

        {/* Nav Links & Controls */}
        <div className="hidden md:flex items-center gap-2 lg:gap-4">
          <Link
            to="/directory"
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/directory'
                ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Directory
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 border ${
                location.pathname.startsWith('/admin')
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/10'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin Panel
              {isSuperAdmin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-extrabold uppercase tracking-wider">Super</span>}
            </Link>
          )}

          <Link
            to="/join"
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/join'
                ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Join Archive
          </Link>

          {/* Theme Dropdown Toggle */}
          <div className="relative">
            <button
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Switch Theme"
            >
              {theme === 'light' ? <Sun className="w-5 h-5 text-amber-500" /> : theme === 'dark' ? <Moon className="w-5 h-5 text-indigo-400" /> : <Laptop className="w-5 h-5" />}
            </button>

            {themeDropdownOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => { setTheme('light'); setThemeDropdownOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium ${theme === 'light' ? 'text-primary-600 font-bold bg-primary-50 dark:bg-primary-950/40' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                  <Sun className="w-4 h-4 text-amber-500" /> Light
                </button>
                <button
                  onClick={() => { setTheme('dark'); setThemeDropdownOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium ${theme === 'dark' ? 'text-primary-600 font-bold bg-primary-50 dark:bg-primary-950/40' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                  <Moon className="w-4 h-4 text-indigo-400" /> Dark
                </button>
                <button
                  onClick={() => { setTheme('system'); setThemeDropdownOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium ${theme === 'system' ? 'text-primary-600 font-bold bg-primary-50 dark:bg-primary-950/40' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                  <Laptop className="w-4 h-4 text-slate-400" /> System
                </button>
              </div>
            )}
          </div>

          {/* User Auth Section */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-primary-600 text-white font-semibold flex items-center justify-center text-xs">
                  {user.email.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[120px] truncate">
                  {member?.name || user.email.split('@')[0]}
                </span>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-50">
                  <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{member?.name || 'User Account'}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                  </div>
                  {user && (
                    <Link
                      to="/member-dashboard"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold"
                    >
                      <User className="w-4 h-4 text-primary-500" />
                      Member Portal / My Profile
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs text-amber-600 dark:text-amber-400 font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/30"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Admin Control Panel
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); setUserDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          )}
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-slate-600 dark:text-slate-300"
          >
            {theme === 'dark' ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 space-y-3">
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search alumni..."
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>

          <Link
            to="/directory"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Directory
          </Link>

          <Link
            to="/join"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Join Archive
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
            >
              Admin Panel
            </Link>
          )}

          {user ? (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-xs text-slate-500 font-medium px-3">Signed in as {user.email}</div>
              {user && (
                <Link
                  to="/member-dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Member Portal / My Profile
                </Link>
              )}
              <button
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm font-medium text-rose-600"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => { onOpenLoginModal(); setMobileMenuOpen(false); }}
              className="w-full py-2.5 text-center text-xs font-bold text-white bg-primary-600 rounded-xl"
            >
              Sign In
            </button>
          )}
        </div>
      )}
    </header>
  );
};
