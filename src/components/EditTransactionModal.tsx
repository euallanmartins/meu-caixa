'use client';

import { useState, useEffect } from 'react';
import { X, Check, CreditCard, Banknote, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface EditTransactionModalProps {
  transaction: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditTransactionModal({ transaction, onClose, onSuccess }: EditTransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // States
  const [description, setDescription] = useState(transaction.description || '');
  const [amount, setAmount] = useState(transaction.amount.toString());
  
  // Payment Logic
  // Check if it's a split payment or single
  const initialIsSplit = transaction.payments && transaction.payments.length > 1;
  const [isSplit, setIsSplit] = useState(initialIsSplit);
  const [method1, setMethod1] = useState<any>(transaction.payments?.[0]?.metodo || transaction.method || 'dinheiro');
  const [method2, setMethod2] = useState<any>(transaction.payments?.[1]?.metodo || 'pix');
  const [amount1, setAmount1] = useState(transaction.payments?.[0]?.valor?.toString() || transaction.amount.toString());
  const [amount2, setAmount2] = useState(transaction.payments?.[1]?.valor?.toString() || '0');

  const totalValue = parseFloat(amount || '0');
  const isProduct = transaction.description.includes('Venda:');

  async function handleSave() {
    if (loading || totalValue <= 0) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      if (transaction.type === 'income') {
        if (isProduct) {
          // It's a product sale. ID could be from venda_produtos or transacoes depending on how it was fetched.
          // For safety, we try to update both if transaction.id maps to a transacao record.
          
          // 1. Update Venda_produtos (amount and potentially comissao if we want to be fancy, but let's stick to simple value)
          const { error: err1 } = await supabase.from('venda_produtos')
            .update({ valor_total: totalValue })
            .or(`id.eq.${transaction.id},transacao_id.eq.${transaction.id}`);
          if (err1) throw err1;

          // 2. Update Transação (if exists)
          await supabase.from('transacoes')
            .update({ valor_total: totalValue })
            .eq('id', transaction.id);

          // 3. Update Payments (if they exist)
          // Look for payment by transacao_id (needs to find it first)
          const { data: tx } = await supabase.from('transacoes').select('id').eq('id', transaction.id).maybeSingle();
          if (tx) {
             await updatePayments(tx.id);
          }
        } else {
          // Regular Service
          const { error: err1 } = await supabase.from('transacoes')
            .update({ 
               // We don't update servico_id here as we don't have a selector, 
               // but we can update cliente_nome if description changed
               cliente_nome: description.includes('-') ? description.split('-')[1].trim() : description,
               valor_total: totalValue 
            })
            .eq('id', transaction.id);
          if (err1) throw err1;

          await updatePayments(transaction.id);
        }
      } else if (transaction.type === 'expense') {
        const { error: err2 } = await supabase.from('despesas')
          .update({ descricao: description, valor: totalValue })
          .eq('id', transaction.id);
        if (err2) throw err2;
      } else if (transaction.type === 'tip') {
        const { error: err3 } = await supabase.from('caixinhas')
          .update({ valor: totalValue, metodo: method1 })
          .eq('id', transaction.id);
        if (err3) throw err3;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Save Error:', err);
      setErrorMsg(err.message || 'Erro desconhecido ao salvar');
    } finally {
      setLoading(false);
    }
  }

  async function updatePayments(txId: string) {
    await supabase.from('transacao_pagamentos').delete().eq('transacao_id', txId);
    if (isSplit) {
      const v1 = parseFloat(amount1 || '0');
      const v2 = parseFloat(amount2 || '0');
      await supabase.from('transacao_pagamentos').insert([
        { transacao_id: txId, metodo: method1, valor: v1 },
        { transacao_id: txId, metodo: method2, valor: v2 }
      ]);
    } else {
      await supabase.from('transacao_pagamentos').insert({
        transacao_id: txId,
        metodo: method1,
        valor: totalValue
      });
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="glass w-full max-w-lg rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-accent" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-white">Editar Lançamento</h3>
                <p className="text-[10px] text-muted uppercase tracking-widest">Ajuste os detalhes da transação</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-muted hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-8 space-y-6">
          {errorMsg && (
            <div className="bg-danger/10 border border-danger/20 p-4 rounded-xl flex items-center gap-3 text-danger text-xs font-bold animate-in shake duration-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-muted ml-1">Descrição / Cliente</label>
            <input 
              type="text" 
              value={description}
              disabled={isProduct}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-accent outline-none ${isProduct ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="Ex: Corte - João"
            />
            {isProduct && <p className="text-[9px] text-accent/50 ml-1">Vendas de produto não permitem alteração de nome.</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-muted ml-1">Valor Total (R$)</label>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xl font-bold text-white focus:border-accent outline-none"
            />
          </div>

          {transaction.type !== 'expense' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                 <label className="text-[10px] uppercase font-bold text-muted">Forma de Pagamento</label>
                 <button 
                   onClick={() => setIsSplit(!isSplit)}
                   className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${isSplit ? 'bg-accent text-black' : 'bg-white/5 text-muted hover:text-white'}`}
                 >
                   {isSplit ? '✓ Pagamento Combinado' : '+ Combinar 2 formas'}
                 </button>
              </div>

              {!isSplit ? (
                <div className="flex gap-2">
                   {['dinheiro', 'pix', 'cartao'].map((m) => (
                      <button
                        key={m}
                        onClick={() => setMethod1(m as any)}
                        className={`flex-1 p-3 rounded-xl border text-[10px] uppercase font-bold transition-all ${method1 === m ? 'border-accent bg-accent/10 text-accent shadow-lg shadow-accent/5' : 'border-white/5 bg-white/5 text-muted hover:text-white'}`}
                      >
                         <span className="flex flex-col items-center gap-1">
                            {m === 'dinheiro' && <Banknote className="h-4 w-4" />}
                            {m === 'pix' && <Sparkles className="h-4 w-4" />}
                            {m === 'cartao' && <CreditCard className="h-4 w-4" />}
                            {m}
                         </span>
                      </button>
                   ))}
                </div>
              ) : (
                <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                   <div className="grid grid-cols-2 gap-4">
                      {/* Method 1 */}
                      <div className="space-y-2">
                         <select 
                           value={method1} 
                           onChange={(e) => setMethod1(e.target.value as any)}
                           className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] uppercase font-bold text-white outline-none"
                         >
                            <option value="dinheiro">Dinheiro</option>
                            <option value="pix">Pix</option>
                            <option value="cartao">Cartão</option>
                         </select>
                         <input 
                           type="number" 
                           value={amount1}
                           onChange={(e) => {
                              setAmount1(e.target.value);
                              const v = parseFloat(e.target.value || '0');
                              if (v <= totalValue) setAmount2((totalValue - v).toFixed(2));
                           }}
                           className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-sm text-white"
                         />
                      </div>
                      {/* Method 2 */}
                      <div className="space-y-2">
                         <select 
                           value={method2} 
                           onChange={(e) => setMethod2(e.target.value as any)}
                           className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] uppercase font-bold text-white outline-none"
                         >
                            <option value="pix">Pix</option>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="cartao">Cartão</option>
                         </select>
                         <input 
                           type="number" 
                           value={amount2}
                           onChange={(e) => {
                              setAmount2(e.target.value);
                              const v = parseFloat(e.target.value || '0');
                              if (v <= totalValue) setAmount1((totalValue - v).toFixed(2));
                           }}
                           className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-sm text-white"
                         />
                      </div>
                   </div>
                   <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] uppercase font-extrabold text-muted">Total Conferido</span>
                      <span className={`text-[10px] font-black ${(parseFloat(amount1||'0') + parseFloat(amount2||'0')) === totalValue ? 'text-accent' : 'text-danger'}`}>
                        R$ {(parseFloat(amount1||'0') + parseFloat(amount2||'0')).toFixed(2)} / R$ {totalValue.toFixed(2)}
                      </span>
                   </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 flex gap-3">
             <button 
               onClick={onClose}
               className="flex-1 py-4 rounded-2xl border border-white/10 font-bold text-muted hover:text-white hover:bg-white/5 transition-all outline-none"
             >
                Cancelar
             </button>
             <button 
               onClick={handleSave}
               disabled={loading || (isSplit && (parseFloat(amount1||'0') + parseFloat(amount2||'0')) !== totalValue)}
               className="flex-[2] py-4 rounded-2xl bg-accent text-black font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-accent/20 disabled:opacity-50 outline-none"
             >
                {loading ? 'Salvando...' : 'Salvar Alterações'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
