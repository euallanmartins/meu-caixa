/* eslint-disable */
'use client';

import { X, CheckCircle2, TrendingUp, Users, Wallet, Receipt, Scissors, Package, Sparkles } from 'lucide-react';

interface ClosingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: any[];
  barbers: any[];
}

export function ClosingReportModal({ isOpen, onClose, transactions, barbers }: ClosingReportModalProps) {
  if (!isOpen) return null;

  // 1. Cálculos de Totais Gerais
  const totalRevenue = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const totalCommissions = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.comissao || 0), 0);
  const totalTips = transactions.filter(t => t.type === 'tip').reduce((acc, t) => acc + t.amount, 0);
  const netProfit = totalRevenue - totalCommissions - totalExpenses;

  // 2. Agrupamento por Barbeiro
  const barberSummary = barbers.map(barber => {
    const barberTxs = transactions.filter(t => t.barbeiro_id === barber.id);
    const produced = barberTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const commission = barberTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.comissao || 0), 0);
    const tips = barberTxs.filter(t => t.type === 'tip').reduce((acc, t) => acc + t.amount, 0);

    return {
      nome: barber.nome,
      produced,
      commission,
      tips,
      totalToReceive: commission + tips
    };
  }).filter(b => b.produced > 0 || b.tips > 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto glass border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="sticky top-0 z-10 p-6 border-b border-white/5 bg-background/50 backdrop-blur-md flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <CheckCircle2 className="text-accent h-6 w-6" />
              Fechamento do Dia
            </h2>
            <p className="text-xs text-muted font-medium uppercase tracking-widest">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 text-muted hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-8 space-y-10">
          
          {/* 1. Main Dashboard Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
               <div className="flex items-center gap-3 text-muted">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Faturamento Bruto</span>
               </div>
               <p className="text-3xl font-black text-white">{formatCurrency(totalRevenue)}</p>
               <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-accent w-full animate-progress"></div>
               </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
               <div className="flex items-center gap-3 text-muted">
                  <Wallet className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Comissões Totais</span>
               </div>
               <p className="text-3xl font-black text-accent-gold">{formatCurrency(totalCommissions)}</p>
               <p className="text-[10px] text-muted-foreground uppercase font-bold">Valor devido à equipe</p>
            </div>

            <div className="p-6 rounded-2xl bg-accent/10 border border-accent/20 space-y-4 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingUp className="h-20 w-20 text-accent" />
               </div>
               <div className="flex items-center gap-3 text-accent/70">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Lucro Líquido (Casa)</span>
               </div>
               <p className="text-3xl font-black text-accent">{formatCurrency(netProfit)}</p>
               <p className="text-[10px] text-accent/50 uppercase font-bold tracking-tighter">Sobras após pagar equipe e despesas</p>
            </div>
          </div>

          {/* 2. Professional Breakdown */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
               <Users className="h-5 w-5 text-accent" />
               <h3 className="text-lg font-bold text-white tracking-tight">Desempenho por Profissional</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {barberSummary.map((b, i) => (
                <div key={i} className="glass group p-5 rounded-2xl border border-white/5 hover:border-accent/40 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent font-black">
                        {b.nome.substring(0,1)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white">{b.nome}</h4>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Atendimentos do dia</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] text-muted uppercase font-bold">Produziu</p>
                       <p className="text-sm font-bold text-white">{formatCurrency(b.produced)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-[9px] text-muted uppercase font-bold mb-1">Comissão</p>
                      <p className="text-xs font-bold text-white">{formatCurrency(b.commission)}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-[9px] text-muted uppercase font-bold mb-1">Caixinhas</p>
                      <p className="text-xs font-bold text-accent-gold">{formatCurrency(b.tips)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-accent/5 border border-accent/10">
                    <span className="text-xs font-bold text-accent italic">Total a Receber</span>
                    <span className="text-lg font-black text-accent">{formatCurrency(b.totalToReceive)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Operational Details */}
          <div className="pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-10">
             <div className="space-y-4">
                <div className="flex items-center gap-3">
                   <Receipt className="h-5 w-5 text-muted" />
                   <h4 className="text-sm font-bold text-white uppercase tracking-widest">Resumo Operacional</h4>
                </div>
                <div className="space-y-3">
                   <div className="flex justify-between text-sm">
                      <span className="text-muted">Total de Entradas</span>
                      <span className="text-white font-medium">{transactions.filter(t => t.type === 'income').length} itens</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-danger opacity-70">Despesas Totais</span>
                      <span className="text-danger font-medium">-{formatCurrency(totalExpenses)}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-accent-gold opacity-70">Gorjetas Processadas</span>
                      <span className="text-accent-gold font-medium">+{formatCurrency(totalTips)}</span>
                   </div>
                </div>
             </div>

             <div className="flex items-end justify-end">
                 <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-2xl bg-accent px-8 py-4 font-black uppercase tracking-widest text-black hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(214,180,122,0.24)]">
                   Imprimir Relatório
                   <Receipt className="h-5 w-5" />
                </button>
             </div>
          </div>

        </div>

        {/* Footer info */}
        <div className="p-6 text-center text-[10px] text-muted uppercase tracking-[0.3em] font-medium opacity-50">
           Digital Pos &bull; Luxury Management &bull; v2.5
        </div>

      </div>
    </div>
  );
}
