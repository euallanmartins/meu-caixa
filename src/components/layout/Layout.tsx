'use client';

import React from 'react';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden font-sans selection:bg-[#D6B47A]/30 selection:text-white">
      {/* Sidebar — somente desktop (lg+) */}
      <Sidebar />

      {/* Área de conteúdo principal */}
      <main
        className="flex-1 overflow-y-auto relative"
        data-testid="main-content"
      >
        {/* pb-[80px] no mobile para não sobrepor o BottomNav */}
        <div className="min-h-full p-4 pb-[88px] lg:p-8 lg:pb-8 animate-in fade-in duration-700">
          {children}
        </div>
      </main>

      {/* Bottom Nav — somente mobile (<lg) */}
      <BottomNav />
    </div>
  );
}
