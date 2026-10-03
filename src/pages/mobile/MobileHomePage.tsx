/**
 * Mobile home page.
 *
 * Same data source (`getSiteSettings` / `getMembers`) and same featured-slice
 * rule as the desktop `HomePage`; only the presentation differs.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  Sparkles,
  Users,
  Building2,
  MapPin,
  ChevronRight,
  Flame,
  Award,
  Globe2,
  UserPlus,
} from 'lucide-react';
import { getSiteSettings, getPublicMembers } from '../../lib/storage';
import { Member } from '../../types';
import { MobileMemberTile, MobileMemberRow } from '../../components/mobile/MobileMemberCard';
import { StatCard } from '../../components/mobile/MobilePrimitives';

interface MobileHomePageProps {
  onSelectMember: (member: Member) => void;
}

const QUICK_SEARCHES = ['Engineer', 'Manager', 'Dhaka', 'USA', 'A+'];

export const MobileHomePage: React.FC<MobileHomePageProps> = ({ onSelectMember }) => {
  const settings = getSiteSettings();
  // Public page: approved records only.
  const members = getPublicMembers();
  const navigate = useNavigate();

  const [searchVal, setSearchVal] = useState('');

  const visibleMembers = members.filter((m) => m.visible);
  // Featured must come from the visible set too: `visible: false` is how an
  // admin hides a record, so showing it here defeats the toggle.
  const featured = [...visibleMembers].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8);
  const recent = [...visibleMembers].sort((a, b) => b.id - a.id).slice(0, 5);

  // Lightweight derived stats (counts only, no extra backend calls).
  const locations = new Set(visibleMembers.map((m) => m.location?.trim()).filter(Boolean));
  const organizations = new Set(visibleMembers.map((m) => m.organization?.trim()).filter(Boolean));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchVal.trim();
    navigate(q ? `/directory?q=${encodeURIComponent(q)}` : '/directory');
  };

  const goToQuickSearch = (term: string) => {
    navigate(`/directory?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="m-safe-x pb-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-primary-900 via-slate-900 to-slate-950 text-white border border-slate-800 shadow-xl mt-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[320px] h-[160px] bg-gradient-to-tr from-primary-500/25 to-indigo-500/25 blur-[70px] pointer-events-none rounded-full" />

        <div className="relative z-10 px-5 pt-6 pb-6 space-y-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-semibold text-primary-200">
            <Sparkles className="w-3 h-3 text-amber-300" />
            Alumni Directory
          </div>

          <h1 className="text-[26px] leading-[1.1] font-extrabold tracking-tight font-outfit bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-primary-200">
            {settings.header_title || 'Department of Computer Science and Engineering'}
          </h1>

          <p className="text-[13px] leading-relaxed text-slate-300 m-line-3">
            {settings.description || 'Connecting CSE graduates, faculty, and academic professionals worldwide.'}
          </p>

          {/* Search: full-width input with the button stacked below, so the
              input never gets squeezed on narrow screens. */}
          <form onSubmit={handleSearchSubmit} className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search name, ID, company, location..."
                className="w-full pl-10 pr-3 py-3.5 text-[15px] bg-white/10 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-white placeholder-slate-400"
              />
            </div>
            <button
              type="submit"
              className="m-tap w-full py-3.5 text-sm font-bold bg-primary-600 active:bg-primary-700 text-white rounded-2xl shadow-lg flex items-center justify-center gap-2"
            >
              Search Directory
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick searches */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <span className="text-[10px] font-semibold text-slate-400 shrink-0 pr-1">Quick:</span>
            {QUICK_SEARCHES.map((term) => (
              <button
                key={term}
                onClick={() => goToQuickSearch(term)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-200 active:bg-white/15"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="flex gap-2 mt-4">
        <StatCard
          value={String(visibleMembers.length)}
          label="Alumni Members"
          icon={<Users className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
          accent="bg-primary-50 dark:bg-primary-950/60"
        />
        <StatCard
          value={String(locations.size)}
          label="Countries & Cities"
          icon={<Globe2 className="w-4 h-4 text-emerald-500" />}
          accent="bg-emerald-50 dark:bg-emerald-950/50"
        />
        <StatCard
          value={String(organizations.size)}
          label="Organizations"
          icon={<Building2 className="w-4 h-4 text-indigo-500" />}
          accent="bg-indigo-50 dark:bg-indigo-950/50"
        />
      </section>

      {/* Directory CTA */}
      <Link
        to="/directory"
        className="m-tap mt-4 flex items-center gap-3 p-4 rounded-2xl bg-primary-600 active:bg-primary-700 text-white shadow-lg shadow-primary-500/25"
      >
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold font-outfit">Explore All {visibleMembers.length} Alumni</p>
          <p className="text-[11px] text-primary-100 opacity-90">Browse the complete directory</p>
        </div>
        <ArrowRight className="w-5 h-5 shrink-0" />
      </Link>

      {/* Join the archive CTA */}
      <Link
        to="/join"
        className="m-tap mt-2.5 flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <UserPlus className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold font-outfit text-slate-900 dark:text-white">Join the Archive</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Register as an alumni member</p>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
      </Link>

      {/* Featured rail */}
      <section className="mt-6">
        <SectionHeader title="Featured Alumni" icon={<Award className="w-4 h-4" />} to="/directory" />
        <div className="m-snap-x mt-3">
          {featured.map((member) => (
            <MobileMemberTile key={member.id} member={member} onSelect={onSelectMember} />
          ))}
        </div>
      </section>

      {/* Recently added */}
      <section className="mt-6">
        <SectionHeader title="Recently Added" icon={<Flame className="w-4 h-4" />} to="/directory" />
        <div className="m-card mt-3 px-3 divide-y divide-slate-100 dark:divide-slate-800/70">
          {recent.map((member) => (
            <MobileMemberRow key={member.id} member={member} onSelect={onSelectMember} />
          ))}
        </div>
      </section>

      {/* Explore by location */}
      <section className="mt-6">
        <SectionHeader title="Explore by Location" icon={<MapPin className="w-4 h-4" />} />
        <div className="flex flex-wrap gap-2 mt-3">
          {Array.from(locations)
            .slice(0, 12)
            .map((loc) => (
              <button
                key={loc}
                onClick={() => navigate(`/directory?q=${encodeURIComponent(loc as string)}`)}
                className="m-tap px-3.5 py-2 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 active:bg-primary-50 active:border-primary-200 dark:active:bg-primary-950/50"
              >
                {loc}
              </button>
            ))}
        </div>
      </section>

      <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 pt-6">
        Dhaka University of Engineering and Technology, Gazipur
      </p>
    </div>
  );
};

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  to?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, icon, to }) => (
  <div className="flex items-center justify-between gap-3">
    <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white font-outfit">
      {icon && <span className="text-primary-500">{icon}</span>}
      {title}
    </h2>
    {to && (
      <Link to={to} className="m-tap flex items-center gap-0.5 text-[11px] font-bold text-primary-600 dark:text-primary-400">
        View All <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    )}
  </div>
);