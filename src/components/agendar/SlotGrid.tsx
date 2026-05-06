import { Clock } from 'lucide-react';
import type { SlotInfo } from '@/hooks/useAgendamento';

interface Props {
  slots:           SlotInfo[];
  horarioSelecionado: string | null;
  onSelect:        (time: string) => void;
}

export function SlotGrid({ slots, horarioSelecionado, onSelect }: Props) {
  const disponiveis = slots.filter(s => s.available);

  if (slots.length === 0) {
    return (
      <div className="py-8 text-center bg-white/5 border border-white/10 rounded-2xl">
        <Clock className="h-8 w-8 mx-auto text-white/20 mb-2" />
        <p className="text-white/40 text-sm">Nenhum horário para este dia.</p>
      </div>
    );
  }

  if (disponiveis.length === 0) {
    return (
      <div className="py-8 text-center bg-white/5 border border-white/10 rounded-2xl">
        <Clock className="h-8 w-8 mx-auto text-white/20 mb-2" />
        <p className="text-white/40 text-sm font-bold">Dia lotado!</p>
        <p className="text-white/30 text-xs mt-1">Escolha outra data.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {slots.map(slot => {
          const isSelected  = horarioSelecionado === slot.time;
          const isAvailable = slot.available;

          return (
            <button
              key={slot.time}
              type="button"
              id={`slot-${slot.time.replace(':', '')}`}
              disabled={!isAvailable}
              onClick={() => isAvailable && onSelect(slot.time)}
              aria-label={`${slot.time} — ${isAvailable ? 'disponível' : 'indisponível'}`}
              aria-pressed={isSelected}
              className={`
                relative py-3 rounded-xl text-sm font-black transition-all duration-150
                ${isSelected
                  ? 'bg-[#D6B47A] text-black shadow-lg shadow-[#D6B47A]/25 scale-105'
                  : isAvailable
                  ? 'bg-white/5 border border-white/10 text-white hover:border-[#D6B47A]/40 hover:bg-[#D6B47A]/10 hover:text-[#D6B47A]'
                  : 'bg-white/[0.02] border border-white/5 text-white/20 cursor-not-allowed line-through'
                }
              `}
            >
              {slot.time}

              {/* Ponto verde de disponível */}
              {isAvailable && !isSelected && (
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#D6B47A]/60" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#D6B47A]/60" />
          <span className="text-[10px] text-white/30">Disponível</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white/10" />
          <span className="text-[10px] text-white/30">Ocupado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#D6B47A]" />
          <span className="text-[10px] text-white/30">Selecionado</span>
        </div>
      </div>
    </div>
  );
}
