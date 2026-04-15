import { Scissors, Package, ArrowUpRight, ArrowDownLeft, Clock, CreditCard, Banknote, Sparkles, User, Trash2, Pencil, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { EditTransactionModal } from './EditTransactionModal';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'tip';
  date: string;
  method?: 'pix' | 'cartao' | 'dinheiro' | 'outro';
  barbeiro_id?: string;
  comissao?: number;
  payments?: { metodo: string, valor: number }[];
}

interface TransactionListProps {
  transactions: Transaction[];
  onRefresh: () => void;
}

export function TransactionList({ transactions, onRefresh }: TransactionListProps) {
  const getIcon = (tx: Transaction) => {
    if (tx.description.includes('Venda:')) return <Package className="h-4 w-4 text-purple-400" />;
    
    switch (tx.type) {
      case 'income': return <Scissors className="h-4 w-4 text-accent" />;
      case 'expense': return <ArrowDownLeft className="h-4 w-4 text-danger" />;
      case 'tip': return <Sparkles className="h-4 w-4 text-accent-gold" />;
      default: return <Clock className="h-4 w-4 text-muted" />;
    }
  };

  const getBgColor = (tx: Transaction) => {
    if (tx.description.includes('Venda:')) return 'bg-purple-500/20 ring-1 ring-purple-500/30';
    
    switch (tx.type) {
      case 'income': return 'bg-accent/20 ring-1 ring-accent/30';
      case 'expense': return 'bg-danger/20 ring-1 ring-danger/30';
      case 'tip': return 'bg-accent-gold/20 ring-1 ring-accent-gold/30';
      default: return 'bg-white/10';
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

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
        // If tx.id was a sale record id, this might not exist in transacoes, which is fine
        const { error: tError } = await supabase.from('transacoes').delete().eq('id', tx.id);
        if (tError) console.warn('Possible skip or expected mismatch if ID is from sale table:', tError);
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

  return (
    <div className="glass rounded-2xl border border-border overflow-hidden">
      <div className="p-5 border-b border-border space-y-1">
        <h3 className="font-bold text-white flex items-center gap-2">
           <Clock className="h-4 w-4 text-accent" />
           Linha do Tempo
        </h3>
        <p className="text-[10px] text-muted uppercase tracking-widest">Movimentações do dia</p>
      </div>

      <div className="relative p-6 px-4 sm:px-8">
        {/* Timeline Vertical Line */}
        <div className="absolute left-9 top-0 bottom-0 w-[2px] bg-gradient-to-b from-border/50 via-border to-transparent"></div>

        <div className="space-y-8">
          {transactions.length === 0 ? (
            <div className="py-12 text-center relative z-10">
              <p className="text-muted text-sm">Nenhuma atividade registrada hoje.</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="relative flex items-start gap-6 group">
                {/* Connector Node */}
                <div className={`relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg transition-transform group-hover:scale-110 ${getBgColor(tx)}`}>
                  {getIcon(tx)}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="space-y-0.5">
                       <h4 className="text-sm font-bold text-white group-hover:text-accent transition-colors">
                          {tx.description}
                       </h4>
                       <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-wider font-medium">
                          <span className="flex items-center gap-1">
                             <Clock className="h-3 w-3" />
                             {new Date(tx.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                             <CreditCard className="h-3 w-3" />
                             {tx.payments && tx.payments.length > 1 
                               ? tx.payments.map(p => p.metodo).join(' + ')
                               : tx.method || 'outro'}
                          </span>
                       </div>
                    </div>
                    <div className="text-left sm:text-right">
                       <p className={`text-sm font-black ${
                          tx.type === 'income' ? 'text-accent' : tx.type === 'expense' ? 'text-danger' : 'text-accent-gold'
                       }`}>
                          {tx.type === 'expense' ? '- ' : '+ '}
                          {formatCurrency(tx.amount)}
                       </p>
                       {tx.comissao && (
                          <p className="text-[9px] text-muted-foreground italic">Comissão: {formatCurrency(tx.comissao)}</p>
                       )}
                        <div className="mt-2 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                             onClick={() => setEditingTx(tx)}
                             className="p-1.5 rounded-lg bg-white/5 text-muted hover:text-white hover:bg-white/10 transition-colors"
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
                  
                  {/* Glass Details Bubble */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/5 p-2 px-3 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                     <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center">
                        <User className="h-3 w-3 text-muted" />
                     </div>
                     <span className="text-[10px] text-muted uppercase font-bold tracking-tighter">ID: {tx.id.substring(0,8)}...</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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
