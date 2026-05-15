'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  HelpCircle,
  Scissors,
  ShieldCheck,
  User,
} from 'lucide-react';

import { useAgendamento } from '@/hooks/useAgendamento';
import { StepIndicator } from '@/components/agendar/StepIndicator';
import { StepIdentificacao } from '@/components/agendar/StepIdentificacao';
import { StepServicos } from '@/components/agendar/StepServicos';
import { StepBarbeiro } from '@/components/agendar/StepBarbeiro';
import { StepHorario } from '@/components/agendar/StepHorario';
import { StepConfirmacao } from '@/components/agendar/StepConfirmacao';
import { StepSucesso } from '@/components/agendar/StepSucesso';
import AgendarLoading from './loading';
import { getServiceDisplay } from '@/lib/serviceDisplay';

function AgendarInner() {
  const searchParams = useSearchParams();
  const barbeariaId = searchParams.get('id');
  const servicoId = searchParams.get('servico') || searchParams.get('service');

  const ag = useAgendamento(barbeariaId, servicoId);

  if (!barbeariaId) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#050505] p-6 font-sans text-white">
        <div className="relative w-full max-w-md">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 text-center space-y-6 shadow-2xl">
            <div className="h-20 w-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20">
              <AlertCircle size={40} strokeWidth={1.5} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tight">Link de agendamento invalido</h1>
              <p className="text-white/50 text-sm leading-relaxed px-4">
                Parece que este link esta incompleto ou expirado. Cada barbearia possui um link unico.
              </p>
            </div>
            <Link
              href="/"
              className="block w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all"
            >
              Voltar ao inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (ag.loadingBarbearia) return <AgendarLoading />;

  if (!ag.barbearia) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#050505] p-6">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 max-w-sm text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-[#ff4d4d] mx-auto" />
          <h1 className="text-white font-black text-lg">Barbearia nao encontrada</h1>
          <p className="text-white/50 text-sm">{ag.error ?? 'Verifique o link e tente novamente.'}</p>
        </div>
      </div>
    );
  }

  if (ag.barbearia.agendamentos_pausados) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#050505] p-6">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 max-w-sm text-center space-y-4">
          <CalendarDays className="h-10 w-10 text-[#D6B47A] mx-auto" />
          <h1 className="text-white font-black text-lg">Agendamentos pausados</h1>
          <p className="text-white/50 text-sm">
            Os agendamentos online desta barbearia estao temporariamente pausados.
          </p>
          <Link
            href="/"
            className="block w-full py-4 bg-[#D6B47A] rounded-2xl font-black text-black uppercase tracking-widest text-xs"
          >
            Voltar ao inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#050505] text-white">
      <div className="blob top-[-10%] left-[-10%]" />
      <div className="blob bottom-[10%] right-[-5%] bg-purple-500/10" style={{ animationDelay: '3s' }} />

      <header className="liquid-glass sticky top-0 z-50 border-b border-white/8">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-4 sm:flex sm:justify-between sm:gap-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Link
              href="/"
              aria-label="Voltar para a pagina inicial"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.035] text-white/75 transition-all hover:border-[#D6B47A]/30 hover:text-[#D6B47A] sm:h-12 sm:w-auto sm:gap-1.5 sm:px-4 sm:text-xs sm:font-black sm:uppercase sm:tracking-[0.08em]"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Inicio</span>
            </Link>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D6B47A]/20 sm:h-14 sm:w-14">
              <Scissors className="h-5 w-5 text-[#D6B47A] sm:h-7 sm:w-7" />
            </div>
          </div>
          <div className="min-w-0 px-1 sm:flex-1">
            <h1 className="overflow-hidden text-ellipsis whitespace-nowrap text-lg font-black leading-tight text-white [overflow-wrap:normal] sm:text-2xl">
              {ag.barbearia.nome}
            </h1>
            <p className="hidden overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-black uppercase leading-tight tracking-[0.12em] text-white/75 [overflow-wrap:normal] min-[390px]:block sm:text-[11px] sm:tracking-[0.28em]">
              Agendamento Online
            </p>
          </div>
          <Link
            href={`/cliente?id=${barbeariaId}`}
            aria-label="Entrar como cliente e ver histórico de agendamentos"
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#D6B47A]/25 bg-[#D6B47A]/10 px-2.5 text-center text-[10px] font-black uppercase leading-tight tracking-[0.04em] text-[#D6B47A] transition-all hover:bg-[#D6B47A]/15 hover:text-[#E7C992] min-[390px]:gap-2 min-[390px]:px-3 sm:h-12 sm:px-5 sm:text-sm sm:normal-case sm:tracking-normal"
          >
            <User className="h-4 w-4 shrink-0 text-[#D6B47A]" />
            <span className="whitespace-nowrap [overflow-wrap:normal] min-[390px]:hidden">Cliente</span>
            <span className="hidden whitespace-nowrap [overflow-wrap:normal] min-[390px]:inline">Minha área</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 pt-8 sm:pt-10 relative z-10">
        {ag.step < 6 && (
          <div className="mx-auto mb-8 max-w-5xl">
            <StepIndicator currentStep={ag.step} onGoTo={ag.goToStep} />
          </div>
        )}

        {ag.error && ag.step < 6 && (
          <div className="mb-6 flex items-start gap-3 bg-[#ff4d4d]/10 border border-[#ff4d4d]/30 rounded-2xl p-4 animate-in fade-in duration-300">
            <AlertCircle className="h-4 w-4 text-[#ff4d4d] shrink-0 mt-0.5" />
            <p className="text-[#ff4d4d] text-sm">{ag.error}</p>
            <button onClick={ag.clearError} className="ml-auto text-white/30 hover:text-white text-xs shrink-0">
              x
            </button>
          </div>
        )}

        <div className={ag.step < 6 ? 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start' : 'mx-auto max-w-lg'}>
          <section className="min-w-0">
            {ag.step === 1 && (
              <StepIdentificacao
                cliente={ag.cliente}
                barbeariaId={barbeariaId}
                authUser={ag.authUser}
                reminderChannel={ag.reminderChannel}
                onSubmit={(cliente) => {
                  ag.setCliente(cliente);
                  ag.nextStep();
                  ag.loadServicos();
                }}
                onAuthLogin={ag.loginCliente}
                onAuthSignup={ag.signupCliente}
                resetPassword={ag.resetPassword}
                onVincularAuth={ag.vincularClienteAuthAtual}
                onLogout={ag.logoutCliente}
                onReminderChannelChange={ag.setReminderChannel}
                onVoltar={() => window.history.back()}
              />
            )}

            {ag.step === 2 && (
              <StepServicos
                servicos={ag.servicos}
                loading={ag.loadingServicos}
                selecionados={ag.servicosSelecionados}
                onToggle={ag.toggleServico}
                duracaoFormatada={ag.duracaoFormatada}
                valorFormatado={ag.valorFormatado}
                onVoltar={ag.prevStep}
                onContinuar={() => {
                  ag.nextStep();
                  ag.loadBarbeiros();
                }}
              />
            )}

            {ag.step === 3 && (
              <StepBarbeiro
                barbeiros={ag.barbeiros}
                loading={ag.loadingBarbeiros}
                selecionado={ag.barbeiro}
                onSelect={ag.setBarbeiro}
                onVoltar={ag.prevStep}
                onContinuar={ag.nextStep}
                servicosSelecionados={ag.servicosSelecionados}
                duracaoFormatada={ag.duracaoFormatada}
                valorFormatado={ag.valorFormatado}
              />
            )}

            {ag.step === 4 && (
              <StepHorario
                data={ag.data}
                horario={ag.horario}
                slots={ag.slots}
                loading={ag.loadingSlots}
                duracaoTotal={ag.duracaoTotal}
                barbeiroId={ag.barbeiro?.id ?? null}
                reminderChannel={ag.reminderChannel}
                onSelectData={(d) => {
                  ag.setData(d);
                  ag.loadSlots(d, ag.barbeiro?.id ?? null, ag.duracaoTotal);
                }}
                onSelectHorario={ag.setHorario}
                onReminderChannelChange={ag.setReminderChannel}
                onJoinWaitlist={ag.entrarListaEspera}
                waitlistLoading={ag.waitlistLoading}
                waitlistMessage={ag.waitlistMessage}
                onVoltar={ag.prevStep}
                onContinuar={() => {
                  ag.loadCustomForms();
                  ag.nextStep();
                }}
              />
            )}

            {ag.step === 5 && (
              <StepConfirmacao
                cliente={ag.cliente}
                servicosSelecionados={ag.servicosSelecionados}
                barbeiro={ag.barbeiro}
                data={ag.data}
                horario={ag.horario}
                observacoes={ag.observacoesAgendamento}
                valorFormatado={ag.valorFormatado}
                duracaoFormatada={ag.duracaoFormatada}
                reminderChannel={ag.reminderChannel}
                submitting={ag.submitting}
                customFormFields={ag.customFormFields}
                customFormAnswers={ag.customFormAnswers}
                onObservacoes={ag.setObservacoes}
                onReminderChannelChange={ag.setReminderChannel}
                onCustomFormAnswer={ag.setCustomFormAnswer}
                onConfirmar={ag.confirmarAgendamento}
                onVoltar={ag.prevStep}
                onEditarStep={ag.goToStep}
              />
            )}

            {ag.step === 6 && (
              <StepSucesso
                cliente={ag.cliente}
                servicosSelecionados={ag.servicosSelecionados}
                barbeiro={ag.barbeiro}
                data={ag.data}
                horario={ag.horario}
                valorFormatado={ag.valorFormatado}
                message={ag.confirmationMessage}
                barbeariaId={barbeariaId}
                onReagendar={ag.resetAgendamento}
              />
            )}
          </section>

          {ag.step < 6 && (
            <aside className="space-y-6 lg:sticky lg:top-28">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20">
                <div className="mb-6 flex items-center gap-4">
                  <CalendarDays className="h-6 w-6 text-white/55" />
                  <h2 className="text-lg font-black text-white">Seu agendamento</h2>
                </div>
                <div className="divide-y divide-white/8">
                  <div className="flex items-start gap-4 py-5">
                    <Scissors className="mt-1 h-5 w-5 text-white/45" />
                    <div>
                      <p className="font-black text-white">Servico</p>
                      <p className="mt-1 text-sm text-white/55">
                        {ag.servicosSelecionados.length
                          ? ag.servicosSelecionados.map(s => getServiceDisplay(s).nome).join(' + ')
                          : 'Selecionar'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 py-5">
                    <User className="mt-1 h-5 w-5 text-white/45" />
                    <div>
                      <p className="font-black text-white">Profissional</p>
                      <p className="mt-1 text-sm text-white/55">{ag.barbeiro?.nome ?? 'Selecionar'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 py-5">
                    <CalendarDays className="mt-1 h-5 w-5 text-white/45" />
                    <div>
                      <p className="font-black text-white">Data e horario</p>
                      <p className="mt-1 text-sm text-white/55">
                        {ag.data && ag.horario
                          ? `${ag.data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} - ${ag.horario}`
                          : 'Selecionar'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 py-5">
                    <CircleDollarSign className="mt-1 h-5 w-5 text-white/45" />
                    <div>
                      <p className="font-black text-white">Valor</p>
                      <p className="mt-1 text-base font-black text-[#f4d06f]">{ag.valorFormatado}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-[#D6B47A]" />
                    <div>
                      <h3 className="font-black text-white">Seus dados estao seguros</h3>
                      <p className="mt-3 text-sm leading-relaxed text-white/55">
                        Nao compartilhamos suas informacoes. Usamos seus dados apenas para agendar e melhorar sua experiencia.
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-white/8" />
                  <div className="flex gap-4">
                    <Clock3 className="mt-1 h-6 w-6 shrink-0 text-[#D6B47A]" />
                    <div>
                      <h3 className="font-black text-white">Agendamento rapido e facil</h3>
                      <p className="mt-3 text-sm leading-relaxed text-white/55">
                        Leva menos de 2 minutos para concluir seu agendamento.
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-white/8" />
                  <div className="flex gap-4">
                    <HelpCircle className="mt-1 h-6 w-6 shrink-0 text-[#D6B47A]" />
                    <div>
                      <h3 className="font-black text-white">Precisa de ajuda?</h3>
                      <p className="mt-3 text-sm leading-relaxed text-white/55">Fale com a gente pelo WhatsApp</p>
                      <p className="mt-2 font-black text-[#D6B47A]">(37) 4749-8484</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>

      <footer className="border-t border-white/5 py-5 text-center relative z-10">
        <p className="text-[10px] text-white/25 uppercase tracking-[0.35em]">
          {ag.barbearia.nome} - Powered by Meu Caixa
        </p>
      </footer>
    </div>
  );
}

export default function AgendarPage() {
  return (
    <Suspense fallback={<AgendarLoading />}>
      <AgendarInner />
    </Suspense>
  );
}
