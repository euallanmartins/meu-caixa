/* eslint-disable */
'use client';

import React from 'react';
import { Mail, Phone, MoreHorizontal, UserPlus, Star, ChevronLeft } from 'lucide-react';

interface ProfileHeaderProps {
  cliente: any;
  onClose?: () => void;
  onEdit?: () => void;
}

export function ClientProfileHeader({ cliente, onClose, onEdit }: ProfileHeaderProps) {
  if (!cliente) return null;

  return (
    <div className="flex flex-col gap-6 lg:gap-8 pb-8 border-b border-white/5">
      {/* Mobile Back Button */}
      <div className="lg:hidden flex items-center justify-between">
         <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40">
            <ChevronLeft size={24} />
         </button>
          <button type="button" onClick={onEdit} className="p-2 hover:bg-white/5 rounded-full text-white/40">
             <MoreHorizontal size={24} />
          </button>
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="relative group">
           <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl transition-all group-hover:border-accent/40">
              {cliente.foto_url ? (
                <img src={cliente.foto_url} alt={cliente.nome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl lg:text-4xl font-black text-white/20">{cliente.nome.substring(0, 1).toUpperCase()}</span>
              )}
           </div>
            <button type="button" onClick={onEdit} title="Editar cliente" className="absolute bottom-1 right-1 w-8 h-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white hover:bg-accent hover:text-black transition-all shadow-lg">
               <UserPlus size={16} />
            </button>
        </div>

        <div className="mt-6 space-y-2">
           <h2 className="text-2xl lg:text-4xl font-black text-white uppercase tracking-tight leading-none">
              {cliente.nome}
           </h2>
           <p className="text-sm font-bold text-muted tracking-widest uppercase opacity-60">
              {cliente.telefone}
           </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
           <span className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-[9px] font-black uppercase text-accent tracking-widest">
              Usuário App
           </span>
           {cliente.tags?.map((tag: string, i: number) => (
             <span key={i} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-black uppercase text-muted tracking-widest">
                {tag}
             </span>
           ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6 mt-8">
           <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => cliente.email && window.open(`mailto:${cliente.email}`)}
                className="w-14 h-14 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all shadow-lg"
              >
                 <Mail size={20} />
              </button>
              <span className="text-[9px] font-black uppercase text-muted tracking-widest">E-mail</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <button 
                type="button"
                onClick={() => window.open(`tel:${cliente.telefone}`)}
                className="w-14 h-14 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white hover:bg-[#D6B47A] hover:text-black transition-all shadow-lg"
              >
                 <Phone size={20} />
              </button>
              <span className="text-[9px] font-black uppercase text-muted tracking-widest">Chamar</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <button 
                type="button"
                onClick={onEdit}
                className="w-14 h-14 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all shadow-lg"
              >
                 <MoreHorizontal size={20} />
              </button>
              <span className="text-[9px] font-black uppercase text-muted tracking-widest">Mais</span>
           </div>
        </div>
      </div>
    </div>
  );
}
