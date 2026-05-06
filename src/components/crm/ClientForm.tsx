/* eslint-disable */
'use client';

import React, { useState } from 'react';
import { ChevronLeft, X, UserPlus, Camera, Smartphone, Mail, FileText, CheckCircle2 } from 'lucide-react';

interface ClientFormProps {
  onClose: () => void;
  onSave: (data: any) => void;
}

export function ClientForm({ onClose, onSave }: ClientFormProps) {
  const [form, setForm] = useState({
    nome: '',
    sobrenome: '',
    cpf: '',
    telefone: '',
    email: '',
    desconto: 0,
    reservas_online: true
  });

  const [activeTab, setActiveTab] = useState<'geral' | 'adicional'>('geral');

  return (
    <div className="fixed inset-0 z-[160] bg-[#0a0a0a] flex flex-col font-sans animate-in slide-in-from-bottom duration-500 overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 lg:px-10 py-5 bg-white/5 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-6">
           <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40">
              <ChevronLeft size={24} />
           </button>
           <h2 className="text-xl lg:text-3xl font-black text-white uppercase tracking-tight">Adicionar novo cliente</h2>
        </div>

        <div className="flex items-center gap-4">
           {/* Online Reserves Switch */}
           <div className="hidden lg:flex items-center gap-4 px-6 border-r border-white/5 mr-2">
              <span className="text-[10px] font-black text-muted uppercase tracking-widest text-right">Ativar reservas online?<br/><span className="text-white">Sim</span></span>
              <button 
                onClick={() => setForm(f => ({ ...f, reservas_online: !f.reservas_online }))}
                className={`w-12 h-6 rounded-full p-1 transition-all ${form.reservas_online ? 'bg-accent' : 'bg-white/10'}`}
              >
                 <div className={`w-4 h-4 rounded-full bg-white transition-all ${form.reservas_online ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
           </div>

           <button 
             onClick={() => onSave(form)}
             className="bg-white text-black px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-accent transition-all shadow-lg"
           >
              Adicionar
           </button>
           <button 
             onClick={() => onSave(form)}
             className="hidden lg:block bg-white/10 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/10"
           >
              Adicionar e Convidar
           </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <div className="hidden lg:flex w-72 border-r border-white/5 flex-col p-10 gap-8 bg-white/[0.02]">
           <button 
             onClick={() => setActiveTab('geral')}
             className={`text-left text-[11px] font-black uppercase tracking-[0.2em] transition-all border-l-4 pl-4 ${activeTab === 'geral' ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'}`}
           >
              Informações Gerais
           </button>
           <button 
             onClick={() => setActiveTab('adicional')}
             className={`text-left text-[11px] font-black uppercase tracking-[0.2em] transition-all border-l-4 pl-4 ${activeTab === 'adicional' ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'}`}
           >
              Informação Adicional
           </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar bg-black/40 lg:bg-transparent">
           <div className="max-w-2xl mx-auto py-12 px-6 space-y-12 pb-32 lg:pb-12">
              
              {/* Photo Upload */}
              <div className="flex flex-col items-center">
                 <div className="relative group cursor-pointer">
                    <div className="w-28 h-28 lg:w-36 lg:h-36 rounded-[3rem] bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center group-hover:border-accent/40 transition-all">
                       <Camera size={32} className="text-white/20 group-hover:text-accent group-hover:scale-110 transition-all" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-accent rounded-2xl flex items-center justify-center text-black shadow-glow border-4 border-black">
                       <UserPlus size={20} />
                    </div>
                 </div>
              </div>

              {/* Fields Group */}
              <div className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-white/30 uppercase ml-4 tracking-tighter">Nome</label>
                       <input 
                         type="text" 
                         className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 px-6 text-white text-sm font-bold focus:border-accent/40 outline-none transition-all placeholder:text-muted/30"
                         placeholder="Ex: João"
                         value={form.nome}
                         onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-white/30 uppercase ml-4 tracking-tighter">Sobrenome</label>
                       <input 
                         type="text" 
                         className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 px-6 text-white text-sm font-bold focus:border-accent/40 outline-none transition-all placeholder:text-muted/30"
                         placeholder="Ex: Silva"
                         value={form.sobrenome}
                         onChange={e => setForm(f => ({ ...f, sobrenome: e.target.value }))}
                       />
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-white/30 uppercase ml-4 tracking-tighter">CPF</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 px-6 text-white text-sm font-bold focus:border-accent/40 outline-none transition-all placeholder:text-muted/30"
                      placeholder="000.000.000-00"
                      value={form.cpf}
                      onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))}
                    />
                 </div>
              </div>

              {/* Discount Section */}
              <div className="p-8 bg-white/5 border border-white/5 rounded-[2.5rem] flex items-center justify-between">
                 <div className="space-y-1">
                    <h4 className="text-xs font-black text-white uppercase tracking-wide">Desconto de cliente</h4>
                    <p className="text-[10px] text-muted font-bold tracking-tight">Aplicar desconto fixo em todos os serviços</p>
                 </div>
                 <div className="flex items-center gap-4 bg-black/40 rounded-2xl p-2 border border-white/5">
                    <button onClick={() => setForm(f => ({ ...f, desconto: Math.max(0, f.desconto - 5) }))} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white">-</button>
                    <span className="w-12 text-center text-lg font-black text-accent">{form.desconto}%</span>
                    <button onClick={() => setForm(f => ({ ...f, desconto: Math.min(100, f.desconto + 5) }))} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white">+</button>
                 </div>
              </div>

              {/* Contact Section */}
              <div className="space-y-8 pt-8 border-t border-white/5">
                 <h3 className="text-xl font-black text-white uppercase tracking-tight">Contato</h3>
                 
                 <div className="space-y-4">
                    <div className="relative group">
                       <Smartphone className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted group-focus-within:text-accent transition-all" />
                       <input 
                         type="text" 
                         className="w-full bg-white/5 border border-white/10 rounded-2xl py-6 pl-16 pr-6 text-white text-base font-black focus:border-[#D6B47A] outline-none"
                         placeholder="Número de telefone"
                         value={form.telefone}
                         onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                       />
                    </div>
                    <div className="relative group">
                       <Mail className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted group-focus-within:text-accent transition-all" />
                       <input 
                         type="text" 
                         className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-16 pr-6 text-white text-sm font-bold focus:border-accent/40 outline-none"
                         placeholder="E-mail"
                         value={form.email}
                         onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                       />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
