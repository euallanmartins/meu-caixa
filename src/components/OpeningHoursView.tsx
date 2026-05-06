/* eslint-disable */
'use client';

import { useState, useEffect } from 'react';
import { Clock, Calendar, Save, Check, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface OpeningHoursViewProps {
  barbeariaId: string | null;
}

const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
];

export function OpeningHoursView({ barbeariaId }: OpeningHoursViewProps) {
  const [horarios, setHorarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  async function fetchHorarios() {
    if (!barbeariaId) return;
    setLoading(true);
    
    // Buscar horários existentes
    const { data, error } = await supabase
      .from('horarios_funcionamento')
      .select('*')
      .eq('barbearia_id', barbeariaId)
      .order('dia_semana');

    if (error) {
      console.error('Erro ao buscar horários:', error);
    }

    if (!data || data.length === 0) {
      // Criar padrões se não existirem
      const defaults = DIAS_SEMANA.map((_, index) => ({
        barbearia_id: barbeariaId,
        dia_semana: index,
        aberto: index !== 0, // Domingo fechado por padrão
        hora_inicio: '08:00:00',
        hora_fim: '20:00:00'
      }));
      setHorarios(defaults);
    } else {
      // Garantir que todos os 7 dias existam (caso algum tenha sido deletado)
      const fullList = DIAS_SEMANA.map((_, index) => {
        const found = data.find(d => d.dia_semana === index);
        return found || {
          barbearia_id: barbeariaId,
          dia_semana: index,
          aberto: false,
          hora_inicio: '08:00:00',
          hora_fim: '20:00:00'
        };
      });
      setHorarios(fullList);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchHorarios();
  }, [barbeariaId]);

  async function handleSave() {
    if (!barbeariaId) return;
    setSaving(true);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('horarios_funcionamento')
        .upsert(horarios, { onConflict: 'barbearia_id, dia_semana' });

      if (error) throw error;
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert('Erro ao salvar horários: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const updateDay = (index: number, updates: any) => {
    const newHorarios = [...horarios];
    newHorarios[index] = { ...newHorarios[index], ...updates };
    setHorarios(newHorarios);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-12 w-12 border-4 border-[#D6B47A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Horário de Funcionamento</h2>
          <p className="text-sm text-white/40 font-bold uppercase tracking-widest mt-1">Defina quando sua barbearia abre e fecha</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${
            success ? 'bg-[#D6B47A] text-white' : 'bg-[#D6B47A] text-black hover:scale-105 active:scale-95 shadow-glow'
          } disabled:opacity-50`}
        >
          {saving ? (
            <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : success ? (
            <><Check size={16} /> Salvo!</>
          ) : (
            <><Save size={16} /> Salvar Alterações</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {horarios.map((dia, index) => (
          <div 
            key={index}
            className={`glass rounded-3xl border transition-all duration-300 ${
              dia.aberto 
                ? 'border-white/10 bg-white/5 shadow-xl' 
                : 'border-white/5 bg-black/20 opacity-60'
            } p-6 flex flex-col sm:flex-row items-center justify-between gap-6 hover:border-white/20`}
          >
            <div className="flex items-center gap-6 w-full sm:w-auto">
              <div 
                className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
                  dia.aberto 
                    ? 'bg-[#D6B47A]/20 border-[#D6B47A]/30 text-[#D6B47A]' 
                    : 'bg-white/5 border-white/10 text-white/20'
                }`}
              >
                <Calendar size={24} />
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-black uppercase tracking-tight ${dia.aberto ? 'text-white' : 'text-white/40'}`}>
                  {DIAS_SEMANA[index]}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                   <div className={`w-2 h-2 rounded-full ${dia.aberto ? 'bg-[#D6B47A] shadow-[0_0_8px_#D6B47A]' : 'bg-red-500'}`} />
                   <span className={`text-[10px] font-black uppercase tracking-widest ${dia.aberto ? 'text-[#D6B47A]' : 'text-red-500/50'}`}>
                     {dia.aberto ? 'Aberto' : 'Fechado'}
                   </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
              {dia.aberto && (
                <div className="flex items-center gap-3 bg-black/40 p-2 rounded-2xl border border-white/5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-white/30 uppercase ml-2">Abrir</label>
                    <input 
                      type="time" 
                      value={dia.hora_inicio.substring(0, 5)} 
                      onChange={(e) => updateDay(index, { hora_inicio: e.target.value + ':00' })}
                      className="bg-transparent border-none text-white font-black text-sm focus:ring-0 cursor-pointer p-0 px-2 w-20"
                    />
                  </div>
                  <div className="h-8 w-[1px] bg-white/10" />
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-white/30 uppercase ml-2">Fechar</label>
                    <input 
                      type="time" 
                      value={dia.hora_fim.substring(0, 5)} 
                      onChange={(e) => updateDay(index, { hora_fim: e.target.value + ':00' })}
                      className="bg-transparent border-none text-white font-black text-sm focus:ring-0 cursor-pointer p-0 px-2 w-20"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => updateDay(index, { aberto: !dia.aberto })}
                className={`px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                  dia.aberto 
                    ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20' 
                    : 'bg-[#D6B47A]/10 border-[#D6B47A]/20 text-[#D6B47A] hover:bg-[#D6B47A]/20'
                }`}
              >
                {dia.aberto ? 'Fechar Dia' : 'Abrir Dia'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="glass p-6 rounded-3xl border border-[#D6B47A]/20 bg-[#D6B47A]/5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#D6B47A]/20 flex items-center justify-center shrink-0 text-[#D6B47A]">
          <AlertCircle size={20} />
        </div>
        <div>
          <h4 className="text-sm font-black text-white uppercase">Dica Smart</h4>
          <p className="text-xs text-white/60 font-medium leading-relaxed mt-1">
            As alterações feitas aqui impactam diretamente a visibilidade dos horários disponíveis na agenda e no site de agendamento público.
          </p>
        </div>
      </div>
    </div>
  );
}
