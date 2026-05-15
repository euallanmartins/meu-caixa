'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { supabase } from '@/lib/supabase';

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function checkOnboarding() {
      if (pathname.startsWith('/gestao/onboarding')) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, barbearia_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!active || !profile?.barbearia_id) return;
      if (['platform_admin', 'super_admin'].includes(String(profile.role))) return;
      if (!['owner', 'proprietario', 'admin'].includes(String(profile.role))) return;

      const { data: barbearia, error } = await supabase
        .from('barbearias')
        .select('onboarding_completed')
        .eq('id', profile.barbearia_id)
        .maybeSingle();

      if (!active || error?.code === '42703') return;
      if (barbearia && barbearia.onboarding_completed === false) {
        router.replace('/gestao/onboarding');
      }
    }

    checkOnboarding();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  return (
    <div className="flex h-dvh min-h-dvh w-full max-w-full overflow-hidden bg-[#0a0a0a] font-sans text-white selection:bg-[#D6B47A]/30 selection:text-white">
      {/* Sidebar — somente desktop (lg+) */}
      <Sidebar />

      {/* Área de conteúdo principal */}
      <main
        className="relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
        data-testid="main-content"
      >
        {/* pb-[80px] no mobile para não sobrepor o BottomNav */}
        <div className="min-h-full w-full max-w-full min-w-0 p-4 pb-[calc(88px+env(safe-area-inset-bottom))] animate-in fade-in duration-700 sm:p-5 lg:p-8 lg:pb-8">
          {children}
        </div>
      </main>

      {/* Bottom Nav — somente mobile (<lg) */}
      <BottomNav />
    </div>
  );
}
