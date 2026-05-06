/* eslint-disable */
'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Phone, 
  Mail, 
  Calendar, 
  Scissors, 
  Trash2, 
  ExternalLink,
  Plus,
  TrendingUp,
  AlertCircle,
  Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ClientDetailSidebarProps {
  cliente: any;
  onClose: () => void;
  onUpdate: () => void;
  barbeariaId: string | null;
}

export function ClientDetailSidebar({ cliente, onClose, onUpdate, barbeariaId }: ClientDetailSidebarProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'historico'>('info');
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalGasto: 0,
    visitasCount: 0,
    noShows: 0
  });

  useEffect(() => {
    async function loadData() {
      if (!cliente?.id || !barbeariaId) return;
      setLoading(true);

      // Carregar agendamentos
      const { data: ags } = await supabase
        .from('agendamentos')
        .select(`
          *,
          servicos(nome, valor),
          barbeiros(nome)
        `)
        .eq('cliente_id', cliente.id)
        .eq('barbearia_id', barbeariaId)
        .order('data_hora_inicio', { ascending: false });

      setAgendamentos(ags || []);

      // Carregar transações para cálculos financeiros
      const { data: trans } = await supabase
        .from('transacoes')
        .select('*')
        .eq('cliente_id', cliente.id)
        .eq('barbearia_id', barbeariaId);

      const total = trans?.reduce((sum, t) => sum + Number(t.valor_total), 0) || 0;
      const noshows = ags?.filter(a => a.status === 'cancelado').length || 0;

      setMetrics({
        totalGasto: total,
        visitasCount: ags?.filter(a => a.status === 'atendido').length || 0,
        noShows: noshows
      });

      setLoading(false);
    }
    loadData();
  }, [barbeariaId, cliente.id]);

  if (!cliente) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-[450px] liquid-glass border-l border-white/10 z-[100] flex flex-col shadow-2xl animate-in slide-in-from-right duration-500">
      {/* Header */}
      <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-accent/20 flex items-center justify-center border border-accent/20">
            <span className="text-xl font-black text-accent">{cliente.nome.substring(0, 1).toUpperCase()}</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">{cliente.nome}</h3>
            <span className="text-[10px] font-bold text-muted tracking-widest uppercase opacity-70">Perfil do Cliente</span>
          </div>
        </div>
        <button onClick={onClose} className="p-3 rounded-2xl hover:bg-white/10 text-muted hover:text-white transition-all">
          <X size={20} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Quick Metrics */}
        <div className="p-8 grid grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/5 p-4 rounded-[1.5rem] flex flex-col gap-1">
            <TrendingUp size={14} className="text-accent mb-1" />
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Total Gasto</span>
            <span className="text-sm font-black text-white">R$ {metrics.totalGasto.toFixed(2)}</span>
          </div>
          <div className="bg-white/5 border border-white/5 p-4 rounded-[1.5rem] flex flex-col gap-1">
            <Clock size={14} className="text-blue-400 mb-1" />
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Visitas</span>
            <span className="text-sm font-black text-white">{metrics.visitasCount}</span>
          </div>
          <div className="bg-white/5 border border-white/5 p-4 rounded-[1.5rem] flex flex-col gap-1">
            <AlertCircle size={14} className="text-danger mb-1" />
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Faltas</span>
            <span className="text-sm font-black text-white">{metrics.noShows}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8 border-b border-white/5 flex gap-8">
           <button 
             onClick={() => setActiveTab('info')}
             className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'info' ? 'text-accent' : 'text-muted hover:text-white'}`}
           >
             Informações
             {activeTab === 'info' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent rounded-full shadow-glow" />}
           </button>
           <button 
             onClick={() => setActiveTab('historico')}
             className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'historico' ? 'text-accent' : 'text-muted hover:text-white'}`}
           >
             Histórico
             {activeTab === 'historico' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent rounded-full shadow-glow" />}
           </button>
        </div>

        <div className="p-8">
          {activeTab === 'info' ? (
            <div className="space-y-8">
              {/* Contact Links */}
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-muted uppercase tracking-[2px]">Contatos Rápidos</h4>
                 <div className="grid grid-cols-2 gap-3">
                    <a 
                      href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`} 
                      target="_blank"
                      className="flex items-center gap-3 p-4 bg-[#D6B47A]/10 border border-[#D6B47A]/20 rounded-2xl hover:bg-[#D6B47A]/15 transition-all group"
                    >
                       <Phone size={16} className="text-[#D6B47A]" />
                       <span className="text-xs font-bold text-[#D6B47A] uppercase tracking-wide">WhatsApp</span>
                    </a>
                    <a 
                      href={`mailto:${cliente.email}`} 
                      className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all"
                    >
                       <Mail size={16} className="text-muted" />
                       <span className="text-xs font-bold text-white uppercase tracking-wide">E-mail</span>
                    </a>
                 </div>
              </div>

              {/* Tags Section */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-muted uppercase tracking-[2px]">Etiquetas</h4>
                    <button type="button" onClick={() => window.alert('Use o cadastro do cliente para adicionar etiquetas.')} className="text-accent hover:opacity-70 transition-all"><Plus size={14} /></button>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {cliente.tags?.length > 0 ? (
                      cliente.tags.map((tag: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-[9px] font-black uppercase text-accent tracking-tighter">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted italic">Nenhuma etiqueta adicionada</span>
                    )}
                 </div>
              </div>

              {/* Remarks */}
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-muted uppercase tracking-[2px]">Observações Técnicas</h4>
                 <textarea 
                   className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-xs text-white h-32 focus:outline-none focus:border-accent/40"
                   placeholder="Notas sobre preferências, estilo ou pele..."
                   value={cliente.observacoes || ''}
                 />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
               {agendamentos.length === 0 ? (
                 <div className="text-center py-20 opacity-30">
                    <Calendar size={32} className="mx-auto mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest">Nenhum atendimento</p>
                 </div>
               ) : (
                 agendamentos.map((ag) => (
                   <div key={ag.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 hover:bg-white/10 transition-all flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            ag.status === 'atendido' ? 'bg-accent/10 text-accent' : 
                            ag.status === 'cancelado' ? 'bg-danger/10 text-danger' : 'bg-blue-400/10 text-blue-400'
                         }`}>
                            <Scissors size={20} />
                         </div>
                         <div>
                            <h5 className="text-[12px] font-black text-white uppercase">{ag.servicos?.nome || 'Serviço'}</h5>
                            <div className="flex items-center gap-2 text-[10px] text-muted font-bold mt-1">
                               <span>{new Date(ag.data_hora_inicio).toLocaleDateString('pt-BR')}</span>
                               <span>•</span>
                               <span>{ag.barbeiros?.nome}</span>
                            </div>
                         </div>
                      </div>
                      <span className="text-xs font-black text-white">
                         R$ {Number(ag.servicos?.valor || 0).toFixed(2)}
                      </span>
                   </div>
                 ))
               )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-8 border-t border-white/5 bg-black/40 flex gap-3">
         <button 
           onClick={onClose}
           className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-[10px] tracking-widest py-4 rounded-2xl border border-white/5 transition-all"
         >
           Fechar
         </button>
         <button
           type="button"
           onClick={onClose}
           className="bg-danger/10 border border-danger/20 hover:bg-danger/20 text-danger p-4 rounded-2xl transition-all"
         >
           <Trash2 size={18} />
         </button>
      </div>
    </div>
  );
}
