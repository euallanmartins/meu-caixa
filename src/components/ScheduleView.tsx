/* eslint-disable */
'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Check, X, Scissors, Plus, Search, Info, Trash2, Clock, User, Phone, Mail, Pencil, Trash, Star, ChevronDown, Users, RefreshCw, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface ScheduleViewProps {
  barbeariaId: string;
  barbers: any[];
  refreshData: () => void;
}

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

function appointmentStatusClasses(status: string) {
  if (status === 'pendente') return 'bg-yellow-500/10 border-yellow-500/25 text-yellow-300';
  if (status === 'aceito' || status === 'confirmado') return 'bg-[#D6B47A]/10 border-[#D6B47A]/25 text-[#D6B47A]';
  if (status === 'recusado' || status === 'cancelado') return 'bg-red-500/10 border-red-500/25 text-red-300';
  if (status === 'concluido' || status === 'realizado' || status === 'atendido') return 'bg-blue-500/10 border-blue-500/25 text-blue-300';
  return 'bg-white/5 border-white/10 text-white/70';
}

function appointmentAccentClass(status: string) {
  if (status === 'pendente') return 'text-yellow-300';
  if (status === 'aceito' || status === 'confirmado') return 'text-[#D6B47A]';
  if (status === 'recusado' || status === 'cancelado') return 'text-red-300';
  if (status === 'concluido' || status === 'realizado' || status === 'atendido') return 'text-blue-300';
  return 'text-white/70';
}

