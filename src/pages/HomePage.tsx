import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Search, 
  Users, 
  UserPlus, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  MapPin, 
  Award, 
  GraduationCap 
} from 'lucide-react';
import { getSiteSettings, getMembers } from '../lib/storage';
import { useAuth } from '../context/AuthContext';
import { MemberCard } from '../components/directory/MemberCard';
import { Member } from '../types';

interface HomePageProps {
  onSelectMember: (member: Member) => void;
  onOpenLoginModal: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onSelectMember, onOpenLoginModal }) => {
  const { user } = useAuth();
  const settings = getSiteSettings();
  const members = getMembers();
  const navigate = useNavigate();

  const featuredMembers = members.slice(0, 6);

  const [searchVal, setSearchVal] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchVal.trim();
    if (q) {
      navigate(`/directory?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/directory');
    }
  };

  const handleQuickSearch = (term: string) => {
    navigate(`/directory?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="space-y-16 pb-16">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 bg-gradient-to-b from-primary-900 via-slate-900 to-slate-950 text-white rounded-3xl mx-4 sm:mx-6 lg:mx-8 shadow-2xl border border-slate-800">
        
        {/* Decorative Background Lighting Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-tr from-primary-500/20 to-indigo-500/20 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center space-y-8">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold text-primary-200">
            <Sparkles className="w-4 h-4 text-amber-300" />
            Official Department Alumni Directory & Archive
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-outfit leading-none bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-primary-200">
              {settings.header_title || 'Department of Computer Science & Engineering'}
            </h1>
            <p className="text-lg sm:text-xl font-medium text-slate-300 max-w-3xl mx-auto">
              {settings.description || 'Connecting CSE graduates, faculty, and academic professionals worldwide.'}
            </p>
          </div>

          {/* Large Hero Search Box */}
          <div className="space-y-3">
            <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto relative group">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-400 transition-colors" />
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search by name, student ID, company, designation, location..."
                className="w-full pl-12 pr-36 py-4 text-sm bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-white placeholder-slate-400 shadow-xl"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 text-xs font-bold bg-primary-600 hover:bg-primary-500 text-white rounded-xl shadow-md transition-colors"
              >
                Search Directory
              </button>
            </form>

            <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Quick Searches:</span>
              {['Engineer', 'Manager', 'Dhaka', 'USA', 'A+'].map((term) => (
                <button
                  key={term}
                  onClick={() => handleQuickSearch(term)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-200 transition-colors text-[11px]"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              to="/directory"
              className="px-6 py-3 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 shadow-lg transition-colors flex items-center gap-2"
            >
              Explore All 922 Alumni
              <ArrowRight className="w-4 h-4 text-primary-600" />
            </Link>

            {settings.join_enabled && !user && (
              <Link
                to="/join"
                className="px-6 py-3 rounded-xl bg-primary-600/80 hover:bg-primary-600 text-white font-bold text-xs border border-primary-400/40 transition-colors flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Join CSE Archive
              </Link>
            )}
          </div>

        </div>

      </section>


      {/* Featured Alumni Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">
              Featured Alumni Members
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Discovered from the legacy archive dataset.
            </p>
          </div>

          <Link
            to="/directory"
            className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
          >
            View All Directory &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredMembers.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              onSelect={onSelectMember}
            />
          ))}
        </div>
      </section>

    </div>
  );
};
