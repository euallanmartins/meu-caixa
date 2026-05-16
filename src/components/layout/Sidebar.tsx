/* eslint-disable */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/hooks/useSidebar';
import { useUserRole } from '@/hooks/useUserRole';
import { SidebarItem } from './SidebarItem';
import { ChevronLeft, LogOut, Scissors, User, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const SHARED_ITEMS = [
  { id: 'agenda',   label: 'Agenda',   icon: 'Calendar', href: '/gestao/agenda',   testId: 'nav-agenda' },
  { id: 'clientes', label: 'Clientes', icon: 'Users',    href: '/gestao/clientes', testId: 'nav-clientes' },
] as const;

const BARBER_ITEMS = [
  { id: 'agenda', label: 'Minha agenda', icon: 'Calendar', href: '/gestao/agenda', testId: 'nav-agenda' },
  { id: 'ganhos', label: 'Meus ganhos', icon: 'Wallet', href: '/gestao/meus-ganhos', testId: 'nav-meus-ganhos' },
  { id: 'perfil', label: 'Meu perfil', icon: 'UserRound', href: '/gestao/meu-perfil', testId: 'nav-meu-perfil' },
] as const;

const ADMIN_ITEMS = [
  {
    id: 'caixa',
    label: 'Caixa / PDV',
    icon: 'ShoppingCart',
    href: '/gestao/caixa',
    testId: 'nav-caixa',
    badge: { label: 'novo', variant: 'accent' },
  },
  { id: 'financeiro', label: 'Financeiro', icon: 'TrendingUp', href: '/gestao/financeiro', testId: 'nav-financeiro' },
  { id: 'equipe',     label: 'Equipe',     icon: 'UserCheck',  href: '/gestao/equipe',     testId: 'nav-equipe' },
  { id: 'lista-espera', label: 'Lista de espera', icon: 'CalendarClock', href: '/gestao/lista-espera', testId: 'nav-lista-espera' },
  // Ocultados temporariamente até ativação da feature
  // { id: 'marketing', label: 'Marketing', icon: 'Megaphone', href: '/gestao/marketing', testId: 'nav-marketing' },
  // { id: 'promocoes', label: 'Promoções', icon: 'BadgePercent', href: '/gestao/promocoes', testId: 'nav-promocoes' },
  // { id: 'formularios', label: 'Formularios', icon: 'FileText', href: '/gestao/formularios', testId: 'nav-formularios' },
  { id: 'avaliacoes', label: 'Avaliacoes', icon: 'MessageSquareText', href: '/gestao/avaliacoes', testId: 'nav-avaliacoes' },
  { id: 'relatorios', label: 'Relatórios', icon: 'BarChart2',  href: '/gestao/relatorios', testId: 'nav-relatorios' },
] as const;

const BOTTOM_ITEMS = [
  { id: 'onboarding',     label: 'Onboarding',     icon: 'Rocket',     href: '/gestao/onboarding',     testId: 'nav-onboarding' },
  { id: 'links',          label: 'Links publicos', icon: 'Link2',      href: '/gestao/configuracoes/links', testId: 'nav-links' },
  { id: 'configuracoes', label: 'Configurações', icon: 'Settings',   href: '/gestao/configuracoes', testId: 'nav-configuracoes' },
  { id: 'suporte',       label: 'Suporte',       icon: 'HelpCircle', href: '/gestao/suporte',       testId: 'nav-suporte' },
] as const;

export function Sidebar() {
  const router = useRouter();
  const { isCollapsed, toggleCollapse } = useSidebar();
  const { isAdmin, isBarbeiro, loading: roleLoading } = useUserRole();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
    router.refresh();
  };

  const visibleMenuItems = isBarbeiro
    ? [...BARBER_ITEMS]
    : isAdmin
    ? [...SHARED_ITEMS, ...ADMIN_ITEMS]
    : [...SHARED_ITEMS];

  const roleLabel = isBarbeiro ? 'Barbeiro' : isAdmin ? 'Administrador' : 'Equipe';
  const roleColor = isAdmin ? 'text-[#D6B47A]' : 'text-blue-400';

  return (
    // Sidebar visível APENAS em desktop (lg+). Mobile usa BottomNav.
    <aside
      className={`
        hidden lg:flex flex-col
        bg-[#0a0a0a]/95 backdrop-blur-2xl border-r border-white/10
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isCollapsed ? 'w-[72px]' : 'w-64'}
        h-[100dvh] sticky top-0 shrink-0
      `}
    >
      {/* Header / Logo */}
      <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-white/5 h-20`}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-500">
            <div className="h-10 w-10 bg-[#D6B47A]/15 text-[#D6B47A] rounded-2xl flex items-center justify-center border border-[#D6B47A]/25">
              <Scissors size={24} />
            </div>
            <div>
              <h1 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Meu Caixa</h1>
              <p className="text-[9px] font-black text-[#D6B47A] uppercase tracking-widest mt-0.5">Premium</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="h-10 w-10 bg-[#D6B47A]/15 text-[#D6B47A] rounded-2xl flex items-center justify-center border border-[#D6B47A]/25">
            <Scissors size={20} />
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className="h-8 w-8 flex items-center justify-center text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
        >
          <ChevronLeft className={`transition-transform duration-500 ${isCollapsed ? 'rotate-180' : ''}`} size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto no-scrollbar py-6 space-y-2">
        <div className="px-4 mb-4">
          {!isCollapsed && (
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-2 mb-4">
              Gerenciamento
            </p>
          )}
          {roleLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            visibleMenuItems.map(item => (
              <SidebarItem key={item.id} {...item} isCollapsed={isCollapsed} icon={item.icon as any} />
            ))
          )}
        </div>

        <div className="px-4 pt-6 mt-6 border-t border-white/5">
          {!isCollapsed && (
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-2 mb-4">
              Sistema
            </p>
          )}
          {!isBarbeiro && BOTTOM_ITEMS.map(item => (
            <SidebarItem key={item.id} {...item} isCollapsed={isCollapsed} icon={item.icon as any} />
          ))}
        </div>
      </nav>

      {/* Footer / User */}
      <div className="p-4 bg-white/5 border-t border-white/10 mt-auto">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] border border-white/10 flex items-center justify-center shrink-0 relative">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="h-full w-full rounded-2xl object-cover" alt="avatar" />
            ) : (
              <User className="text-white/50" size={20} />
            )}
            {isAdmin && (
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-[#D6B47A] rounded-full flex items-center justify-center">
                <Shield size={9} className="text-black" />
              </div>
            )}
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-white uppercase truncate">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Profissional'}
              </p>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${roleColor}`}>
                {roleLoading ? '...' : roleLabel}
              </p>
            </div>
          )}

          {!isCollapsed && (
            <button
              onClick={handleLogout}
              className="h-8 w-8 flex items-center justify-center text-white/40 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-all"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
