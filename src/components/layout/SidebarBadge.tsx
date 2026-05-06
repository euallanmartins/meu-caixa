import React from 'react';

interface SidebarBadgeProps {
  label: string;
  variant?: 'accent' | 'blue' | 'red';
}

export function SidebarBadge({ label, variant = 'accent' }: SidebarBadgeProps) {
  const variants = {
    accent: 'bg-[#D6B47A]/10 text-[#D6B47A] border-[#D6B47A]/25',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    red: 'bg-red-500/15 text-red-500 border-red-500/30',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${variants[variant]}`}>
      {label}
    </span>
  );
}
