/**
 * Shared directory query logic.
 *
 * Both the desktop `DirectoryPage` and the mobile `MobileDirectoryPage` use
 * this hook, so search / filter / sort / pagination behaviour is guaranteed to
 * be identical between the two UIs. Only the presentation differs.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Member } from '../types';
import { getPublicMembers, trackPageView, trackSearch } from '../lib/storage';
import { usePersistentState } from './usePersistentState';

export type DirectoryLayout = 'grid' | 'list';
export type SortKey = 'name' | 'id_asc' | 'id_desc' | 'recent';

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'id_asc', label: 'ID (Low to High)' },
  { value: 'id_desc', label: 'ID (High to Low)' },
  { value: 'recent', label: 'Recently Updated' },
];

export interface UseMemberDirectoryOptions {
  /** Query coming from the `?q=` URL parameter. */
  urlQuery?: string;
  /** Query pushed down from the global navbar search box. */
  searchQuerySignal?: string;
  /** Default number of members per page. */
  pageSize?: number;
  /** Whether to record an analytics page view on mount. */
  trackView?: boolean;
  /** Analytics path recorded when `trackView` is enabled. */
  viewPath?: string;
  /**
   * Which UI performed the search. Recorded on every search so the admin
   * analytics page can report mobile vs desktop usage.
   */
  source?: 'mobile' | 'desktop';
}

export interface UseMemberDirectoryResult {
  members: Member[];
  /** The full filtered + sorted result set (all pages combined). */
  allResults: Member[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedBlood: string;
  setSelectedBlood: (b: string) => void;
  selectedSort: SortKey;
  setSelectedSort: (s: SortKey) => void;
  layout: DirectoryLayout;
  setLayout: (l: DirectoryLayout) => void;
  page: number;
  setPage: (p: number) => void;
  totalResults: number;
  totalPages: number;
  pageSize: number;
  paginatedMembers: Member[];
  startIndex: number;
  endIndex: number;
  hasActiveFilters: boolean;
  resetFilters: () => void;
}

function matchesQuery(member: Member, query: string): boolean {
  const q = query.toLowerCase();
  return Boolean(
    member.name?.toLowerCase().includes(q) ||
    member.student_id?.toLowerCase().includes(q) ||
    member.email?.toLowerCase().includes(q) ||
    member.organization?.toLowerCase().includes(q) ||
    member.location?.toLowerCase().includes(q) ||
    member.designation?.toLowerCase().includes(q)
  );
}

const LAYOUTS: readonly DirectoryLayout[] = ['grid', 'list'];
const SORTS: readonly SortKey[] = ['name', 'id_asc', 'id_desc', 'recent'];

export function useMemberDirectory(options: UseMemberDirectoryOptions = {}): UseMemberDirectoryResult {
  const {
    urlQuery,
    searchQuerySignal,
    pageSize = 12,
    trackView = false,
    viewPath = '/directory',
    source = 'desktop',
  } = options;

  const initialQuery = urlQuery || searchQuerySignal || '';

  const [members, setMembers] = useState<Member[]>(() => getPublicMembers());
  const [searchQuery, setSearchQueryState] = useState<string>(initialQuery);

  // Persisted so grid/list, the sort order and the blood filter survive a
  // refresh and a return visit. Shared by the desktop and mobile directories,
  // so the choice follows the visitor between the two UIs.
  const [selectedBlood, setSelectedBlood] = usePersistentState<string>(
    'directory_blood',
    ['', ...BLOOD_GROUPS],
    ''
  );
  const [selectedSort, setSelectedSort] = usePersistentState<SortKey>('directory_sort', SORTS, 'name');
  const [layout, setLayout] = usePersistentState<DirectoryLayout>('directory_layout', LAYOUTS, 'grid');

  const [page, setPage] = useState(1);

  useEffect(() => {
    if (trackView) {
      trackPageView(viewPath);
    }
  }, [trackView, viewPath]);

  // Mirror the background Supabase refresh performed by getMembers().
  useEffect(() => {
    const interval = window.setInterval(() => {
      const next = getPublicMembers();
      setMembers((prev) => (next.length && next.length !== prev.length ? next : prev));
    }, 8000);
    return () => window.clearInterval(interval);
  }, []);

  // Sync the external query signals into local state.
  // A ref is used so that clearing the signal back to '' is honoured too
  // (a plain truthiness check would drop the empty-string case).
  const lastSignal = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (urlQuery !== undefined && urlQuery !== null) {
      setSearchQueryState(urlQuery);
      setPage(1);
      return;
    }

    if (searchQuerySignal !== undefined && searchQuerySignal !== lastSignal.current) {
      lastSignal.current = searchQuerySignal;
      setSearchQueryState(searchQuerySignal);
      setPage(1);
    }
  }, [urlQuery, searchQuerySignal]);

  const setSearchQuery = (q: string) => {
    setSearchQueryState(q);
    setPage(1);
  };

  const setBlood = (b: string) => {
    setSelectedBlood(b);
    setPage(1);
  };

  const setSort = (s: SortKey) => {
    setSelectedSort(s);
    setPage(1);
  };

  const resetFilters = () => {
    setSearchQueryState('');
    setSelectedBlood('');
    setSelectedSort('name');
    setPage(1);
  };

  const sorted = useMemo(() => {
    const filtered = members.filter((m) => {
      if (!m.visible) return false;
      if (selectedBlood && m.blood !== selectedBlood) return false;
      if (searchQuery.trim() && !matchesQuery(m, searchQuery.trim())) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      switch (selectedSort) {
        case 'id_asc':
          return a.id - b.id;
        case 'id_desc':
          return b.id - a.id;
        case 'recent':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'name':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });
  }, [members, selectedBlood, searchQuery, selectedSort]);

  const totalPages = Math.ceil(sorted.length / pageSize) || 1;

  // Record every settled search (debounced) so the admin analytics page can
  // report what was searched and how many results each query returned.
  const trimmedQuery = searchQuery.trim();
  useEffect(() => {
    if (!trimmedQuery) return;

    const filters = [
      selectedBlood ? `blood=${selectedBlood}` : '',
      selectedSort !== 'name' ? `sort=${selectedSort}` : '',
    ]
      .filter(Boolean)
      .join('&');

    const timer = window.setTimeout(() => {
      trackSearch(trimmedQuery, sorted.length, { source, filters: filters || undefined });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [trimmedQuery, sorted.length, selectedBlood, selectedSort, source]);

  // Keep the current page inside the valid range as the result set shrinks.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedMembers = useMemo(
    () => sorted.slice((page - 1) * pageSize, page * pageSize),
    [sorted, page, pageSize]
  );

  const hasActiveFilters = Boolean(searchQuery || selectedBlood || selectedSort !== 'name');

  const startIndex = sorted.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, sorted.length);

  return {
    members,
    allResults: sorted,
    searchQuery,
    setSearchQuery,
    selectedBlood,
    setSelectedBlood: setBlood,
    selectedSort,
    setSelectedSort: setSort,
    layout,
    setLayout,
    page,
    setPage,
    totalResults: sorted.length,
    totalPages,
    pageSize,
    paginatedMembers,
    startIndex,
    endIndex,
    hasActiveFilters,
    resetFilters,
  };
}