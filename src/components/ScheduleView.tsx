/* eslint-disable */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Lock,
  MoreVertical,
  Plus,
  Scissors,
  Search,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { trackAnalyticsEvent } from '@/lib/analytics/trackEvent';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { AgendaMobileProprietario } from './AgendaMobileProprietario';
import { AgendaMobileProfissional } from './AgendaMobileProfissional';

interface ScheduleViewProps {
  barbeariaId: string;
  barbers: any[];
  refreshData: () => void;
  currentRole?: string | null;
  scopeBarbeiroId?: string | null;
}

type ViewMode = 'hoje' | 'dia' | 'semana';
type ModalType = 'agendamento' | 'bloqueio';

const HOUR_HEIGHT = 104;
const FALLBACK_START_HOUR = 8;
const FALLBACK_END_HOUR = 20;
const fieldInputClass = 'h-13 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none transition-all focus:border-[#D6B47A]/45 disabled:cursor-not-allowed disabled:opacity-40';
const fieldSelectClass = `${fieldInputClass} appearance-none`;
const fieldTextareaClass = 'w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-bold text-white outline-none transition-all placeholder:text-white/28 focus:border-[#D6B47A]/45';

const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  aceito: 'Aceito',
  confirmado: 'Aceito',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  concluido: 'Concluido',
  realizado: 'Concluido',
  atendido: 'Concluido',
};

function dateToLocalKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = parseLocalDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return dateToLocalKey(date);
}

function getLocalDayRange(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);

  return {
    dayStart: start.toISOString(),
    dayEnd: end.toISOString(),
  };
}

function formatDateLabel(dateKey: string) {
  const date = parseLocalDateKey(dateKey);
  return {
    weekday: date.toLocaleDateString('pt-BR', { weekday: 'long' }),
    weekdayShort: date.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase(),
    dayMonth: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }),
  };
}

export function formatTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function minutesBetween(startValue: string, endValue: string) {
  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  return Math.max(15, Math.round((end - start) / 60000));
}

export function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function appointmentStatusClasses(status: string) {
  if (status === 'pendente') return 'border-amber-300/35 bg-amber-300/[0.075] text-amber-100 shadow-amber-950/20';
  if (status === 'aceito' || status === 'confirmado') return 'border-[#D6B47A]/45 bg-[#D6B47A]/[0.10] text-[#F1D59C] shadow-[#D6B47A]/10';
  if (status === 'recusado' || status === 'cancelado') return 'border-red-400/22 bg-red-400/[0.055] text-red-100/75 shadow-red-950/10';
  if (status === 'concluido' || status === 'realizado' || status === 'atendido') return 'border-white/14 bg-white/[0.045] text-white/70 shadow-black/20';
  return 'border-white/12 bg-white/[0.055] text-white/80 shadow-black/20';
}

export function statusDotClasses(status: string) {
  if (status === 'pendente') return 'bg-amber-300';
  if (status === 'aceito' || status === 'confirmado') return 'bg-[#D6B47A]';
  if (status === 'recusado' || status === 'cancelado') return 'bg-red-300/70';
  if (status === 'concluido' || status === 'realizado' || status === 'atendido') return 'bg-[#D6B47A]/55';
  return 'bg-white/40';
}

export function isScheduleConflictError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /hor[aá]rio ocupado|ocupado ou indisponivel|overlap|conflict|duplicate key|prevent_agendamento_overlap/i.test(message);
}

export function scheduleErrorMessage(error: unknown, fallback = 'Não foi possível concluir agora. Tente novamente em instantes.') {
  if (isScheduleConflictError(error)) return 'Esse horário acabou de ser ocupado. Escolha outro horário.';
  const message = error instanceof Error ? error.message : String(error || '');
  return message || fallback;
}

export function calculateTop(dateStr: string, startHour: number) {
  const date = new Date(dateStr);
  const hour = date.getHours();
  const minutes = date.getMinutes();
  return Math.max(0, (hour - startHour) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT);
}

export function calculateHeight(startStr: string, endStr: string) {
  const durationMin = minutesBetween(startStr, endStr);
  return Math.max(72, (durationMin / 60) * HOUR_HEIGHT - 8);
}

export function calculateTopFromTime(timeStr: string, startHour: number) {
  const [hour, minutes] = timeStr.split(':').map(Number);
  return Math.max(0, (hour - startHour) * HOUR_HEIGHT + (Number(minutes || 0) / 60) * HOUR_HEIGHT);
}

export function calculateHeightFromTimes(startStr: string, endStr: string) {
  const [h1, m1] = startStr.split(':').map(Number);
  const [h2, m2] = endStr.split(':').map(Number);
  const durationMin = Math.max(30, (h2 * 60 + Number(m2 || 0)) - (h1 * 60 + Number(m1 || 0)));
  return Math.max(72, (durationMin / 60) * HOUR_HEIGHT - 8);
}

function groupAppointmentsByBarberAndTime(appointments: any[]) {
  return appointments.reduce((acc: Record<string, any[]>, appointment) => {
    const barberId = appointment.barbeiro_id || 'sem-profissional';
    if (!acc[barberId]) acc[barberId] = [];
    acc[barberId].push(appointment);
    return acc;
  }, {});
}

