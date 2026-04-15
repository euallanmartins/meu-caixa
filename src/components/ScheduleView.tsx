'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Check, X, Scissors, Phone, Mail, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ScheduleViewProps {
  barbeariaId: string;
  barbers: any[];
  refreshData: () => void;
}

export function ScheduleView({ barbeariaId, barbers, refreshData }: ScheduleViewProps) {
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterBarbeiro, setFilterBarbeiro] = useState('');

  useEffect(() => {
    loadAgendamentos();
  }, [selectedDate, barbeariaId]);

  async function loadAgendamentos() {
    setLoading(true);
    const startOfDay = `${selectedDate}T00:00:00`;
    const endOfDay = `${selectedDate}T23:59:59`;

    const { data, error } = await supabase
      .from('agendamentos')
      .select('*, clientes(nome, email, telefone), barbeiros(nome), servicos(nome, valor, duracao_minutos)')
      .eq('barbearia_id', barbeariaId)
      .gte('data_hora_inicio', startOfDay)
      .lte('data_hora_inicio', endOfDay)
      .order('data_hora_inicio', { ascending: true });

    if (error) console.error('Erro ao buscar agendamentos:', error);
    setAgendamentos(data || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from('agendamentos')
      .update({ status })
      .eq('id', id);

    if (error) {
      alert('Erro: ' + error.message);
      return;
    }
    loadAgendamentos();
    if (status === 'atendido') refreshData();
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
    pendente: { label: 'Pendente', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
    confirmado: { label: 'Confirmado', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
    atendido: { label: 'Atendido', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' },
    cancelado: { label: 'Cancelado', color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/20' },
  };

  // Navigate dates
  function changeDate(offset: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  }

  const filtered = filterBarbeiro
    ? agendamentos.filter(a => a.barbeiro_id === filterBarbeiro)
    : agendamentos;

  const pendingCount = agendamentos.filter(a => a.status === 'pendente').length;
  const confirmedCount = agendamentos.filter(a => a.status === 'confirmado').length;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Agenda</h2>
          <p className="text-sm text-muted">Gerencie os agendamentos dos clientes</p>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="p-2 rounded-lg bg-white/5 text-muted hover:text-white transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white min-w-[160px] text-center">
            <Calendar className="h-3.5 w-3.5 inline mr-2 text-accent" />
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </div>
          <button onClick={() => changeDate(1)} className="p-2 rounded-lg bg-white/5 text-muted hover:text-white transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick Stats + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-[10px] font-bold text-yellow-400 uppercase">
            🟡 {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-green-400/10 border border-green-400/20 text-[10px] font-bold text-green-400 uppercase">
            🟢 {confirmedCount} confirmado{confirmedCount !== 1 ? 's' : ''}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-muted uppercase">
            {agendamentos.length} total
          </div>
        </div>

        <select
          value={filterBarbeiro}
          onChange={(e) => setFilterBarbeiro(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="" className="bg-zinc-900">Todos os profissionais</option>
          {barbers.map(b => (
            <option key={b.id} value={b.id} className="bg-zinc-900">{b.nome}</option>
          ))}
        </select>
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-10 sm:p-16 flex flex-col items-center justify-center border-dashed border-white/10 text-center">
          <Calendar className="h-12 w-12 text-muted/30 mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">Nenhum agendamento</h3>
          <p className="text-sm text-muted">Compartilhe o link <span className="text-accent">/agendar</span> para seus clientes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const st = statusConfig[a.status] || statusConfig.pendente;
            const startTime = new Date(a.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const endTime = new Date(a.data_hora_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={a.id} className={`glass rounded-2xl border ${st.border} overflow-hidden group`}>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Time + Service */}
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 shrink-0 rounded-xl ${st.bg} flex flex-col items-center justify-center`}>
                        <span className="text-xs font-black text-white">{startTime}</span>
                        <span className="text-[8px] text-muted">até {endTime}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{a.clientes?.nome || 'Cliente'}</h4>
                        <p className="text-[10px] text-muted uppercase font-medium tracking-tighter">
                          <Scissors className="h-2.5 w-2.5 inline mr-0.5" />
                          {a.servicos?.nome || 'Serviço'} • {a.barbeiros?.nome || 'Barbeiro'} • {formatCurrency(a.valor_estimado || 0)}
                        </p>
                      </div>
                    </div>

                    {/* Status + Actions */}
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${st.bg} ${st.color} border ${st.border}`}>
                        {st.label}
                      </span>

                      {a.status === 'pendente' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateStatus(a.id, 'confirmado')}
                            className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-black transition-all"
                            title="Confirmar"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => updateStatus(a.id, 'cancelado')}
                            className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-all"
                            title="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {a.status === 'confirmado' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateStatus(a.id, 'atendido')}
                            className="px-3 py-1.5 rounded-lg bg-accent text-black text-[10px] font-black uppercase hover:scale-105 active:scale-95 transition-all"
                          >
                            ✓ Atendido
                          </button>
                          <button
                            onClick={() => updateStatus(a.id, 'cancelado')}
                            className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-all"
                            title="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Client Contact Info - Expandable */}
                  <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center gap-3 text-[10px] text-muted">
                    {a.clientes?.telefone && (
                      <a
                        href={`https://wa.me/55${a.clientes.telefone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-600/10 text-green-400 hover:bg-green-600/20 transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                        {a.clientes.telefone}
                      </a>
                    )}
                    {a.clientes?.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {a.clientes.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
