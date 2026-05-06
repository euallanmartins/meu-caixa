import { Check, Clock, Plus, Scissors } from 'lucide-react';
import type { Servico } from '@/hooks/useAgendamento';
import { getServiceDisplay } from '@/lib/serviceDisplay';

interface Props {
  servico: Servico;
  selecionado: boolean;
  popular?: boolean;
  onToggle: (s: Servico) => void;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatDuracao = (min: number) => {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}min`;
};

export function ServicoCard({ servico, selecionado, popular, onToggle }: Props) {
  const display = getServiceDisplay(servico);

  return (
    <button
      type="button"
      id={`servico-${servico.id}`}
      onClick={() => onToggle(servico)}
      aria-pressed={selecionado}
      className={[
        'group w-full rounded-2xl border p-3 text-left transition-all duration-200',
        'hover:-translate-y-0.5 active:translate-y-0',
        selecionado
          ? 'border-[#D6B47A] bg-[#D6B47A]/10 shadow-lg shadow-[#D6B47A]/10'
          : 'border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]',
      ].join(' ')}
    >
      <div className="grid grid-cols-[44px_minmax(0,1fr)_86px] items-center gap-3 sm:grid-cols-[52px_minmax(0,1fr)_104px] sm:gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D6B47A]/20 bg-[#D6B47A]/10 text-[#E7C992] sm:h-12 sm:w-12 sm:rounded-2xl">
          <Scissors className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>

        <span className="min-w-0">
          {popular && (
            <span className="mb-1 inline-flex rounded-full bg-[#D6B47A]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#E7C992]">
              Popular
            </span>
          )}
          <span className="line-clamp-2 text-sm font-black leading-snug text-white sm:text-base">
            {display.nome}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-bold text-white/50 sm:text-sm">
            <Clock className="h-3.5 w-3.5 shrink-0 text-white/40" />
            <span className="shrink-0">{formatDuracao(servico.duracao_minutos)}</span>
            <span className="text-white/25">-</span>
            <span className="truncate">{display.categoria}</span>
          </span>
          {servico.descricao && (
            <span className="mt-1 hidden line-clamp-1 text-sm leading-relaxed text-white/45 sm:block">
              {servico.descricao}
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-col items-end justify-center gap-2">
          <span className="max-w-full truncate whitespace-nowrap text-sm font-black text-[#D6B47A] sm:text-base">
            {formatCurrency(Number(servico.valor))}
          </span>
          <span
            className={[
              'flex h-9 w-9 items-center justify-center rounded-xl border transition-all',
              selecionado
                ? 'border-[#D6B47A] bg-gradient-to-br from-[#B8935F] to-[#E0C28D] text-[#120f09]'
                : 'border-white/15 bg-white/[0.04] text-white/45 group-hover:border-[#D6B47A]/35 group-hover:text-[#E7C992]',
            ].join(' ')}
            aria-hidden="true"
          >
            {selecionado ? <Check className="h-5 w-5" strokeWidth={3} /> : <Plus className="h-5 w-5" />}
          </span>
        </span>
      </div>
    </button>
  );
}
