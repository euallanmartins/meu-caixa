'use client';

import Link from 'next/link';
import { LockKeyhole, Sparkles } from 'lucide-react';

type UpsellCardProps = {
  title?: string;
  description?: string;
  requiredPlan?: 'STARTER' | 'PRO' | 'PREMIUM';
  compact?: boolean;
};

export function UpsellCard({
  title = 'Recurso premium',
  description = 'Este modulo faz parte de um plano superior do Meu Caixa.',
  requiredPlan = 'PRO',
  compact = false,
}: UpsellCardProps) {
  return (
    <div className={`min-w-0 overflow-hidden rounded-3xl border border-[#D6B47A]/25 bg-[#D6B47A]/[0.07] ${compact ? 'p-5' : 'p-5 sm:p-7'}`}>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/10 text-[#D6B47A]">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D6B47A]">Upgrade</p>
            <h2 className="mt-1 break-words text-xl font-black text-white sm:text-2xl">{title}</h2>
            <p className="mt-2 max-w-2xl break-words text-sm leading-relaxed text-white/58">{description}</p>
          </div>
        </div>

        <Link
          href="/gestao/suporte"
          className="inline-flex min-h-12 w-full min-w-0 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] px-4 py-3 text-center text-sm font-black text-black sm:w-auto sm:px-5"
        >
          <Sparkles className="h-4 w-4" />
          {requiredPlan === 'PRO' ? 'Liberar no plano PRO' : `Fazer upgrade ${requiredPlan}`}
        </Link>
      </div>
    </div>
  );
}
