'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserRole } from '@/hooks/useUserRole';
import * as LucideIcons from 'lucide-react';

const SHARED_ITEMS = [
  { id: 'agenda',   label: 'Agenda',    icon: 'Calendar'    as const, href: '/gestao/agenda' },
  { id: 'clientes', label: 'Clientes',  icon: 'Users'       as const, href: '/gestao/clientes' },
];

const ADMIN_ITEMS = [
  { id: 'caixa',      label: 'Caixa',      icon: 'ShoppingCart' as const, href: '/gestao/caixa' },
  { id: 'financeiro', label: 'Financ.',    icon: 'TrendingUp'   as const, href: '/gestao/financeiro' },
  { id: 'relatorios', label: 'Relat.',    icon: 'BarChart2'    as const, href: '/gestao/relatorios' },
  { id: 'avaliacoes', label: 'Aval.',     icon: 'MessageSquareText' as const, href: '/gestao/avaliacoes' },
  { id: 'equipe',     label: 'Equipe',     icon: 'UserCheck'    as const, href: '/gestao/equipe' },
];

export function BottomNav() {
  const pathname = usePathname();
  const { isAdmin, loading } = useUserRole();

  const items = isAdmin
    ? [...SHARED_ITEMS, ...ADMIN_ITEMS]
    : [...SHARED_ITEMS];

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-[90] safe-area-bottom"
      aria-label="NavegaÃ§Ã£o principal"
    >
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-[#0a0a0a]/90 backdrop-blur-2xl border-t border-white/10" />

      <div
        className="relative flex items-stretch h-[64px] overflow-x-auto no-scrollbar px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {loading
          ? /* Skeleton durante carregamento */
            [1, 2, 3].map(i => (
              <div key={i} className="flex-1 flex flex-col items-center justify-center gap-1 mx-1">
                <div className="h-5 w-5 rounded bg-white/10 animate-pulse" />
                <div className="h-2 w-8 rounded bg-white/10 animate-pulse" />
              </div>
            ))
          : items.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = LucideIcons[item.icon] as LucideIcons.LucideIcon;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  data-testid={`bottom-nav-${item.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    relative flex-1 flex flex-col items-center justify-center gap-[3px]
                    transition-all duration-200 min-w-[56px] px-1
                    ${isActive ? 'text-[#D6B47A]' : 'text-white/35 active:text-white/70'}
                  `}
                >
                  {/* Active indicator pill no topo */}
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-[#D6B47A] shadow-[0_0_8px_rgba(214,180,122,0.7)]" />
                  )}

                  <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                  </span>

                  <span className={`text-[9px] font-black uppercase tracking-widest leading-none truncate max-w-[52px] text-center ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
      </div>
    </nav>
  );
}
