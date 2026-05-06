/* eslint-disable */
'use client';

import { ArrowDownLeft, Banknote, Clock, CreditCard, Filter, Package, Pencil, Scissors, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EditTransactionModal } from './EditTransactionModal';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'tip';
  date: string;
  method?: 'pix' | 'cartao' | 'dinheiro' | 'outro';
  comissao?: number;
  payments?: { metodo: string; valor: number }[];
}

interface TransactionListProps {
  transactions: Transaction[];
  barbeariaId: string;
  onRefresh: () => void;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export function TransactionList({ transactions, barbeariaId, onRefresh }: TransactionListProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'tip'>('all');

  const sorted = [...transactions]
    .filter(tx => filter === 'all' || tx.type === filter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  async function performDelete(tx: Transaction) {
    setIsDeleting(tx.id);
    try {
      if (tx.type === 'expense') {
        const { error } = await supabase.from('despesas').delete().eq('id', tx.id).eq('barbearia_id', barbeariaId);
        if (error) throw error;
      } else if (tx.type === 'tip') {
        const { error } = await supabase.from('caixinhas').delete().eq('id', tx.id).eq('barbearia_id', barbeariaId);
        if (error) throw error;
      } else {
        await supabase.from('transacoes').delete().eq('id', tx.id).eq('barbearia_id', barbeariaId);
      }
      onRefresh();
    } catch (err: any) {
      alert('Erro ao excluir: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsDeleting(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
      <div className="flex items-center justify-between border-b border-white/8 px-6 py-5">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-white">
            <Clock className="h-5 w-5 text-[#D6B47A]" />
            Linha do Tempo
          </h3>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Movimentacoes do dia</p>
        </div>
        <button
          type="button"
          onClick={() => setFilter(prev => prev === 'all' ? 'income' : prev === 'income' ? 'expense' : prev === 'expense' ? 'tip' : 'all')}
          className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold text-white/75 transition-all hover:bg-white/[0.08] sm:flex"
        >
          <Filter className="h-4 w-4" />
          {filter === 'all' ? 'Todas as atividades' : filter === 'income' ? 'Vendas' : filter === 'expense' ? 'Saidas' : 'Gorjetas'}
        </button>
      </div>

      <div className="divide-y divide-white/8 px-4 py-2 sm:px-6">
        {sorted.length === 0 ? (
          <div className="py-16 text-center text-sm text-white/45">Nenhuma atividade registrada hoje.</div>
        ) : (
          sorted.map(tx => {
            const method = tx.payments?.length
              ? tx.payments.map(p => p.metodo).join(' + ')
              : tx.method || 'outro';

            return (
              <div key={tx.id} className="group grid grid-cols-[40px_56px_minmax(0,1fr)_auto] items-center gap-3 py-3 sm:grid-cols-[44px_72px_minmax(0,1fr)_auto_90px]">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                  tx.type === 'income'
                    ? 'border-[#D6B47A]/40 text-[#D6B47A]'
                    : tx.type === 'expense'
                    ? 'border-[#ff4d4d]/40 text-[#ff4d4d]'
                    : 'border-yellow-400/40 text-yellow-300'
                }`}>
                  {tx.description.includes('Venda:') ? <Package className="h-4 w-4" /> : tx.type === 'income' ? <Scissors className="h-4 w-4" /> : tx.type === 'expense' ? <ArrowDownLeft className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </div>

                <p className="text-sm text-white/55">
                  {new Date(tx.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{tx.description}</p>
                  <p className="mt-0.5 truncate text-xs text-white/45">{tx.comissao ? `Comissao: ${formatCurrency(tx.comissao)}` : 'Movimentacao registrada'}</p>
                </div>

                <p className={`text-right text-sm font-black ${tx.type === 'income' ? 'text-[#D6B47A]' : tx.type === 'expense' ? 'text-[#ff4d4d]' : 'text-yellow-300'}`}>
                  {tx.type === 'expense' ? '-' : '+'} {formatCurrency(tx.amount)}
                </p>

                <div className="hidden items-center justify-end gap-2 sm:flex">
                  <span className="rounded-lg bg-white/[0.08] px-3 py-1 text-[11px] font-bold capitalize text-white/60">
                    {method}
                  </span>
                  <button onClick={() => setEditingTx(tx)} className="rounded-lg p-2 text-white/25 opacity-0 transition-all hover:bg-white/10 hover:text-white group-hover:opacity-100">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => (isDeleting === tx.id ? performDelete(tx) : setIsDeleting(tx.id))}
                    className={`rounded-lg p-2 opacity-0 transition-all group-hover:opacity-100 ${isDeleting === tx.id ? 'bg-[#ff4d4d] text-white' : 'text-[#ff4d4d] hover:bg-[#ff4d4d]/12'}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          barbeariaId={barbeariaId}
          onClose={() => setEditingTx(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
