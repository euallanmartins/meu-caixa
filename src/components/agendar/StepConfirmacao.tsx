'use client';

import Image from 'next/image';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  Loader2,
  Scissors,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import type { Barbeiro, ClienteInput, CustomFormField, ReminderChannel, Servico } from '@/hooks/useAgendamento';
import { safeSupabaseImageUrl } from '@/lib/security/url';
import { ReminderChannelSelector } from './ReminderChannelSelector';

interface Props {
  cliente: ClienteInput;
  servicosSelecionados: Servico[];
  barbeiro: Barbeiro | null;
  data: Date | null;
  horario: string | null;
  observacoes: string;
  valorFormatado: string;
  duracaoFormatada: string;
  reminderChannel: ReminderChannel;
  submitting: boolean;
  customFormFields?: CustomFormField[];
  customFormAnswers?: Record<string, string>;
  onObservacoes: (obs: string) => void;
  onReminderChannelChange: (channel: ReminderChannel) => void;
  onCustomFormAnswer?: (fieldId: string, value: string) => void;
  onConfirmar: () => Promise<boolean>;
  onVoltar: () => void;
  onEditarStep?: (step: 1 | 2 | 3 | 4) => void;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function StepConfirmacao({
  cliente,
  servicosSelecionados,
  barbeiro,
  data,
  horario,
  observacoes,
  valorFormatado,
  duracaoFormatada,
  reminderChannel,
  submitting,
  customFormFields = [],
  customFormAnswers = {},
  onObservacoes,
  onReminderChannelChange,
  onCustomFormAnswer,
  onConfirmar,
  onVoltar,
  onEditarStep,
}: Props) {
  const dataFormatada = data
    ? format(data, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : 'Data nao selecionada';
  const barbeiroFotoUrl = safeSupabaseImageUrl(barbeiro?.foto_url, '/barber-portrait.jpg');

  return (
    <div className="animate-in slide-in-from-right-4 duration-300">
      <div className="mb-7 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-[0.32em] text-white/45">
          Etapa 5 de 5 - Confirme seu agendamento
        </p>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Quase pronto! Confira e confirme seu agendamento
          </h2>
          <p className="mt-2 text-base text-white/60">Revise os detalhes do seu agendamento. Se estiver tudo certo, e so confirmar.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)] xl:items-start">
        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-4">
              <h3 className="flex items-center gap-3 text-[12px] font-black uppercase tracking-[0.24em] text-white/60">
                <Scissors className="h-5 w-5 text-[#D6B47A]" />
                Servicos
              </h3>
              <button type="button" onClick={() => onEditarStep?.(2)} className="text-sm font-black text-[#D6B47A]">Editar</button>
            </div>
            <div className="divide-y divide-white/8">
              {servicosSelecionados.map(s => (
                <div key={s.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto] gap-4 py-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D6B47A]/15 bg-[#D6B47A]/10 text-[#D6B47A]">
                    <Scissors className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-white">{s.nome}</p>
                    <p className="mt-1 text-sm text-white/60">{s.duracao_minutos}min</p>
                  </div>
                  <p className="font-black text-[#D6B47A]">{formatCurrency(Number(s.valor))}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/8 pt-4">
              <div className="flex gap-3">
                <Clock className="mt-1 h-5 w-5 text-white/45" />
                <div>
                  <p className="text-sm text-white/50">Duracao total</p>
                  <p className="font-black text-white">{duracaoFormatada}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <CircleDollarSign className="mt-1 h-5 w-5 text-white/45" />
                <div>
                  <p className="text-sm text-white/50">Valor total</p>
                  <p className="font-black text-[#D6B47A]">{valorFormatado}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-4">
              <h3 className="flex items-center gap-3 text-[12px] font-black uppercase tracking-[0.24em] text-white/60">
                <User className="h-5 w-5 text-[#D6B47A]" />
                Profissional
              </h3>
              <button type="button" onClick={() => onEditarStep?.(3)} className="text-sm font-black text-[#D6B47A]">Editar</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-center">
              <div className="relative h-[112px] overflow-hidden rounded-xl bg-white/5">
                <Image src={barbeiroFotoUrl} alt="" fill sizes="112px" className="object-cover opacity-90" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black text-white">{barbeiro?.nome ?? 'Qualquer disponivel'}</h3>
                  {barbeiro?.destaque_label && (
                    <span className="rounded-full bg-[#D6B47A]/15 px-2.5 py-1 text-xs font-black text-[#D6B47A]">
                      {barbeiro.destaque_label}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-white/60">
                  {barbeiro?.especialidade || 'Especialista em cortes masculinos, barbas e visagismo.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(barbeiro?.tags?.length ? barbeiro.tags : ['Cortes', 'Barbas', 'Degrades', 'Visagismo']).map(tag => (
                    <span key={tag} className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs text-white/70">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-4">
              <h3 className="flex items-center gap-3 text-[12px] font-black uppercase tracking-[0.24em] text-white/60">
                <CalendarDays className="h-5 w-5 text-[#D6B47A]" />
                Data e horario
              </h3>
              <button type="button" onClick={() => onEditarStep?.(4)} className="text-sm font-black text-[#D6B47A]">Editar</button>
            </div>
            <p className="text-lg font-black capitalize text-white">{dataFormatada}</p>
            <p className="mt-2 text-2xl font-black text-[#D6B47A]">{horario}</p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-4">
              <h3 className="flex items-center gap-3 text-[12px] font-black uppercase tracking-[0.24em] text-white/60">
                <User className="h-5 w-5 text-[#D6B47A]" />
                Seus dados
              </h3>
              <button type="button" onClick={() => onEditarStep?.(1)} className="text-sm font-black text-[#D6B47A]">Editar</button>
            </div>
            <div className="grid gap-2 text-sm font-bold text-white/80">
              <span>{cliente.email}</span>
              <span>{cliente.nome}</span>
              <span>{cliente.telefone}</span>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-[#D6B47A]/40 bg-[#D6B47A]/10">
              <ShieldCheck className="h-10 w-10 text-[#D6B47A]" />
            </div>
            <h3 className="text-2xl font-black text-[#D6B47A]">Tudo certo!</h3>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/60">
              Ao confirmar, voce recebera uma confirmacao com todos os detalhes no contato informado.
            </p>
            <div className="mt-6 flex gap-4 rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/8 p-4 text-left">
              <ClipboardCheck className="mt-1 h-5 w-5 shrink-0 text-[#D6B47A]" />
              <div>
                <p className="font-black text-white">Politica de cancelamento</p>
                <p className="mt-1 text-sm leading-relaxed text-white/60">
                  Cancelamentos ou reagendamentos devem ser feitos com pelo menos 2 horas de antecedencia.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h3 className="mb-3 text-[12px] font-black uppercase tracking-[0.24em] text-white/60">
              Lembrete do agendamento
            </h3>
            <p className="mb-4 text-sm text-white/55">Como voce prefere receber seu lembrete?</p>
            <ReminderChannelSelector
              name="confirmacao-reminder-channel"
              value={reminderChannel}
              onChange={onReminderChannelChange}
            />
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h3 className="mb-4 text-[12px] font-black uppercase tracking-[0.24em] text-white/60">
              Resumo do agendamento
            </h3>
            <div className="divide-y divide-white/8 text-sm">
              <div className="flex justify-between gap-4 py-3"><span className="text-white/55">Servicos</span><span className="text-right text-white">{servicosSelecionados.map(s => s.nome).join(', ')}</span></div>
              <div className="flex justify-between gap-4 py-3"><span className="text-white/55">Profissional</span><span className="text-right text-white">{barbeiro?.nome ?? 'Qualquer disponivel'}</span></div>
              <div className="flex justify-between gap-4 py-3"><span className="text-white/55">Data</span><span className="text-right text-white">{data ? format(data, 'dd/MM/yyyy') : '-'}</span></div>
              <div className="flex justify-between gap-4 py-3"><span className="text-white/55">Horario</span><span className="text-right text-white">{horario ?? '-'}</span></div>
              <div className="flex justify-between gap-4 py-3"><span className="text-white/55">Duracao total</span><span className="text-right text-white">{duracaoFormatada}</span></div>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-5">
              <span className="text-lg font-black text-white">Valor total</span>
              <span className="text-2xl font-black text-[#D6B47A]">{valorFormatado}</span>
            </div>
          </section>
        </aside>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <label htmlFor="ag-obs" className="mb-2 block text-sm font-black text-white">
          Alguma observacao para o atendimento?
        </label>
        <textarea
          id="ag-obs"
          rows={3}
          value={observacoes}
          onChange={e => onObservacoes(e.target.value)}
          placeholder="Ex: Corte mais curto nas laterais, alergia a algum produto..."
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-[#D6B47A]/40"
        />
      </div>

      {customFormFields.length > 0 && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <h3 className="mb-4 text-sm font-black text-white">Perguntas da barbearia</h3>
          <div className="grid gap-4">
            {customFormFields.map(field => (
              <label key={field.id} className="block space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                  {field.label}{field.required ? ' *' : ''}
                </span>
                {field.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={customFormAnswers[field.id] || ''}
                    onChange={event => onCustomFormAnswer?.(field.id, event.target.value)}
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-[#D6B47A]/40"
                  />
                ) : (
                  <input
                    type="text"
                    value={customFormAnswers[field.id] || ''}
                    onChange={event => onCustomFormAnswer?.(field.id, event.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-[#D6B47A]/40"
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#f4d06f]" />
        <p className="text-sm leading-relaxed text-white/60">
          <span className="font-black text-[#f4d06f]">Seus dados estao seguros.</span> Nao compartilhamos suas informacoes.
          Usamos seus dados apenas para agendar e melhorar sua experiencia.
        </p>
      </div>

      <div className="mt-5 grid gap-3 border-t border-white/8 pt-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <button
          type="button"
          onClick={onVoltar}
          disabled={submitting}
          className="flex h-14 items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] font-black text-white transition-all hover:bg-white/[0.08] disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5 text-white/55" />
          Voltar
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={submitting}
          className="flex h-14 items-center justify-center gap-3 rounded-xl bg-[#D6B47A] font-black text-black transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Confirmando...
            </>
          ) : (
            <>
              Confirmar agendamento
              <CheckCircle2 className="h-5 w-5" />
              <Sparkles className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
