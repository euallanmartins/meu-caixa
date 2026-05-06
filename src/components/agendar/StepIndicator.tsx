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

  return (
    <div className="w-full" role="navigation" aria-label="Progresso do agendamento">
      <div className="grid grid-cols-5">
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
        <p className="text-center text-[10px] font-black text-white/40 uppercase tracking-[0.28em] mt-7">
          {`Etapa ${currentStep} de 5 - ${STEP_LABELS[currentStep]}`}
        </p>
      )}
    </div>
  );
}
