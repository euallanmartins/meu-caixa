'use client';

import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { Check, CalendarPlus, ListChecks, RefreshCw, Scissors, User } from 'lucide-react';
import type { ClienteInput, Servico, Barbeiro } from '@/hooks/useAgendamento';

interface Props {
  cliente:              ClienteInput;
  servicosSelecionados: Servico[];
  barbeiro:             Barbeiro | null;
  data:                 Date | null;
  horario:              string | null;
  valorFormatado:       string;
  barbeariaId:           string;
  onReagendar:          () => void;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

// Gera link de intent para Google Agenda
function buildGoogleCalendarLink(params: {
  titulo:       string;
  descricao:    string;
  inicio:       Date;
  fim:          Date;
  localizacao?: string;
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const q = new URLSearchParams({
    text:     params.titulo,
    details:  params.descricao,
    dates:    `${fmt(params.inicio)}/${fmt(params.fim)}`,
    location: params.localizacao ?? '',
  });

  return `${base}&${q.toString()}`;
}

export function StepSucesso({
  cliente,
  servicosSelecionados,
  barbeiro,
  data,
  horario,
  valorFormatado,
  barbeariaId,
  onReagendar,
}: Props) {
  const checkRef = useRef<HTMLDivElement>(null);

  // Scroll to top ao montar
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    checkRef.current?.focus();
  }, []);

  const dataFormatada = data && horario
    ? format(data, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : '—';

  const primeiroNome = cliente.nome.split(' ')[0];

  // Google Agenda link
  const googleLink = (() => {
    if (!data || !horario) return null;
    const [h, m]  = horario.split(':').map(Number);
    const inicio  = new Date(data);
    inicio.setHours(h, m, 0, 0);

    const duracaoTotal = servicosSelecionados.reduce((acc, s) => acc + s.duracao_minutos, 0);
    const fim = new Date(inicio.getTime() + duracaoTotal * 60_000);

    const nomesServicos = servicosSelecionados.map(s => s.nome).join(' + ');

    return buildGoogleCalendarLink({
      titulo:    `Barbearia — ${nomesServicos}`,
      descricao: `Agendado para ${cliente.nome}${barbeiro ? ` com ${barbeiro.nome}` : ''}.\nValor estimado: ${valorFormatado}`,
      inicio,
      fim,
    });
  })();

  return (
    <div className="space-y-8 animate-in zoom-in-95 fade-in duration-500">
      {/* Ícone de check animado */}
      <div className="flex flex-col items-center text-center gap-4 py-6">
        <div
          ref={checkRef}
          tabIndex={-1}
          className="
            relative h-24 w-24 rounded-full
            bg-[#D6B47A]/20 flex items-center justify-center
            ring-4 ring-[#D6B47A]/30 ring-offset-4 ring-offset-[#050505]
            animate-in zoom-in-50 duration-700
          "
        >
          {/* Glow */}
          <div className="absolute inset-0 rounded-full bg-[#D6B47A]/10 blur-xl scale-150" />
          <Check
            size={44}
            strokeWidth={3}
            className="text-[#D6B47A] relative z-10 animate-in zoom-in-95 duration-500"
          />
        </div>

        <div>
          <h2 className="text-2xl font-black text-white">
            Tudo certo, {primeiroNome}!
          </h2>
          <p className="text-white/50 text-sm mt-1 max-w-xs mx-auto">
            Seu agendamento foi realizado. Aguarde a confirmação da barbearia.
          </p>
        </div>
      </div>

      {/* Card de resumo */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">

        {/* Linha de destaque */}
        <div className="bg-[#D6B47A]/10 border-b border-[#D6B47A]/20 px-5 py-4 text-center">
          <p className="text-[#D6B47A] font-black text-3xl">{horario}</p>
          <p className="text-white/60 text-sm capitalize mt-0.5">{dataFormatada}</p>
        </div>

        <div className="divide-y divide-white/5">
          {/* Profissional */}
          <div className="flex items-center gap-3 px-5 py-3.5">
            <User size={15} className="text-white/30 shrink-0" />
            <div className="min-w-0 flex-1 flex items-center justify-between">
              <span className="text-white/50 text-sm">Profissional</span>
              <span className="text-white font-bold text-sm">
                {barbeiro ? barbeiro.nome : 'Qualquer disponível'}
              </span>
            </div>
          </div>

          {/* Serviços */}
          <div className="px-5 py-3.5">
            <div className="flex items-start gap-3">
              <Scissors size={15} className="text-white/30 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="space-y-1">
                  {servicosSelecionados.map(s => (
                    <div key={s.id} className="flex items-center justify-between">
                      <span className="text-white/80 text-sm">{s.nome}</span>
                      <span className="text-white/50 text-sm">{formatCurrency(Number(s.valor))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-white/[0.02]">
            <span className="text-white/50 text-sm">Valor estimado</span>
            <span className="text-[#D6B47A] font-black text-lg">{valorFormatado}</span>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="space-y-3">
        {/* Adicionar ao Google Agenda */}
        {googleLink && (
          <a
            href={googleLink}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-google-agenda"
            className="
              flex items-center justify-center gap-2 w-full py-4 rounded-2xl
              bg-white/10 hover:bg-white/15 border border-white/20
              text-white font-black uppercase tracking-widest text-sm
              hover:scale-[1.02] active:scale-[0.98] transition-all
            "
          >
            <CalendarPlus size={18} />
            Adicionar ao Google Agenda
          </a>
        )}

        <Link
          href={`/cliente?id=${barbeariaId}`}
          id="btn-meus-agendamentos"
          className="
            flex items-center justify-center gap-2 w-full py-4 rounded-2xl
            bg-[#D6B47A] text-black
            font-black uppercase tracking-widest text-sm
            hover:scale-[1.02] active:scale-[0.98] transition-all
          "
        >
          <ListChecks size={18} />
          Ver meus agendamentos
        </Link>

        {/* Fazer novo agendamento */}
        <button
          type="button"
          id="btn-reagendar"
          onClick={onReagendar}
          className="
            flex items-center justify-center gap-2 w-full py-4 rounded-2xl
            bg-transparent text-white/40 hover:text-white
            font-bold text-sm transition-all hover:bg-white/5
          "
        >
          <RefreshCw size={16} />
          Fazer outro agendamento
        </button>
      </div>
    </div>
  );
}
