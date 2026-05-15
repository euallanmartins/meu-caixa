'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  setYear, setMonth,
  startOfMonth, endOfMonth,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfYear, endOfYear,
  subDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateFilterMode } from '@/hooks/useDateFilter';

interface DateFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: DateFilterMode;
  startDate: Date;
  endDate: Date;
  onApply: (start: Date, end: Date, mode: DateFilterMode) => void;
}

type DateFilterModalContentProps = Omit<DateFilterModalProps, 'isOpen'>;

const MODES: { id: DateFilterMode; label: string }[] = [
  { id: 'mes', label: 'MÃªs' },
  { id: 'dia', label: 'Hoje' },
  { id: 'semana', label: 'Semana' },
  { id: 'ultimo', label: 'Ãšltimos 30 dias' },
  { id: 'ano', label: 'Ano' },
  { id: 'custom', label: 'De - Para' },
];

const MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

export function DateFilterModal({
  isOpen,
  ...props
}: DateFilterModalProps) {
  if (!isOpen) return null;

  return <DateFilterModalContent key={`${props.currentMode}-${props.startDate.toISOString()}`} {...props} />;
}

function DateFilterModalContent({
  onClose,
  currentMode,
  startDate,
  onApply,
}: DateFilterModalContentProps) {
  const [tempMode, setTempMode] = useState<DateFilterMode>(currentMode);
  const [viewYear, setViewYear] = useState(startDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(startDate.getMonth());

  const handleApply = () => {
    const now = new Date();
    let start: Date;
    let end: Date;

    // FIX: Implementado para TODOS os modos
    switch (tempMode) {
      case 'mes':
        start = startOfMonth(setMonth(new Date(viewYear, 0), selectedMonth));
        start = setYear(start, viewYear);
        end = endOfMonth(start);
        break;
      case 'dia':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'semana':
        start = startOfWeek(now, { locale: ptBR });
        end = endOfWeek(now, { locale: ptBR });
        break;
      case 'ultimo':
        start = startOfDay(subDays(now, 30));
        end = endOfDay(now);
        break;
      case 'ano':
        start = startOfYear(new Date(viewYear, 0));
        end = endOfYear(new Date(viewYear, 0));
        break;
      default: // 'custom' â€” usa mÃªs selecionado como base
        start = startOfMonth(setYear(setMonth(now, selectedMonth), viewYear));
        end = endOfMonth(start);
    }

    onApply(start, end, tempMode);
    onClose();
  };

  const needsMonthPicker = tempMode === 'mes' || tempMode === 'custom';
  const needsYearPicker = tempMode === 'mes' || tempMode === 'ano' || tempMode === 'custom';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#121212] border border-white/10 rounded-[28px] overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Filtrar perÃ­odo</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Modos em Pills */}
        <div className="flex gap-2 flex-wrap px-6 py-4 border-b border-white/5">
          {MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => setTempMode(mode.id)}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                tempMode === mode.id
                  ? 'bg-accent text-black'
                  : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Seletor de Ano */}
        {needsYearPicker && (
          <div className="flex items-center justify-center gap-6 py-4 border-b border-white/5">
            <button
              onClick={() => setViewYear(y => y - 1)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-2xl font-black text-white w-20 text-center">{viewYear}</span>
            <button
              onClick={() => setViewYear(y => y + 1)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Grid de Meses */}
        {needsMonthPicker && (
          <div className="grid grid-cols-4 gap-2 p-6">
            {MONTHS.map((month, idx) => (
              <button
                key={month}
                onClick={() => setSelectedMonth(idx)}
                className={`h-14 rounded-2xl border text-sm font-bold uppercase tracking-widest transition-all ${
                  selectedMonth === idx
                    ? 'bg-accent border-accent text-black shadow-[0_0_16px_rgba(214,180,122,0.3)]'
                    : 'bg-white/5 border-white/5 text-white/40 hover:border-white/20 hover:text-white'
                }`}
              >
                {month}
              </button>
            ))}
          </div>
        )}

        {/* DescriÃ§Ã£o para modos simples */}
        {!needsMonthPicker && (
          <div className="flex items-center justify-center px-6 py-10 text-white/30 text-sm font-bold">
            {tempMode === 'dia' && 'Dados de hoje'}
            {tempMode === 'semana' && 'Semana atual'}
            {tempMode === 'ultimo' && 'Ãšltimos 30 dias a partir de hoje'}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            className="px-8 py-3 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all active:scale-95"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