export function ScheduleView({ barbeariaId, barbers, refreshData, currentRole, scopeBarbeiroId }: ScheduleViewProps) {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const isScopedBarber = currentRole === 'barbeiro' && Boolean(scopeBarbeiroId);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [bloqueios, setBloqueios] = useState<any[]>([]);
  const [businessHours, setBusinessHours] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => dateToLocalKey(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>('dia');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('agendamento');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [quickMenu, setQuickMenu] = useState<{ barberId: string; hour: number; x: number; y: number } | null>(null);

  const [newApp, setNewApp] = useState({
    cliente_id: '',
    barbeiro_id: '',
    servico_id: '',
    data: selectedDate,
    hora: '09:00',
    status: 'aceito',
    observacoes: '',
  });

  const [newBlock, setNewBlock] = useState({
    barbeiro_id: '',
    data: selectedDate,
    tipo: 'horario' as 'horario' | 'dia',
    hora_inicio: '09:00',
    hora_fim: '10:00',
    motivo: '',
  });

  useEffect(() => {
    loadData();
    loadFormResources();
  }, [selectedDate, barbeariaId]);

  useEffect(() => {
    setNewApp(prev => ({ ...prev, data: selectedDate }));
    setNewBlock(prev => ({ ...prev, data: selectedDate }));
  }, [selectedDate]);

  async function loadData() {
    if (!barbeariaId) return;
    setLoading(true);

    const { dayStart, dayEnd } = getLocalDayRange(selectedDate);
    const agendamentosQuery = (includeBarberPhoto: boolean) => {
      let query = supabase
        .from('agendamentos')
        .select(includeBarberPhoto
          ? '*, clientes(nome, telefone, email), servicos(nome, duracao_minutos, valor), barbeiros(nome, foto_url)'
          : '*, clientes(nome, telefone, email), servicos(nome, duracao_minutos, valor), barbeiros(nome)')
        .eq('barbearia_id', barbeariaId)
        .gte('data_hora_inicio', dayStart)
        .lte('data_hora_inicio', dayEnd)
        .order('data_hora_inicio');

      if (isScopedBarber && scopeBarbeiroId) query = query.eq('barbeiro_id', scopeBarbeiroId);
      return query;
    };

    try {
      let resAg = await agendamentosQuery(true);
      if (resAg.error?.code === '42703') {
        console.warn('Fallback agenda sem barbeiros.foto_url:', resAg.error);
        resAg = await agendamentosQuery(false);
      }

      let bloqueiosQuery = supabase
          .from('bloqueios')
          .select('*, barbeiros(nome)')
          .eq('barbearia_id', barbeariaId)
          .eq('data', selectedDate);

      if (isScopedBarber && scopeBarbeiroId) bloqueiosQuery = bloqueiosQuery.eq('barbeiro_id', scopeBarbeiroId);

      const [resBl, resBh] = await Promise.all([
        bloqueiosQuery,
        supabase
          .from('horarios_funcionamento')
          .select('*')
          .eq('barbearia_id', barbeariaId),
      ]);

      if (resAg.error) console.error('Erro ao carregar agendamentos:', resAg.error);
      if (resBl.error) console.error('Erro ao carregar bloqueios:', resBl.error);
      if (resBh.error) console.error('Erro ao carregar horarios:', resBh.error);

      setAgendamentos(resAg.data || []);
      setBloqueios(resBl.data || []);
      setBusinessHours(resBh.data || []);
    } catch (err) {
      console.error('Erro fatal ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadFormResources() {
    if (!barbeariaId) return;
    const [resS, resC] = await Promise.all([
      supabase.from('servicos').select('*').eq('barbearia_id', barbeariaId).eq('ativo', true).order('nome'),
      isScopedBarber
        ? Promise.resolve({ data: [], error: null })
        : supabase.from('clientes').select('*').eq('barbearia_id', barbeariaId).order('nome'),
    ]);

    setServices(resS.data || []);
    setClients(resC.data || []);
  }

  const dateLabel = useMemo(() => formatDateLabel(selectedDate), [selectedDate]);
  const currentDayOfWeek = parseLocalDateKey(selectedDate).getDay();
  const daySettings = businessHours?.find(h => Number(h.dia_semana) === currentDayOfWeek);
  const startHour = daySettings?.aberto && daySettings.hora_inicio
    ? Number(String(daySettings.hora_inicio).split(':')[0])
    : FALLBACK_START_HOUR;
  const endHour = daySettings?.aberto && daySettings.hora_fim
    ? Number(String(daySettings.hora_fim).split(':')[0])
    : FALLBACK_END_HOUR;
  const hours = daySettings?.aberto === false
    ? []
    : Array.from({ length: Math.max(1, endHour - startHour + 1) }, (_, index) => startHour + index);
  const visibleBarbers = useMemo(() => {
    const activeBarbers = (barbers || []).filter(b => b?.ativo !== false);
    const scoped = isScopedBarber && scopeBarbeiroId
      ? activeBarbers.filter(b => b.id === scopeBarbeiroId)
      : activeBarbers;
    return scoped.slice(0, isScopedBarber ? 1 : 4);
  }, [barbers, isScopedBarber, scopeBarbeiroId]);
  const appointmentsByBarber = useMemo(() => groupAppointmentsByBarberAndTime(agendamentos), [agendamentos]);
  const gridHeight = Math.max(1, hours.length) * HOUR_HEIGHT;
  const expeditionLabel = hours.length ? `${hourLabel(startHour)}-${hourLabel(endHour)}` : 'Fechado';
  const upcomingAppointments = useMemo(
    () => agendamentos
      .filter(appointment => new Date(appointment.data_hora_inicio).getTime() >= Date.now())
      .sort((a, b) => new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime())
      .slice(0, 4),
    [agendamentos],
  );

  const filteredClients = useMemo(() => {
    const term = clientSearchTerm.trim().toLowerCase();
    if (!term) return clients.slice(0, 8);
    return clients
      .filter(client => [client.nome, client.telefone, client.email].some(value => String(value || '').toLowerCase().includes(term)))
      .slice(0, 8);
  }, [clients, clientSearchTerm]);

  function openNewAppointment(barberId?: string, hour?: number) {
    if (isScopedBarber) {
      alert('Seu acesso permite criar bloqueios na sua agenda. Agendamentos de cliente devem entrar pelo fluxo da barbearia.');
      return;
    }
    setModalType('agendamento');
    setSelectedAppointment(null);
    setSelectedBlock(null);
    setNewApp(prev => ({
      ...prev,
      barbeiro_id: barberId || prev.barbeiro_id || visibleBarbers[0]?.id || '',
      data: selectedDate,
      hora: typeof hour === 'number' ? hourLabel(hour) : prev.hora,
    }));
    setIsModalOpen(true);
  }

  function openNewBlock(barberId?: string, hour?: number) {
    setModalType('bloqueio');
    setSelectedAppointment(null);
    setSelectedBlock(null);
    setNewBlock(prev => ({
      ...prev,
      barbeiro_id: (isScopedBarber && scopeBarbeiroId) ? scopeBarbeiroId : (barberId || prev.barbeiro_id || ''),
      data: selectedDate,
      hora_inicio: typeof hour === 'number' ? hourLabel(hour) : prev.hora_inicio,
      hora_fim: typeof hour === 'number' ? hourLabel(hour + 1) : prev.hora_fim,
    }));
    setIsModalOpen(true);
  }

  function handleSlotClick(event: React.MouseEvent, barberId: string, hour: number) {
    setQuickMenu({
      barberId,
      hour,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleQuickAction(type: ModalType) {
    if (!quickMenu) return;
    if (type === 'agendamento' && isScopedBarber) {
      setQuickMenu(null);
      return;
    }
    if (type === 'agendamento') openNewAppointment(quickMenu.barberId, quickMenu.hour);
    else openNewBlock(quickMenu.barberId, quickMenu.hour);
    setQuickMenu(null);
  }

  function handleDragStart(event: React.DragEvent, id: string, type: 'app' | 'block') {
    if (isScopedBarber) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('id', id);
    event.dataTransfer.setData('type', type);
    event.currentTarget.classList.add('opacity-50');
  }

  function handleDragEnd(event: React.DragEvent) {
    event.currentTarget.classList.remove('opacity-50');
  }

  async function handleDrop(event: React.DragEvent, targetBarberId: string, hour: number) {
    event.preventDefault();
    const id = event.dataTransfer.getData('id');
    const type = event.dataTransfer.getData('type');
    if (!id || !type) return;

    if (type === 'app') {
      const { data: originalApp } = await supabase
        .from('agendamentos')
        .select('data_hora_inicio, data_hora_fim, barbeiro_id')
        .eq('id', id)
        .eq('barbearia_id', barbeariaId)
        .maybeSingle();

      if (!originalApp) return;
      if (isScopedBarber && originalApp.barbeiro_id !== scopeBarbeiroId) return;

      const oldStart = new Date(originalApp.data_hora_inicio);
      const oldEnd = new Date(originalApp.data_hora_fim);
      const durationMs = oldEnd.getTime() - oldStart.getTime();
      const newStart = new Date(`${selectedDate}T${String(hour).padStart(2, '0')}:00:00`);
      const newEnd = new Date(newStart.getTime() + durationMs);

      const { error } = await supabase
        .from('agendamentos')
        .update({
          barbeiro_id: targetBarberId,
          data_hora_inicio: newStart.toISOString(),
          data_hora_fim: newEnd.toISOString(),
        })
        .eq('id', id)
        .eq('barbearia_id', barbeariaId);

      if (error) {
        alert(scheduleErrorMessage(error));
        await loadData();
      }
      else {
        await loadData();
        refreshData?.();
      }
    }

    if (type === 'block') {
      const { data: originalBlock } = await supabase
        .from('bloqueios')
        .select('hora_inicio, hora_fim, barbeiro_id')
        .eq('id', id)
        .eq('barbearia_id', barbeariaId)
        .maybeSingle();

      if (!originalBlock) return;
      if (isScopedBarber && originalBlock.barbeiro_id !== scopeBarbeiroId) return;

      let durationHours = 1;
      if (originalBlock.hora_inicio && originalBlock.hora_fim) {
        const [h1, m1] = originalBlock.hora_inicio.split(':').map(Number);
        const [h2, m2] = originalBlock.hora_fim.split(':').map(Number);
        durationHours = (h2 + Number(m2 || 0) / 60) - (h1 + Number(m1 || 0) / 60);
      }

      const hStart = `${String(hour).padStart(2, '0')}:00:00`;
      const hEnd = `${String(hour + Math.max(1, Math.round(durationHours))).padStart(2, '0')}:00:00`;
      const { error } = await supabase
        .from('bloqueios')
        .update({
          barbeiro_id: targetBarberId,
          hora_inicio: hStart,
          hora_fim: hEnd,
          data: selectedDate,
        })
        .eq('id', id)
        .eq('barbearia_id', barbeariaId);

      if (error) alert(scheduleErrorMessage(error, 'Erro ao transferir bloqueio.'));
      else loadData();
    }
  }

  async function handleUpdateStatus(id: string, status: string) {
    const appointment = agendamentos.find(item => item.id === id);
    if (isScopedBarber && appointment?.barbeiro_id !== scopeBarbeiroId) {
      alert('Voce so pode alterar agendamentos da sua propria agenda.');
      return;
    }

    const { error } = await supabase
      .from('agendamentos')
      .update({ status })
      .eq('id', id)
      .eq('barbearia_id', barbeariaId);

    if (error) {
      alert(scheduleErrorMessage(error, 'Erro ao atualizar status.'));
      await loadData();
    }
    else {
      await loadData();
      refreshData?.();
      setSelectedAppointment((current: any) => current ? { ...current, status } : current);
    }
  }

  async function handleProfessionalResponse(id: string, status: 'aceito' | 'recusado') {
    const appointment = agendamentos.find(item => item.id === id);
    if (isScopedBarber && appointment?.barbeiro_id !== scopeBarbeiroId) {
      alert('Voce so pode responder agendamentos da sua propria agenda.');
      return;
    }

    const motivo = status === 'recusado'
      ? window.prompt('Motivo da recusa (opcional):') || null
      : null;

    const { data, error } = await supabase.rpc('rpc_profissional_responder_agendamento', {
      p_agendamento_id: id,
      p_novo_status: status,
      p_motivo_recusa: motivo,
    });

    if (error) {
      alert(scheduleErrorMessage(error, 'Erro ao responder agendamento.'));
      await loadData();
      return;
    }

    const result = data as { success?: boolean; message?: string; status?: string } | null;
    if (!result?.success) {
      alert(result?.message || 'Nao foi possivel responder este agendamento.');
      await loadData();
      return;
    }

    void trackAnalyticsEvent({
      barbearia_id: barbeariaId,
      event_type: status === 'aceito' ? 'appointment_accepted' : 'appointment_rejected',
      event_source: 'professional_agenda',
      barbeiro_id: appointment?.barbeiro_id || null,
      cliente_id: appointment?.cliente_id || null,
      agendamento_id: id,
    });

    void fetch('/api/push/professional-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agendamento_id: id,
        status,
      }),
    }).catch((pushError) => {
      console.warn('Falha ao disparar push de resposta profissional:', pushError);
    });

    await loadData();
    refreshData?.();
    setSelectedAppointment((current: any) => current ? { ...current, status: result.status || status } : current);
  }

  async function handleUpdateInternalNote() {
    if (!selectedAppointment) return;
    if (isScopedBarber && selectedAppointment.barbeiro_id !== scopeBarbeiroId) {
      alert('Voce so pode editar observacoes da sua propria agenda.');
      return;
    }
    const { error } = await supabase
      .from('agendamentos')
      .update({ observacoes: selectedAppointment.observacoes })
      .eq('id', selectedAppointment.id)
      .eq('barbearia_id', barbeariaId);

    if (error) alert('Erro ao salvar observacao: ' + error.message);
    else loadData();
  }

  async function handleSaveAppointment() {
    const targetBarbeiroId = isScopedBarber && scopeBarbeiroId ? scopeBarbeiroId : newApp.barbeiro_id;
    if (!newApp.servico_id || !targetBarbeiroId || !newApp.hora) {
      alert('Selecione servico, barbeiro e horario.');
      return;
    }

    const [year, month, day] = newApp.data.split('-').map(Number);
    const [hour, minute] = newApp.hora.split(':').map(Number);
    const start = new Date(year, month - 1, day, hour, minute);
    if (Number.isNaN(start.getTime())) {
      alert('Horario ou data invalidos.');
      return;
    }

    const service = services.find(item => item.id === newApp.servico_id);
    const duration = Number(service?.duracao_minutos || 30);
    const end = new Date(start.getTime() + duration * 60000);

    const { error } = await supabase.from('agendamentos').insert({
      barbearia_id: barbeariaId,
      cliente_id: newApp.cliente_id || null,
      barbeiro_id: targetBarbeiroId,
      servico_id: newApp.servico_id,
      data_hora_inicio: start.toISOString(),
      data_hora_fim: end.toISOString(),
      status: newApp.status,
      observacoes: newApp.observacoes,
    });

    if (error) {
      alert(scheduleErrorMessage(error));
      await loadData();
      return;
    }

    setIsModalOpen(false);
    await loadData();
    refreshData?.();
  }

  async function handleSaveBlock() {
    const { error } = await supabase.from('bloqueios').insert({
      barbearia_id: barbeariaId,
      barbeiro_id: (isScopedBarber && scopeBarbeiroId) ? scopeBarbeiroId : (newBlock.barbeiro_id || null),
      data: newBlock.data,
      tipo: newBlock.tipo,
      hora_inicio: newBlock.tipo === 'horario' ? newBlock.hora_inicio : null,
      hora_fim: newBlock.tipo === 'horario' ? newBlock.hora_fim : null,
      motivo: newBlock.motivo,
    });

    if (error) alert(scheduleErrorMessage(error, 'Erro ao criar bloqueio.'));
    else {
      setIsModalOpen(false);
      loadData();
    }
  }

  async function handleDeleteBlock(blockId: string) {
    const block = bloqueios.find(item => item.id === blockId);
    if (isScopedBarber && block?.barbeiro_id !== scopeBarbeiroId) {
      alert('Voce so pode remover bloqueios da sua propria agenda.');
      return;
    }

    const { error } = await supabase
      .from('bloqueios')
      .delete()
      .eq('id', blockId)
      .eq('barbearia_id', barbeariaId);

    if (error) alert(scheduleErrorMessage(error, 'Erro ao remover bloqueio.'));
    else {
      setSelectedBlock(null);
      loadData();
    }
  }

  function handleCheckout(app: any) {
    if (isScopedBarber) {
      alert('Checkout fica disponivel para dono, admin ou gerente.');
      return;
    }
    router.push(`/gestao/caixa?agendamentoId=${app.id}`);
  }

  return (
    <div className="min-h-full bg-[#070707] text-white">
      <div className="space-y-5">
        <AgendaHeader
          dateLabel={dateLabel}
          onNewAppointment={() => isScopedBarber ? openNewBlock(scopeBarbeiroId || undefined) : openNewAppointment()}
          isScopedBarber={isScopedBarber}
        />

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <AgendaViewSwitcher
            value={viewMode}
            onChange={(mode) => {
              setViewMode(mode);
              if (mode === 'hoje') setSelectedDate(dateToLocalKey(new Date()));
            }}
          />
          <AgendaDateNavigator
            dateLabel={dateLabel}
            onPrev={() => setSelectedDate(prev => addDaysToDateKey(prev, -1))}
            onNext={() => setSelectedDate(prev => addDaysToDateKey(prev, 1))}
            onToday={() => setSelectedDate(dateToLocalKey(new Date()))}
          />
        </div>

        <AgendaSummaryBar
          appointmentsCount={agendamentos.length}
          barbersCount={visibleBarbers.length}
          expeditionLabel={expeditionLabel}
        />

        {viewMode === 'semana' && (
          <div className="rounded-2xl border border-[#D6B47A]/18 bg-[#D6B47A]/[0.06] px-5 py-4 text-sm font-bold text-[#E7C992]">
            A visao semanal esta preparada no controle, mas a grade abaixo segue exibindo o dia selecionado para preservar a operacao atual.
          </div>
        )}

        {isMobile && !isScopedBarber ? (
          <AgendaMobileProprietario
            barbers={visibleBarbers}
            hours={hours}
            startHour={startHour}
            appointmentsByBarber={appointmentsByBarber}
            bloqueios={bloqueios}
            onSelectAppointment={setSelectedAppointment}
            onSelectBlock={setSelectedBlock}
            onSlotClick={handleSlotClick}
          />
        ) : isMobile && isScopedBarber ? (
          <AgendaMobileProfissional
            barber={visibleBarbers[0]}
            hours={hours}
            startHour={startHour}
            appointments={visibleBarbers.length > 0 ? appointmentsByBarber[visibleBarbers[0].id] || [] : []}
            bloqueios={bloqueios}
            onSelectAppointment={setSelectedAppointment}
            onSelectBlock={setSelectedBlock}
            onSlotClick={handleSlotClick}
          />
        ) : (
          <AgendaGrid
            loading={loading}
            hours={hours}
            startHour={startHour}
            gridHeight={gridHeight}
            barbers={visibleBarbers}
            appointmentsByBarber={appointmentsByBarber}
            bloqueios={bloqueios}
            onSlotClick={handleSlotClick}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onSelectAppointment={setSelectedAppointment}
            onSelectBlock={setSelectedBlock}
            canDrag={!isScopedBarber}
          />
        )}

        <UpcomingAppointmentsCard
          appointments={upcomingAppointments}
          onOpen={setSelectedAppointment}
          onViewAll={() => router.push('/gestao/relatorios/lista-agendamentos')}
        />
      </div>

      {quickMenu && (
        <>
          <button className="fixed inset-0 z-[160] cursor-default" onClick={() => setQuickMenu(null)} aria-label="Fechar menu rapido" />
          <div
            className="fixed z-[170] min-w-[230px] overflow-hidden rounded-2xl border border-white/10 bg-[#151515] shadow-2xl shadow-black/50"
            style={{
              top: Math.min(quickMenu.y, typeof window !== 'undefined' ? window.innerHeight - 160 : 0),
              left: Math.min(quickMenu.x, typeof window !== 'undefined' ? window.innerWidth - 260 : 0),
            }}
          >
            {!isScopedBarber && (
              <button
                type="button"
                onClick={() => handleQuickAction('agendamento')}
                className="flex w-full items-center gap-3 border-b border-white/8 px-5 py-4 text-left text-xs font-black uppercase tracking-[0.14em] text-white transition-all hover:bg-white/[0.06]"
              >
                <Plus className="h-4 w-4 text-[#D6B47A]" />
                Novo agendamento
              </button>
            )}
            <button
              type="button"
              onClick={() => handleQuickAction('bloqueio')}
              className="flex w-full items-center gap-3 px-5 py-4 text-left text-xs font-black uppercase tracking-[0.14em] text-white transition-all hover:bg-white/[0.06]"
            >
              <Lock className="h-4 w-4 text-white/45" />
              Bloquear horario
            </button>
          </div>
        </>
      )}

      {selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onChange={setSelectedAppointment}
          onStatus={handleUpdateStatus}
          onProfessionalResponse={handleProfessionalResponse}
          onCheckout={handleCheckout}
          onSaveNote={handleUpdateInternalNote}
          canCheckout={!isScopedBarber}
        />
      )}

      {selectedBlock && (
        <BlockDetails
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          onDelete={handleDeleteBlock}
        />
      )}

      {isModalOpen && (
        <AgendaModal
          type={modalType}
          onClose={() => setIsModalOpen(false)}
          newApp={newApp}
          setNewApp={setNewApp}
          newBlock={newBlock}
          setNewBlock={setNewBlock}
          services={services}
          clients={filteredClients}
          allClients={clients}
          barbers={visibleBarbers}
          clientSearchTerm={clientSearchTerm}
          setClientSearchTerm={setClientSearchTerm}
          onSaveAppointment={handleSaveAppointment}
          onSaveBlock={handleSaveBlock}
          isScopedBarber={isScopedBarber}
        />
      )}
    </div>
  );
}

function AgendaHeader({
  dateLabel,
  onNewAppointment,
  isScopedBarber,
}: {
  dateLabel: ReturnType<typeof formatDateLabel>;
  onNewAppointment: () => void;
  isScopedBarber: boolean;
}) {
  return (
    <header className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-[#111]/80 p-5 shadow-2xl shadow-black/20 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">{isScopedBarber ? 'Minha agenda' : 'Agenda'}</h2>
        <p className="mt-2 text-sm font-bold capitalize text-white/50 sm:text-base">{dateLabel.weekday}, {dateLabel.dayMonth}</p>
      </div>
      <button
        type="button"
        onClick={onNewAppointment}
        className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#D6B47A] px-6 text-sm font-black uppercase tracking-[0.14em] text-black transition-all hover:scale-[1.01] active:scale-[0.98]"
      >
        <Plus className="h-5 w-5" />
        {isScopedBarber ? 'Bloquear horario' : 'Novo agendamento'}
      </button>
    </header>
  );
}

function AgendaViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  const items: Array<{ id: ViewMode; label: string }> = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'dia', label: 'Dia' },
    { id: 'semana', label: 'Semana' },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`h-12 rounded-xl text-xs font-black uppercase tracking-[0.16em] transition-all ${
            value === item.id ? 'bg-[#D6B47A] text-black' : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function AgendaDateNavigator({
  dateLabel,
  onPrev,
  onNext,
  onToday,
}: {
  dateLabel: ReturnType<typeof formatDateLabel>;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <button type="button" onClick={onPrev} className="flex h-13 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/70 hover:text-white">
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button type="button" onClick={onToday} className="min-w-0 text-center">
        <span className="block truncate text-[11px] font-black uppercase tracking-[0.24em] text-[#D6B47A]">{dateLabel.weekdayShort}</span>
        <span className="mt-1 block truncate text-2xl font-black capitalize text-white sm:text-3xl">{dateLabel.dayMonth}</span>
      </button>
      <button type="button" onClick={onNext} className="flex h-13 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/70 hover:text-white">
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}

function AgendaSummaryBar({
  appointmentsCount,
  barbersCount,
  expeditionLabel,
}: {
  appointmentsCount: number;
  barbersCount: number;
  expeditionLabel: string;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryItem icon={CalendarDays} value={appointmentsCount} label="agendamentos" />
        <SummaryItem icon={Users} value={barbersCount} label="barbeiros" />
        <SummaryItem icon={Clock} value={expeditionLabel} label="expediente" />
      </div>
      <button type="button" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 text-xs font-black uppercase tracking-[0.14em] text-white/60 hover:text-white">
        <Filter className="h-4 w-4 text-[#D6B47A]" />
        Filtros
      </button>
    </section>
  );
}

function SummaryItem({ icon: Icon, value, label }: { icon: any; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-black/20 px-4 py-3">
      <Icon className="h-5 w-5 text-[#D6B47A]" />
      <p className="text-sm font-black text-white">
        {value} <span className="font-bold text-white/45">{label}</span>
      </p>
    </div>
  );
}

function AgendaGrid({
  loading,
  hours,
  startHour,
  gridHeight,
  barbers,
  appointmentsByBarber,
  bloqueios,
  onSlotClick,
  onDragStart,
  onDragEnd,
  onDrop,
  onSelectAppointment,
  onSelectBlock,
  canDrag,
}: {
  loading: boolean;
  hours: number[];
  startHour: number;
  gridHeight: number;
  barbers: any[];
  appointmentsByBarber: Record<string, any[]>;
  bloqueios: any[];
  onSlotClick: (event: React.MouseEvent, barberId: string, hour: number) => void;
  onDragStart: (event: React.DragEvent, id: string, type: 'app' | 'block') => void;
  onDragEnd: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent, barberId: string, hour: number) => void;
  onSelectAppointment: (appointment: any) => void;
  onSelectBlock: (block: any) => void;
  canDrag: boolean;
}) {
  const template = `72px repeat(${Math.max(1, barbers.length)}, minmax(178px, 1fr))`;
  const minWidth = `${72 + Math.max(1, barbers.length) * 178}px`;

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
        <div className="h-[640px] animate-pulse rounded-2xl bg-white/[0.045]" />
      </div>
    );
  }

  if (!barbers.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.025] px-6 py-16 text-center">
        <Users className="mx-auto h-12 w-12 text-white/25" />
        <h3 className="mt-4 text-xl font-black text-white">Nenhum barbeiro ativo</h3>
        <p className="mt-2 text-sm text-white/45">Cadastre profissionais ativos para montar a grade do dia.</p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d0d] shadow-2xl shadow-black/30">
      <div className="overflow-x-auto">
        <div className="min-w-full" style={{ minWidth }}>
          <div className="sticky top-0 z-30 grid border-b border-white/10 bg-[#111]/95 backdrop-blur-xl" style={{ gridTemplateColumns: template }}>
            <div className="sticky left-0 z-40 flex h-20 items-center justify-center border-r border-white/10 bg-[#111]/95 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
              Horario
            </div>
            {barbers.map(barber => <BarberHeader key={barber.id} barber={barber} />)}
          </div>

          <div className="grid" style={{ gridTemplateColumns: template }}>
            <div className="sticky left-0 z-20 border-r border-white/10 bg-[#0f0f0f]" style={{ height: gridHeight }}>
              {hours.map(hour => (
                <div key={hour} className="flex items-start justify-center border-b border-white/[0.055] pt-3 text-[11px] font-black text-white/38" style={{ height: HOUR_HEIGHT }}>
                  {hourLabel(hour)}
                </div>
              ))}
            </div>

            {barbers.map(barber => (
              <AgendaBarberColumn
                key={barber.id}
                barber={barber}
                hours={hours}
                startHour={startHour}
                height={gridHeight}
                appointments={appointmentsByBarber[barber.id] || []}
                blocks={bloqueios.filter(block => !block.barbeiro_id || block.barbeiro_id === barber.id)}
                onSlotClick={onSlotClick}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDrop={onDrop}
                onSelectAppointment={onSelectAppointment}
                onSelectBlock={onSelectBlock}
                canDrag={canDrag}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BarberHeader({ barber }: { barber: any }) {
  return (
    <div className="flex h-20 items-center gap-3 border-r border-white/10 px-4 last:border-r-0">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#D6B47A]/18 bg-[#D6B47A]/10 text-sm font-black text-[#D6B47A]">
        {barber.foto_url ? <img src={barber.foto_url} alt="" className="h-full w-full object-cover" /> : String(barber.nome || 'B').slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-white">{barber.nome}</p>
        <p className="mt-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
          <span className="h-1.5 w-1.5 rounded-full bg-[#D6B47A]" />
          Disponivel
        </p>
      </div>
    </div>
  );
}

function AgendaBarberColumn({
  barber,
  hours,
  startHour,
  height,
  appointments,
  blocks,
  onSlotClick,
  onDragStart,
  onDragEnd,
  onDrop,
  onSelectAppointment,
  onSelectBlock,
  canDrag,
}: {
  barber: any;
  hours: number[];
  startHour: number;
  height: number;
  appointments: any[];
  blocks: any[];
  onSlotClick: (event: React.MouseEvent, barberId: string, hour: number) => void;
  onDragStart: (event: React.DragEvent, id: string, type: 'app' | 'block') => void;
  onDragEnd: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent, barberId: string, hour: number) => void;
  onSelectAppointment: (appointment: any) => void;
  onSelectBlock: (block: any) => void;
  canDrag: boolean;
}) {
  return (
    <div className="relative border-r border-white/10 last:border-r-0" style={{ height }}>
      {hours.map(hour => (
        <button
          key={`${barber.id}-${hour}`}
          type="button"
          onClick={(event) => onSlotClick(event, barber.id, hour)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onDrop(event, barber.id, hour)}
          className="group block w-full border-b border-white/[0.055] bg-[#0c0c0c] text-left transition-all hover:bg-[#D6B47A]/[0.045]"
          style={{ height: HOUR_HEIGHT }}
          aria-label={`Criar agendamento para ${barber.nome} as ${hourLabel(hour)}`}
        >
          <span className="ml-3 mt-3 inline-flex rounded-full border border-dashed border-white/8 px-2 py-1 text-[10px] font-bold text-white/0 transition-all group-hover:border-[#D6B47A]/20 group-hover:text-[#D6B47A]/70">
            Livre
          </span>
        </button>
      ))}

      {blocks.map(block => (
        <BlockCard
          key={block.id}
          block={block}
          top={block.tipo === 'dia' ? 6 : calculateTopFromTime(block.hora_inicio || hourLabel(startHour), startHour)}
          height={block.tipo === 'dia' ? Math.max(72, height - 12) : calculateHeightFromTimes(block.hora_inicio || hourLabel(startHour), block.hora_fim || hourLabel(startHour + 1))}
          onSelect={() => onSelectBlock(block)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          canDrag={canDrag}
        />
      ))}

      {appointments.map(appointment => (
        <AgendaAppointmentCard
          key={appointment.id}
          appointment={appointment}
          top={calculateTop(appointment.data_hora_inicio, startHour)}
          height={calculateHeight(appointment.data_hora_inicio, appointment.data_hora_fim)}
          onSelect={() => onSelectAppointment(appointment)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          canDrag={canDrag}
        />
      ))}
    </div>
  );
}

export function AgendaAppointmentCard({
  appointment,
  top,
  height,
  onSelect,
  onDragStart,
  onDragEnd,
  canDrag,
}: {
  appointment: any;
  top: number;
  height: number;
  onSelect: () => void;
  onDragStart: (event: React.DragEvent, id: string, type: 'app' | 'block') => void;
  onDragEnd: (event: React.DragEvent) => void;
  canDrag: boolean;
}) {
  const duration = minutesBetween(appointment.data_hora_inicio, appointment.data_hora_fim);
  const status = String(appointment.status || 'confirmado');
  const compact = height < 100;
  const veryCompact = height < 72;

  return (
    <article
      draggable={canDrag}
      onDragStart={(event) => onDragStart(event, appointment.id, 'app')}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`absolute left-2 right-2 z-10 cursor-pointer overflow-hidden rounded-2xl border shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-black/40 ${compact ? 'p-2' : 'p-3'} ${appointmentStatusClasses(status)}`}
      style={{ top, minHeight: height, height }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black leading-none text-white/70">{formatTime(appointment.data_hora_inicio)}</p>
          <h4 className={`${veryCompact ? 'mt-0.5 text-xs leading-tight' : 'mt-1 text-sm leading-tight'} line-clamp-1 font-black text-white`}>
            {appointment.clientes?.nome || 'Cliente nao informado'}
          </h4>
        </div>
        <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(); }} className="shrink-0 rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white">
          <MoreVertical className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
      </div>
      {!compact && <p className="mt-1 line-clamp-1 text-[11px] font-bold leading-tight text-white/62">{appointment.servicos?.nome || 'Servico'}</p>}
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-black/22 px-2 py-1 text-[10px] font-black leading-none text-white/62">{duration}min</span>
          <span className="flex items-center gap-1 rounded-full bg-black/22 px-2 py-1 text-[10px] font-black leading-none text-white/62">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDotClasses(status)}`} />
            {statusLabel[status] || status}
          </span>
        </div>
      )}
    </article>
  );
}

