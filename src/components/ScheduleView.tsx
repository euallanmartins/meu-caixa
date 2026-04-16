'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Check, X, Scissors, Phone, Mail, ChevronLeft, ChevronRight, Settings, Ban, Pencil, Save } from 'lucide-react';
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

  // Settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [horarioAbertura, setHorarioAbertura] = useState(8);
  const [horarioFechamento, setHorarioFechamento] = useState(21);
  const [bufferMinutos, setBufferMinutos] = useState(10);
  const [savingSettings, setSavingSettings] = useState(false);

  // Block modal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockType, setBlockType] = useState<'dia' | 'horario'>('dia');
  const [blockDate, setBlockDate] = useState('');
  const [blockBarber, setBlockBarber] = useState('');
  const [blockHoraInicio, setBlockHoraInicio] = useState('');
  const [blockHoraFim, setBlockHoraFim] = useState('');
  const [blockMotivo, setBlockMotivo] = useState('');

  // Edit appointment modal
  const [editingAgendamento, setEditingAgendamento] = useState<any | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editBarbeiro, setEditBarbeiro] = useState('');

  // Bloqueios do dia
  const [bloqueios, setBloqueios] = useState<any[]>([]);

  useEffect(() => {
    loadAgendamentos();
    loadSettings();
    loadBloqueios();
  }, [selectedDate, barbeariaId]);

  async function loadSettings() {
    const { data } = await supabase.from('barbearias').select('horario_abertura, horario_fechamento, buffer_minutos').eq('id', barbeariaId).single();
    if (data) {
      setHorarioAbertura(data.horario_abertura ?? 8);
      setHorarioFechamento(data.horario_fechamento ?? 21);
      setBufferMinutos(data.buffer_minutos ?? 10);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const { error } = await supabase.from('barbearias').update({
        horario_abertura: horarioAbertura,
        horario_fechamento: horarioFechamento,
        buffer_minutos: bufferMinutos,
      }).eq('id', barbeariaId);
      if (error) throw error;
      setShowSettings(false);
    } catch (err: any) { alert('Erro: ' + err.message); }
    finally { setSavingSettings(false); }
  }

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

  async function loadBloqueios() {
    const { data } = await supabase.from('bloqueios').select('*').eq('barbearia_id', barbeariaId).eq('data', selectedDate);
    setBloqueios(data || []);
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('agendamentos').update({ status }).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    loadAgendamentos();
    if (status === 'atendido') refreshData();
  }

  async function handleSaveBlock() {
    if (!blockDate) return;
    try {
      const payload: any = {
        barbearia_id: barbeariaId,
        tipo: blockType,
        data: blockDate,
        motivo: blockMotivo || null,
        barbeiro_id: blockBarber || null,
      };
      if (blockType === 'horario') {
        payload.hora_inicio = blockHoraInicio;
        payload.hora_fim = blockHoraFim;
      }
      const { error } = await supabase.from('bloqueios').insert(payload);
      if (error) throw error;
      setShowBlockModal(false);
      setBlockDate(''); setBlockMotivo(''); setBlockBarber(''); setBlockHoraInicio(''); setBlockHoraFim('');
      loadBloqueios();
    } catch (err: any) { alert('Erro: ' + err.message); }
  }

  async function removeBlock(id: string) {
    await supabase.from('bloqueios').delete().eq('id', id);
    loadBloqueios();
  }

  async function handleSaveEdit() {
    if (!editingAgendamento || !editDate || !editTime) return;
    try {
      const duracao = editingAgendamento.servicos?.duracao_minutos || 30;
      const inicio = new Date(`${editDate}T${editTime}:00`);
      const fim = new Date(inicio.getTime() + duracao * 60000);

      const updateData: any = {
        data_hora_inicio: inicio.toISOString(),
        data_hora_fim: fim.toISOString(),
      };
      if (editBarbeiro) updateData.barbeiro_id = editBarbeiro;

      const { error } = await supabase.from('agendamentos').update(updateData).eq('id', editingAgendamento.id);
      if (error) throw error;
      setEditingAgendamento(null);
      loadAgendamentos();
    } catch (err: any) { alert('Erro: ' + err.message); }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
    pendente: { label: 'Pendente', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
    confirmado: { label: 'Confirmado', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
    atendido: { label: 'Atendido', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' },
    cancelado: { label: 'Cancelado', color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/20' },
  };

  function changeDate(offset: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  }

  const filtered = filterBarbeiro ? agendamentos.filter(a => a.barbeiro_id === filterBarbeiro) : agendamentos;
  const pendingCount = agendamentos.filter(a => a.status === 'pendente').length;
  const confirmedCount = agendamentos.filter(a => a.status === 'confirmado').length;
  const dayBlocked = bloqueios.some(b => b.tipo === 'dia' && !b.barbeiro_id);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Agenda</h2>
          <p className="text-sm text-muted">Gerencie agendamentos, bloqueios e horários</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => changeDate(-1)} className="p-2 rounded-lg bg-white/5 text-muted hover:text-white transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white min-w-[160px] text-center">
            <Calendar className="h-3.5 w-3.5 inline mr-2 text-accent" />
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </div>
          <button onClick={() => changeDate(1)} className="p-2 rounded-lg bg-white/5 text-muted hover:text-white transition-colors"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowSettings(!showSettings)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${showSettings ? 'bg-accent text-black' : 'bg-white/5 text-muted hover:text-white border border-white/10'}`}>
          <Settings className="h-3 w-3" /> Horários
        </button>
        <button onClick={() => { setShowBlockModal(!showBlockModal); setBlockDate(selectedDate); }} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${showBlockModal ? 'bg-danger text-white' : 'bg-white/5 text-muted hover:text-white border border-white/10'}`}>
          <Ban className="h-3 w-3" /> Bloquear
        </button>
        <div className="flex-1" />
        <select value={filterBarbeiro} onChange={(e) => setFilterBarbeiro(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
          <option value="" className="bg-zinc-900">Todos</option>
          {barbers.map(b => (<option key={b.id} value={b.id} className="bg-zinc-900">{b.nome}</option>))}
        </select>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass rounded-2xl border border-accent/30 p-4 sm:p-6 animate-in fade-in duration-200 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">⚙️ Horário de Funcionamento</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Abertura</label>
              <select value={horarioAbertura} onChange={(e) => setHorarioAbertura(parseInt(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none">
                {Array.from({ length: 24 }, (_, i) => (<option key={i} value={i} className="bg-zinc-900">{String(i).padStart(2, '0')}:00</option>))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Fechamento</label>
              <select value={horarioFechamento} onChange={(e) => setHorarioFechamento(parseInt(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none">
                {Array.from({ length: 24 }, (_, i) => (<option key={i} value={i} className="bg-zinc-900">{String(i).padStart(2, '0')}:00</option>))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Buffer entre atendimentos</label>
              <select value={bufferMinutos} onChange={(e) => setBufferMinutos(parseInt(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none">
                {[0, 5, 10, 15, 20, 30].map(m => (<option key={m} value={m} className="bg-zinc-900">{m} min</option>))}
              </select>
            </div>
          </div>
          <button onClick={saveSettings} disabled={savingSettings}
            className="flex items-center gap-2 px-5 py-3 bg-accent rounded-xl font-bold text-black text-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
            <Save className="h-4 w-4" /> {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && (
        <div className="glass rounded-2xl border border-danger/30 p-4 sm:p-6 animate-in fade-in duration-200 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">🚫 Criar Bloqueio</h3>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setBlockType('dia')} className={`flex-1 p-2.5 rounded-xl border text-xs font-bold transition-all ${blockType === 'dia' ? 'border-danger bg-danger/10 text-danger' : 'border-border bg-card/30 text-muted'}`}>Dia Inteiro</button>
            <button onClick={() => setBlockType('horario')} className={`flex-1 p-2.5 rounded-xl border text-xs font-bold transition-all ${blockType === 'horario' ? 'border-danger bg-danger/10 text-danger' : 'border-border bg-card/30 text-muted'}`}>Horário Específico</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Data</label>
              <input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Profissional (opcional)</label>
              <select value={blockBarber} onChange={(e) => setBlockBarber(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none">
                <option value="" className="bg-zinc-900">Todos</option>
                {barbers.map(b => (<option key={b.id} value={b.id} className="bg-zinc-900">{b.nome}</option>))}
              </select>
            </div>
          </div>
          {blockType === 'horario' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted ml-1">Início</label>
                <input type="time" value={blockHoraInicio} onChange={(e) => setBlockHoraInicio(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted ml-1">Fim</label>
                <input type="time" value={blockHoraFim} onChange={(e) => setBlockHoraFim(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none" />
              </div>
            </div>
          )}
          <div>
            <label className="text-[10px] uppercase font-bold text-muted ml-1">Motivo (opcional)</label>
            <input type="text" value={blockMotivo} onChange={(e) => setBlockMotivo(e.target.value)} placeholder="Ex: Feriado, Folga..."
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none" />
          </div>
          <button onClick={handleSaveBlock} className="w-full py-3 bg-danger rounded-xl font-bold text-white hover:scale-[1.01] active:scale-95 transition-all">
            Confirmar Bloqueio
          </button>
        </div>
      )}

      {/* Active blocks for this day */}
      {bloqueios.length > 0 && (
        <div className="space-y-2">
          {bloqueios.map(b => (
            <div key={b.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-danger/5 border border-danger/10 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs">
                <Ban className="h-3 w-3 text-danger" />
                <span className="text-danger font-bold">
                  {b.tipo === 'dia' ? '🚫 Dia Bloqueado' : `🚫 Bloqueio ${b.hora_inicio}–${b.hora_fim}`}
                </span>
                {b.barbeiro_id && <span className="text-muted">• {barbers.find(br => br.id === b.barbeiro_id)?.nome || 'Barbeiro'}</span>}
                {b.motivo && <span className="text-muted">• {b.motivo}</span>}
              </div>
              <button onClick={() => removeBlock(b.id)} className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-2 flex-wrap">
        <div className="px-3 py-1.5 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-[10px] font-bold text-yellow-400 uppercase">🟡 {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}</div>
        <div className="px-3 py-1.5 rounded-lg bg-green-400/10 border border-green-400/20 text-[10px] font-bold text-green-400 uppercase">🟢 {confirmedCount} confirmado{confirmedCount !== 1 ? 's' : ''}</div>
        <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-muted uppercase">{agendamentos.length} total</div>
        {dayBlocked && <div className="px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/20 text-[10px] font-bold text-danger uppercase">⛔ DIA BLOQUEADO</div>}
      </div>

      {/* Edit Modal */}
      {editingAgendamento && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass w-full max-w-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center"><Pencil className="h-5 w-5 text-accent" /></div>
                <div>
                  <h3 className="text-lg font-bold text-white">Alterar Agendamento</h3>
                  <p className="text-[10px] text-muted uppercase tracking-widest">{editingAgendamento.clientes?.nome}</p>
                </div>
              </div>
              <button onClick={() => setEditingAgendamento(null)} className="p-2 hover:bg-white/10 rounded-full text-muted hover:text-white transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted ml-1">Nova Data</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-accent outline-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted ml-1">Novo Horário</label>
                <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-accent outline-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted ml-1">Profissional</label>
                <select value={editBarbeiro} onChange={(e) => setEditBarbeiro(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none">
                  <option value="" className="bg-zinc-900">Manter atual</option>
                  {barbers.map(b => (<option key={b.id} value={b.id} className="bg-zinc-900">{b.nome}</option>))}
                </select>
              </div>
              <div className="pt-2 flex gap-3">
                <button onClick={() => setEditingAgendamento(null)} className="flex-1 py-3 rounded-2xl border border-white/10 font-bold text-muted hover:text-white transition-all">Cancelar</button>
                <button onClick={handleSaveEdit} className="flex-[2] py-3 rounded-2xl bg-accent text-black font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-accent/20">
                  Salvar Alteração
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appointments List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>
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

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${st.bg} ${st.color} border ${st.border}`}>{st.label}</span>

                      {/* Edit button */}
                      {(a.status === 'pendente' || a.status === 'confirmado') && (
                        <button onClick={() => {
                          setEditingAgendamento(a);
                          const d = new Date(a.data_hora_inicio);
                          setEditDate(d.toISOString().split('T')[0]);
                          setEditTime(d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
                          setEditBarbeiro('');
                        }} className="p-2 rounded-lg bg-white/5 text-muted hover:text-white transition-colors" title="Alterar horário">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {a.status === 'pendente' && (
                        <div className="flex gap-1">
                          <button onClick={() => updateStatus(a.id, 'confirmado')} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-black transition-all" title="Confirmar"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => updateStatus(a.id, 'cancelado')} className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-all" title="Cancelar"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                      {a.status === 'confirmado' && (
                        <div className="flex gap-1">
                          <button onClick={() => updateStatus(a.id, 'atendido')} className="px-3 py-1.5 rounded-lg bg-accent text-black text-[10px] font-black uppercase hover:scale-105 active:scale-95 transition-all">✓ Atendido</button>
                          <button onClick={() => updateStatus(a.id, 'cancelado')} className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-all" title="Cancelar"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center gap-3 text-[10px] text-muted">
                    {a.clientes?.telefone && (
                      <a href={`https://wa.me/55${a.clientes.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-600/10 text-green-400 hover:bg-green-600/20 transition-colors">
                        <Phone className="h-3 w-3" />{a.clientes.telefone}
                      </a>
                    )}
                    {a.clientes?.email && (
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{a.clientes.email}</span>
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
