import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, User, ShieldCheck, Sun, Moon, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface MobileBottomNavProps {
  onOpenLoginModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenLoginModal }) => {
  const { user, member, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const navItems = [
    {
      label: 'Home',
      path: '/',
      icon: Home,
      exact: true,
    },
    {
      label: 'Directory',
      path: '/directory',
      icon: Users,
      exact: false,
    },
  ];

  if (user) {
    navItems.push({
      label: 'Portal',
      path: '/member-dashboard',
      icon: User,
      exact: false,
    });
  }

  if (isAdmin) {
    navItems.push({
      label: 'Admin',
      path: '/admin',
      icon: ShieldCheck,
      exact: false,
    });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-2 py-1.5 transition-colors">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);

          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 relative ${
                isActive
                  ? 'text-primary-600 dark:text-primary-400 font-bold scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${
                isActive ? 'bg-primary-50 dark:bg-primary-950/60 shadow-sm' : ''
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-tight leading-none mt-0.5">{item.label}</span>
            </Link>
          );
        })}

        {/* Auth / Theme Action Icon */}
        {!user ? (
          <button
            onClick={onOpenLoginModal}
            className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all duration-200"
          >
            <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
              <LogIn className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="text-[10px] tracking-tight leading-none mt-0.5">Sign In</span>
          </button>
        ) : (
          <button
            onClick={toggleTheme}
            className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all duration-200"
            title="Toggle Theme"
          >
            <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-indigo-400" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500" />
              )}
            </div>
            <span className="text-[10px] tracking-tight leading-none mt-0.5">Theme</span>
          </button>
        )}
      </div>
    </nav>
  );
};
