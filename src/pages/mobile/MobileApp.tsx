/**
 * Mobile application shell for the public site.
 *
 * Renders a fixed header, an independently scrolling content region and a
 * bottom tab bar. Routes:
 *   /, /directory, /member-dashboard -> mobile UI
 *   /admin/*                        -> the EXISTING desktop admin page,
 *                                      deliberately untouched on mobile.
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import { Member } from '../../types';
import { MobileHeader, MobileTabBar } from '../../components/mobile/MobileHeader';
import { MobileMemberSheet } from '../../components/mobile/MobileMemberSheet';
import { MobileLoginSheet } from '../../components/mobile/MobileLoginSheet';
import { MobileHomePage } from './MobileHomePage';
import { MobileDirectoryPage } from './MobileDirectoryPage';
import { MobileMemberDashboardPage } from './MobileMemberDashboardPage';
import { JoinArchivePage } from '../JoinArchivePage';
import { AdminPage } from '../AdminPage';

export const MobileApp: React.FC = () => {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const location = useLocation();

  // The admin console always uses the desktop UI, so the mobile chrome is
  // hidden entirely on those routes.
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Reset the shared navbar search signal when leaving the directory.
  useEffect(() => {
    if (!location.pathname.startsWith('/directory')) {
      setGlobalSearchQuery('');
    }
  }, [location.pathname]);

  // On inner routes the shell behaves like an app screen with a back button.
  const showBack = !['/', '/directory'].includes(location.pathname) && !isAdminRoute;

  // Scroll the content region back to the top on navigation.
  useEffect(() => {
    const el = document.querySelector('.m-scroll');
    if (el) el.scrollTop = 0;
  }, [location.pathname]);

  const handleSelectMember = (member: Member) => setSelectedMember(member);

  const openLogin = () => setLoginOpen(true);

  // ---- Admin route: hand off to the untouched desktop admin page --------
  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <AdminPage onOpenLoginModal={openLogin} />
        <MobileLoginSheet isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );
  }

  return (
    <div className="m-shell m-text-fix bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <MobileHeader
        showBack={showBack}
        searchValue={
          location.pathname.startsWith('/directory') ? globalSearchQuery : undefined
        }
        onSearchChange={
          location.pathname.startsWith('/directory')
            ? (value) => setGlobalSearchQuery(value)
            : undefined
        }
        onOpenLogin={openLogin}
      />

      <main className="m-scroll">
        <Routes>
          <Route path="/" element={<MobileHomePage onSelectMember={handleSelectMember} />} />

          <Route
            path="/directory"
            element={
              <MobileDirectoryPage
                onSelectMember={handleSelectMember}
                searchQuerySignal={globalSearchQuery}
              />
            }
          />

          <Route path="/member-dashboard" element={<MobileMemberDashboardPage />} />

          <Route path="/join" element={<JoinArchivePage />} />

          <Route
            path="*"
            element={
              <div className="m-safe-x py-16">
                <div className="m-card p-8 text-center space-y-4">
                  <h2 className="text-4xl font-extrabold font-outfit text-slate-900 dark:text-white">404</h2>
                  <p className="text-xs text-slate-400">Page not found.</p>
                  <Link
                    to="/"
                    className="m-tap inline-flex px-5 py-3 bg-primary-600 active:bg-primary-700 text-white text-xs font-bold rounded-xl"
                  >
                    Return Home
                  </Link>
                </div>
              </div>
            }
          />
        </Routes>

        <footer className="m-safe-x py-6 text-center">
          <p className="text-[10px] text-slate-400 dark:text-slate-600">
            Developed by{' '}
            <a
              href="https://wa.me/mohatamim"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-500 dark:text-slate-400"
            >
              mohatamim
            </a>
          </p>
        </footer>
      </main>

      <MobileTabBar onOpenLogin={openLogin} />

      {/* Overlays */}
      <MobileLoginSheet isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      <MobileMemberSheet member={selectedMember} onClose={() => setSelectedMember(null)} />
    </div>
  );
};

export default MobileApp;