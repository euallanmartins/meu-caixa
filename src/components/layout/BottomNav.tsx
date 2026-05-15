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

const BARBER_ITEMS = [
  { id: 'agenda', label: 'Agenda', icon: 'Calendar' as const, href: '/gestao/agenda' },
  { id: 'ganhos', label: 'Ganhos', icon: 'Wallet' as const, href: '/gestao/meus-ganhos' },
  { id: 'perfil', label: 'Perfil', icon: 'UserRound' as const, href: '/gestao/meu-perfil' },
];

const ADMIN_ITEMS = [
  { id: 'caixa',      label: 'Caixa',      icon: 'ShoppingCart' as const, href: '/gestao/caixa' },
  { id: 'financeiro', label: 'Financ.',    icon: 'TrendingUp'   as const, href: '/gestao/financeiro' },
  { id: 'relatorios', label: 'Relat.',    icon: 'BarChart2'    as const, href: '/gestao/relatorios' },
  { id: 'avaliacoes', label: 'Aval.',     icon: 'MessageSquareText' as const, href: '/gestao/avaliacoes' },
  { id: 'equipe',     label: 'Equipe',     icon: 'UserCheck'    as const, href: '/gestao/equipe' },
  { id: 'onboarding', label: 'Onboard',    icon: 'Rocket'       as const, href: '/gestao/onboarding' },
  { id: 'lista-espera', label: 'Espera',    icon: 'CalendarClock' as const, href: '/gestao/lista-espera' },
  { id: 'marketing', label: 'Market.',      icon: 'Megaphone'    as const, href: '/gestao/marketing' },
  { id: 'promocoes', label: 'Promo.',       icon: 'BadgePercent' as const, href: '/gestao/promocoes' },
  { id: 'formularios', label: 'Forms',      icon: 'FileText'     as const, href: '/gestao/formularios' },
  { id: 'links', label: 'Links',            icon: 'Link2'        as const, href: '/gestao/configuracoes/links' },
];

export function BottomNav() {
  const pathname = usePathname();
  const { isAdmin, isBarbeiro, loading } = useUserRole();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const items = isBarbeiro
    ? BARBER_ITEMS
    : isAdmin
    ? [...SHARED_ITEMS, ...ADMIN_ITEMS]
    : [...SHARED_ITEMS];

  const primaryItems = isAdmin ? items.slice(0, 5) : items;
  const overflowItems = isAdmin ? items.slice(5) : [];
  const hasOverflowActive = overflowItems.some(item => pathname === item.href || pathname.startsWith(item.href + '/'));
  const navColumns = Math.max(primaryItems.length + (overflowItems.length ? 1 : 0), 1);

  return (
    <>
      {moreOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[88] bg-black/55 backdrop-blur-sm lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {moreOpen && overflowItems.length > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[91] max-h-[min(70vh,520px)] overflow-y-auto rounded-3xl border border-white/10 bg-[#101010]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-2xl lg:hidden">
          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Mais atalhos</p>
          <div className="grid gap-2">
            {overflowItems.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = LucideIcons[item.icon] as LucideIcons.LucideIcon;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex h-12 items-center gap-3 rounded-2xl px-4 text-sm font-black transition-all ${
                    isActive
                      ? 'bg-[#D6B47A]/15 text-[#D6B47A]'
                      : 'bg-white/[0.035] text-white/70 active:bg-white/[0.075]'
                  }`}
                >
                  <Icon size={19} />
                  <span>{item.label === 'Aval.' ? 'Avaliacoes' : item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-[90] pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navegacao principal"
      >
        <div className="absolute inset-0 bg-[#0a0a0a]/92 backdrop-blur-2xl border-t border-white/10" />

        <div
          className="relative grid h-[68px] items-stretch px-1"
          style={{ gridTemplateColumns: `repeat(${navColumns}, minmax(0, 1fr))` }}
        >
        {loading
          ? [1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col items-center justify-center gap-1 mx-1">
                <div className="h-5 w-5 rounded bg-white/10 animate-pulse" />
                <div className="h-2 w-8 rounded bg-white/10 animate-pulse" />
              </div>
            ))
          : primaryItems.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = LucideIcons[item.icon] as LucideIcons.LucideIcon;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  data-testid={`bottom-nav-${item.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    relative flex flex-col items-center justify-center gap-[3px]
                    transition-all duration-200 px-1
                    ${isActive ? 'text-[#D6B47A]' : 'text-white/35 active:text-white/70'}
                  `}
                >
                  {isActive && (
                    <span className="absolute top-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-[#D6B47A]" />
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

          {overflowItems.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(current => !current)}
              aria-expanded={moreOpen}
              className={`relative flex flex-col items-center justify-center gap-[3px] px-1 transition-all duration-200 ${
                hasOverflowActive || moreOpen ? 'text-[#D6B47A]' : 'text-white/35 active:text-white/70'
              }`}
            >
              {(hasOverflowActive || moreOpen) && (
                <span className="absolute top-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-[#D6B47A]" />
              )}
              <LucideIcons.MoreHorizontal size={22} strokeWidth={2.4} />
              <span className="max-w-[52px] truncate text-center text-[9px] font-black uppercase leading-none tracking-widest opacity-80">
                Mais
              </span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
