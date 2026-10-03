/**
 * Mobile directory page.
 *
 * Uses the shared `useMemberDirectory` hook, so search, blood-group filter,
 * sorting and result semantics are byte-for-byte identical to the desktop
 * `DirectoryPage`. Only the chrome differs: a sticky header with inline
 * search, a filter bottom sheet, an infinite list and a "load more" footer.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, SlidersHorizontal, RotateCcw, ChevronDown, LayoutGrid, List } from 'lucide-react';
import { Member } from '../../types';
import { useMemberDirectory, BLOOD_GROUPS, SORT_OPTIONS, type SortKey } from '../../hooks/useMemberDirectory';
import { usePhotoUrl, getDefaultAvatar } from '../../lib/r2';
import { MobileMemberCard } from '../../components/mobile/MobileMemberCard';
import { EmptyState, Sheet, Chip } from '../../components/mobile/MobilePrimitives';

interface MobileDirectoryPageProps {
  onSelectMember: (member: Member) => void;
  searchQuerySignal?: string;
  /** Requested page size; the list loads further pages on demand. */
  pageSize?: number;
}

export const MobileDirectoryPage: React.FC<MobileDirectoryPageProps> = ({
  onSelectMember,
  searchQuerySignal,
  pageSize = 15,
}) => {
  const [searchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const urlQ = searchParams.get('q') ?? undefined;

  const directory = useMemberDirectory({
    urlQuery: urlQ,
    searchQuerySignal,
    pageSize,
    trackView: true,
    viewPath: '/directory',
    source: 'mobile',
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
    totalResults,
    allResults,
    hasActiveFilters,
    resetFilters,
  } = directory;

  // Reset the infinite-scroll window whenever the result set changes.
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [searchQuery, selectedBlood, selectedSort, pageSize]);

  const canLoadMore = visibleCount < totalResults;

  // Grow the window by one page each time the sentinel scrolls back into view.
  //
  // The observer re-arms only after the sentinel has LEFT the viewport again,
  // otherwise a tall viewport + `rootMargin` makes it fire in a loop and append
  // a dozen pages in a single gesture (15 -> 150).
  const armRef = useRef(true);

  useEffect(() => {
    armRef.current = true;
  }, [searchQuery, selectedBlood, selectedSort, pageSize]);

  useEffect(() => {
    if (!canLoadMore) return;

    const sentinel = document.getElementById('m-directory-sentinel');
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (!entry.isIntersecting) {
          // Sentinel scrolled out of view: re-arm for the next pass.
          armRef.current = true;
          return;
        }

        if (!armRef.current) return;
        armRef.current = false;

        setVisibleCount((prev) => Math.min(prev + pageSize, totalResults));
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, visibleCount, totalResults, pageSize]);

  // Page over the *full* filtered result set. `directory.paginatedMembers`
  // only ever holds a single page, which capped the list at `pageSize` items.
  const visibleMembers = useMemo(
    () => allResults.slice(0, visibleCount),
    [allResults, visibleCount]
  );

  const loadMore = () => {
    // Manual tap: consume the arm token so the observer doesn't immediately
    // append a second page on the re-render.
    armRef.current = false;
    setVisibleCount((prev) => Math.min(prev + pageSize, totalResults));
  };

  const activeFilterCount = (selectedBlood ? 1 : 0) + (selectedSort !== 'name' ? 1 : 0);

  return (
    <div className="m-safe-x pb-6">
      {/* Result count summary */}
      <div className="flex items-center justify-between gap-3 py-3">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white font-outfit leading-tight">
            Alumni Directory
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {totalResults} {totalResults === 1 ? 'member' : 'members'} found
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Layout switch */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setLayout('list')}
              className={`m-tap p-1.5 rounded-lg ${layout === 'list' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-400'}`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayout('grid')}
              className={`m-tap p-1.5 rounded-lg ${layout === 'grid' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-400'}`}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Filter trigger */}
          <button
            onClick={() => setFiltersOpen(true)}
            className="m-tap relative p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            aria-label="Open filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full bg-primary-600 text-white text-[9px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
          {searchQuery && (
            <Chip label={`"${searchQuery}"`} active onClick={() => setSearchQuery('')} icon={<span className="text-[10px]">&times;</span>} />
          )}
          {selectedBlood && (
            <Chip label={selectedBlood} active onClick={() => setSelectedBlood('')} icon={<span className="text-[10px]">&times;</span>} />
          )}
          {selectedSort !== 'name' && (
            <Chip
              label={SORT_OPTIONS.find((o) => o.value === selectedSort)?.label || selectedSort}
              active
              onClick={() => setSelectedSort('name')}
              icon={<span className="text-[10px]">&times;</span>}
            />
          )}
          <button
            onClick={resetFilters}
            className="m-tap shrink-0 px-3 py-2 rounded-full text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      )}

      {/* Results */}
      {visibleMembers.length > 0 ? (
        <div className={layout === 'grid' ? 'grid grid-cols-2 gap-2.5' : 'space-y-2.5 mt-1'}>
          {visibleMembers.map((member) =>
            layout === 'grid' ? (
              <MobileGridCard key={member.id} member={member} onSelect={onSelectMember} />
            ) : (
              <MobileMemberCard key={member.id} member={member} onSelect={onSelectMember} />
            )
          )}
        </div>
      ) : (
        <div className="m-card mt-2">
          <EmptyState
            icon={<Users className="w-7 h-7" />}
            title="No Alumni Found"
            description={
              searchQuery
                ? `No members match "${searchQuery}". Try a broader search or reset your filters.`
                : 'No member records match the current filters.'
            }
            actionLabel="Reset All Filters"
            onAction={resetFilters}
          />
        </div>
      )}

      {/* Infinite scroll sentinel + explicit "Load more" affordance */}
      {visibleMembers.length > 0 && canLoadMore && (
        <>
          <div id="m-directory-sentinel" className="h-px" />
          <div className="flex flex-col items-center gap-2 py-5">
            <p className="text-[11px] text-slate-400">
              Showing {visibleMembers.length} of {totalResults}
            </p>
            <button
              onClick={loadMore}
              className="m-tap px-6 py-3 text-xs font-bold rounded-xl bg-primary-600 active:bg-primary-700 text-white shadow-md shadow-primary-500/20"
            >
              Load more
            </button>
          </div>
        </>
      )}

      {visibleMembers.length > 0 && !canLoadMore && (
        <p className="text-center text-[11px] text-slate-400 pt-6">
          End of list &middot; showing all {totalResults} {totalResults === 1 ? 'member' : 'members'}
        </p>
      )}

      {/* Filter sheet */}
      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters and Sorting"
        subtitle={`${totalResults} results match`}
        footer={
          <div className="flex gap-2.5 pb-1">
            <button
              onClick={resetFilters}
              className="m-tap flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              onClick={() => setFiltersOpen(false)}
              className="m-tap flex-[2] py-3.5 rounded-2xl bg-primary-600 active:bg-primary-700 text-white text-xs font-bold shadow-lg shadow-primary-500/25"
            >
              Show {totalResults} Results
            </button>
          </div>
        }
      >
        <div className="space-y-5 pb-2">
          {/* Sort */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2.5">
              Sort by
            </p>
            <div className="relative">
              <select
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value as SortKey)}
                className="m-select pr-10"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Blood group */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2.5">
              Blood Group
            </p>
            <div className="flex flex-wrap gap-2">
              <Chip label="Any" active={selectedBlood === ''} onClick={() => setSelectedBlood('')} />
              {BLOOD_GROUPS.map((blood) => (
                <Chip
                  key={blood}
                  label={blood}
                  active={selectedBlood === blood}
                  onClick={() => setSelectedBlood(selectedBlood === blood ? '' : blood)}
                />
              ))}
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
};

/** Two-up grid card for the mobile directory's "grid" density option. */
const MobileGridCard: React.FC<{ member: Member; onSelect: (m: Member) => void }> = ({ member, onSelect }) => {
  const { url, loading } = usePhotoUrl(member.photo_url || member.photo_key);
  const defaultAvatar = getDefaultAvatar(undefined, member.name);

  return (
    <button
      onClick={() => onSelect(member)}
      className="m-tap m-card overflow-hidden flex flex-col text-left"
    >
      <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
            <span className="w-5 h-5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          </div>
        )}
        <img
          src={url || defaultAvatar}
          alt={member.name}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = defaultAvatar;
          }}
        />
        {member.student_id && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-slate-900/80 text-white font-mono text-[9px] font-semibold">
            {member.student_id}
          </span>
        )}
      </div>
      <div className="p-2.5 min-w-0">
        <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">{member.name}</p>
        <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {member.designation || 'Alumni Member'}
        </p>
      </div>
    </button>
  );
};