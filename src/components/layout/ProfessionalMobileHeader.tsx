'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Menu } from 'lucide-react';

type QuickAction = {
  label: string;
  href: string;
  icon?: LucideIcon;
};

interface ProfessionalMobileHeaderProps {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  action?: QuickAction;
}

export function ProfessionalMobileHeader({
  title,
  subtitle,
  icon: Icon = Menu,
  action,
}: ProfessionalMobileHeaderProps) {
  const ActionIcon = action?.icon;

  return (
    <header className="mb-5 max-w-full rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20 lg:hidden">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D6B47A]/20 bg-[#D6B47A]/10 text-[#D6B47A]">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-[1.35rem] font-black uppercase leading-none tracking-tight text-white min-[380px]:text-2xl">
              {title}
            </h1>
            <p className="mt-2 line-clamp-2 text-[10px] font-black uppercase tracking-[0.08em] text-white/42 min-[380px]:tracking-[0.16em]">
              {subtitle}
            </p>
          </div>
        </div>

        {action && (
          <Link
            href={action.href}
            className="flex h-11 min-w-0 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] px-3 text-[11px] font-black uppercase tracking-[0.08em] text-black active:scale-[0.98] min-[380px]:h-12 min-[380px]:px-4 min-[380px]:text-xs"
          >
            {ActionIcon && <ActionIcon className="h-4 w-4" />}
            <span className="max-w-[9rem] truncate">{action.label}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
