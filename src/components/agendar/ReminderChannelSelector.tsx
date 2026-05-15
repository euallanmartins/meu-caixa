'use client';

import { CheckCircle2, Circle, Mail, MessageCircle } from 'lucide-react';
import type { ReminderChannel } from '@/hooks/useAgendamento';

interface ReminderChannelSelectorProps {
  value: ReminderChannel;
  onChange: (channel: ReminderChannel) => void;
  name: string;
  variant?: 'large' | 'compact';
}

const OPTIONS: Array<{
  value: ReminderChannel;
  label: string;
  hint?: string;
  Icon: typeof MessageCircle;
}> = [
  { value: 'whatsapp', label: 'WhatsApp', hint: 'Recomendado', Icon: MessageCircle },
  { value: 'email', label: 'E-mail', Icon: Mail },
];

export function ReminderChannelSelector({
  value,
  onChange,
  name,
  variant = 'compact',
}: ReminderChannelSelectorProps) {
  const isLarge = variant === 'large';

  return (
    <div
      role="radiogroup"
      aria-label="Canal de lembrete"
      className={isLarge ? 'grid gap-4 md:grid-cols-2' : 'grid gap-2'}
    >
      {OPTIONS.map(({ value: optionValue, label, hint, Icon }) => {
        const selected = value === optionValue;

        return (
          <label
            key={optionValue}
            className={[
              'group flex cursor-pointer items-center justify-between border text-left transition-all',
              isLarge ? 'min-h-20 rounded-2xl p-5' : 'rounded-xl px-4 py-3',
              selected
                ? isLarge
                  ? 'border-[#D6B47A] bg-[#D6B47A]/10'
                  : 'border-[#D6B47A]/40 bg-[#D6B47A]/10'
                : isLarge
                  ? 'border-white/15 bg-white/[0.03] hover:bg-white/[0.06]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]',
            ].join(' ')}
            onPointerDown={() => onChange(optionValue)}
            onClick={() => onChange(optionValue)}
          >
            <input
              type="radio"
              name={name}
              value={optionValue}
              checked={selected}
              onChange={() => onChange(optionValue)}
              className="sr-only"
            />
            <span className={isLarge ? 'flex items-center gap-4' : 'flex items-center gap-3 font-black'}>
              <Icon
                className={[
                  isLarge ? 'h-8 w-8' : 'h-5 w-5',
                  selected || optionValue === 'whatsapp' ? 'text-[#D6B47A]' : 'text-white/45',
                ].join(' ')}
              />
              <span>
                <span className={`block font-black ${selected || isLarge ? 'text-white' : 'text-white/80'}`}>
                  {label}
                </span>
                {isLarge && hint && (
                  <span className="text-sm font-bold text-[#D6B47A]">{hint}</span>
                )}
              </span>
            </span>
            {isLarge ? (
              selected ? <CheckCircle2 className="h-5 w-5 text-[#D6B47A]" /> : <Circle className="h-5 w-5 text-white/40" />
            ) : (
              <span className={`h-4 w-4 rounded-full ${selected ? 'border-4 border-[#D6B47A]' : 'border-2 border-white/35'}`} />
            )}
          </label>
        );
      })}
    </div>
  );
}
