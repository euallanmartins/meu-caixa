'use client';

import { useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isBefore,
  isSameDay,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, Star, Timer } from 'lucide-react';
import type { ReminderChannel, SlotInfo } from '@/hooks/useAgendamento';
import { ReminderChannelSelector } from './ReminderChannelSelector';
import { SlotGrid } from './SlotGrid';

interface Props {
  data: Date | null;
  horario: string | null;
  slots: SlotInfo[];
  loading: boolean;
  duracaoTotal: number;
  barbeiroId: string | null;
  reminderChannel: ReminderChannel;
  onSelectData: (d: Date) => void;
  onSelectHorario: (h: string) => void;
  onReminderChannelChange: (channel: ReminderChannel) => void;
  onJoinWaitlist?: () => void;
  waitlistLoading?: boolean;
  waitlistMessage?: string | null;
  onVoltar: () => void;
  onContinuar: () => void;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export function StepHorario({
  data,
  horario,
  slots,
  loading,
  duracaoTotal,
  reminderChannel,
  onSelectData,
  onSelectHorario,
  onReminderChannelChange,
  onJoinWaitlist,
  waitlistLoading,
  waitlistMessage,
  onVoltar,
  onContinuar,
}: Props) {
  const hoje = new Date();
  const [mesCalendario, setMesCalendario] = useState<Date>(() => startOfMonth(data ?? hoje));

  const inicioGrade = startOfWeek(startOfMonth(mesCalendario), { locale: ptBR });
  const fimGrade = endOfWeek(endOfMonth(mesCalendario), { locale: ptBR });
  const diasGrade = eachDayOfInterval({ start: inicioGrade, end: fimGrade });
  const mesLabel = format(mesCalendario, 'MMMM yyyy', { locale: ptBR });
  const podeVoltarMes = format(mesCalendario, 'yyyy-MM') > format(hoje, 'yyyy-MM');

  function isDiaDisponivel(dia: Date): boolean {
    if (getDay(dia) === 0) return false;
    if (isBefore(dia, hoje) && !isToday(dia)) return false;
    return true;
  }

  function isDiaOutroMes(dia: Date): boolean {
    return format(dia, 'MM-yyyy') !== format(mesCalendario, 'MM-yyyy');
  }

  return (
    <div className="animate-in slide-in-from-right-4 duration-300">
      <div className="mb-7 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-[0.32em] text-white/45">
          Etapa 4 de 5 - Escolha a data e horario
        </p>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Escolha a melhor data e horario
          </h2>
          <p className="mt-2 text-base text-white/60">
            Veja os horarios disponiveis e selecione o que melhor se encaixa na sua rotina.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-[#D6B47A]" />
            <h3 className="text-lg font-black text-white">1. Escolha a data</h3>
          </div>

          <div className="mb-5 flex items-center justify-between border-t border-white/8 pt-5">
            <button
              type="button"
              onClick={() => setMesCalendario(prev => subMonths(prev, 1))}
              disabled={!podeVoltarMes}
              aria-label="Mes anterior"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/55 transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h4 className="text-xl font-black capitalize text-white">{mesLabel}</h4>
            <button
              type="button"
              onClick={() => setMesCalendario(prev => addMonths(prev, 1))}
              aria-label="Proximo mes"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/55 transition-all hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-black uppercase text-white/45">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {diasGrade.map(dia => {
              const disponivel = isDiaDisponivel(dia);
              const outroMes = isDiaOutroMes(dia);
              const selecionado = data ? isSameDay(dia, data) : false;
              const disabled = !disponivel || outroMes;

              return (
                <button
                  key={format(dia, 'yyyy-MM-dd')}
                  type="button"
                  id={`dia-${format(dia, 'yyyy-MM-dd')}`}
                  disabled={disabled}
                  onClick={() => !disabled && onSelectData(dia)}
                  aria-label={format(dia, "d 'de' MMMM", { locale: ptBR })}
                  aria-pressed={selecionado}
                  className={[
                    'relative flex aspect-square items-center justify-center rounded-full text-base font-bold transition-all',
                    selecionado
                      ? 'bg-[#D6B47A] text-black shadow-lg shadow-[#D6B47A]/20'
                      : disabled
                      ? 'cursor-not-allowed text-white/18'
                      : 'text-white hover:bg-[#D6B47A]/10 hover:text-[#D6B47A]',
                  ].join(' ')}
                >
                  {format(dia, 'd')}
                  {isToday(dia) && !selecionado && !disabled && (
                    <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-[#D6B47A]" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/55">
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#D6B47A]" /> Datas disponiveis</span>
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-white/35" /> Poucos horarios</span>
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-white/15" /> Indisponivel</span>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-[#D6B47A]" />
            <div>
              <h3 className="text-lg font-black text-white">2. Escolha o horario</h3>
              <p className="mt-1 text-sm font-black capitalize text-[#D6B47A]">
                {data ? format(data, "EEEE, d 'de' MMMM", { locale: ptBR }) : 'Selecione uma data'}
              </p>
            </div>
            {loading && <Loader2 className="ml-auto h-5 w-5 animate-spin text-white/35" />}
          </div>

          <div className="mb-6 flex gap-3 rounded-2xl border border-[#D6B47A]/30 bg-[#D6B47A]/8 p-4">
            <Star className="h-6 w-6 shrink-0 text-[#D6B47A]" />
            <div>
              <p className="font-black text-white">Horarios em destaque</p>
              <p className="mt-1 text-sm text-white/55">Selecionamos os melhores horarios para voce.</p>
            </div>
          </div>

          {!data ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-sm text-white/45">
              Escolha uma data para ver os horarios.
            </div>
          ) : loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <SlotGrid
              slots={slots}
              horarioSelecionado={horario}
              onSelect={onSelectHorario}
              onJoinWaitlist={onJoinWaitlist}
              waitlistLoading={waitlistLoading}
              waitlistMessage={waitlistMessage}
            />
          )}

          {horario && (
            <div className="mt-6 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <Timer className="h-6 w-6 shrink-0 text-[#D6B47A]" />
              <div>
                <p className="font-black text-white">Horario selecionado</p>
                <p className="mt-1 text-sm font-bold capitalize text-[#D6B47A]">
                  {data ? format(data, "EEEE, d 'de' MMMM", { locale: ptBR }) : ''} as {horario}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-4 flex gap-3">
              <Bell className="h-5 w-5 text-[#D6B47A]" />
              <div>
                <p className="font-black text-white">Lembrete</p>
                <p className="mt-1 text-sm text-white/55">Enviaremos uma confirmacao e lembrete do seu agendamento.</p>
              </div>
            </div>
            <ReminderChannelSelector
              name="horario-reminder-channel"
              value={reminderChannel}
              onChange={onReminderChannelChange}
            />
          </div>

          <p className="mt-4 text-sm text-white/45">
            Duracao estimada: <span className="font-black text-white">{duracaoTotal || 0}min</span>
          </p>
        </section>
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
          disabled={!horario || loading}
          className="flex h-14 items-center justify-center gap-3 rounded-xl bg-[#D6B47A] font-black text-black transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          Continuar para confirmacao
          <ChevronRight className="h-5 w-5" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
