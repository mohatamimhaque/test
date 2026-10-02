import React from 'react';
import { Search, Filter, LayoutGrid, List, SlidersHorizontal, RotateCcw } from 'lucide-react';

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
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

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
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-between md:justify-end">
          
          {/* Blood Group Select */}
          <select
            value={selectedBlood}
            onChange={(e) => onBloodChange(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-slate-200"
          >
            <option value="">All Blood Groups</option>
            {BLOOD_GROUPS.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Sort Selector */}
          <select
            value={selectedSort}
            onChange={(e) => onSortChange(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-slate-200"
          >
            <option value="name">Sort by Name (A-Z)</option>
            <option value="id_asc">Sort by ID (Ascending)</option>
            <option value="id_desc">Sort by ID (Descending)</option>
            <option value="recent">Recently Updated</option>
          </select>

          {/* Layout Toggle Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => onLayoutChange('grid')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                layout === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onLayoutChange('list')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                layout === 'list'
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
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
