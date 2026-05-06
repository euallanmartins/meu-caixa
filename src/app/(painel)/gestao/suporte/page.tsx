'use client';

import { HelpCircle } from 'lucide-react';

export default function SuportePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="h-24 w-24 bg-white/5 border border-white/10 text-white/40 flex items-center justify-center rounded-[3rem]">
         <HelpCircle size={48} />
      </div>
      <div className="text-center space-y-2">
         <h2 className="text-2xl font-black text-white uppercase tracking-tight">Central de Ajuda</h2>
         <p className="text-sm font-bold text-muted uppercase tracking-widest max-w-md mx-auto">
            Canal de comunicação com o suporte técnico.
         </p>
         
         <div className="mt-8">
            <a href="mailto:alin.tyga@gmail.com" className="inline-block bg-[#D6B47A]/10 text-[#D6B47A] border border-[#D6B47A]/30 px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#D6B47A]/20 transition-all">
                Falar com Desenvolvedor
            </a>
         </div>
      </div>
    </div>
  );
}
