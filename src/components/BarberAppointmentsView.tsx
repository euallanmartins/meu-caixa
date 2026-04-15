'use client';

import { useState } from 'react';
import { User, Scissors, Sparkles, Package, Clock, Filter, Wallet, Trash2, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { EditTransactionModal } from './EditTransactionModal';

interface BarberAppointmentsViewProps {
  barbers: any[];
  transactions: any[];
  loading: boolean;
  onRefresh: () => void;
}

export function BarberAppointmentsView({ barbers, transactions, loading, onRefresh }: BarberAppointmentsViewProps) {
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<any | null>(null);

  const selectedBarber = barbers.find(b => b.id === selectedBarberId);
  const myTransactions = transactions.filter(t => t.barbeiro_id === selectedBarberId);

  const stats = {
    produced: myTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
    commission: myTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.comissao || 0), 0),
    tips: myTransactions.filter(t => t.type === 'tip').reduce((acc, t) => acc + t.amount, 0),
  };

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
        // It's an income (Service or Product)
        if (tx.description.includes('Venda:')) {
          // 1. Find the venda_produtos record (could be tx.id or linked by transacao_id)
          const { data: venda, error: vError } = await supabase
            .from('venda_produtos')
            .select('id, produto_id, quantidade')
            .or(`id.eq.${tx.id},transacao_id.eq.${tx.id}`)
            .maybeSingle();
          
          if (vError) throw vError;

          if (venda) {
            // 2. Revert stock
            const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', venda.produto_id).single();
            if (prod) {
              await supabase.from('produtos').update({ estoque: prod.estoque + venda.quantidade }).eq('id', venda.produto_id);
            }
            // 3. Delete the sale record specifically
            await supabase.from('venda_produtos').delete().eq('id', venda.id);
          }
        }
        
        // 4. Delete from transacoes (will cascade to transacao_pagamentos)
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

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Meus Atendimentos</h2>
          <p className="text-sm text-muted">Acompanhe sua produção e ganhos do dia</p>
        </div>

        <div className="relative min-w-[200px]">
           <select 
             value={selectedBarberId}
             onChange={(e) => setSelectedBarberId(e.target.value)}
             className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 pr-10"
           >
             <option value="" className="bg-zinc-900">Selecione seu nome</option>
             {barbers.map(b => (
               <option key={b.id} value={b.id} className="bg-zinc-900">{b.nome}</option>
             ))}
           </select>
           <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
        </div>
      </div>

      {!selectedBarberId ? (
        <div className="glass rounded-[2.5rem] p-20 flex flex-col items-center justify-center border-dashed border-border/50">
           <div className="h-20 w-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
              <User className="h-10 w-10 text-accent/50" />
           </div>
           <h3 className="text-xl font-bold text-white mb-2">Quem é você?</h3>
           <p className="text-muted text-center max-w-xs text-sm">
              Selecione seu nome acima para visualizar suas metas e atendimentos do dia.
           </p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="glass p-6 rounded-2xl border border-border">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Total Produzido</p>
                <div className="flex items-end justify-between">
                   <h4 className="text-2xl font-black text-white">{formatCurrency(stats.produced)}</h4>
                   <Scissors className="h-5 w-5 text-accent/50" />
                </div>
             </div>
             
             <div className="glass p-6 rounded-2xl border border-accent/20 bg-accent/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-2">Sua Comissão</p>
                <div className="flex items-end justify-between">
                   <h4 className="text-2xl font-black text-accent">{formatCurrency(stats.commission)}</h4>
                   <Wallet className="h-5 w-5 text-accent/50" />
                </div>
                <p className="text-[9px] text-accent/60 mt-2 italic font-medium">Estimativa a receber hoje</p>
             </div>

             <div className="glass p-6 rounded-2xl border border-accent-gold/20 bg-accent-gold/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent-gold mb-2">Gorjetas</p>
                <div className="flex items-end justify-between">
                   <h4 className="text-2xl font-black text-accent-gold">{formatCurrency(stats.tips)}</h4>
                   <Sparkles className="h-5 w-5 text-accent-gold/50" />
                </div>
             </div>
          </div>

          {/* Timeline */}
          <div className="glass rounded-3xl border border-border overflow-hidden">
             <div className="p-6 border-b border-border flex items-center justify-between">
                <h3 className="font-bold text-white flex items-center gap-2">
                   <Clock className="h-4 w-4 text-accent" />
                   Meus Lançamentos
                </h3>
                <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-muted uppercase">
                   {myTransactions.length} registros
                </span>
             </div>

             <div className="p-6">
                {myTransactions.length === 0 ? (
                   <p className="text-center py-12 text-muted text-sm italic">Nenhum atendimento lançado hoje.</p>
                ) : (
                   <div className="space-y-6 relative">
                      <div className="absolute left-[17px] top-6 bottom-6 w-[1px] bg-border/50"></div>
                      
                      {myTransactions.map((tx) => (
                         <div key={tx.id} className="relative flex items-start gap-4 transform transition-transform hover:translate-x-1">
                            <div className={`mt-1.5 h-9 w-9 shrink-0 rounded-full flex items-center justify-center z-10 shadow-lg ${
                               tx.type === 'income' ? 'bg-accent/20 border border-accent/30' : 'bg-accent-gold/20 border border-accent-gold/30'
                            }`}>
                               {tx.description.includes('Venda:') ? <Package className="h-4 w-4 text-purple-400" /> : 
                                tx.type === 'income' ? <Scissors className="h-4 w-4 text-accent" /> : 
                                <Sparkles className="h-4 w-4 text-accent-gold" />}
                            </div>
                            
                            <div className="flex-1 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:bg-white-[0.07] transition-all">
                               <div className="flex justify-between items-start">
                                  <div>
                                     <h5 className="text-sm font-bold text-white">{tx.description}</h5>
                                     <p className="text-[10px] text-muted uppercase font-bold tracking-tighter">
                                        {new Date(tx.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} &bull; {
                                           tx.payments && tx.payments.length > 1 
                                            ? tx.payments.map((p: any) => p.metodo).join(' + ')
                                            : tx.method
                                        }
                                     </p>
                                  </div>
                                  <div className="text-right">
                                     <p className={`text-sm font-black ${tx.type === 'income' ? 'text-white' : 'text-accent-gold'}`}>
                                        {formatCurrency(tx.amount)}
                                     </p>
                                     <div className="mt-2 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                          onClick={() => setEditingTx(tx)}
                                          className="p-1.5 rounded-lg bg-white/5 text-muted hover:text-white transition-colors"
                                        >
                                           <Pencil className="h-3 w-3" />
                                        </button>
                                        <div className="flex items-center gap-1 overflow-hidden transition-all duration-300">
                                           {isDeleting === tx.id ? (
                                             <button 
                                               onClick={() => performDelete(tx)}
                                               className="px-2 py-1 rounded-lg bg-danger text-white text-[9px] font-black uppercase tracking-tighter animate-in slide-in-from-right-2"
                                             >
                                                Confirmar?
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
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>
                )}
             </div>
          </div>
        </div>
      )}

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
