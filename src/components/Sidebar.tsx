/* eslint-disable */
'use client';

import React from 'react';
import { 
  Users, 
  Wallet, 
  Package, 
  Calendar, 
  Scissors, 
  UserCircle, 
  Settings,
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Contact2,
  ShoppingCart
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export type TabId = 'pos' | 'barbers' | 'cash' | 'products' | 'mine' | 'schedule' | 'services' | 'clients';

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  isAdmin: boolean;
  profile: any;
}

export function Sidebar({ activeTab, setActiveTab, isAdmin, profile }: SidebarProps) {
  const router = useRouter();

  const menuItems = [
    { id: 'pos', label: 'Nova Venda', icon: ShoppingCart, color: 'text-accent', bar: 'bg-accent' },
    { id: 'schedule', label: 'Agenda', icon: Calendar, color: 'text-orange-400', bar: 'bg-orange-500' },
    { id: 'cash', label: 'Financeiro', icon: Wallet, color: 'text-white', bar: 'bg-white' },
    { id: 'barbers', label: 'Equipe', icon: Users, color: 'text-blue-400', bar: 'bg-blue-500' },
    { id: 'clients', label: 'Clientes', icon: Contact2, color: 'text-pink-400', bar: 'bg-pink-500' },
    { id: 'products', label: 'Estoque', icon: Package, color: 'text-purple-400', bar: 'bg-purple-500' },
    { id: 'services', label: 'ServiÃ§os', icon: Scissors, color: 'text-cyan-400', bar: 'bg-cyan-500' },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 liquid-glass border-r border-white/10 z-[60] flex flex-col p-6 transition-all duration-300">
      {/* Logo Section */}
      <div className="flex items-center gap-3 mb-12">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 border border-accent/20 shadow-[0_0_15px_rgba(214,180,122,0.2)]">
          <Scissors className="h-6 w-6 text-accent" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-black tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent uppercase">
            Meu Caixa
          </span>
          <span className="text-[9px] font-bold text-accent tracking-[3.5px] uppercase opacity-70">
            Premium
          </span>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
        <div className="mb-4">
          <h4 className="text-[10px] font-black text-muted uppercase tracking-[2.5px] mb-4 opacity-50">Menu Principal</h4>
          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabId)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group relative ${
                  activeTab === item.id 
                    ? 'bg-white/10 text-white border border-white/5' 
                    : 'text-muted hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                <item.icon className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${
                  activeTab === item.id ? item.color : 'text-muted'
                }`} />
                <span className={`text-[12px] font-bold tracking-wide ${
                  activeTab === item.id ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                }`}>
                  {item.label}
                </span>
                
                {activeTab === item.id && (
                  <div className={`absolute left-0 w-1 h-6 rounded-full ${item.bar} shadow-[0_0_15px_rgba(255,255,255,0.4)]`} />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Profile & Footer Section */}
      <div className="mt-auto pt-6 border-t border-white/5">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 mb-4 group cursor-pointer hover:bg-white/10 transition-all">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center border border-accent/20">
                <UserCircle className="w-6 h-6 text-accent" />
             </div>
             <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate">{profile?.barbearias?.nome || 'Minha Barbearia'}</span>
                <span className="text-[10px] text-muted font-medium truncate">Gerencial</span>
             </div>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-danger hover:bg-danger/10 transition-all duration-300 border border-transparent hover:border-danger/20 group"
        >
          <LogOut className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[12px] font-black uppercase tracking-widest">Sair</span>
        </button>
      </div>
    </aside>
  );
}
