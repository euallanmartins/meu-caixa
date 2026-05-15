import type { LucideIcon } from 'lucide-react';

interface ReportCardProps {
  icon?: LucideIcon;
  title: string;
  value: string | number;
  hint?: string;
  variation?: string;
  children?: React.ReactNode;
}

export function ReportCard({ icon: Icon, title, value, hint, variation, children }: ReportCardProps) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="break-words text-[10px] font-black uppercase tracking-[0.12em] text-white/45 sm:text-[11px] sm:tracking-[0.18em]">{title}</p>
          <p className="mt-3 break-words text-2xl font-black leading-tight text-white sm:text-3xl">{value}</p>
          {hint && <p className="mt-2 text-sm font-bold text-[#D6B47A]">{hint}</p>}
        </div>
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D6B47A]/10 text-[#D6B47A] sm:h-12 sm:w-12">
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
      {variation && (
        <span className="mt-4 inline-flex rounded-full bg-[#ff4d4d]/12 px-2.5 py-1 text-[10px] font-black text-[#ff4d4d]">
          {variation}
        </span>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
