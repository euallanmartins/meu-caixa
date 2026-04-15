'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AIAssistantProps {
  onProcessed: () => void;
  profile?: any;
}

export function AIAssistant({ onProcessed, profile }: AIAssistantProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  async function handleProcess() {
    if (!input.trim() || loading || !profile?.barbearia_id) return;
    setLoading(true);

    try {
      const lowerInput = input.toLowerCase();
      
      // Extract Value
      const valueMatch = input.match(/(?:(?:R\$|R\s?\$)?\s?)?(\d+([.,]\d{1,2})?)/);
      const value = valueMatch ? parseFloat(valueMatch[1].replace(',', '.')) : 0;
      
      if (value === 0) {
        alert("Não consegui identificar o valor. Tente algo como 'Corte R$ 35 pix'.");
        setLoading(false);
        return;
      }

      // Extract Method
      let method = 'dinheiro';
      if (lowerInput.includes('pix')) method = 'pix';
      else if (lowerInput.includes('cartao') || lowerInput.includes('cartão') || lowerInput.includes('credito') || lowerInput.includes('debito')) method = 'cartao';

      // Type Detection
      const isExpense = /gastei|paguei|despesa|saida|comprei/.test(lowerInput);
      const isTip = /caixinha|gorjeta/.test(lowerInput);

      // Description logic
      let desc = input.replace(valueMatch![0], '').trim();
      desc = desc.replace(/(pix|cartao|cartão|dinheiro|no|em)/ig, '').trim() || 'Lançamento Automático';

      const barbeariaId = profile.barbearia_id;
      const today = new Date().toISOString();

      if (isExpense) {
        // Inserir Despesa
        await supabase.from('despesas').insert({
          barbearia_id: barbeariaId,
          descricao: desc.substring(0, 50),
          valor: value,
          data: today
        });
        alert(`Despesa registrada: R$ ${value.toFixed(2)}`);
      } else if (isTip) {
        // Inserir Caixinha (Gorjeta)
        await supabase.from('caixinhas').insert({
          barbearia_id: barbeariaId,
          valor: value,
          metodo: method,
          data: today
        });
        alert(`Caixinha registrada: R$ ${value.toFixed(2)} (${method})`);
      } else {
        // Inserir Transação de Serviço Genérica
        const { data: servico } = await supabase.from('servicos')
          .select('id').eq('barbearia_id', barbeariaId).limit(1).maybeSingle();
          
        let servicoId = servico?.id;
        
        // Se não tiver serviço, cria um genérico para o teste da IA
        if (!servicoId) {
          const { data: newServ, error: servErr } = await supabase.from('servicos').insert({
            barbearia_id: barbeariaId,
            nome: 'Serviço via IA',
            valor: value
          }).select().single();
          if (servErr) throw new Error('Erro Serviço: ' + servErr.message);
          servicoId = newServ?.id;
        }
        
        // Vamos buscar ou criar um barbeiro que é obrigatório nas transações
        const { data: barbeiro } = await supabase.from('barbeiros')
          .select('id').eq('barbearia_id', barbeariaId).limit(1).maybeSingle();
          
        let barbeiroId = barbeiro?.id;
        if (!barbeiroId) {
           const { data: newBarb, error: barbErr } = await supabase.from('barbeiros').insert({
             barbearia_id: barbeariaId,
             nome: 'Barbeiro Autônomo'
           }).select().single();
           if (barbErr) throw new Error('Erro Barbeiro: ' + barbErr.message);
           barbeiroId = newBarb?.id;
        }

        // Criar a transação
        const { data: txData, error: txErr } = await supabase.from('transacoes').insert({
           barbearia_id: barbeariaId,
           cliente_nome: desc.substring(0, 50),
           servico_id: servicoId,
           barbeiro_id: barbeiroId,
           valor_total: value,
           data: today,
        }).select().single();
        
        if (txErr) throw new Error('Erro Transação: ' + txErr.message);

        // Criar o meio de pagamento associado à transação
        if (txData) {
          await supabase.from('transacao_pagamentos').insert({
            transacao_id: txData.id,
            valor: value,
            metodo: method
          });
        }
        alert(`Entrada registrada: R$ ${value.toFixed(2)} (${method})`);
      }

      setInput('');
      onProcessed();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao processar: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="liquid-glass rounded-2xl border border-white/5 p-4 sm:p-6 transition-all">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent animate-pulse" />
        <h3 className="font-semibold text-white text-xs sm:text-sm uppercase tracking-wider">AIDA (Sua Assistente)</h3>
      </div>

      <div className="relative group">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex: 'Corte R$ 35' ou 'Despesa R$ 10'"
          rows={1}
          className="w-full resize-none overflow-hidden rounded-xl border border-white/10 bg-black/40 py-3 sm:py-4 pl-4 pr-12 text-sm text-white placeholder-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
        />
        <button
          onClick={handleProcess}
          disabled={loading || !input.trim()}
          className="absolute right-1.5 bottom-1.5 sm:right-2 sm:bottom-2 rounded-lg bg-accent p-2 text-black transition-all hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
          ) : (
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </button>
      </div>
      
      <p className="mt-3 text-[10px] text-muted uppercase tracking-widest text-center">
        Digite e pressione o botão para lançar rapidamente.
      </p>
    </div>
  );
}
