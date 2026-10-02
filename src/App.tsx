import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Member } from './types';
import { Navbar } from './components/common/Navbar';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { Footer } from './components/common/Footer';
import { LoginModal } from './components/common/LoginModal';
import { MemberModal } from './components/directory/MemberModal';
import { HomePage } from './pages/HomePage';
import { DirectoryPage } from './pages/DirectoryPage';
import { JoinPage } from './pages/JoinPage';
import { MemberDashboardPage } from './pages/MemberDashboardPage';
import { AdminPage } from './pages/AdminPage';

export const App: React.FC = () => {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const navigate = useNavigate();

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
  };

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

          <Route path="/join" element={<JoinPage />} />

          <Route path="/member-dashboard" element={<MemberDashboardPage />} />

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

    </div>
  );
};

export default App;
