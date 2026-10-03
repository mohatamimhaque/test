import React from 'react';
import { Search, LayoutGrid, List, RotateCcw } from 'lucide-react';

interface SortOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedBlood: string;
  onBloodChange: (blood: string) => void;
  selectedSort: string;
  onSortChange: (sort: string) => void;
  layout: 'grid' | 'list';
  onLayoutChange: (layout: 'grid' | 'list') => void;
  totalResults: number;
  onResetFilters: () => void;
  /** Blood group options (shared with the mobile UI). */
  bloodGroups?: readonly string[];
  /** Sort options (shared with the mobile UI). */
  sortOptions?: SortOption[];
}

const DEFAULT_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const DEFAULT_SORT_OPTIONS: SortOption[] = [
  { value: 'name', label: 'Sort by Name (A-Z)' },
  { value: 'id_asc', label: 'Sort by ID (Ascending)' },
  { value: 'id_desc', label: 'Sort by ID (Descending)' },
  { value: 'recent', label: 'Recently Updated' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedBlood,
  onBloodChange,
  selectedSort,
  onSortChange,
  layout,
  onLayoutChange,
  totalResults,
  onResetFilters,
  bloodGroups = DEFAULT_BLOOD_GROUPS,
  sortOptions = DEFAULT_SORT_OPTIONS,
}) => {
  const hasActiveFilters = Boolean(searchQuery || selectedBlood || selectedSort !== 'name');

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4 transition-colors duration-200">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input Field */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search alumni by name, ID, designation, company, location..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>

        {/* Filter Dropdowns & Layout Switches */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 w-full md:w-auto justify-between md:justify-end">
          
          {/* Blood Group Select */}
          <select
            value={selectedBlood}
            onChange={(e) => onBloodChange(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-slate-200 truncate"
          >
            <option value="">All Blood Groups</option>
            {bloodGroups.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Sort Selector */}
          <select
            value={selectedSort}
            onChange={(e) => onSortChange(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-slate-200 truncate"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Layout Toggle Buttons */}
          <div className="col-span-2 sm:col-span-1 flex items-center justify-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => onLayoutChange('grid')}
              className={`flex-1 sm:flex-initial p-1.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-1 ${
                layout === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="sm:hidden text-[11px]">Grid</span>
            </button>
            <button
              onClick={() => onLayoutChange('list')}
              className={`flex-1 sm:flex-initial p-1.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-1 ${
                layout === 'list'
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
              <span className="sm:hidden text-[11px]">List</span>
            </button>
          </div>

        </div>

      </div>

      {/* Filter Status Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div>
          Showing <span className="font-bold text-slate-900 dark:text-white">{totalResults}</span> alumni members
        </div>

        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};
