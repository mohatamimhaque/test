import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Member } from '../types';
import { useMemberDirectory, BLOOD_GROUPS, SORT_OPTIONS, type SortKey } from '../hooks/useMemberDirectory';
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
  const urlQ = searchParams.get('q') ?? undefined;

  // Shared with the mobile directory so search/filter/sort/pagination
  // behaviour can never diverge between the two UIs.
  const directory = useMemberDirectory({
    urlQuery: urlQ,
    searchQuerySignal,
    pageSize: 12,
    trackView: true,
    viewPath: '/directory',
    source: 'desktop',
  });

  const {
    searchQuery,
    setSearchQuery,
    selectedBlood,
    setSelectedBlood,
    selectedSort,
    setSelectedSort,
    layout,
    setLayout,
    page,
    setPage,
    totalResults,
    totalPages,
    pageSize,
    paginatedMembers,
    resetFilters,
  } = directory;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">
            CSE Alumni Member Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse, search, and connect with {totalResults ? directory.members.length : 0} CSE alumni members.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedBlood={selectedBlood}
        onBloodChange={setSelectedBlood}
        selectedSort={selectedSort}
        onSortChange={(sort) => setSelectedSort(sort as SortKey)}
        layout={layout}
        onLayoutChange={setLayout}
        totalResults={totalResults}
        onResetFilters={resetFilters}
        bloodGroups={BLOOD_GROUPS}
        sortOptions={SORT_OPTIONS}
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
            onClick={resetFilters}
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
        totalItems={totalResults}
        pageSize={pageSize}
        onPageChange={setPage}
      />

    </div>
  );
};