export function BlockCard({
  block,
  top,
  height,
  onSelect,
  onDragStart,
  onDragEnd,
  canDrag,
}: {
  block: any;
  top: number;
  height: number;
  onSelect: () => void;
  onDragStart: (event: React.DragEvent, id: string, type: 'app' | 'block') => void;
  onDragEnd: (event: React.DragEvent) => void;
  canDrag: boolean;
}) {
  return (
    <article
      draggable={canDrag}
      onDragStart={(event) => onDragStart(event, block.id, 'block')}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className="absolute left-2 right-2 z-[8] cursor-pointer overflow-hidden rounded-2xl border border-white/12 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.06)_6px,rgba(255,255,255,0.025)_6px,rgba(255,255,255,0.025)_12px)] p-3 text-white/65 shadow-xl"
      style={{ top, minHeight: height, height }}
    >
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-white/50" />
        <p className="text-xs font-black uppercase tracking-[0.12em] text-white/70">Bloqueado</p>
      </div>
      {block.motivo && <p className="mt-2 line-clamp-2 text-xs font-bold text-white/45">{block.motivo}</p>}
    </article>
  );
}

function UpcomingAppointmentsCard({ appointments, onOpen, onViewAll }: { appointments: any[]; onOpen: (appointment: any) => void; onViewAll: () => void }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white">Proximos agendamentos</h3>
          <p className="mt-1 text-sm text-white/45">Fila relevante do dia selecionado</p>
        </div>
        <button type="button" onClick={onViewAll} className="rounded-xl border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#D6B47A] hover:bg-white/[0.06]">
          Ver todos
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {appointments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm font-bold text-white/35 lg:col-span-2 xl:col-span-4">
            Nenhum proximo agendamento para hoje.
          </div>
        ) : (
          appointments.map(appointment => (
            <button
              key={appointment.id}
              type="button"
              onClick={() => onOpen(appointment)}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-[#D6B47A]/35 hover:bg-[#D6B47A]/[0.045]"
            >
              <p className="text-lg font-black text-white">{appointment.clientes?.nome || 'Cliente'}</p>
              <p className="mt-1 truncate text-sm font-bold text-white/55">{appointment.servicos?.nome || 'Servico'} com {appointment.barbeiros?.nome || 'profissional'}</p>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[#D6B47A]">Hoje, {formatTime(appointment.data_hora_inicio)}</p>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function AppointmentDetails({
  appointment,
  onClose,
  onChange,
  onStatus,
  onProfessionalResponse,
  onCheckout,
  onSaveNote,
  canCheckout,
}: {
  appointment: any;
  onClose: () => void;
  onChange: (appointment: any) => void;
  onStatus: (id: string, status: string) => void;
  onProfessionalResponse: (id: string, status: 'aceito' | 'recusado') => void;
  onCheckout: (appointment: any) => void;
  onSaveNote: () => void;
  canCheckout: boolean;
}) {
  const status = String(appointment.status || 'confirmado');

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/70 backdrop-blur-sm">
      <button type="button" className="hidden flex-1 cursor-default lg:block" onClick={onClose} aria-label="Fechar detalhes" />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[#101010] shadow-2xl shadow-black">
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#D6B47A]">{formatTime(appointment.data_hora_inicio)}</p>
            <h3 className="mt-1 text-2xl font-black text-white">{appointment.clientes?.nome || 'Cliente nao informado'}</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-white/60 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className={`rounded-2xl border p-4 ${appointmentStatusClasses(status)}`}>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Status</p>
            <p className="mt-2 text-lg font-black text-white">{statusLabel[status] || status}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem icon={Scissors} label="Servico" value={appointment.servicos?.nome || 'Servico'} />
            <DetailItem icon={User} label="Profissional" value={appointment.barbeiros?.nome || 'Profissional'} />
            <DetailItem icon={Clock} label="Duracao" value={`${minutesBetween(appointment.data_hora_inicio, appointment.data_hora_fim)}min`} />
            <DetailItem icon={Calendar} label="Horario" value={`${formatTime(appointment.data_hora_inicio)} - ${formatTime(appointment.data_hora_fim)}`} />
          </div>

          {status === 'pendente' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => onProfessionalResponse(appointment.id, 'aceito')} className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] font-black text-black">
                <Check className="h-5 w-5" />
                Aceitar
              </button>
              <button type="button" onClick={() => onProfessionalResponse(appointment.id, 'recusado')} className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 font-black text-red-100">
                <X className="h-5 w-5" />
                Recusar
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <label className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Observacoes internas</label>
            <textarea
              value={appointment.observacoes || ''}
              onChange={event => onChange({ ...appointment, observacoes: event.target.value })}
              rows={5}
              className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-bold text-white outline-none focus:border-[#D6B47A]/45"
              placeholder="Adicionar observacoes para a equipe..."
            />
            <button type="button" onClick={onSaveNote} className="mt-3 h-11 rounded-xl bg-white px-4 text-sm font-black text-black">
              Salvar observacao
            </button>
          </div>
        </div>

        <div className={`grid gap-3 border-t border-white/10 p-5 ${canCheckout ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <button type="button" onClick={() => onStatus(appointment.id, 'cancelado')} className="h-12 rounded-xl border border-white/10 text-sm font-black text-white/65 hover:bg-white/[0.06]">
            Cancelar
          </button>
          <button type="button" onClick={() => onStatus(appointment.id, 'concluido')} className="h-12 rounded-xl border border-white/10 text-sm font-black text-white/65 hover:bg-white/[0.06]">
            Concluir
          </button>
          {canCheckout && (
            <button type="button" onClick={() => onCheckout(appointment)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#D6B47A] text-sm font-black text-black">
              Checkout
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <Icon className="h-5 w-5 text-[#D6B47A]" />
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-1 truncate font-black text-white">{value}</p>
    </div>
  );
}

function BlockDetails({ block, onClose, onDelete }: { block: any; onClose: () => void; onDelete: (id: string) => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">Bloqueio</p>
            <h3 className="mt-2 text-2xl font-black text-white">{block.motivo || 'Horario bloqueado'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-5 text-sm font-bold text-white/55">
          {block.tipo === 'dia' ? 'Dia inteiro' : `${String(block.hora_inicio || '').slice(0, 5)} - ${String(block.hora_fim || '').slice(0, 5)}`}
        </p>
        <button type="button" onClick={() => onDelete(block.id)} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 font-black text-red-100">
          <Trash2 className="h-4 w-4" />
          Remover bloqueio
        </button>
      </div>
    </div>
  );
}

function AgendaModal({
  type,
  onClose,
  newApp,
  setNewApp,
  newBlock,
  setNewBlock,
  services,
  clients,
  allClients,
  barbers,
  clientSearchTerm,
  setClientSearchTerm,
  onSaveAppointment,
  onSaveBlock,
  isScopedBarber,
}: {
  type: ModalType;
  onClose: () => void;
  newApp: any;
  setNewApp: (value: any) => void;
  newBlock: any;
  setNewBlock: (value: any) => void;
  services: any[];
  clients: any[];
  allClients: any[];
  barbers: any[];
  clientSearchTerm: string;
  setClientSearchTerm: (value: string) => void;
  onSaveAppointment: () => void;
  onSaveBlock: () => void;
  isScopedBarber: boolean;
}) {
  const selectedClient = allClients.find(client => client.id === newApp.cliente_id);
  const selectedService = services.find(service => service.id === newApp.servico_id);

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111] shadow-2xl shadow-black">
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#D6B47A]">{type === 'agendamento' ? 'Agenda' : 'Bloqueio'}</p>
            <h3 className="mt-1 text-2xl font-black text-white">{type === 'agendamento' ? 'Novo agendamento' : 'Bloquear horario'}</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-white/60 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {type === 'agendamento' ? (
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <FieldLabel label="Cliente">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      value={clientSearchTerm}
                      onChange={event => setClientSearchTerm(event.target.value)}
                      placeholder="Buscar por nome, telefone ou email"
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/25 pl-10 pr-3 text-sm font-bold text-white outline-none focus:border-[#D6B47A]/45"
                    />
                  </div>
                  <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => setNewApp({ ...newApp, cliente_id: '' })}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm font-bold ${!newApp.cliente_id ? 'border-[#D6B47A]/35 bg-[#D6B47A]/10 text-[#D6B47A]' : 'border-white/8 bg-black/20 text-white/55'}`}
                    >
                      Venda/chegada sem cliente
                    </button>
                    {clients.map(client => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => setNewApp({ ...newApp, cliente_id: client.id })}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${newApp.cliente_id === client.id ? 'border-[#D6B47A]/35 bg-[#D6B47A]/10' : 'border-white/8 bg-black/20'}`}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-xs font-black text-white">{String(client.nome || 'C').slice(0, 2).toUpperCase()}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-white">{client.nome}</span>
                          <span className="block truncate text-xs text-white/40">{client.telefone || client.email || 'Sem contato'}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </FieldLabel>

              <FieldLabel label="Servico">
                <select value={newApp.servico_id} onChange={event => setNewApp({ ...newApp, servico_id: event.target.value })} className={fieldSelectClass}>
                  <option value="">Selecione o servico</option>
                  {services.map(service => (
                    <option key={service.id} value={service.id}>{service.nome} - R$ {service.valor}</option>
                  ))}
                </select>
              </FieldLabel>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Profissional">
                  <select value={newApp.barbeiro_id} onChange={event => setNewApp({ ...newApp, barbeiro_id: event.target.value })} className={fieldSelectClass} disabled={isScopedBarber}>
                    <option value="">Selecione</option>
                    {barbers.map(barber => <option key={barber.id} value={barber.id}>{barber.nome}</option>)}
                  </select>
                </FieldLabel>
                <FieldLabel label="Status">
                  <select value={newApp.status} onChange={event => setNewApp({ ...newApp, status: event.target.value })} className={fieldSelectClass}>
                    <option value="aceito">Aceito</option>
                    <option value="pendente">Pendente</option>
                    <option value="confirmado">Confirmado</option>
                  </select>
                </FieldLabel>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Data">
                  <input type="date" value={newApp.data} onChange={event => setNewApp({ ...newApp, data: event.target.value })} className={fieldInputClass} />
                </FieldLabel>
                <FieldLabel label="Horario">
                  <input type="time" value={newApp.hora} onChange={event => setNewApp({ ...newApp, hora: event.target.value })} className={fieldInputClass} />
                </FieldLabel>
              </div>

              <FieldLabel label="Observacoes">
                <textarea value={newApp.observacoes} onChange={event => setNewApp({ ...newApp, observacoes: event.target.value })} rows={4} className={fieldTextareaClass} placeholder="Notas internas para este atendimento" />
              </FieldLabel>
            </div>

            <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">Resumo</p>
              <h4 className="mt-3 text-2xl font-black text-white">{selectedClient?.nome || 'Sem cliente'}</h4>
              <p className="mt-2 text-sm font-bold text-white/50">{selectedService?.nome || 'Servico nao selecionado'}</p>
              <p className="mt-5 text-3xl font-black text-[#D6B47A]">R$ {selectedService?.valor || '0,00'}</p>
              <button type="button" onClick={onSaveAppointment} className="mt-6 flex h-13 w-full items-center justify-center rounded-2xl bg-[#D6B47A] font-black text-black">
                Salvar agendamento
              </button>
            </aside>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <FieldLabel label="Profissional">
              <select value={newBlock.barbeiro_id} onChange={event => setNewBlock({ ...newBlock, barbeiro_id: event.target.value })} className={fieldSelectClass} disabled={isScopedBarber}>
                {!isScopedBarber && <option value="">Toda a equipe</option>}
                {barbers.map(barber => <option key={barber.id} value={barber.id}>{barber.nome}</option>)}
              </select>
            </FieldLabel>
            <div className="grid gap-4 sm:grid-cols-3">
              <FieldLabel label="Tipo">
                <select value={newBlock.tipo} onChange={event => setNewBlock({ ...newBlock, tipo: event.target.value })} className={fieldSelectClass}>
                  <option value="horario">Horario</option>
                  <option value="dia">Dia inteiro</option>
                </select>
              </FieldLabel>
              <FieldLabel label="Inicio">
                <input type="time" value={newBlock.hora_inicio} onChange={event => setNewBlock({ ...newBlock, hora_inicio: event.target.value })} disabled={newBlock.tipo === 'dia'} className={fieldInputClass} />
              </FieldLabel>
              <FieldLabel label="Fim">
                <input type="time" value={newBlock.hora_fim} onChange={event => setNewBlock({ ...newBlock, hora_fim: event.target.value })} disabled={newBlock.tipo === 'dia'} className={fieldInputClass} />
              </FieldLabel>
            </div>
            <FieldLabel label="Motivo">
              <textarea value={newBlock.motivo} onChange={event => setNewBlock({ ...newBlock, motivo: event.target.value })} rows={5} className={fieldTextareaClass} placeholder="Ex: Almoco, reuniao, folga" />
            </FieldLabel>
            <button type="button" onClick={onSaveBlock} className="flex h-13 w-full items-center justify-center rounded-2xl bg-white font-black text-black">
              Criar bloqueio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{label}</span>
      {children}
    </label>
  );
}
