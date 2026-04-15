'use client';

import { useState, useEffect } from 'react';
import { Scissors, Calendar, Clock, User, Mail, Phone, ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const BARBEARIA_ID = 'a251aedd-347a-466a-a26a-4b53d394f7ae';
const BUFFER_MINUTES = 10;
const OPEN_HOUR = 8;
const CLOSE_HOUR = 21;

export default function AgendarPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Client data
  const [clienteNome, setClienteNome] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');

  // Selection data
  const [barbeiros, setBarbeiros] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<any>(null);
  const [selectedServico, setSelectedServico] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [barbeariaNome, setBarbeariaNome] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [{ data: barbs }, { data: servs }, { data: barb }] = await Promise.all([
      supabase.from('barbeiros').select('*').eq('barbearia_id', BARBEARIA_ID).eq('ativo', true),
      supabase.from('servicos').select('*').eq('barbearia_id', BARBEARIA_ID),
      supabase.from('barbearias').select('nome').eq('id', BARBEARIA_ID).single()
    ]);
    setBarbeiros(barbs || []);
    setServicos(servs || []);
    setBarbeariaNome(barb?.nome || 'Barbearia');
  }

  // Generate dates for next 14 days
  function getNextDays() {
    const days: { date: string; label: string; dayName: string }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        dayName: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      });
    }
    return days;
  }

  // Load available slots for a given day + barber + service
  async function loadSlots(date: string) {
    if (!selectedBarbeiro || !selectedServico) return;
    
    const duracao = (selectedServico.duracao_minutos || 30) + BUFFER_MINUTES;
    
    // Get existing appointments for this barber on this date
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;
    
    const { data: existing } = await supabase
      .from('agendamentos')
      .select('data_hora_inicio, data_hora_fim')
      .eq('barbeiro_id', selectedBarbeiro.id)
      .gte('data_hora_inicio', startOfDay)
      .lte('data_hora_inicio', endOfDay)
      .not('status', 'eq', 'cancelado');

    const occupied = (existing || []).map(a => ({
      start: new Date(a.data_hora_inicio).getTime(),
      end: new Date(a.data_hora_fim).getTime() + BUFFER_MINUTES * 60000,
    }));

    // Generate all 15-min slots
    const slots: string[] = [];
    const now = new Date();
    
    for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
      for (let m = 0; m < 60; m += 15) {
        const slotStart = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
        const slotEnd = new Date(slotStart.getTime() + duracao * 60000);
        
        // Don't show slots in the past
        if (slotStart <= now) continue;
        
        // Don't show slots that go past closing
        const closeTime = new Date(`${date}T${CLOSE_HOUR}:00:00`);
        if (slotEnd > closeTime) continue;

        // Check for conflicts
        const hasConflict = occupied.some(occ => 
          slotStart.getTime() < occ.end && slotEnd.getTime() > occ.start
        );

        if (!hasConflict) {
          slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
      }
    }

    setAvailableSlots(slots);
  }

  useEffect(() => {
    if (selectedDate && selectedBarbeiro && selectedServico) {
      loadSlots(selectedDate);
    }
  }, [selectedDate, selectedBarbeiro, selectedServico]);

  async function handleSubmit() {
    if (loading) return;
    setLoading(true);

    try {
      // 1. Create or find client
      const { data: existingClient } = await supabase
        .from('clientes')
        .select('id')
        .eq('email', clienteEmail)
        .eq('barbearia_id', BARBEARIA_ID)
        .maybeSingle();

      let clienteId = existingClient?.id;

      if (!clienteId) {
        const { data: newClient, error: clientErr } = await supabase.from('clientes').insert({
          barbearia_id: BARBEARIA_ID,
          nome: clienteNome,
          email: clienteEmail,
          telefone: clienteTelefone,
        }).select().single();

        if (clientErr) throw clientErr;
        clienteId = newClient.id;
      }

      // 2. Calculate times
      const duracao = selectedServico.duracao_minutos || 30;
      const inicio = new Date(`${selectedDate}T${selectedTime}:00`);
      const fim = new Date(inicio.getTime() + duracao * 60000);

      // 3. Final conflict check
      const { data: conflicts } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('barbeiro_id', selectedBarbeiro.id)
        .not('status', 'eq', 'cancelado')
        .lt('data_hora_inicio', fim.toISOString())
        .gt('data_hora_fim', inicio.toISOString());

      if (conflicts && conflicts.length > 0) {
        alert('Ops! Este horário acabou de ser reservado. Por favor, escolha outro.');
        setLoading(false);
        return;
      }

      // 4. Create appointment
      const { error: agendErr } = await supabase.from('agendamentos').insert({
        barbearia_id: BARBEARIA_ID,
        cliente_id: clienteId,
        barbeiro_id: selectedBarbeiro.id,
        servico_id: selectedServico.id,
        data_hora_inicio: inicio.toISOString(),
        data_hora_fim: fim.toISOString(),
        valor_estimado: selectedServico.valor,
        status: 'pendente',
      });

      if (agendErr) throw agendErr;
      setSuccess(true);
    } catch (err: any) {
      alert('Erro ao agendar: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Success screen
  if (success) {
    const whatsappMsg = encodeURIComponent(
      `Olá! Meu nome é ${clienteNome}. Agendei um ${selectedServico.nome} com ${selectedBarbeiro.nome} no dia ${new Date(`${selectedDate}T${selectedTime}`).toLocaleDateString('pt-BR')} às ${selectedTime}. Aguardo confirmação!`
    );
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 sm:p-12 max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-500">
          <div className="h-20 w-20 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
            <Check className="h-10 w-10 text-accent" />
          </div>
          <h1 className="text-2xl font-black text-white">Agendamento Realizado!</h1>
          <p className="text-muted text-sm">
            Seu horário com <span className="text-accent font-bold">{selectedBarbeiro.nome}</span> foi reservado.
            Aguarde a confirmação.
          </p>
          <div className="glass rounded-2xl p-4 text-left space-y-2 border border-white/5">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Serviço</span>
              <span className="text-white font-bold">{selectedServico.nome}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Data</span>
              <span className="text-white font-bold">{new Date(`${selectedDate}T${selectedTime}`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', weekday: 'short' })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Horário</span>
              <span className="text-accent font-bold">{selectedTime}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Valor</span>
              <span className="text-white font-bold">{formatCurrency(selectedServico.valor)}</span>
            </div>
          </div>
          <a
            href={`https://wa.me/5511999999999?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-center hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
          >
            📱 Confirmar via WhatsApp
          </a>
          <button
            onClick={() => { setSuccess(false); setStep(1); setSelectedBarbeiro(null); setSelectedServico(null); setSelectedDate(''); setSelectedTime(''); }}
            className="text-sm text-muted hover:text-white transition-colors"
          >
            Fazer novo agendamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      {/* Liquid Background */}
      <div className="blob top-[-10%] left-[-10%] bg-accent/20" />
      <div className="blob bottom-[10%] right-[-5%] bg-purple-500/10" style={{ animationDelay: '2s' }} />

      {/* Header */}
      <header className="liquid-glass border-b border-white/5 sticky top-0 z-50">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Scissors className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">{barbeariaNome}</h1>
            <p className="text-[10px] text-muted uppercase tracking-widest">Agendamento Online</p>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center flex-1 gap-2">
              <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                s < step ? 'bg-accent text-black' :
                s === step ? 'bg-accent/20 text-accent ring-2 ring-accent/50' :
                'bg-white/5 text-muted'
              }`}>
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && <div className={`flex-1 h-[2px] rounded transition-all ${s < step ? 'bg-accent' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-12 relative z-10">
        {/* Step 1: Dados do Cliente */}
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Seus Dados</h2>
              <p className="text-sm text-muted">Precisamos das suas informações para o agendamento.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-muted ml-1">Nome Completo *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input
                    type="text" required value={clienteNome}
                    onChange={(e) => setClienteNome(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-accent outline-none transition-all"
                    placeholder="João Silva"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-muted ml-1">E-mail *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input
                    type="email" required value={clienteEmail}
                    onChange={(e) => setClienteEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-accent outline-none transition-all"
                    placeholder="joao@email.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-muted ml-1">Celular (WhatsApp) *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input
                    type="tel" required value={clienteTelefone}
                    onChange={(e) => setClienteTelefone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-accent outline-none transition-all"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => { if (clienteNome && clienteEmail && clienteTelefone) setStep(2); }}
              disabled={!clienteNome || !clienteEmail || !clienteTelefone}
              className="w-full py-4 rounded-2xl bg-accent text-black font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              Continuar <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Step 2: Escolher Barbeiro */}
        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(1)} className="p-2 rounded-lg bg-white/5 text-muted hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
              <div>
                <h2 className="text-xl font-black text-white">Escolha o Profissional</h2>
                <p className="text-sm text-muted">Quem vai te atender?</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {barbeiros.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setSelectedBarbeiro(b); setStep(3); }}
                  className={`glass rounded-2xl p-4 sm:p-6 flex flex-col items-center gap-3 border transition-all hover:scale-[1.03] active:scale-95 ${
                    selectedBarbeiro?.id === b.id ? 'border-accent bg-accent/10' : 'border-white/5 hover:border-accent/50'
                  }`}
                >
                  <div className="h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center text-accent font-black text-xl">
                    {b.nome.substring(0, 1)}
                  </div>
                  <span className="text-sm font-bold text-white text-center">{b.nome}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Escolher Serviço */}
        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(2)} className="p-2 rounded-lg bg-white/5 text-muted hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
              <div>
                <h2 className="text-xl font-black text-white">Escolha o Serviço</h2>
                <p className="text-sm text-muted">Com <span className="text-accent font-bold">{selectedBarbeiro?.nome}</span></p>
              </div>
            </div>

            <div className="space-y-3">
              {servicos.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedServico(s); setStep(4); setSelectedDate(''); setSelectedTime(''); }}
                  className={`w-full glass rounded-2xl p-4 flex items-center justify-between border transition-all hover:scale-[1.01] active:scale-[0.99] ${
                    selectedServico?.id === s.id ? 'border-accent bg-accent/10' : 'border-white/5 hover:border-accent/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
                      <Scissors className="h-4 w-4 text-accent" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{s.nome}</p>
                      <p className="text-[10px] text-muted uppercase font-medium">
                        <Clock className="h-2.5 w-2.5 inline mr-1" />
                        {s.duracao_minutos || 30} min
                      </p>
                    </div>
                  </div>
                  <span className="text-accent font-black">{formatCurrency(s.valor)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Escolher Data e Horário */}
        {step === 4 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(3)} className="p-2 rounded-lg bg-white/5 text-muted hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
              <div>
                <h2 className="text-xl font-black text-white">Data e Horário</h2>
                <p className="text-sm text-muted">{selectedServico?.nome} • {selectedServico?.duracao_minutos || 30}min</p>
              </div>
            </div>

            {/* Date Selector */}
            <div>
              <label className="text-[10px] uppercase font-bold text-muted ml-1 block mb-2">
                <Calendar className="h-3 w-3 inline mr-1" /> Selecione o dia
              </label>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {getNextDays().map((d) => (
                  <button
                    key={d.date}
                    onClick={() => { setSelectedDate(d.date); setSelectedTime(''); }}
                    className={`shrink-0 p-3 rounded-xl border text-center min-w-[60px] transition-all ${
                      selectedDate === d.date
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-white/5 bg-white/5 text-muted hover:text-white hover:border-accent/30'
                    }`}
                  >
                    <span className="text-[9px] uppercase font-bold block">{d.dayName}</span>
                    <span className="text-sm font-black block">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div>
                <label className="text-[10px] uppercase font-bold text-muted ml-1 block mb-2">
                  <Clock className="h-3 w-3 inline mr-1" /> Horários disponíveis
                </label>
                {availableSlots.length === 0 ? (
                  <div className="py-8 text-center glass rounded-2xl border border-white/5">
                    <p className="text-muted text-sm">Nenhum horário disponível neste dia.</p>
                    <p className="text-[10px] text-muted mt-1">Tente outra data.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {availableSlots.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                          selectedTime === time
                            ? 'border-accent bg-accent text-black shadow-lg shadow-accent/20'
                            : 'border-white/5 bg-white/5 text-white hover:border-accent/50'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Confirm */}
            {selectedTime && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="glass rounded-2xl p-4 border border-accent/20 bg-accent/5 space-y-3">
                  <h4 className="text-[10px] uppercase font-bold text-accent tracking-widest">Resumo do Agendamento</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted">Cliente</span><span className="text-white font-bold">{clienteNome}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Profissional</span><span className="text-white font-bold">{selectedBarbeiro?.nome}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Serviço</span><span className="text-white font-bold">{selectedServico?.nome}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Data</span><span className="text-white font-bold">{new Date(`${selectedDate}T${selectedTime}`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Horário</span><span className="text-accent font-black text-lg">{selectedTime}</span></div>
                    <div className="flex justify-between border-t border-white/5 pt-2 mt-2"><span className="text-muted">Valor</span><span className="text-accent font-black text-lg">{formatCurrency(selectedServico?.valor)}</span></div>
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-accent text-black font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-accent/20"
                >
                  {loading ? (
                    <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Sparkles className="h-5 w-5" /> Confirmar Agendamento</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-6 text-center">
        <p className="text-[10px] text-muted uppercase tracking-[0.2em]">
          {barbeariaNome} • Agendamento Online
        </p>
      </footer>
    </div>
  );
}
