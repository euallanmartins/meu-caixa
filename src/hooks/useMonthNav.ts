import { useState, useEffect, useMemo } from 'react';
import { addMonths, subMonths, startOfMonth, endOfMonth, format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function useMonthNav() {
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    // Tenta recuperar do localStorage para manter persistência
    if (typeof window !== 'undefined') {
       const saved = localStorage.getItem('relatorios_data');
       if (saved) {
         const d = new Date(saved);
         if (isValid(d)) return startOfMonth(d);
       }
    }
    return startOfMonth(new Date());
  });

  // Atualiza localStorage sempre que mudar
  useEffect(() => {
    if (typeof window !== 'undefined') {
       localStorage.setItem('relatorios_data', currentDate.toISOString());
    }
  }, [currentDate]);

  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  // Capitalize "Abr 2026" (date-fns retorna lowercase por padrão no ptBR em alguns contextos)
  const formattedMonth = useMemo(() => {
    const str = format(currentDate, 'MMM yyyy', { locale: ptBR });
    return str.replace(/^\w/, c => c.toUpperCase());
  }, [currentDate]);

  const inicioMes = useMemo(() => startOfMonth(currentDate).toISOString(), [currentDate]);
  const fimMes = useMemo(() => endOfMonth(currentDate).toISOString(), [currentDate]);

  return {
    currentDate,
    setCurrentDate,
    handlePrevMonth,
    handleNextMonth,
    formattedMonth,
    inicioMes,
    fimMes
  };
}
