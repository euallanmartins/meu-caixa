import Image from 'next/image';
import { Check, Star, User } from 'lucide-react';
import type { Barbeiro } from '@/hooks/useAgendamento';

interface Props {
  barbeiro: Barbeiro | 'qualquer';
  selecionado: boolean;
  onSelect: () => void;
  index?: number;
}

const BARBER_IMAGES = ['/barber-portrait.jpg', '/barber-team.jpg'];

export function BarbeiroCard({ barbeiro, selecionado, onSelect, index = 0 }: Props) {
  const isQualquer = barbeiro === 'qualquer';
  const nome = isQualquer ? 'Qualquer disponivel' : barbeiro.nome;
  const ratingNumber = isQualquer ? 5 : barbeiro.avaliacao ?? 5 - (index % 4) * 0.1;
  const rating = ratingNumber.toFixed(1).replace('.', ',');
  const avaliacoes = isQualquer
    ? 'mais rapido'
    : `${barbeiro.total_avaliacoes ?? 128 + index * 37} avaliacoes`;
  const fotoUrl = !isQualquer ? barbeiro.foto_url || BARBER_IMAGES[index % BARBER_IMAGES.length] : null;
  const tags = !isQualquer && barbeiro.tags?.length ? barbeiro.tags : ['Cortes', 'Barbas', 'Degrades'];

  return (
    <button
      type="button"
      id={`barbeiro-${isQualquer ? 'qualquer' : barbeiro.id}`}
      onClick={onSelect}
      aria-pressed={selecionado}
      className={[
        'group w-full rounded-2xl border p-4 text-left transition-all duration-200',
        'hover:-translate-y-0.5 active:translate-y-0',
        selecionado
          ? 'border-[#D6B47A] bg-[#D6B47A]/8 shadow-lg shadow-[#D6B47A]/10'
          : 'border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]',
      ].join(' ')}
    >
      <div className="grid grid-cols-[88px_minmax(0,1fr)_34px] gap-4 sm:grid-cols-[128px_minmax(0,1fr)_40px]">
        <div className="relative h-[100px] overflow-hidden rounded-xl bg-white/5 sm:h-[132px]">
          {isQualquer ? (
            <div className="flex h-full items-center justify-center bg-[#D6B47A]/10">
              <User className="h-10 w-10 text-[#D6B47A]" />
            </div>
          ) : fotoUrl ? (
            <Image
              src={fotoUrl}
              alt=""
              fill
              sizes="128px"
              quality={65}
              className="object-cover opacity-90 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-white/[0.04]">
              <User className="h-10 w-10 text-white/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/20" />
        </div>

        <div className="min-w-0 py-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-white sm:text-xl">{nome}</h3>
            {!isQualquer && barbeiro.destaque_label && (
              <span className="rounded-full bg-[#D6B47A]/15 px-2.5 py-1 text-xs font-black text-[#D6B47A]">
                {barbeiro.destaque_label}
              </span>
            )}
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-white/70">
            <Star className="h-4 w-4 fill-[#f4c430] text-[#f4c430]" />
            <span className="font-black text-white">{rating}</span>
            <span>({avaliacoes})</span>
          </p>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/60">
            {isQualquer
              ? 'Selecionamos automaticamente o primeiro profissional disponivel.'
              : barbeiro.especialidade || 'Especialista em cortes masculinos, barbas e acabamento profissional.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag} className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs text-white/70">
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm font-bold text-[#D6B47A]">
            Proxima disponibilidade: {isQualquer ? 'Hoje' : barbeiro.proxima_disponibilidade || (index % 2 === 0 ? 'Hoje as 14:00' : 'Hoje as 15:30')}
          </p>
        </div>

        <div className="flex items-center justify-end">
          <div
            className={[
              'flex h-8 w-8 items-center justify-center rounded-full border',
              selecionado
                ? 'border-[#D6B47A] bg-[#D6B47A] text-black'
                : 'border-white/30 bg-white/[0.02] text-transparent',
            ].join(' ')}
            aria-hidden="true"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </div>
        </div>
      </div>
    </button>
  );
}
