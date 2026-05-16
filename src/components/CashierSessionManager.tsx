/* eslint-disable */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Lock, 
  Unlock, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  History
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CashierSessionManagerProps {
  currentSession: any;
  barbeariaId: string;
  onRefresh: () => void;
  formatCurrency: (val: number) => string;
}

export function CashierSessionManager({ currentSession, barbeariaId, onRefresh, formatCurrency }: CashierSessionManagerProps) {
  const [openingBalance, setOpeningBalance] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleOpenSession() {
    if (!openingBalance || isNaN(Number(openingBalance))) return;
    
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { error } = await supabase
      .from('caixa_sessoes')
      .insert([{
        barbearia_id: barbeariaId,
        usuario_id: user.id,
        saldo_inicial: Number(openingBalance),
        status: 'aberto'
      }]);

    if (error) {
      console.error('Erro ao abrir caixa:', error);
    } else {
      onRefresh();
    }
    setLoading(false);
  }

  async function handleCloseSession() {
    if (!currentSession) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('caixa_sessoes')
      .update({
        status: 'fechado',
        fechado_em: new Date().toISOString(),
        saldo_final: 0 // TODO: Calcular real se necessário
      })
      .eq('id', currentSession.id)
      .eq('barbearia_id', barbeariaId);

    if (error) {
      console.error('Erro ao fechar caixa:', error);
    } else {
      onRefresh();
    }
    setLoading(false);
  }

  if (!currentSession) {
    return (
      <div className="liquid-glass rounded-[2.5rem] p-10 border-2 border-dashed border-white/10 flex flex-col items-center text-center max-w-2xl mx-auto animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-full bg-danger/10 flex items-center justify-center mb-8 border border-danger/20 shadow-[0_0_30px_rgba(255,77,77,0.1)]">
           <Lock className="w-10 h-10 text-danger" />
        </div>
        <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Caixa Fechado</h3>
        <p className="text-muted text-sm font-medium leading-relaxed mb-10 max-w-md">
          Para começar a realizar vendas e gerenciar o faturamento do dia, você precisa abrir o caixa informando o saldo inicial em dinheiro.
        </p>

        <div className="w-full max-w-sm space-y-4">
           <div className="relative group">
              <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted group-focus-within:text-accent transition-colors" />
              <input 
                type="number" 
                placeholder="Saldo inicial na gaveta (R$)"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white font-black text-lg focus:outline-none focus:border-accent/50 focus:bg-white/10 transition-all"
              />
           </div>
           <button 
             onClick={handleOpenSession}
             disabled={loading || !openingBalance}
             className="w-full bg-accent text-black py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3 shadow-[0_15px_30px_rgba(214,180,122,0.2)]"
           >
             {loading ? 'Abrindo...' : 'Abrir Caixa do Dia'}
             <ArrowRight size={18} />
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
      <div className="md:col-span-2 liquid-glass rounded-[2rem] p-8 border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
              <Unlock className="w-8 h-8 text-accent" />
           </div>
           <div>
              <div className="flex items-center gap-2 mb-1">
                 <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse"></span>
                 <p className="text-[10px] font-black uppercase tracking-[2px] text-accent">Caixa Aberto</p>
              </div>
              <h4 className="text-xl font-black text-white uppercase tracking-tight">Turno em Andamento</h4>
              <p className="text-[10px] text-muted font-bold uppercase mt-1">Iniciado em: {new Date(currentSession.aberto_em).toLocaleTimeString()}</p>
           </div>
        </div>

        <div className="flex gap-8 px-8 border-x border-white/5 hidden lg:flex">
           <div>
              <p className="text-[9px] font-black uppercase tracking-[2px] text-muted mb-1 opacity-50">Saldo Inicial</p>
              <p className="text-lg font-black text-white">{formatCurrency(currentSession.saldo_inicial)}</p>
           </div>
           <div>
              <p className="text-[9px] font-black uppercase tracking-[2px] text-accent mb-1 opacity-50">Status</p>
              <p className="text-lg font-black text-white uppercase tracking-tighter">Operacional</p>
           </div>
        </div>

        <button 
          onClick={handleCloseSession}
          disabled={loading}
          className="bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          {loading ? 'Fechando...' : 'Fechar Caixa'}
        </button>
      </div>

      <div className="liquid-glass rounded-[2rem] p-8 border border-white/10 bg-white/5 flex items-center justify-between">
         <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[2px] text-muted mb-2 opacity-50">Histórico de Turnos</span>
            <Link href="/gestao/relatorios/fluxo-caixa" className="flex items-center gap-2 text-xs font-black text-white/70 hover:text-white transition-colors">
               <History size={16} />
               Ver Relatórios Anteriores
            </Link>
         </div>
         <ArrowRight size={20} className="text-muted opacity-30" />
      </div>
    </div>
  );
}
