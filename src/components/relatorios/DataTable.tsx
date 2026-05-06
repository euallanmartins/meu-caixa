/* eslint-disable */
import React, { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  format?: (value: any, row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  loading?: boolean;
}

export function DataTable<T>({ columns, data, emptyMessage = 'Não existem informações a serem exibidas', loading }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a: any, b: any) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  return (
    <div className="w-full overflow-x-auto no-scrollbar">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map((col) => (
              <th 
                key={String(col.key)} 
                className={`py-4 px-2 text-[10px] uppercase tracking-widest text-white/30 font-black ${col.sortable ? 'cursor-pointer hover:text-white/60 transition-colors' : ''} ${col.width || ''}`}
                onClick={() => col.sortable && handleSort(String(col.key))}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc' ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            // Skeleton Loading
            Array.from({ length: 3 }).map((_, idx) => (
              <tr key={idx} className="border-b border-white/5 animate-pulse">
                {columns.map((c, i) => (
                  <td key={i} className="py-4 px-2">
                    <div className="h-4 bg-white/5 rounded w-full max-w-[120px]"></div>
                  </td>
                ))}
              </tr>
            ))
          ) : sortedData.length === 0 ? (
            // Empty State
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-xs font-bold text-muted uppercase tracking-widest">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            // Rows
            sortedData.map((row, idx) => (
              <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                {columns.map((col) => (
                   <td key={String(col.key)} className="py-4 px-2 text-xs font-bold text-white/80 group-hover:text-white">
                      {col.format ? col.format((row as any)[col.key], row) : (row as any)[col.key] || '-'}
                   </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