export function ScheduleView({ barbeariaId, barbers, refreshData }: ScheduleViewProps) {
  const router = useRouter();
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [bloqueios, setBloqueios] = useState<any[]>([]);
  const [businessHours, setBusinessHours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => dateToLocalKey(new Date()));
  const [mobileViewMode, setMobileViewMode] = useState<'dia' | 'semana'>('dia');
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [drawerTab, setDrawerTab] = useState<'appointment' | 'info'>('appointment');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'agendamento' | 'bloqueio'>('agendamento');
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  
  const [services, setServices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  
  // New Appointment / Block State
  const [newApp, setNewApp] = useState({
    cliente_id: '',
    barbeiro_id: '',
    servico_id: '',
    data: selectedDate,
    hora: '09:00',
    status: 'aceito',
    observacoes: ''
  });

  const [newBlock, setNewBlock] = useState({
    barbeiro_id: '',
    data: selectedDate,
    tipo: 'horario' as 'horario' | 'dia',
    hora_inicio: '09:00',
    hora_fim: '10:00',
    motivo: ''
  });

  const [quickMenu, setQuickMenu] = useState<{ barberId: string; hour: number; x: number; y: number } | null>(null);

  const handleSlotClick = (e: React.MouseEvent, barberId: string, hour: number) => {
    // Abrir o Quick Menu na posiÃ§Ã£o do clique
    
    setQuickMenu({
      barberId,
      hour,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleQuickAction = (type: 'agendamento' | 'bloqueio') => {
    if (!quickMenu) return;
    
    setModalType(type);
    if (type === 'agendamento') {
      setNewApp({
        ...newApp,
        barbeiro_id: quickMenu.barberId,
        hora: `${String(quickMenu.hour).padStart(2, '0')}:00`,
        data: selectedDate
      });
    } else {
      setNewBlock({
        ...newBlock,
        barbeiro_id: quickMenu.barberId,
        hora_inicio: `${String(quickMenu.hour).padStart(2, '0')}:00`,
        hora_fim: `${String(quickMenu.hour + 1).padStart(2, '0')}:00`,
        data: selectedDate
      });
    }
    setIsModalOpen(true);
    setQuickMenu(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string, type: 'app' | 'block') => {
    e.dataTransfer.setData('id', id);
    e.dataTransfer.setData('type', type);
    // Adicionar efeito visual de fantasma se necessÃ¡rio
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-50');
  };

  const handleDrop = async (e: React.DragEvent, targetBarberId: string, hour: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('id');
    const type = e.dataTransfer.getData('type');

    if (!id || !type) return;

    if (type === 'app') {
      const { data: originalApp } = await supabase
        .from('agendamentos')
        .select('data_hora_inicio, data_hora_fim')
        .eq('id', id)
        .eq('barbearia_id', barbeariaId)
        .maybeSingle();
      if (!originalApp) return;

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
          data_hora_fim: newEnd.toISOString()
        })
        .eq('id', id)
        .eq('barbearia_id', barbeariaId);

      if (error) alert('Erro ao transferir agendamento: ' + error.message);
      else loadData();

    } else if (type === 'block') {
      const { data: originalBlock } = await supabase
        .from('bloqueios')
        .select('hora_inicio, hora_fim')
        .eq('id', id)
        .eq('barbearia_id', barbeariaId)
        .maybeSingle();
      if (!originalBlock) return;

      let durationHours = 1;
      if (originalBlock.hora_inicio && originalBlock.hora_fim) {
        const [h1, m1] = originalBlock.hora_inicio.split(':').map(Number);
        const [h2, m2] = originalBlock.hora_fim.split(':').map(Number);
        durationHours = (h2 + m2/60) - (h1 + m1/60);
      }

      const hStart = String(hour).padStart(2, '0') + ':00:00';
      const hEnd = String(hour + Math.max(1, Math.round(durationHours))).padStart(2, '0') + ':00:00';

      const { error } = await supabase
        .from('bloqueios')
        .update({ 
          barbeiro_id: targetBarberId,
          hora_inicio: hStart,
          hora_fim: hEnd,
          data: selectedDate
        })
        .eq('id', id)
        .eq('barbearia_id', barbeariaId);

      if (error) alert('Erro ao transferir bloqueio: ' + error.message);
      else loadData();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // NecessÃ¡rio para permitir o drop
  };

  useEffect(() => {
    loadData();
    loadFormResources();
  }, [selectedDate, barbeariaId]);

  async function loadData() {
    if (!barbeariaId) return;
    setLoading(true);
    
    const { dayStart, dayEnd } = getLocalDayRange(selectedDate);

    try {
      const [resAg, resBl, resBh] = await Promise.all([
        supabase
          .from('agendamentos')
          .select('*, clientes(nome, telefone, email), servicos(nome, duracao_minutos, valor), barbeiros(nome)')
          .eq('barbearia_id', barbeariaId)
          .gte('data_hora_inicio', dayStart)
          .lte('data_hora_inicio', dayEnd)
          .order('data_hora_inicio'),
        supabase
          .from('bloqueios')
          .select('*, barbeiros(nome)')
          .eq('barbearia_id', barbeariaId)
          .eq('data', selectedDate),
        supabase
          .from('horarios_funcionamento')
          .select('*')
          .eq('barbearia_id', barbeariaId)
      ]);

      if (resAg.error) console.error('Erro ao carregar agendamentos:', resAg.error);
      if (resBl.error) console.error('Erro ao carregar bloqueios:', resBl.error);
      if (resBh.error) console.error('Erro ao carregar horÃ¡rios:', resBh.error);

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
    const [resS, resC] = await Promise.all([
      supabase.from('servicos').select('*').eq('barbearia_id', barbeariaId),
      supabase.from('clientes').select('*').eq('barbearia_id', barbeariaId)
    ]);
    setServices(resS.data || []);
    setClients(resC.data || []);
  }

  // ConfiguraÃ§Ã£o DinÃ¢mica de HorÃ¡rios
  const currentDayOfWeek = new Date(selectedDate + 'T12:00:00').getDay();
  const daySettings = businessHours?.find(h => h.dia_semana === currentDayOfWeek) || {
    aberto: true,
    hora_inicio: '08:00:00',
    hora_fim: '20:00:00'
  };

  const START_HOUR = parseInt(daySettings.hora_inicio.split(':')[0]);
  const END_HOUR = parseInt(daySettings.hora_fim.split(':')[0]);
  const hours = daySettings.aberto 
    ? Array.from({ length: (END_HOUR - START_HOUR) + 1 }, (_, i) => i + START_HOUR)
    : [];

  const HOUR_HEIGHT = 128; // h-32 = 8rem = 128px

  const calculateTop = (dateStr: string) => {
    const date = new Date(dateStr);
    const hour = date.getHours();
    const minutes = date.getMinutes();
    return (hour - START_HOUR) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
  };

  const calculateHeight = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const durationMin = (end.getTime() - start.getTime()) / 60000;
    return (durationMin / 60) * HOUR_HEIGHT;
  };

  const calculateTopFromTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
  };

  const calculateHeightFromTimes = (startStr: string, endStr: string) => {
    const [h1, m1] = startStr.split(':').map(Number);
    const [h2, m2] = endStr.split(':').map(Number);
    const durationMin = (h2 * 60 + m2) - (h1 * 60 + m1);
    return (durationMin / 60) * HOUR_HEIGHT;
  };

  const getAppointmentsForBarber = (barberId: string) => {
    return agendamentos.filter(ag => ag.barbeiro_id === barberId);
  };

  const getBlocksForBarber = (barberId: string | null) => {
    return bloqueios.filter(bl => bl.barbeiro_id === barberId || bl.barbeiro_id === null);
  };

  const upcomingMobile = agendamentos
    .filter(ag => new Date(ag.data_hora_inicio).getTime() >= Date.now() && ['pendente', 'aceito', 'confirmado'].includes(String(ag.status)))
    .sort((a, b) => new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime())
    .slice(0, 3);

  const mobileWeekDays = Array.from({ length: 7 }, (_, index) => {
    const start = parseLocalDateKey(selectedDate);
    start.setDate(start.getDate() - start.getDay() + index);
    const key = dateToLocalKey(start);
    const total = agendamentos.filter(ag => dateToLocalKey(new Date(ag.data_hora_inicio)) === key).length;
    return { key, date: start, total };
  });

  async function handleUpdateStatus(id: string, status: string) {
    const { error } = await supabase
      .from('agendamentos')
      .update({ status })
      .eq('id', id)
      .eq('barbearia_id', barbeariaId);
    
    if (error) alert('Erro ao atualizar status');
    else {
       loadData();
       setIsDrawerOpen(false);
    }
  }

  async function handleProfessionalResponse(id: string, status: 'aceito' | 'recusado') {
    const motivo = status === 'recusado'
      ? window.prompt('Motivo da recusa (opcional):') || null
      : null;

    const { data, error } = await supabase.rpc('rpc_profissional_responder_agendamento', {
      p_agendamento_id: id,
      p_novo_status: status,
      p_motivo_recusa: motivo,
    });

    if (error) {
      alert(error.message || 'Erro ao responder agendamento.');
      return;
    }

    const result = data as { success?: boolean; message?: string; status?: string } | null;
    if (!result?.success) {
      alert(result?.message || 'Nao foi possivel responder este agendamento.');
      return;
    }

    await loadData();
    if (refreshData) refreshData();
    setSelectedAppointment((current: any) => current ? { ...current, status: result.status || status } : current);
  }

  async function handleUpdateInternalNote() {
    if (!selectedAppointment) return;
    const { error } = await supabase
      .from('agendamentos')
      .update({ observacoes: selectedAppointment.observacoes })
      .eq('id', selectedAppointment.id)
      .eq('barbearia_id', barbeariaId);
    
    if (error) console.error('Erro ao salvar nota:', error);
  }

  async function handleSaveAppointment() {
    try {
      if (!newApp.servico_id || !newApp.barbeiro_id || !newApp.hora) {
        alert('Por favor, selecione um serviÃ§o, um barbeiro e o horÃ¡rio.');
        return;
      }

      // ConstruÃ§Ã£o segura da data: YYYY-MM-DD + HH:mm
      const [year, month, day] = newApp.data.split('-').map(Number);
      const [hour, minute] = newApp.hora.split(':').map(Number);
      
      const start = new Date(year, month - 1, day, hour, minute);
      
      if (isNaN(start.getTime())) {
        alert('HorÃ¡rio ou data invÃ¡lidos.');
        return;
      }

      const service = services.find(s => s.id === newApp.servico_id);
      const duration = service?.duracao_minutos || 30;
      const end = new Date(start.getTime() + duration * 60000);

      const { error } = await supabase.from('agendamentos').insert({
        barbearia_id: barbeariaId,
        cliente_id: newApp.cliente_id || null,
        barbeiro_id: newApp.barbeiro_id,
        servico_id: newApp.servico_id,
        data_hora_inicio: start.toISOString(),
        data_hora_fim: end.toISOString(),
        status: newApp.status,
        observacoes: newApp.observacoes
      });

      if (error) {
        console.error('Erro Supabase:', error);
        alert('Erro ao salvar no banco: ' + error.message);
      } else {
        setIsModalOpen(false);
        loadData();
        if (refreshData) refreshData();
      }
    } catch (err: any) {
      console.error('Erro Fatal handleSaveAppointment:', err);
      alert('Erro inesperado: ' + err.message);
    }
  }

  async function handleSaveBlock() {
    const { error } = await supabase.from('bloqueios').insert({
      barbearia_id: barbeariaId,
      barbeiro_id: newBlock.barbeiro_id || null,
      data: newBlock.data,
      tipo: newBlock.tipo,
      hora_inicio: newBlock.tipo === 'horario' ? newBlock.hora_inicio : null,
      hora_fim: newBlock.tipo === 'horario' ? newBlock.hora_fim : null,
      motivo: newBlock.motivo
    });

    if (error) alert(error.message);
    else {
      setIsModalOpen(false);
      loadData();
    }
  }

  const handleCheckout = (app: any) => {
    router.push(`/gestao/caixa?agendamentoId=${app.id}`);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
      <div className="space-y-6 pb-5 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push('/gestao')}
            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white"
            aria-label="Menu"
          >
            <span className="block h-0.5 w-7 bg-white before:relative before:-top-2 before:block before:h-0.5 before:w-7 before:bg-white after:relative after:top-[6px] after:block after:h-0.5 after:w-7 after:bg-white" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-3xl font-black uppercase leading-none text-white">Agenda</h2>
            <p className="mt-2 text-sm text-white/45">Gestao de horarios e profissionais</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setModalType('agendamento');
              setIsModalOpen(true);
            }}
            className="flex h-16 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-left font-black text-white"
          >
            <Plus className="h-7 w-7 text-[#D6B47A]" />
            <span className="leading-tight">Novo<br />Agendamento</span>
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
          <div className="grid grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, -1))}
              className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(dateToLocalKey(new Date()))}
              className="min-w-0 text-center"
              aria-label="Voltar para hoje"
            >
              <span className="block text-sm font-black uppercase tracking-[0.16em] text-[#D6B47A]">
                {parseLocalDateKey(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long' })}
              </span>
              <span className="mt-1 block truncate text-2xl font-black uppercase text-white">
                {parseLocalDateKey(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, 1))}
              className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setModalType('bloqueio');
              setIsModalOpen(true);
            }}
            className="mt-4 flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] text-xs font-black uppercase tracking-[0.16em]"
          >
            <Calendar className="h-5 w-5" />
            Ausencia / Bloqueio
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedDate(dateToLocalKey(new Date()))}
            className="h-14 rounded-2xl border border-white/10 bg-white/[0.04] px-7 text-xs font-black uppercase tracking-[0.16em]"
          >
            Hoje
          </button>
          <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setMobileViewMode('dia')}
              className={`flex h-14 items-center gap-2 rounded-xl px-6 text-sm font-black uppercase transition-all ${
                mobileViewMode === 'dia' ? 'bg-[#D6B47A] text-black' : 'text-white/45'
              }`}
            >
              <Calendar className="h-5 w-5" />
              Dia
            </button>
            <button
              type="button"
              onClick={() => setMobileViewMode('semana')}
              className={`flex h-14 items-center gap-2 rounded-xl px-6 text-sm font-black uppercase transition-all ${
                mobileViewMode === 'semana' ? 'bg-[#D6B47A] text-black' : 'text-white/45'
              }`}
            >
              Semana
            </button>
          </div>
        </div>
      </div>

      {mobileViewMode === 'semana' && (
        <div className="mb-6 grid gap-3 lg:hidden">
          {mobileWeekDays.map(day => {
            const isSelected = day.key === selectedDate;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => {
                  setSelectedDate(day.key);
                  setMobileViewMode('dia');
                }}
                className={`flex items-center justify-between rounded-3xl border p-5 text-left transition-all ${
                  isSelected
                    ? 'border-[#D6B47A]/45 bg-[#D6B47A]/10'
                    : 'border-white/10 bg-white/[0.035]'
                }`}
              >
                <span>
                  <span className="block text-xs font-black uppercase tracking-[0.16em] text-[#D6B47A]">
                    {day.date.toLocaleDateString('pt-BR', { weekday: 'long' })}
                  </span>
                  <span className="mt-1 block text-2xl font-black uppercase text-white">
                    {day.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                  </span>
                </span>
                <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/65">
                  {isSelected ? `${day.total} agenda${day.total === 1 ? '' : 's'}` : 'Ver dia'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div className="hidden p-8 lg:flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-6">
          <div className="liquid-glass p-1 rounded-2xl flex border border-white/10">
            <button 
              onClick={() => {
                setSelectedDate(addDaysToDateKey(selectedDate, -1));
              }}
              className="p-3 hover:bg-white/10 rounded-xl transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-6 flex flex-col justify-center text-center min-w-[200px]">
              <span className="text-xs font-black uppercase tracking-widest text-[#D6B47A]">
                {parseLocalDateKey(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long' })}
              </span>
              <span className="text-lg font-black uppercase tracking-tighter">
                {parseLocalDateKey(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
              </span>
            </div>
            <button 
              onClick={() => {
                setSelectedDate(addDaysToDateKey(selectedDate, 1));
              }}
              className="p-3 hover:bg-white/10 rounded-xl transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <button 
            onClick={() => setSelectedDate(dateToLocalKey(new Date()))}
            className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            Hoje
          </button>
        </div>

        <div className="flex items-center gap-4">
           <button 
            onClick={() => {
              setModalType('bloqueio');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
           >
             AusÃªncia / Bloqueio
           </button>
           <button 
            onClick={() => {
              setModalType('agendamento');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-[#D6B47A] text-black text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-glow"
           >
             <Plus size={16} /> Novo Agendamento
           </button>
        </div>
      </div>

      {/* Grid */}
      <div className={`${mobileViewMode === 'dia' ? 'flex' : 'hidden'} -mx-4 flex-1 overflow-auto no-scrollbar relative min-h-[56vh] flex-col border-y border-white/8 lg:mx-0 lg:flex lg:min-h-[60vh] lg:border-y-0`}>
        {!daySettings.aberto ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 sm:p-20 text-center space-y-6 animate-in fade-in zoom-in duration-500">
             <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                <X size={48} strokeWidth={3} />
             </div>
             <div className="space-y-2">
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Barbearia Fechada</h3>
                <p className="text-white/40 font-bold uppercase tracking-widest text-xs max-w-xs mx-auto leading-relaxed">
                  NÃ£o hÃ¡ expediente configurado para este dia da semana nas configuraÃ§Ãµes.
                </p>
             </div>
             <button 
               onClick={() => {
                 setSelectedDate(addDaysToDateKey(selectedDate, 1));
               }}
               className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all hover:scale-105 active:scale-95"
             >
               Ver PrÃ³ximo Dia
             </button>
          </div>
        ) : (
          <div className="flex min-w-full">
            {/* Time Column */}
            <div className="w-24 shrink-0 border-r border-white/5 bg-[#0a0a0a] sticky left-0 z-20">
              {hours.map(hour => (
                <div key={hour} className="h-32 border-b border-white/5 px-4 py-2 text-[10px] font-black text-white/30 uppercase">
                  {hour}:00
                </div>
              ))}
            </div>

            {/* Barbers Columns */}
            <div className="flex flex-1">
              {barbers.map(barber => (
                <div key={barber.id} className="min-w-[300px] flex-1 border-r border-white/5 relative">
                  <div className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-md px-6 py-4 border-b border-white/5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#D6B47A]/20 flex items-center justify-center border border-[#D6B47A]/20 text-[#D6B47A]">
                      <User size={16} />
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest">{barber.nome}</h3>
                  </div>

                  <div className="relative">
                    {/* Grid Background Slots */}
                    {hours.map(hour => (
                      <div 
                        key={hour} 
                        onClick={(e) => handleSlotClick(e, barber.id, hour)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, barber.id, hour)}
                        className="h-32 border-b border-white/5 relative group cursor-pointer hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                           <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-white/20">
                              <Plus size={20} />
                           </div>
                        </div>
                      </div>
                    ))}
                    {/* Items (Appointments + Blocks) with Overlap Handling */}
                    {(() => {
                      const apps = (agendamentos || [])
                        .filter(a => a.barbeiro_id === barber.id)
                        .map(a => ({
                          ...a,
                          itemType: 'app',
                          startNum: new Date(a.data_hora_inicio).getTime(),
                          endNum: new Date(a.data_hora_fim).getTime()
                        }));
                      
                      const blks = (bloqueios || [])
                        .filter(b => (b.barbeiro_id === barber.id || !b.barbeiro_id) && b.tipo !== 'dia')
                        .map(b => {
                          const [h1, m1] = b.hora_inicio.split(':').map(Number);
                          const [h2, m2] = b.hora_fim.split(':').map(Number);
                          const s = parseLocalDateKey(selectedDate);
                          s.setHours(h1, m1, 0);
                          const e = parseLocalDateKey(selectedDate);
                          e.setHours(h2, m2, 0);
                          return {
                            ...b,
                            itemType: 'block',
                            startNum: s.getTime(),
                            endNum: e.getTime()
                          };
                        });

                      const allItems = [...apps, ...blks].sort((a, b) => a.startNum - b.startNum);
                      
                      // Group overlapping items
                      const columns: any[][] = [];
                      allItems.forEach(item => {
                        let placed = false;
                        for (const col of columns) {
                          const lastItem = col[col.length - 1];
                          if (item.startNum >= lastItem.endNum) {
                            col.push(item);
                            placed = true;
                            break;
                          }
                        }
                        if (!placed) columns.push([item]);
                      });

                      return columns.flatMap((col, colIdx) => {
                        const width = 100 / columns.length;
                        const left = colIdx * width;
                        const isCompact = columns.length > 1;

                        return col.map(item => {
                          const itemTop = (item.itemType === 'app' ? 
                            calculateTop(item.data_hora_inicio) : 
                            calculateTopFromTime(item.hora_inicio)) + 4;
                          const itemHeight = (item.itemType === 'app' ? 
                            calculateHeight(item.data_hora_inicio, item.data_hora_fim) : 
                            calculateHeightFromTimes(item.hora_inicio, item.hora_fim)) - 8;
                          
                          const isShort = itemHeight < 60;
                          const isTiny = itemHeight < 40;
                          const paddingClass = isTiny ? 'p-1' : (isCompact || isShort) ? 'p-2' : 'p-4';

                          if (item.itemType === 'app') {
                            return (
                              <button
                                key={item.id}
                                title={`${item.servicos?.nome} - ${item.clientes?.nome || 'Cliente Avulso'}`}
                                draggable="true"
                                onDragStart={(e) => handleDragStart(e, item.id, 'app')}
                                onDragEnd={handleDragEnd}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAppointment(item);
                                  setSelectedBlock(null);
                                  setDrawerTab('appointment');
                                  setIsDrawerOpen(true);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: itemTop,
                                  height: itemHeight,
                                  left: `${left}%`,
                                  width: `calc(${width}% - 8px)`,
                                  marginLeft: '4px'
                                }}
                                className={`z-10 rounded-2xl ${paddingClass} flex ${isTiny ? 'flex-row items-center justify-center gap-2' : 'flex-col justify-between'} transition-all hover:scale-[0.99] overflow-hidden active:scale-95 shadow-lg border ${appointmentStatusClasses(item.status)}`}
                              >
                                {isTiny ? (
                                  <>
                                    <p className={`font-black uppercase tracking-tight text-[8px] truncate max-w-[45%] ${appointmentAccentClass(item.status)}`}>
                                      {item.servicos?.nome || 'ServiÃ§o'}
                                    </p>
                                    <span className="text-white/20 text-[8px]">â€¢</span>
                                    <h4 className="text-[8px] font-black uppercase truncate text-white leading-none max-w-[45%]">
                                      {item.clientes?.nome || 'Cliente Avulso'}
                                    </h4>
                                  </>
                                ) : (
                                  <>
                                    <div className="relative z-10 w-full">
                                      <p className={`font-black uppercase tracking-tight truncate ${isShort ? 'text-[7px] mb-0' : 'text-[8px] mb-1'} ${appointmentAccentClass(item.status)}`}>
                                        {item.servicos?.nome || 'ServiÃ§o'}
                                      </p>
                                      <h4 className={`${(isCompact || isShort) ? 'text-[9px]' : 'text-xs'} font-black uppercase truncate text-white leading-none`}>
                                        {item.clientes?.nome || 'Cliente Avulso'}
                                      </h4>
                                    </div>
                                    
                                    {!isShort && (
                                      <div className="flex items-center justify-between relative z-10 mt-auto pt-2 border-t border-white/5">
                                        <span className="text-[9px] font-bold text-white/40 uppercase">
                                          {new Date(item.startNum).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {['aceito', 'confirmado'].includes(item.status) && !isCompact && (
                                          <Check size={12} className="text-[#D6B47A]" />
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </button>
                            );
                          } else {
                            return (
                              <div 
                                key={item.id} 
                                draggable="true"
                                onDragStart={(e) => handleDragStart(e, item.id, 'block')}
                                onDragEnd={handleDragEnd}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBlock(item);
                                  setSelectedAppointment(null);
                                  setIsDrawerOpen(true);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: itemTop,
                                  height: itemHeight,
                                  left: `${left}%`,
                                  width: `calc(${width}% - 8px)`,
                                  marginLeft: '4px'
                                }}
                                className={`z-10 bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center ${paddingClass} animate-in fade-in zoom-in-95 cursor-move hover:bg-white/10 transition-colors`}
                              >
                                 {!isShort && <Clock size={isCompact ? 12 : 16} className="text-white/20 mb-2" />}
                                 <span className={`${isTiny ? 'text-[7px]' : (isCompact || isShort) ? 'text-[8px]' : 'text-[9px]'} font-black uppercase tracking-widest text-white/30 truncate w-full`}>{item.motivo || 'IndisponÃ­vel'}</span>
                                 {!isShort && (
                                   <span className="text-[8px] font-bold text-white/20 mt-1 uppercase tracking-tighter truncate">
                                     {item.hora_inicio.substring(0, 5)} - {item.hora_fim.substring(0, 5)}
                                   </span>
                                 )}
                              </div>
                            );
                          }
                        });
                      });
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] lg:hidden">
        <div className="flex items-center justify-between border-b border-white/8 p-5">
          <h3 className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.12em] text-white">
            <Calendar className="h-5 w-5 text-[#D6B47A]" />
            Proximos agendamentos
          </h3>
          <button
            type="button"
            onClick={() => router.push('/gestao/relatorios/lista-agendamentos')}
            className="rounded-2xl border border-[#D6B47A]/25 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#D6B47A]"
          >
            Ver todos
          </button>
        </div>
        <div className="divide-y divide-white/8">
          {upcomingMobile.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-white/45">Nenhum agendamento futuro para este dia.</div>
          ) : upcomingMobile.map(ag => (
            <button
              key={ag.id}
              type="button"
              onClick={() => {
                setSelectedAppointment(ag);
                setSelectedBlock(null);
                setDrawerTab('appointment');
                setIsDrawerOpen(true);
              }}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
            >
              <span>
                <span className="block text-3xl font-black text-white">
                  {new Date(ag.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="mt-2 block text-sm text-white/55">
                  {ag.barbeiros?.nome || 'Profissional'} <span className="text-[#D6B47A]">â€¢</span> {ag.servicos?.nome || 'Servico'}
                </span>
              </span>
              <span className="text-lg font-black text-white">{ag.clientes?.nome || 'Cliente'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Drawer */}
      {isDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in" onClick={() => setIsDrawerOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-[450px] bg-[#0d0d0d] border-l border-white/10 z-[110] shadow-2xl animate-in slide-in-from-right duration-500">
            
            {selectedAppointment && (
              <>
                {/* Drawer Header Appointment */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setIsDrawerOpen(false)}
                      className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all border border-white/10"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Detalhes do Agendamento</h3>
                  </div>
                  <button 
                    className="p-3 text-white/20 hover:text-red-500 transition-colors"
                    onClick={() => {
                       if (confirm('Deseja excluir este agendamento?')) {
                         supabase
                           .from('agendamentos')
                           .delete()
                           .eq('id', selectedAppointment.id)
                           .eq('barbearia_id', barbeariaId)
                           .then(() => {
                            loadData();
                            setIsDrawerOpen(false);
                         });
                       }
                    }}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-white/5">
                   <button 
                    onClick={() => setDrawerTab('appointment')}
                    className={`flex-1 py-6 text-[10px] font-black uppercase tracking-widest transition-all ${drawerTab === 'appointment' ? 'text-[#D6B47A] border-b-2 border-[#D6B47A]' : 'text-white/40'}`}
                   >
                     Agendamento
                   </button>
                   <button 
                    onClick={() => setDrawerTab('info')}
                    className={`flex-1 py-6 text-[10px] font-black uppercase tracking-widest transition-all ${drawerTab === 'info' ? 'text-[#D6B47A] border-b-2 border-[#D6B47A]' : 'text-white/40'}`}
                   >
                     InformaÃ§Ãµes
                   </button>
                </div>

                <div className="p-8 overflow-y-auto h-[calc(100%-250px)] no-scrollbar">
                  {drawerTab === 'appointment' ? (
                    <div className="space-y-10">
                       <div className="liquid-glass p-8 rounded-[2rem] border border-[#D6B47A]/20 bg-[#D6B47A]/5 relative overflow-hidden">
                          <div className="relative z-10 space-y-6">
                             <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-[#D6B47A] uppercase tracking-[0.3em]">ServiÃ§o</span>
                                <div className="px-3 py-1 rounded-full bg-[#D6B47A]/20 border border-[#D6B47A]/20">
                                   <span className="text-[9px] font-black text-[#D6B47A] uppercase">{statusLabel[selectedAppointment.status] || selectedAppointment.status}</span>
                                </div>
                             </div>
                             <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{selectedAppointment.servicos?.nome}</h2>
                             <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                   <Clock size={16} className="text-white/40" />
                                   <span className="text-sm font-bold text-white uppercase">{selectedAppointment.servicos?.duracao_minutos || selectedAppointment.servicos?.duracao || 30} Minutos</span>
                                </div>
                                <div className="flex items-center gap-2">
                                   <Scissors size={16} className="text-white/40" />
                                   <span className="text-sm font-bold text-white uppercase">R$ {selectedAppointment.servicos?.valor}</span>
                                </div>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-6">
                          <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Cliente</h4>
                          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex items-center justify-between">
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/10">
                                   <User size={20} />
                                </div>
                                <div>
                                   <p className="text-sm font-black uppercase text-white">{selectedAppointment.clientes?.nome}</p>
                                   <p className="text-[10px] font-bold text-white/40 uppercase">{selectedAppointment.clientes?.telefone}</p>
                                </div>
                             </div>
                          </div>
                       </div>

                       {selectedAppointment.status === 'pendente' && (
                         <div className="grid grid-cols-2 gap-4">
                            <button
                              onClick={() => handleProfessionalResponse(selectedAppointment.id, 'recusado')}
                              className="py-4 px-6 rounded-xl border border-red-500/25 bg-red-500/10 text-[10px] font-black text-red-300 uppercase tracking-widest hover:bg-red-500/15 transition-all"
                            >
                               Recusar
                            </button>
                            <button
                              onClick={() => handleProfessionalResponse(selectedAppointment.id, 'aceito')}
                              className="py-4 px-6 rounded-xl border border-[#D6B47A]/30 bg-[#D6B47A] text-[10px] font-black text-black uppercase tracking-widest hover:scale-[1.01] active:scale-95 transition-all"
                            >
                               Aceitar
                            </button>
                         </div>
                       )}

                       <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => handleUpdateStatus(selectedAppointment.id, 'cancelado')}
                            className="py-4 px-6 bg-white/5 rounded-xl border border-white/10 text-[10px] font-black text-white/40 uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all font-bold"
                          >
                             Cancelar
                          </button>
                          <button 
                            onClick={() => handleCheckout(selectedAppointment)}
                            className="py-4 px-6 bg-[#2d3436] rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-black transition-all"
                          >
                             Checkout
                          </button>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-8 animate-in fade-in">
                       <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Nota Interna</h4>
                       <textarea 
                         className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white/70 min-h-[150px] outline-none"
                         value={selectedAppointment.observacoes || ''}
                         onChange={(e) => setSelectedAppointment({ ...selectedAppointment, observacoes: e.target.value })}
                         onBlur={handleUpdateInternalNote}
                       />
                    </div>
                  )}
                </div>

                <div className="absolute bottom-0 left-0 w-full p-8 bg-[#0d0d0d] border-t border-white/5">
                    <button 
                      onClick={() => {
                        if (selectedAppointment.status === 'aceito' || selectedAppointment.status === 'confirmado') {
                           handleUpdateStatus(selectedAppointment.id, 'concluido');
                        } else {
                           setIsDrawerOpen(false);
                        }
                      }}
                      className="w-full bg-[#D6B47A] text-black py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-glow hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      {selectedAppointment.status === 'aceito' || selectedAppointment.status === 'confirmado' ? 'Marcar como concluido' : 'Fechar'}
                    </button>
                </div>
              </>
            )}

            {selectedBlock && (
              <div className="flex flex-col h-full">
                {/* Header Block */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setIsDrawerOpen(false)} className="p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all"><ChevronLeft size={18} /></button>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Editar Bloqueio</h3>
                  </div>
                  <button 
                    onClick={async () => {
                      if (confirm('Remover este bloqueio?')) {
                        await supabase
                          .from('bloqueios')
                          .delete()
                          .eq('id', selectedBlock.id)
                          .eq('barbearia_id', barbeariaId);
                        loadData();
                        setIsDrawerOpen(false);
                      }
                    }}
                    className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto no-scrollbar">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">FuncionÃ¡rio</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm font-bold uppercase outline-none focus:border-[#D6B47A]/40 transition-all"
                      value={selectedBlock.barbeiro_id || ''}
                      onChange={async (e) => {
                        const newId = e.target.value;
                        setSelectedBlock({...selectedBlock, barbeiro_id: newId});
                        await supabase
                          .from('bloqueios')
                          .update({ barbeiro_id: newId })
                          .eq('id', selectedBlock.id)
                          .eq('barbearia_id', barbeariaId);
                        loadData();
                      }}
                    >
                      <option value="">Toda a Equipe</option>
                      {barbers.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">InÃ­cio</label>
                      <input 
                        type="time" 
                        value={selectedBlock.hora_inicio || '09:00'}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm font-bold outline-none focus:border-[#D6B47A]/40 transition-all"
                        onChange={async (e) => {
                          const val = e.target.value;
                          setSelectedBlock({...selectedBlock, hora_inicio: val});
                          await supabase
                            .from('bloqueios')
                            .update({ hora_inicio: val })
                            .eq('id', selectedBlock.id)
                            .eq('barbearia_id', barbeariaId);
                          loadData();
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Fim</label>
                      <input 
                        type="time" 
                        value={selectedBlock.hora_fim || '10:00'}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm font-bold outline-none focus:border-[#D6B47A]/40 transition-all"
                        onChange={async (e) => {
                          const val = e.target.value;
                          setSelectedBlock({...selectedBlock, hora_fim: val});
                          await supabase
                            .from('bloqueios')
                            .update({ hora_fim: val })
                            .eq('id', selectedBlock.id)
                            .eq('barbearia_id', barbeariaId);
                          loadData();
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Motivo do Bloqueio</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white/70 min-h-[150px] outline-none focus:border-[#D6B47A]/40 transition-all font-bold"
                      value={selectedBlock.motivo || ''}
                      placeholder="Ex: HorÃ¡rio de AlmoÃ§o..."
                      onChange={async (e) => {
                        const val = e.target.value;
                        setSelectedBlock({...selectedBlock, motivo: val});
                      }}
                      onBlur={async () => {
                        await supabase
                          .from('bloqueios')
                          .update({ motivo: selectedBlock.motivo })
                          .eq('id', selectedBlock.id)
                          .eq('barbearia_id', barbeariaId);
                        loadData();
                      }}
                    />
                  </div>
                </div>

                <div className="mt-auto p-8 border-t border-white/5">
                  <button 
                    onClick={() => setIsDrawerOpen(false)}
                    className="w-full py-5 bg-[#D6B47A] text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-glow hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Salvar e Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-end bg-black/80 backdrop-blur-md animate-in fade-in transition-all">
           <div className="h-full w-full max-w-xl bg-[#0d0d0d] border-l border-white/10 shadow-2xl animate-in slide-in-from-right flex flex-col">
              {modalType === 'agendamento' ? (
                <>
                  {/* Header */}
                  <div className="p-8 flex items-center gap-6 border-b border-white/5">
                     <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-white/50"><X size={24}/></button>
                     <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Novo agendamento</h3>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto no-scrollbar relative">
                    {/* SeÃ§Ã£o de Busca de Cliente (SobrepÃµe o formulÃ¡rio se aberta) */}
                    {isClientSearchOpen && (
                      <div className="absolute inset-0 bg-[#0d0d0d] z-[50] flex flex-col animate-in fade-in slide-in-from-right duration-300">
                         {/* Search Header */}
                         <div className="p-8 border-b border-white/5 flex items-center gap-6 sticky top-0 bg-[#0d0d0d] z-[60]">
                            <button onClick={() => setIsClientSearchOpen(false)} className="p-3 hover:bg-white/5 rounded-xl border border-white/10 text-white/50"><ChevronLeft size={20}/></button>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Busca de clientes</h3>
                         </div>

                         {/* Search Input */}
                         <div className="p-8 space-y-8 flex-1 overflow-y-auto no-scrollbar">
                            <div className="relative group">
                               <label className="absolute -top-2 left-4 bg-[#0d0d0d] px-2 text-[10px] font-black text-white/20 uppercase tracking-widest z-10 group-focus-within:text-[#D6B47A]">Digite o nome, nÃºmero de telefone...</label>
                               <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20">
                                  <Search size={20} />
                               </div>
                               <input 
                                 type="text" 
                                 autoFocus
                                 value={clientSearchTerm}
                                 onChange={(e) => setClientSearchTerm(e.target.value)}
                                 className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 pl-16 text-sm font-bold text-white outline-none focus:border-[#D6B47A]/40 transition-all font-bold"
                               />
                            </div>

                             <button type="button" onClick={() => window.location.assign('/gestao/clientes')} className="flex items-center gap-4 text-[#D6B47A] hover:text-[#D6B47A]/80 transition-all group">
                               <div className="p-2 rounded-lg bg-[#D6B47A]/10 border border-[#D6B47A]/20 group-hover:scale-110 transition-transform">
                                  <Plus size={18} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest">Adicionar novo cliente</span>
                            </button>

                            {/* Client List */}
                            <div className="space-y-2">
                               {clients
                                .filter(c => 
                                  c.nome.toLowerCase().includes(clientSearchTerm.toLowerCase()) || 
                                  c.telefone?.includes(clientSearchTerm)
                                )
                                .map(c => (
                                 <button 
                                   key={c.id}
                                   onClick={() => {
                                      setNewApp({ ...newApp, cliente_id: c.id });
                                      setIsClientSearchOpen(false);
                                   }}
                                   className="w-full p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all flex items-center justify-between text-left group"
                                 >
                                    <div className="flex items-center gap-4">
                                       <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-xs font-black text-white uppercase border border-white/10">
                                          {c.nome.substring(0, 2)}
                                       </div>
                                       <div>
                                          <p className="text-sm font-black text-white uppercase">{c.nome}</p>
                                          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{c.telefone || 'Sem telefone'}</p>
                                       </div>
                                    </div>
                                    <ChevronRight size={16} className="text-white/10 group-hover:text-[#D6B47A] transition-all" />
                                 </button>
                               ))}
                            </div>
                         </div>
                      </div>
                    )}

                    {/* FormulÃ¡rio Principal (Escondido se a busca estiver aberta) */}
                    {!isClientSearchOpen && (
                      <div className="flex flex-col animate-in fade-in duration-300">
                        {/* Client Selection */}
                        <div className="p-8">
                          <div 
                            onClick={() => setIsClientSearchOpen(true)}
                            className={`border-2 border-dashed rounded-[2rem] p-8 flex items-center justify-between group cursor-pointer transition-all ${
                              newApp.cliente_id ? 'border-[#D6B47A]/30 bg-[#D6B47A]/5' : 'border-white/10 hover:border-[#D6B47A]/50'
                            }`}
                          >
                            <div className="flex items-center gap-6">
                              <div className={`w-16 h-16 rounded-full flex items-center justify-center border transition-all ${
                                newApp.cliente_id ? 'bg-[#D6B47A]/20 text-[#D6B47A] border-[#D6B47A]/30' : 'bg-white/5 text-white/20 border-white/5 group-hover:bg-[#D6B47A]/10 group-hover:text-[#D6B47A]'
                              }`}>
                                <User size={32} />
                              </div>
                              <div className="space-y-1">
                                {newApp.cliente_id ? (
                                   <>
                                      <p className="text-lg font-black text-white uppercase tracking-tight">{clients.find(c => c.id === newApp.cliente_id)?.nome}</p>
                                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none">{clients.find(c => c.id === newApp.cliente_id)?.telefone}</p>
                                   </>
                                ) : (
                                   <p className="text-sm font-bold text-white/60">Selecione um cliente ou deixe em branco para chegada</p>
                                )}
                              </div>
                            </div>
                            {newApp.cliente_id ? (
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setNewApp({ ...newApp, cliente_id: '' });
                                 }}
                                 className="p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                               >
                                  <X size={16} />
                               </button>
                            ) : (
                               <Plus size={32} className="text-white/20 group-hover:text-[#D6B47A] transition-all" />
                            )}
                          </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex px-8 border-b border-white/5">
                          <button type="button" onClick={() => setDrawerTab('appointment')} className="py-6 px-4 text-[10px] font-black uppercase tracking-widest text-[#D6B47A] border-b-2 border-[#D6B47A]">Agendamento</button>
                          <button type="button" onClick={() => setDrawerTab('info')} className="py-6 px-4 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white">InformaÃ§Ãµes</button>
                        </div>

                        <div className="p-8 space-y-10">
                          {/* Date & Options */}
                          <div className="flex items-center gap-4">
                            <button type="button" onClick={() => setSelectedDate(dateToLocalKey(new Date()))} className="flex items-center gap-2 px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-white">
                              Hoje <ChevronDown size={16} className="text-white/30" />
                            </button>
                            <button type="button" onClick={() => setIsClientSearchOpen(true)} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/40 hover:bg-white/10 transition-all">
                               <Users size={16} /> Agende para + alguÃ©m
                            </button>
                            <button type="button" onClick={() => window.alert('Recorrencia sera configurada na proxima versao desta tela.')} className="flex items-center gap-2 px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/40 hover:bg-white/10 transition-all">
                               <RefreshCw size={16} /> Recorrente
                            </button>
                          </div>

                          {/* Service Selection */}
                          <div className="space-y-4">
                            <div className="relative group">
                              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none transition-colors group-focus-within:text-[#D6B47A]">
                                <Scissors size={20} />
                              </div>
                              <select 
                                value={newApp.servico_id}
                                onChange={(e) => setNewApp({ ...newApp, servico_id: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 pl-16 text-sm font-bold text-white outline-none focus:border-[#D6B47A]/40 transition-all appearance-none font-bold"
                              >
                                <option value="">Selecione o serviÃ§o</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.nome} - R$ {s.valor}</option>)}
                              </select>
                              <ChevronRight size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20" />
                            </div>
                          </div>

                          {/* Times */}
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3 relative group">
                              <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-2 group-focus-within:text-[#D6B47A]">InÃ­cio</label>
                              <input 
                                type="time" 
                                value={newApp.hora}
                                onChange={(e) => setNewApp({ ...newApp, hora: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-lg font-black text-white outline-none focus:border-[#D6B47A]/40 transition-all font-bold"
                              />
                            </div>
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-2">Fim</label>
                              <input 
                                type="time" 
                                readOnly
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-lg font-black text-white/30 outline-none opacity-50 transition-all font-bold"
                                value={(() => {
                                   if (!newApp.hora || !newApp.servico_id) return '--:--';
                                   const s = services.find(sv => sv.id === newApp.servico_id);
                                   const [h, m] = newApp.hora.split(':').map(Number);
                                   const d = new Date();
                                   d.setHours(h, m + (s?.duracao || 30), 0);
                                   return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                })()}
                              />
                            </div>
                          </div>

                          {/* Barber */}
                          <div className="space-y-4">
                            <div className="relative group">
                              <label className="absolute -top-2 left-4 bg-[#0d0d0d] px-2 text-[10px] font-black text-white/20 uppercase tracking-widest z-10 group-focus-within:text-[#D6B47A]">FuncionÃ¡rio</label>
                               <select 
                                 value={newApp.barbeiro_id}
                                 onChange={(e) => setNewApp({ ...newApp, barbeiro_id: e.target.value })}
                                 className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm font-bold text-white outline-none focus:border-[#D6B47A]/40 transition-all font-bold appearance-none"
                               >
                                 <option value="">Qualquer Profissional</option>
                                 {barbers.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                               </select>
                               <ChevronDown size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20" />
                            </div>
                            <p className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-widest ml-2">
                               <User size={12}/> FuncionÃ¡rio escolhido manualmente
                            </p>
                          </div>

                          {/* Options */}
                          <div className="flex items-center justify-between p-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#D6B47A]/10 group-hover:border-[#D6B47A]/30 transition-all">
                                <Heart size={24} className="text-white/20 group-hover:text-[#D6B47A] transition-colors" />
                              </div>
                              <span className="text-xs font-black text-white/40 uppercase tracking-widest group-hover:text-white transition-all">Solicitado pelo cliente</span>
                            </label>
                          </div>

                          <button type="button" onClick={() => window.location.assign('/gestao/configuracoes')} className="w-full py-5 border border-dashed border-white/10 rounded-2xl text-[10px] font-black text-white/20 uppercase tracking-widest hover:border-[#D6B47A]/30 hover:text-[#D6B47A] transition-all">
                             Adicionar outro serviÃ§o +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-8 border-t border-white/5 bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-10">
                       <div>
                          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Total</p>
                          <p className="text-4xl font-black text-white">
                            R$ {services.find(s => s.id === newApp.servico_id)?.valor || '0,00'}
                          </p>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">A ser pago</p>
                          <p className="text-4xl font-black text-white">
                            R$ {services.find(s => s.id === newApp.servico_id)?.valor || '0,00'}
                          </p>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <button 
                        onClick={() => setIsModalOpen(false)}
                        className="py-6 rounded-2xl border border-white/10 text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/5 transition-all"
                       >
                         Descartar
                       </button>
                       <button 
                        onClick={handleSaveAppointment}
                        className="py-6 rounded-2xl bg-[#D6B47A] text-black text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-glow"
                       >
                         Salvar
                       </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="p-8 flex items-center gap-6 border-b border-white/5">
                     <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-white/50"><X size={24}/></button>
                     <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Bloquear HorÃ¡rio</h3>
                  </div>
                  
                  <div className="p-8 space-y-6 flex-1">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Barbeiro</label>
                        <select 
                          value={newBlock.barbeiro_id}
                          onChange={(e) => setNewBlock({ ...newBlock, barbeiro_id: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-[#D6B47A]/40 transition-all font-bold appearance-none"
                        >
                           <option value="">Toda a Equipe</option>
                           {barbers.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                        </select>
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">InÃ­cio</label>
                           <input 
                             type="time" 
                             value={newBlock.hora_inicio} 
                             onChange={(e) => setNewBlock({ ...newBlock, hora_inicio: e.target.value })}
                             className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-[#D6B47A]/40 transition-all"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Fim</label>
                           <input 
                             type="time" 
                             value={newBlock.hora_fim} 
                             onChange={(e) => setNewBlock({ ...newBlock, hora_fim: e.target.value })}
                             className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-[#D6B47A]/40 transition-all"
                           />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Motivo</label>
                        <textarea 
                          placeholder="Ex: AlmoÃ§o, ReuniÃ£o, Folga" 
                          value={newBlock.motivo}
                          onChange={(e) => setNewBlock({ ...newBlock, motivo: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white/70 min-h-[150px] outline-none focus:border-[#D6B47A]/40 transition-all font-bold"
                        />
                     </div>
                  </div>

                  <div className="p-8 border-t border-white/5 mt-auto">
                    <button 
                      onClick={handleSaveBlock}
                      className="w-full bg-white text-black py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-glow transition-all hover:scale-[1.02] active:scale-95"
                    >
                      Criar Bloqueio
                    </button>
                  </div>
                </div>
              )}
           </div>
        </div>
      )}
      
      {quickMenu && (
        <>
          <div className="fixed inset-0 z-[160]" onClick={() => setQuickMenu(null)} />
          <div 
            className="fixed z-[170] bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 min-w-[220px]"
            style={{ top: Math.min(quickMenu.y, typeof window !== 'undefined' ? window.innerHeight - 150 : 0), left: Math.min(quickMenu.x, typeof window !== 'undefined' ? window.innerWidth - 240 : 0) }}
          >
             <button 
              onClick={() => handleQuickAction('agendamento')}
              className="w-full flex items-center gap-3 px-6 py-4 hover:bg-white/5 text-[10px] font-black text-white uppercase tracking-widest transition-all border-b border-white/5"
             >
                <Plus size={14} className="text-accent" />
                Novo Agendamento
             </button>
             <button 
              onClick={() => handleQuickAction('bloqueio')}
              className="w-full flex items-center gap-3 px-6 py-4 hover:bg-white/5 text-[10px] font-black text-white uppercase tracking-widest transition-all"
             >
                <Clock size={14} className="text-orange-400" />
                Novo Bloqueio
             </button>
          </div>
        </>
      )}
    </div>
  );
}
