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
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">{title}</p>
          <p className="mt-3 text-3xl font-black text-white">{value}</p>
          {hint && <p className="mt-2 text-sm font-bold text-[#D6B47A]">{hint}</p>}
        </div>
        {Icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D6B47A]/10 text-[#D6B47A]">
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

