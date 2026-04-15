'use client';

import { useState } from 'react';
import { User, Scissors, Sparkles, Package, Clock, Wallet, Trash2, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { EditTransactionModal } from './EditTransactionModal';

interface BarberAppointmentsViewProps {
  barbers: any[];
  transactions: any[];
  loading: boolean;
  onRefresh: () => void;
}

export function BarberAppointmentsView({ barbers, transactions, loading, onRefresh }: BarberAppointmentsViewProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<any | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  async function performDelete(tx: any) {
    setIsDeleting(tx.id);
    try {
      if (tx.type === 'expense') {
        const { error } = await supabase.from('despesas').delete().eq('id', tx.id);
        if (error) throw error;
      } else if (tx.type === 'tip') {
        const { error } = await supabase.from('caixinhas').delete().eq('id', tx.id);
        if (error) throw error;
      } else {
        if (tx.description.includes('Venda:')) {
          const { data: venda, error: vError } = await supabase
            .from('venda_produtos')
            .select('id, produto_id, quantidade')
            .or(`id.eq.${tx.id},transacao_id.eq.${tx.id}`)
            .maybeSingle();
          
          if (vError) throw vError;

          if (venda) {
            const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', venda.produto_id).single();
            if (prod) {
              await supabase.from('produtos').update({ estoque: prod.estoque + venda.quantidade }).eq('id', venda.produto_id);
            }
            await supabase.from('venda_produtos').delete().eq('id', venda.id);
          }
        }
        
        const { error: tError } = await supabase.from('transacoes').delete().eq('id', tx.id);
        if (tError) console.warn('Possible skip if ID is from sale table:', tError);
      }
      
      onRefresh();
      setIsDeleting(null);
    } catch (err: any) {
      console.error('Delete Error:', err);
      alert('Erro ao excluir: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsDeleting(null);
    }
  }

  if (loading) return (
     <div className="flex h-64 items-center justify-center">
       <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
     </div>
  );

  // Agrupar transações por barbeiro
  const barberQueues = barbers.map(barber => {
    const barberTxs = transactions.filter(t => t.barbeiro_id === barber.id);
    const stats = {
      produced: barberTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
      commission: barberTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.comissao || 0), 0),
      tips: barberTxs.filter(t => t.type === 'tip').reduce((acc, t) => acc + t.amount, 0),
      count: barberTxs.filter(t => t.type === 'income').length,
    };
    return { barber, transactions: barberTxs, stats };
  }).filter(q => q.transactions.length > 0 || true); // Mostrar todos, mesmo sem atendimentos

  // Barbeiros com atendimentos primeiro
  barberQueues.sort((a, b) => b.transactions.length - a.transactions.length);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Atendimentos</h2>
          <p className="text-sm text-muted">Fila de atendimentos por profissional</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-xs font-bold text-muted uppercase">
            {transactions.filter(t => t.type === 'income').length} atendimentos hoje
          </div>
        </div>
      </div>

      {/* Resumo geral compacto */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="glass p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border text-center">
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Total Produzido</p>
          <p className="text-base sm:text-xl font-black text-white">
            {formatCurrency(transactions.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0))}
          </p>
        </div>
        <div className="glass p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-accent/20 bg-accent/5 text-center">
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-accent mb-1">Comissões</p>
          <p className="text-base sm:text-xl font-black text-accent">
            {formatCurrency(transactions.filter(t => t.type === 'income').reduce((a, t) => a + (t.comissao || 0), 0))}
          </p>
        </div>
        <div className="glass p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-accent-gold/20 bg-accent-gold/5 text-center">
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-accent-gold mb-1">Gorjetas</p>
          <p className="text-base sm:text-xl font-black text-accent-gold">
            {formatCurrency(transactions.filter(t => t.type === 'tip').reduce((a, t) => a + t.amount, 0))}
          </p>
        </div>
      </div>

      {/* Filas por Barbeiro */}
      <div className="space-y-6">
        {barberQueues.map(({ barber, transactions: barberTxs, stats }) => (
          <div key={barber.id} className="glass rounded-2xl border border-border overflow-hidden">
            {/* Header do Barbeiro */}
            <div className="p-4 sm:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-black text-lg">
                  {barber.nome.substring(0, 1)}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base sm:text-lg">{barber.nome}</h3>
                  <p className="text-[10px] text-muted uppercase tracking-widest font-medium">
                    {stats.count} {stats.count === 1 ? 'atendimento' : 'atendimentos'} • Comissão: {barber.comissao}{barber.comissao_tipo === 'percentual' ? '%' : ' R$'}
                  </p>
                </div>
              </div>

              {/* Mini stats inline */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                  <span className="text-[9px] text-muted uppercase font-bold block">Produziu</span>
                  <span className="text-xs font-black text-white">{formatCurrency(stats.produced)}</span>
                </div>
                <div className="px-3 py-1.5 bg-accent/5 rounded-lg border border-accent/10">
                  <span className="text-[9px] text-accent uppercase font-bold block">Comissão</span>
                  <span className="text-xs font-black text-accent">{formatCurrency(stats.commission)}</span>
                </div>
                {stats.tips > 0 && (
                  <div className="px-3 py-1.5 bg-accent-gold/5 rounded-lg border border-accent-gold/10">
                    <span className="text-[9px] text-accent-gold uppercase font-bold block">Gorjetas</span>
                    <span className="text-xs font-black text-accent-gold">{formatCurrency(stats.tips)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Lista de Atendimentos */}
            <div className="p-3 sm:p-4">
              {barberTxs.length === 0 ? (
                <p className="text-center py-6 text-muted text-sm italic">Nenhum atendimento lançado hoje.</p>
              ) : (
                <div className="space-y-2">
                  {barberTxs.map((tx) => (
                    <div 
                      key={tx.id} 
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all"
                    >
                      {/* Ícone + Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${
                          tx.description.includes('Venda:') ? 'bg-purple-500/20' :
                          tx.type === 'income' ? 'bg-accent/20' : 'bg-accent-gold/20'
                        }`}>
                          {tx.description.includes('Venda:') ? <Package className="h-3.5 w-3.5 text-purple-400" /> :
                           tx.type === 'income' ? <Scissors className="h-3.5 w-3.5 text-accent" /> :
                           <Sparkles className="h-3.5 w-3.5 text-accent-gold" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">{tx.description}</p>
                          <p className="text-[10px] text-muted uppercase font-medium tracking-tighter">
                            <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                            {new Date(tx.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {
                              tx.payments && tx.payments.length > 1 
                                ? tx.payments.map((p: any) => p.metodo).join(' + ')
                                : tx.method
                            }
                          </p>
                        </div>
                      </div>

                      {/* Valor + Ações */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-black ${
                          tx.type === 'income' ? 'text-accent' : 'text-accent-gold'
                        }`}>
                          {formatCurrency(tx.amount)}
                        </span>

                        {/* Botões de ação - sempre visíveis no mobile */}
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingTx(tx)}
                            className="p-1.5 rounded-lg bg-white/5 text-muted hover:text-white transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          
                          {isDeleting === tx.id ? (
                            <button 
                              onClick={() => performDelete(tx)}
                              className="px-2 py-1 rounded-lg bg-danger text-white text-[9px] font-black uppercase animate-in slide-in-from-right-2"
                            >
                              OK?
                            </button>
                          ) : null}
                          
                          <button 
                            onClick={() => setIsDeleting(isDeleting === tx.id ? null : tx.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isDeleting === tx.id ? 'bg-white/10 text-white' : 'bg-danger/10 text-danger hover:bg-danger hover:text-white'
                            }`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer: Total a Receber */}
            {stats.produced > 0 && (
              <div className="px-4 sm:px-5 py-3 border-t border-white/5 bg-accent/[0.03] flex items-center justify-between">
                <span className="text-xs font-bold text-accent/70 uppercase tracking-wider">Total a Receber</span>
                <span className="text-base sm:text-lg font-black text-accent">{formatCurrency(stats.commission + stats.tips)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {editingTx && (
        <EditTransactionModal 
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
