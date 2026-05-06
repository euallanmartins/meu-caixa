'use client';

import { ChevronLeft, ChevronRight, Crown, Loader2, Scissors, ShieldCheck, Star, Users } from 'lucide-react';
import type { Barbeiro, Servico } from '@/hooks/useAgendamento';
import { BarbeiroCard } from './BarbeiroCard';

interface Props {
  barbeiros: Barbeiro[];
  loading: boolean;
  selecionado: Barbeiro | null;
  onSelect: (b: Barbeiro | null) => void;
  onVoltar: () => void;
  onContinuar: () => void;
  servicosSelecionados: Servico[];
  duracaoFormatada: string;
  valorFormatado: string;
}

export function StepBarbeiro({
  barbeiros,
  loading,
  selecionado,
  onSelect,
  onVoltar,
  onContinuar,
  servicosSelecionados,
  duracaoFormatada,
  valorFormatado,
}: Props) {
  const isQualquerSelected = selecionado === null;

  return (
    <div className="animate-in slide-in-from-right-4 duration-300">
      <div className="mb-7 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-[0.32em] text-white/45">
          Etapa 3 de 5 - Escolha seu profissional
        </p>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Escolha seu profissional
          </h2>
          <p className="mt-2 text-base text-white/60">
            Veja os profissionais disponiveis e escolha com quem deseja agendar.
          </p>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="space-y-4">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/45">
            Profissionais disponiveis
          </p>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[164px] rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : barbeiros.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] py-14 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-white/20" />
              <p className="text-sm text-white/45">Nenhum profissional disponivel.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <BarbeiroCard
                barbeiro="qualquer"
                selecionado={isQualquerSelected}
                onSelect={() => onSelect(null)}
              />
              {barbeiros.map((b, index) => (
                <BarbeiroCard
                  key={b.id}
                  barbeiro={b}
                  selecionado={selecionado?.id === b.id}
                  onSelect={() => onSelect(b)}
                  index={index}
                />
              ))}
            </div>
          )}

          <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-[72px_minmax(0,1fr)] sm:items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#D6B47A]/12 text-[#D6B47A]">
              <Crown className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-black text-white">Dica da barbearia</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/60">
                Cada profissional tem seu estilo. Escolha quem mais combina com o seu visual.
              </p>
            </div>
          </div>
        </div>

        <aside className="hidden space-y-5 xl:block">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h3 className="mb-5 text-[12px] font-black uppercase tracking-[0.24em] text-white/55">
              Resumo da sua escolha
            </h3>
            <div className="divide-y divide-white/8">
              <div className="flex gap-4 py-4">
                <Scissors className="mt-1 h-6 w-6 text-white/45" />
                <div>
                  <p className="font-black text-white">Servicos</p>
                  <p className="mt-1 text-sm font-bold text-[#D6B47A]">{servicosSelecionados.length} selecionados</p>
                </div>
              </div>
              <div className="py-4">
                <p className="text-sm text-white/50">Duracao total</p>
                <p className="mt-1 font-black text-white">{duracaoFormatada}</p>
              </div>
              <div className="py-4">
                <p className="text-sm text-white/50">Valor total</p>
                <p className="mt-1 text-xl font-black text-[#D6B47A]">{valorFormatado}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <h3 className="mb-5 text-[12px] font-black uppercase tracking-[0.24em] text-white/55">
              Sobre nossos profissionais
            </h3>
            <div className="space-y-5">
              <div className="flex gap-4">
                <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-[#D6B47A]" />
                <div>
                  <p className="font-black text-white">Profissionais qualificados</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">Todos passam por treinamentos constantes.</p>
                </div>
              </div>
              <div className="border-t border-white/8" />
              <div className="flex gap-4">
                <Star className="mt-1 h-6 w-6 shrink-0 text-[#D6B47A]" />
                <div>
                  <p className="font-black text-white">Avaliacoes reais</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">Avaliados por clientes apos cada atendimento.</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-8 grid gap-3 border-t border-white/8 pt-5 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <button
          type="button"
          onClick={onVoltar}
          className="flex h-14 items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] font-black text-white transition-all hover:bg-white/[0.08]"
        >
          <ChevronLeft className="h-5 w-5 text-white/55" />
          Voltar
        </button>
        <button
          type="button"
          onClick={onContinuar}
          disabled={loading}
          className="flex h-14 items-center justify-center gap-3 rounded-xl bg-[#D6B47A] font-black text-black transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Escolher data e horario'}
          {!loading && <ChevronRight className="h-5 w-5" strokeWidth={3} />}
        </button>
      </div>
    </div>
  );
}
