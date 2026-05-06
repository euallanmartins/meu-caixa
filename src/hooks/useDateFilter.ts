'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { 
  startOfMonth, 
  endOfMonth, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfYear, 
  endOfYear,
  format,
  parseISO,
  isValid,
  subDays,
  addMonths,
  subMonths
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCallback, useMemo } from 'react';

export type DateFilterMode = 'custom' | 'dia' | 'semana' | 'mes' | 'ano' | 'ultimo';

export function useDateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Recupera valores da URL ou assume padrões (Mês Atual)
  const mode = (searchParams.get('mode') as DateFilterMode) || 'mes';
  const startStr = searchParams.get('start');
  const endStr = searchParams.get('end');

  const { startDate, endDate } = useMemo(() => {
    let start = startStr ? parseISO(startStr) : startOfMonth(new Date());
    let end = endStr ? parseISO(endStr) : endOfMonth(new Date());

    if (!isValid(start)) start = startOfMonth(new Date());
    if (!isValid(end)) end = endOfMonth(new Date());

    return { startDate: start, endDate: end };
  }, [startStr, endStr]);

  const updateRange = useCallback((newStart: Date, newEnd: Date, newMode: DateFilterMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('start', newStart.toISOString());
    params.set('end', newEnd.toISOString());
    params.set('mode', newMode);
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  const setMode = (newMode: DateFilterMode) => {
    const now = new Date();
    let start = now;
    let end = now;

    switch (newMode) {
      case 'dia':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'semana':
        start = startOfWeek(now, { locale: ptBR });
        end = endOfWeek(now, { locale: ptBR });
        break;
      case 'mes':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'ano':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      case 'ultimo':
        start = subDays(now, 30);
        end = now;
        break;
      default:
        return; // Custom logic handled by specific selection
    }
    updateRange(start, end, newMode);
  };

  const formattedLabel = useMemo(() => {
    if (mode === 'mes') {
      const str = format(startDate, 'MMM yyyy', { locale: ptBR });
      return str.replace(/^\w/, c => c.toUpperCase());
    }
    if (mode === 'dia') {
      return format(startDate, "dd 'de' MMMM", { locale: ptBR });
    }
    return `${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')}`;
  }, [mode, startDate, endDate]);

  return {
    startDate,
    endDate,
    mode,
    setMode,
    updateRange,
    formattedLabel,
    // Helpers para navegação rápida (Mês +/-)
    handlePrevMonth: () => {
      const newStart = startOfMonth(subMonths(startDate, 1));
      const newEnd = endOfMonth(newStart);
      updateRange(newStart, newEnd, 'mes');
    },
    handleNextMonth: () => {
      const newStart = startOfMonth(addMonths(startDate, 1));
      const newEnd = endOfMonth(newStart);
      updateRange(newStart, newEnd, 'mes');
    }
  };
}
