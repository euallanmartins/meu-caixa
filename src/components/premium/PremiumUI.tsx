'use client';

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { Search } from 'lucide-react';

type PolymorphicProps<T extends ElementType> = {
  as?: T;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function PremiumCard<T extends ElementType = 'div'>({
  as,
  className,
  children,
  ...props
}: PolymorphicProps<T>) {
  const Component = as || 'div';
  return (
    <Component className={cx('premium-card', className)} {...props}>
      {children}
    </Component>
  );
}

export function PremiumButton<T extends ElementType = 'button'>({
  as,
  className,
  children,
  ...props
}: PolymorphicProps<T>) {
  const Component = as || 'button';
  return (
    <Component className={cx('premium-button inline-flex min-h-12 items-center justify-center gap-2 px-5 text-sm font-black', className)} {...props}>
      {children}
    </Component>
  );
}

export function PremiumBadge({ className, children, tone = 'accent' }: {
  className?: string;
  children: ReactNode;
  tone?: 'accent' | 'success' | 'danger' | 'muted';
}) {
  const tones = {
    accent: 'border-[#D6B47A]/30 bg-[#D6B47A]/10 text-[#E7C992]',
    success: 'border-[#22C55E]/25 bg-[#22C55E]/10 text-[#22C55E]',
    danger: 'border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]',
    muted: 'border-white/10 bg-white/[0.04] text-white/55',
  };

  return (
    <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]', tones[tone], className)}>
      {children}
    </span>
  );
}

export function PremiumInput(props: ComponentPropsWithoutRef<'input'>) {
  return <input {...props} className={cx('premium-input h-12 w-full px-4 text-sm font-bold outline-none placeholder:text-white/30', props.className)} />;
}

export function PremiumTextarea(props: ComponentPropsWithoutRef<'textarea'>) {
  return <textarea {...props} className={cx('premium-input min-h-28 w-full resize-none p-4 text-sm font-bold outline-none placeholder:text-white/30', props.className)} />;
}

export function PremiumSectionTitle({ eyebrow, title, subtitle, className }: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cx('space-y-2', className)}>
      {eyebrow && <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#D6B47A]">{eyebrow}</p>}
      <h2 className="text-2xl font-black tracking-tight text-[#F5F5F4] sm:text-3xl">{title}</h2>
      {subtitle && <p className="max-w-2xl text-sm leading-relaxed text-[#A1A1AA] sm:text-base">{subtitle}</p>}
    </div>
  );
}

export function PremiumEmptyState({ icon, title, subtitle, action }: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="premium-card px-6 py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#D6B47A]">
        {icon || <Search className="h-8 w-8" />}
      </div>
      <h3 className="mt-5 text-lg font-black text-white">{title}</h3>
      {subtitle && <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/50">{subtitle}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PremiumBottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#060606]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.45)] backdrop-blur-2xl', className)}>
      {children}
    </div>
  );
}
