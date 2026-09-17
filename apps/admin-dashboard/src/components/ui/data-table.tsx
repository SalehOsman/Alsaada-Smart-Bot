'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Search,
  Filter,
  X,
} from 'lucide-react';
import { useDashboardPreferences, type TableDensity } from '@/components/providers/dashboard-preferences-provider';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface FacetedFilter {
  id: string;
  label: string;
  value: string;
  onClear: () => void;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  pageSize?: number;
  emptyState?: React.ReactNode;
  density?: TableDensity;
  facetedFilters?: FacetedFilter[];
  onClearAllFilters?: () => void;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = 'بحث...',
  searchFilter,
  pageSize = 10,
  emptyState,
  density,
  facetedFilters,
  onClearAllFilters,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Read tableDensity preference safely
  let prefDensity: TableDensity = 'comfortable';
  try {
    const prefs = useDashboardPreferences();
    prefDensity = prefs.preferences.tableDensity;
  } catch {
    prefDensity = 'comfortable';
  }
  const isCompact = (density || prefDensity) === 'compact';

  // Filter
  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) return data;
    if (searchFilter) {
      return data.filter((item) => searchFilter(item, searchQuery.trim()));
    }
    const q = searchQuery.trim().toLowerCase();
    return data.filter((item) =>
      Object.values(item).some(
        (val) => val && String(val).toLowerCase().includes(q)
      )
    );
  }, [data, searchQuery, searchFilter]);

  // Sort
  const sortedData = React.useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB), 'ar')
        : String(valB).localeCompare(String(valA), 'ar');
    });
  }, [filteredData, sortKey, sortAsc]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full pr-9 pl-4 py-2.5 min-h-[44px] text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          إجمالي السجلات: <span className="font-bold text-slate-900 dark:text-slate-100">{filteredData.length}</span>
        </div>
      </div>

      {/* Faceted Filter Pills Bar */}
      {(searchQuery.trim() || (facetedFilters && facetedFilters.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            الفلاتر النشطة:
          </span>
          {searchQuery.trim() && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              <span>بحث: {searchQuery}</span>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="hover:text-orange-800 dark:hover:text-orange-200 cursor-pointer"
                aria-label="إزالة فلتر البحث"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {facetedFilters?.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            >
              <span>{f.label}: {f.value}</span>
              <button
                type="button"
                onClick={f.onClear}
                className="hover:text-rose-500 cursor-pointer"
                aria-label={`إزالة فلتر ${f.label}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setCurrentPage(1);
              onClearAllFilters?.();
            }}
            className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer mr-2"
          >
            تفريغ الكل
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        {paginatedData.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            {emptyState || 'لا توجد سجلات مطابقة للبحث'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`${isCompact ? 'py-2 px-3' : 'py-3 px-4'} ${col.className || ''}`}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                        >
                          <span>{col.header}</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {paginatedData.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`${isCompact ? 'py-2 px-3' : 'py-3.5 px-4'} ${col.className || ''}`}
                      >
                        {col.render ? col.render(item) : item[col.key] ?? '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              صفحة {currentPage} من {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 min-h-[36px] min-w-[36px] inline-flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 min-h-[36px] min-w-[36px] inline-flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
