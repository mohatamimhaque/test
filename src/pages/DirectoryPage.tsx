import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Member } from '../types';
import { getMembers, trackPageView } from '../lib/storage';
import { MemberCard } from '../components/directory/MemberCard';
import { FilterBar } from '../components/directory/FilterBar';
import { Pagination } from '../components/common/Pagination';
import { Users } from 'lucide-react';

interface DirectoryPageProps {
  onSelectMember: (member: Member) => void;
  searchQuerySignal?: string;
}

export const DirectoryPage: React.FC<DirectoryPageProps> = ({ onSelectMember, searchQuerySignal }) => {
  const [searchParams] = useSearchParams();
  const [members, setMembers] = useState<Member[]>(() => getMembers());
  
  const urlQ = searchParams.get('q');
  const initialQ = urlQ || searchQuerySignal || '';
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [selectedBlood, setSelectedBlood] = useState('');
  const [selectedSort, setSelectedSort] = useState('name');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    trackPageView('/directory');
  }, []);

  useEffect(() => {
    const qFromUrl = searchParams.get('q');
    if (qFromUrl !== null && qFromUrl !== undefined) {
      setSearchQuery(qFromUrl);
      setPage(1);
    } else if (searchQuerySignal) {
      setSearchQuery(searchQuerySignal);
      setPage(1);
    }
  }, [searchParams, searchQuerySignal]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedBlood('');
    setSelectedSort('name');
    setPage(1);
  };

  // Filter and sort members
  const filtered = members.filter(m => {
    if (!m.visible) return false;

    if (selectedBlood && m.blood !== selectedBlood) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name?.toLowerCase().includes(q);
      const matchStudentId = m.student_id?.toLowerCase().includes(q);
      const matchEmail = m.email?.toLowerCase().includes(q);
      const matchCompany = m.organization?.toLowerCase().includes(q);
      const matchLocation = m.location?.toLowerCase().includes(q);
      const matchDesignation = m.designation?.toLowerCase().includes(q);
      return matchName || matchStudentId || matchEmail || matchCompany || matchLocation || matchDesignation;
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (selectedSort === 'name') {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (selectedSort === 'id_asc') {
      return a.id - b.id;
    }
    if (selectedSort === 'id_desc') {
      return b.id - a.id;
    }
    if (selectedSort === 'recent') {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paginatedMembers = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">
            CSE Alumni Member Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse, search, and connect with 922 CSE alumni members.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={(q) => { setSearchQuery(q); setPage(1); }}
        selectedBlood={selectedBlood}
        onBloodChange={(b) => { setSelectedBlood(b); setPage(1); }}
        selectedSort={selectedSort}
        onSortChange={setSelectedSort}
        layout={layout}
        onLayoutChange={setLayout}
        totalResults={sorted.length}
        onResetFilters={handleResetFilters}
      />

      {/* Members Grid / List */}
      {paginatedMembers.length > 0 ? (
        <div className={layout === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-3"}>
          {paginatedMembers.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              layout={layout}
              onSelect={onSelectMember}
            />
          ))}
        </div>
      ) : (
        <div className="p-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 font-outfit">No Alumni Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No member records match your query "{searchQuery}". Try broadening your search or resetting filters.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 text-xs font-bold bg-primary-600 text-white rounded-xl shadow hover:bg-primary-700 transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      )}

      {/* Pagination Bar */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={sorted.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />

    </div>
  );
};
