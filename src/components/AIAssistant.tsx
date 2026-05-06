'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AIAssistantProps {
  onProcessed: () => void;
  profile?: {
    barbearia_id?: string | null;
    role?: string | null;
  } | null;
}

type Feedback = {
  kind: 'success' | 'warning' | 'error';
  message: string;
};

export function AIAssistant({ onProcessed, profile }: AIAssistantProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [input]);

  async function handleProcess() {
    const texto = input.trim();
    const barbeariaId = profile?.barbearia_id;

    if (!texto || loading) return;

    if (!barbeariaId) {
      setFeedback({
        kind: 'error',
        message: 'Nao foi possivel identificar a barbearia do seu perfil profissional.',
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const { data, error } = await supabase.rpc('rpc_aida_lancamento_rapido', {
        p_barbearia_id: barbeariaId,
        p_texto: texto,
      });

      if (error) throw error;

      const result = data as { success?: boolean; message?: string } | null;
      const message = result?.message || 'Nao consegui processar esse lancamento.';

      if (result?.success) {
        setFeedback({ kind: 'success', message });
        setInput('');
        onProcessed();
        return;
      }

      setFeedback({ kind: 'warning', message });
    } catch (err) {
      console.error('[AIDA] Falha ao processar lancamento:', err);
      setFeedback({
        kind: 'error',
        message: 'Nao foi possivel lancar agora. Verifique se a RPC da AIDA foi aplicada no Supabase.',
      });
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || !input.trim() || !profile?.barbearia_id;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20 transition-all sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#D6B47A]/20 bg-[#D6B47A]/10 text-[#D6B47A]">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white sm:text-sm">
            AIDA
          </h3>
          <p className="mt-1 text-[11px] font-bold text-white/45">
            Lancamento rapido de atendimento
          </p>
        </div>
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              handleProcess();
            }
          }}
          placeholder="Ex: Diego fez corte agora 30 reais"
          rows={1}
          className="max-h-40 min-h-14 w-full resize-none overflow-hidden rounded-2xl border border-white/10 bg-black/35 py-4 pl-4 pr-14 text-sm font-semibold leading-relaxed text-white outline-none transition-all placeholder:text-white/30 focus:border-[#D6B47A]/55 focus:ring-4 focus:ring-[#D6B47A]/10"
        />
        <button
          type="button"
          onClick={handleProcess}
          disabled={disabled}
          className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#D6B47A] text-black transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
          aria-label="Enviar lancamento para AIDA"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>

      {feedback && (
        <div
          className={[
            'mt-4 flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed',
            feedback.kind === 'success'
              ? 'border-[#D6B47A]/25 bg-[#D6B47A]/10 text-[#E7C992]'
              : feedback.kind === 'warning'
                ? 'border-yellow-400/25 bg-yellow-400/10 text-yellow-100'
                : 'border-[#ff4d4d]/25 bg-[#ff4d4d]/10 text-[#ff9a9a]',
          ].join(' ')}
        >
          {feedback.kind === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{feedback.message}</p>
        </div>
      )}

      <p className="mt-3 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
        Apenas atendimentos realizados. Ex: Diego fez barba 25 pix.
      </p>
    </div>
  );
}
