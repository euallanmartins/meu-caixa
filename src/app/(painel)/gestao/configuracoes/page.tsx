/* eslint-disable */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ServicesView } from '@/components/ServicesView';
import { ProductsView } from '@/components/ProductsView';
import { OpeningHoursView } from '@/components/OpeningHoursView';
import { BarbeariaProfileSettings } from '@/components/BarbeariaProfileSettings';
import { BarbeariaPortfolioManager } from '@/components/BarbeariaPortfolioManager';
import { ProfessionalMobileHeader } from '@/components/layout/ProfessionalMobileHeader';

type ConfigTab = 'perfil' | 'portfolio' | 'servicos' | 'produtos' | 'horarios';

const tabs: Array<{ id: ConfigTab; label: string }> = [
  { id: 'perfil', label: 'Perfil publico' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'servicos', label: 'Catalogo de servicos' },
  { id: 'produtos', label: 'Estoque de produtos' },
  { id: 'horarios', label: 'Horario de funcionamento' },
];

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ConfigTab>('perfil');

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, barbearias(nome)')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileData?.barbearia_id) {
        await supabase.auth.signOut();
        router.replace('/');
        router.refresh();
        return;
      }

      setProfile(profileData);
      setLoading(false);
    }

    checkUser();
  }, [router]);

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#D6B47A] border-t-transparent" />
    </div>
  );

  return (
    <div className="min-w-0 space-y-8 pb-28 animate-in fade-in duration-500">
      <ProfessionalMobileHeader
        icon={Settings}
        title="Ajustes"
        subtitle="Perfil publico, servicos e horarios"
      />

      <div className="hidden lg:block">
        <h2 className="text-3xl font-black uppercase tracking-tight text-white">Configuracoes</h2>
        <p className="mt-1 text-sm font-bold uppercase tracking-widest text-white/40">
          Gerencie perfil publico, catalogo, estoque e horarios da barbearia
        </p>
      </div>

      <div className="flex w-full max-w-full gap-4 overflow-x-auto border-b border-white/10 pb-4 no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 whitespace-nowrap rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'border border-[#D6B47A]/30 bg-[#D6B47A]/10 text-[#D6B47A]'
                : 'bg-white/5 text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {activeTab === 'perfil' && <BarbeariaProfileSettings barbeariaId={profile?.barbearia_id} />}
        {activeTab === 'portfolio' && <BarbeariaPortfolioManager barbeariaId={profile?.barbearia_id} />}
        {activeTab === 'servicos' && <ServicesView barbeariaId={profile?.barbearia_id} />}
        {activeTab === 'produtos' && <ProductsView barbeariaId={profile?.barbearia_id} />}
        {activeTab === 'horarios' && <OpeningHoursView barbeariaId={profile?.barbearia_id} />}
      </div>
    </div>
  );
}
