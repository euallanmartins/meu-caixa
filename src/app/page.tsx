'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AIAssistant } from '@/components/AIAssistant';
import { LogOut, Scissors, User } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';

import { BarbersView } from '@/components/BarbersView';
import { DailyCashView } from '@/components/DailyCashView';
import { ProductsView } from '@/components/ProductsView';
import { BarberAppointmentsView } from '@/components/BarberAppointmentsView';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'barbers' | 'cash' | 'products' | 'mine'>('barbers');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  
  // Real data fetching
  const { transactions, barbers, loading: dataLoading, refreshData } = useDashboardData(profile?.barbearia_id || null);

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      setUser(user);
      
      // Fetch Profile to get barbearia_id safely
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, barbearias(nome)')
        .eq('id', user.id)
        .maybeSingle();
        
      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError);
      }
        
      setProfile(profileData);
      setLoading(false);
    }
    checkUser();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) return (
     <div className="flex min-h-screen items-center justify-center bg-background">
       <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
     </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      {/* Liquid Background Blobs */}
      <div className="blob top-[-10%] left-[-10%] bg-accent/20" />
      <div className="blob bottom-[10%] right-[-5%] bg-purple-500/10 animate-delay-2000" style={{ animationDelay: '2s' }} />
      <div className="blob top-[40%] left-[30%] bg-blue-500/10" style={{ animationDuration: '30s', width: '600px', height: '600px' }} />

      {/* Header com Abas */}
      <header className="liquid-glass border-b border-white/5 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
                <Scissors className="h-5 w-5 text-accent" />
              </div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Meu Caixa
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted">
                <User className="h-4 w-4" />
                <span>{profile?.barbearias?.nome || 'Minha Barbearia'}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Abas Superiores Estilo Pro - Mobile Responsive Scroll */}
          <div className="flex gap-6 sm:gap-10 pb-0 overflow-x-auto no-scrollbar scroll-smooth">
            {[
              { id: 'barbers', label: 'Barbeiros', color: 'text-accent', bar: 'bg-accent' },
              { id: 'cash', label: 'Caixa do Dia', color: 'text-white', bar: 'bg-white' },
              { id: 'mine', label: 'Atendimentos', color: 'text-blue-400', bar: 'bg-blue-500' },
              { id: 'products', label: 'Produtos', color: 'text-purple-400', bar: 'bg-purple-500' }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative py-4 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.2em] transition-all whitespace-nowrap min-w-fit ${
                  activeTab === tab.id ? tab.color : 'text-muted hover:text-white'
                }`}
              >
                {tab.label}
                <div className={`absolute bottom-0 left-0 h-0.5 sm:h-1 w-full rounded-t-full transition-all duration-300 ${
                  activeTab === tab.id ? `${tab.bar} opacity-100 shadow-[0_0_15px_rgba(255,255,255,0.4)]` : 'bg-transparent opacity-0'
                }`}></div>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
          <div className="lg:col-span-4 xl:col-span-3 space-y-6">
             <AIAssistant profile={profile} onProcessed={refreshData} />
             
             {/* Status da Loja - Liquid Style */}
             <div className="liquid-glass rounded-[2rem] p-8 border border-white/5 hidden lg:block">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted mb-4 opacity-70">Status da Loja</h4>
                <div className="space-y-4">
                   <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-xs text-muted">Atendimento</span>
                      <span className="text-xs font-bold text-accent">Aberto</span>
                   </div>
                   <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-xs text-muted">Profissionais</span>
                      <span className="text-xs font-bold text-white">{barbers.length}</span>
                   </div>
                </div>
             </div>
          </div>

          <div className="lg:col-span-8 xl:col-span-9">
             {activeTab === 'barbers' ? (
                <BarbersView 
                  barbers={barbers} 
                  barbeariaId={profile?.barbearia_id} 
                  refreshData={refreshData}
                  loading={dataLoading}
                />
             ) : activeTab === 'cash' ? (
                <DailyCashView 
                  transactions={transactions} 
                  barbers={barbers}
                  refreshData={refreshData} 
                />
             ) : activeTab === 'mine' ? (
                <BarberAppointmentsView 
                  barbers={barbers} 
                  transactions={transactions}
                  loading={dataLoading}
                  onRefresh={refreshData}
                />
             ) : (
                <ProductsView 
                  barbeariaId={profile?.barbearia_id}
                />
             )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/5 bg-card/10 py-8 text-center backdrop-blur-md">
        <p className="text-[10px] text-muted uppercase tracking-[0.2em] font-medium">
          Sistema de Gestão Premium &bull; v2.0
        </p>
      </footer>
    </div>
  );
}
