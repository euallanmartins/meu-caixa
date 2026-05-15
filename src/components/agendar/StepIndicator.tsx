import { Check } from 'lucide-react';
import type { Step } from '@/hooks/useAgendamento';

const STEP_LABELS: Record<Step, string> = {
  1: 'Dados',
  2: 'Servicos',
  3: 'Profissional',
  4: 'Data e horario',
  5: 'Confirmacao',
  6: 'Sucesso',
};

interface Props {
  currentStep: Step;
  onGoTo?: (step: Step) => void;
}

export function StepIndicator({ currentStep, onGoTo }: Props) {
  const visibleSteps: Step[] = [1, 2, 3, 4, 5];
  const progress = Math.min(Math.max(currentStep, 1), 5);

  return (
    <div className="w-full" role="navigation" aria-label="Progresso do agendamento">
      <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-xl shadow-black/20 sm:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D6B47A]">
              Etapa {progress} de 5
            </p>
            <p className="mt-1 break-words text-lg font-black leading-tight text-white">
              {STEP_LABELS[progress as Step]}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {visibleSteps.map(step => {
              const isDone = currentStep > step;
              const isActive = currentStep === step;
              const canNavigate = isDone && onGoTo;

              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => canNavigate && onGoTo(step)}
                  disabled={!canNavigate}
                  aria-label={`${isDone ? 'Voltar para ' : ''}${STEP_LABELS[step]}`}
                  className={`h-3 rounded-full transition-all ${
                    isActive
                      ? 'w-8 bg-[#D6B47A]'
                      : isDone
                        ? 'w-3 bg-[#D6B47A]/60'
                        : 'w-3 bg-white/15'
                  }`}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#B8935F] to-[#E0C28D] transition-all duration-500"
            style={{ width: `${(progress / 5) * 100}%` }}
          />
        </div>
      </div>

      <div className="hidden grid-cols-5 sm:grid">
        {visibleSteps.map((step, idx) => {
          const isDone = currentStep > step;
          const isActive = currentStep === step;
          const canNavigate = isDone && onGoTo;

          return (
            <div key={step} className="relative flex flex-col items-center gap-3">
              {idx < visibleSteps.length - 1 && (
                <div className="absolute left-1/2 top-[17px] h-[2px] w-full bg-white/10">
                  <div
                    className="h-full bg-[#D6B47A] transition-all duration-500"
                    style={{ width: currentStep > step ? '100%' : '0%' }}
                  />
                </div>
              )}

              <button
                onClick={() => canNavigate && onGoTo(step)}
                disabled={!canNavigate}
                aria-label={`${isDone ? 'Voltar para ' : ''}${STEP_LABELS[step]}`}
                className={`
                  relative z-10 h-9 w-9 shrink-0 rounded-full flex items-center justify-center
                  text-[11px] font-black transition-all duration-300
                  ${isDone
                    ? 'bg-gradient-to-br from-[#B8935F] to-[#E0C28D] text-[#120f09] shadow-lg shadow-[#D6B47A]/20 cursor-pointer hover:scale-110'
                    : isActive
                    ? 'bg-[#D6B47A]/10 text-[#E7C992] ring-2 ring-[#D6B47A] ring-offset-2 ring-offset-[#060606]'
                    : 'bg-white/8 text-white/40 border border-white/5 cursor-default'
                  }
                `}
              >
                {isDone ? <Check size={14} strokeWidth={3} /> : step}
              </button>

              <span className={`text-center text-[10px] sm:text-xs font-bold ${isActive ? 'text-white' : 'text-white/45'}`}>
                {STEP_LABELS[step]}
              </span>
            </div>
          );
        })}
      </div>

      {currentStep < 6 && (
        <p className="mt-7 hidden text-center text-[10px] font-black uppercase tracking-[0.28em] text-white/40 sm:block">
          {`Etapa ${currentStep} de 5 - ${STEP_LABELS[currentStep]}`}
        </p>
      )}
    </div>
  );
}
