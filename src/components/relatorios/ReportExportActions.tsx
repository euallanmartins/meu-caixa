/* eslint-disable */
'use client';

import { Download } from 'lucide-react';
import { useExportCSV } from '@/hooks/useExportCSV';
import { useExportPDF } from '@/hooks/useExportPDF';

interface ReportExportActionsProps {
  title: string;
  subtitle: string;
  data: any[];
  columns: { key: string; label: string }[];
  filenamePrefix: string;
  disabled?: boolean;
}

export function ReportExportActions({ 
  title, 
  subtitle, 
  data, 
  columns, 
  filenamePrefix,
  disabled = false
}: ReportExportActionsProps) {
  const { exportToCSV } = useExportCSV();
  const { exportToPDF } = useExportPDF();

  const handleExportCSV = () => {
    const keys = columns.map(c => c.key);
    const headers = columns.map(c => c.label);
    
    exportToCSV({
       filename: `${filenamePrefix}_${new Date().getTime()}`,
       headers,
       data,
       keys
    });
  };

  const handleExportPDF = () => {
    const keys = columns.map(c => c.key);
    const headers = columns.map(c => c.label);
    
    exportToPDF({
       filename: `${filenamePrefix}_${new Date().getTime()}`,
       title: title.toUpperCase(),
       subtitle,
       headers,
       data,
       keys
    });
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
      <button 
        onClick={handleExportPDF} 
        disabled={disabled || data.length === 0} 
        title="Exportar como documento PDF"
        className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white/10 hover:bg-white/20 border border-white/10 disabled:opacity-20 rounded-xl sm:rounded-2xl transition-all group shrink-0"
      >
         <Download size={14} className="text-white group-hover:scale-110 transition-transform" />
         <div className="flex flex-col items-start leading-none gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-white">
               <span className="hidden sm:inline">Exportar</span> PDF
            </span>
         </div>
      </button>
      
      <button 
        onClick={handleExportCSV} 
        disabled={disabled || data.length === 0} 
        title="Exportar como planilha Excel"
        className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white/20 hover:bg-white/30 border border-white/20 disabled:opacity-20 rounded-xl sm:rounded-2xl transition-all group shrink-0"
      >
         <Download size={14} className="text-white group-hover:scale-110 transition-transform" />
         <div className="flex flex-col items-start leading-none gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-white">
               <span className="hidden sm:inline">Exportar</span> CSV
            </span>
         </div>
      </button>
    </div>
  );
}
