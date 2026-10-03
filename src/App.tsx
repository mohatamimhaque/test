import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Member } from './types';
import { Navbar } from './components/common/Navbar';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { Footer } from './components/common/Footer';
import { LoginModal } from './components/common/LoginModal';
import { MemberModal } from './components/directory/MemberModal';
import { HomePage } from './pages/HomePage';
import { DirectoryPage } from './pages/DirectoryPage';
import { JoinArchivePage } from './pages/JoinArchivePage';
import { MemberDashboardPage } from './pages/MemberDashboardPage';
import { AdminPage } from './pages/AdminPage';
import { MobileApp } from './pages/mobile/MobileApp';
import { useDeviceType, type DeviceType, type UiOverride } from './hooks/useDeviceType';

export const App: React.FC = () => {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const navigate = useNavigate();

  const { isMobile, detected, override, setOverride } = useDeviceType();

  // Flag the active UI mode on <html> so the mobile-only style layer applies.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('mobile-ui', isMobile);
    return () => root.classList.remove('mobile-ui');
  }, [isMobile]);

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
  };

  // ---------------------------------------------------------------------
  // Mobile devices get the dedicated mobile UI for the public pages.
  // The admin panel is excluded: `/admin/*` always renders the desktop UI.
  // ---------------------------------------------------------------------
  if (isMobile) {
    return <MobileApp />;
  }

  // ---------------------------------------------------------------------
  // Default UI for desktop + tablet devices - unchanged from the original.
  // ---------------------------------------------------------------------

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 font-sans">
      
      {/* Top Navbar */}
      <Navbar
        onSearchQueryChange={setGlobalSearchQuery}
        onOpenLoginModal={() => setLoginModalOpen(true)}
      />

      {/* Main Page Routing */}
      <main className="flex-1 pb-16 md:pb-0">
        <Routes>
          <Route 
            path="/" 
            element={
              <HomePage 
                onSelectMember={handleSelectMember} 
                onOpenLoginModal={() => setLoginModalOpen(true)} 
              />
            } 
          />

          <Route 
            path="/directory" 
            element={
              <DirectoryPage 
                onSelectMember={handleSelectMember}
                searchQuerySignal={globalSearchQuery}
              />
            } 
          />

          <Route path="/member-dashboard" element={<MemberDashboardPage />} />
          <Route path="/join" element={<JoinArchivePage />} />
          <Route 
            path="/admin/*" 
            element={<AdminPage onOpenLoginModal={() => setLoginModalOpen(true)} />} 
          />

          <Route 
            path="*" 
            element={
              <div className="max-w-md mx-auto my-20 p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h2 className="text-3xl font-extrabold font-outfit">404</h2>
                <p className="text-xs text-slate-400">Page not found.</p>
                <button 
                  onClick={() => navigate('/')} 
                  className="px-4 py-2 bg-primary-600 text-white text-xs font-bold rounded-xl"
                >
                  Return Home
                </button>
              </div>
            } 
          />
        </Routes>
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Bottom Icon Navigation */}
      <MobileBottomNav onOpenLoginModal={() => setLoginModalOpen(true)} />

      {/* Modals */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      <MemberModal
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
      />

      {/* Dev helper: preview the mobile UI (or force desktop) on a large screen. */}
      <UiModeSwitcher detected={detected} override={override} onChange={setOverride} />
    </div>
  );
};

interface UiModeSwitcherProps {
  detected: DeviceType;
  override: UiOverride;
  onChange: (value: UiOverride) => void;
}

const UiModeSwitcher: React.FC<UiModeSwitcherProps> = ({ detected, override, onChange }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-[60] hidden lg:block">
      {open && (
        <div className="mb-2 w-48 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-1.5">
          <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Detected: {detected}
          </p>
          {(['auto', 'mobile', 'desktop'] as const).map((value) => (
            <button
              key={value}
              onClick={() => onChange(value)}
              className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                override === value
                  ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-slate-900/80 dark:bg-white/10 backdrop-blur border border-slate-700 dark:border-slate-600 text-white dark:text-slate-300 text-[10px] font-bold shadow-lg hover:bg-slate-900 dark:hover:bg-white/20 transition-colors"
        title="Preview UI mode"
      >
        UI
      </button>
    </div>
  );
};

export default App;
