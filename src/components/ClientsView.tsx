'use client';

import { useState, useEffect } from 'react';
import { Users, Phone, Mail, Search, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ClientsViewProps {
  barbeariaId: string | null;
}

export function ClientsView({ barbeariaId }: ClientsViewProps) {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  async function fetchClientes() {
    if (!barbeariaId) return;
    setLoading(true);
    const { data } = await supabase
      .from('clientes')
      .select('*, agendamentos(id, status, data_hora_inicio)')
      .eq('barbearia_id', barbeariaId)
      .order('created_at', { ascending: false });
    setClientes(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchClientes(); }, [barbeariaId]);

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone.includes(search)
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Clientes</h2>
          <p className="text-sm text-muted">{clientes.length} clientes cadastrados</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, email ou telefone..."
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-accent outline-none transition-all"
        />
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-dashed border-border opacity-60">
          <Users className="h-12 w-12 text-muted mx-auto mb-4" />
          <p className="text-muted font-medium">{search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((c) => {
            const totalAgendamentos = c.agendamentos?.length || 0;
            const atendidos = c.agendamentos?.filter((a: any) => a.status === 'atendido').length || 0;
            const lastVisit = c.agendamentos?.filter((a: any) => a.status === 'atendido')
              .sort((a: any, b: any) => new Date(b.data_hora_inicio).getTime() - new Date(a.data_hora_inicio).getTime())[0];

            return (
              <div key={c.id} className="glass rounded-2xl border border-border/50 p-4 hover:border-accent/30 transition-all group">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-black text-sm">
                    {c.nome.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white text-sm truncate">{c.nome}</h4>
                    <div className="space-y-1 mt-1">
                      <a
                        href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300 transition-colors"
                      >
                        <Phone className="h-2.5 w-2.5" />
                        {c.telefone}
                      </a>
                      <p className="flex items-center gap-1 text-[10px] text-muted truncate">
                        <Mail className="h-2.5 w-2.5" />
                        {c.email}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px]">
                  <div className="flex gap-3">
                    <span className="text-muted">{totalAgendamentos} agendamento{totalAgendamentos !== 1 ? 's' : ''}</span>
                    <span className="text-accent font-bold">{atendidos} atendido{atendidos !== 1 ? 's' : ''}</span>
                  </div>
                  {lastVisit && (
                    <span className="text-muted flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      Última: {new Date(lastVisit.data_hora_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
