/* eslint-disable */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Filter, Mail, MoreHorizontal, Phone, Plus, Search, UserPlus, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ClientProfileHeader } from './crm/ClientProfileHeader';
import { ClientActivityTabs } from './crm/ClientActivityTabs';
import { ClientForm } from './crm/ClientForm';

interface ClientsViewProps {
  barbeariaId: string | null;
}

type Segment = 'all' | 'novos' | 'fieis' | 'ausentes';

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export function ClientsView({ barbeariaId }: ClientsViewProps) {
  const router = useRouter();
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSegment, setActiveSegment] = useState<Segment>('all');
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  async function fetchClientes() {
    if (!barbeariaId) {
      setClientes([]);
      setSelectedCliente(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const clientesQuery = (includeBarberPhoto: boolean) =>
        supabase
          .from('clientes')
          .select(includeBarberPhoto ? `
          *,
          agendamentos(
            id,
            idempotency_key,
            status,
            data_hora_inicio,
            data_hora_fim,
            valor_estimado,
            observacoes,
            servicos(nome, valor, duracao_minutos),
            barbeiros(nome, foto_url, destaque_label)
          ),
            transacoes(
              id,
              valor_total,
              data,
            servicos(nome),
            transacao_pagamentos(metodo, valor),
            venda_produtos(quantidade, produtos(nome))
          )
        ` : `
          *,
          agendamentos(
            id,
            idempotency_key,
            status,
            data_hora_inicio,
            data_hora_fim,
            valor_estimado,
            observacoes,
            servicos(nome, valor, duracao_minutos),
            barbeiros(nome, destaque_label)
          ),
          transacoes(
            id,
            valor_total,
            data,
            servicos(nome),
            transacao_pagamentos(metodo, valor),
            venda_produtos(quantidade, produtos(nome))
          )
        `)
          .eq('barbearia_id', barbeariaId)
          .order('nome', { ascending: true });

      let { data, error } = await clientesQuery(true);
      if (error?.code === '42703') {
        console.warn('Fallback clientes sem barbeiros.foto_url:', error);
        const fallback = await clientesQuery(false);
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      const processed = (data || []).map(client => ({
        ...client,
        receitaTotal: client.transacoes?.reduce((acc: number, t: any) => acc + Number(t.valor_total || 0), 0) || 0,
      }));

      setClientes(processed);
      setSelectedCliente((prev: any) => prev ? processed.find(c => c.id === prev.id) || null : null);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClientes();
  }, [barbeariaId]);

  const segmented = useMemo(() => {
    const now = new Date();
    return clientes.filter(c => {
      const matchesSearch =
        c.nome?.toLowerCase().includes(search.toLowerCase()) ||
        c.telefone?.includes(search);

      if (!matchesSearch) return false;
      if (activeSegment === 'all') return true;

      const completed = c.agendamentos?.filter((a: any) => ['atendido', 'realizado', 'concluido'].includes(a.status)) || [];
      if (activeSegment === 'novos') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return new Date(c.created_at) > sevenDaysAgo;
      }
      if (activeSegment === 'fieis') return completed.length >= 2;
      if (activeSegment === 'ausentes') {
        const lastVisit = completed.length > 0
          ? new Date([...completed].sort((a: any, b: any) => new Date(b.data_hora_inicio).getTime() - new Date(a.data_hora_inicio).getTime())[0].data_hora_inicio)
          : null;
        return !!lastVisit && lastVisit < new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
      }
      return true;
    });
  }, [clientes, search, activeSegment]);

  const summary = selectedCliente ? {
    agendamentos: selectedCliente.agendamentos?.length || 0,
    ausencias: selectedCliente.agendamentos?.filter((a: any) => ['ausente', 'nao_compareceu'].includes(a.status)).length || 0,
    cancelamentos: selectedCliente.agendamentos?.filter((a: any) => a.status === 'cancelado').length || 0,
    receita: selectedCliente.receitaTotal || 0,
  } : null;

  async function handleSaveClient(data: any) {
    if (!barbeariaId) return;
    const nome = [data.nome, data.sobrenome].filter(Boolean).join(' ').trim();
    if (!nome) return;

    const { error } = await supabase.from('clientes').insert({
      barbearia_id: barbeariaId,
      nome,
      telefone: data.telefone,
      email: data.email || null,
    });

    if (error) {
      alert('Erro ao salvar cliente: ' + error.message);
      return;
    }

    setShowAddForm(false);
    fetchClientes();
  }

  async function handleEditSelectedClient() {
    if (!selectedCliente) return;
    const nome = window.prompt('Nome do cliente', selectedCliente.nome || '');
    if (nome === null) return;
    const telefone = window.prompt('Telefone do cliente', selectedCliente.telefone || '');
    if (telefone === null) return;
    const email = window.prompt('E-mail do cliente', selectedCliente.email || '');
    if (email === null) return;

    const { error } = await supabase
      .from('clientes')
      .update({ nome, telefone, email: email || null })
      .eq('id', selectedCliente.id)
      .eq('barbearia_id', barbeariaId);

    if (error) {
      alert('Erro ao atualizar cliente: ' + error.message);
      return;
    }

    fetchClientes();
  }

  async function handleToggleBlockSelectedClient() {
    if (!selectedCliente || !barbeariaId) return;
    const shouldBlock = !selectedCliente.bloqueado;
    const motivo = shouldBlock ? window.prompt('Motivo interno do bloqueio', selectedCliente.motivo_bloqueio || '') : null;
    if (shouldBlock && motivo === null) return;

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('clientes')
      .update({
        bloqueado: shouldBlock,
        motivo_bloqueio: shouldBlock ? motivo || null : null,
        bloqueado_em: shouldBlock ? new Date().toISOString() : null,
        bloqueado_por: shouldBlock ? userData.user?.id ?? null : null,
      })
      .eq('id', selectedCliente.id)
      .eq('barbearia_id', barbeariaId);

    if (error) {
      alert('Erro ao atualizar bloqueio: ' + error.message);
      return;
    }

    fetchClientes();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#D6B47A] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-full space-y-7 overflow-hidden pb-10">
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="hidden min-w-0 items-start justify-between gap-4 lg:flex">
          <div className="min-w-0">
          <h2 className="break-words text-[2.2rem] font-black uppercase leading-none tracking-tight text-white min-[390px]:text-[2.55rem] sm:text-4xl">Gestao CRM</h2>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-white/45 sm:text-sm sm:tracking-[0.26em]">
            Base de dados e segmentacao de clientes
          </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex h-16 items-center justify-center gap-4 rounded-2xl bg-[#D6B47A] px-6 font-black uppercase tracking-[0.14em] text-black transition-all hover:scale-[1.01] lg:h-12 lg:rounded-xl lg:tracking-[0.16em]"
        >
          <Plus className="h-5 w-5" />
          Novo cliente
        </button>
      </div>

      {selectedCliente && (
        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.025] lg:hidden">
          <ClientProfileHeader cliente={selectedCliente} onClose={() => setSelectedCliente(null)} onEdit={handleEditSelectedClient} />
          <ClientActivityTabs cliente={selectedCliente} />
        </div>
      )}

      <div className={`${selectedCliente ? 'hidden' : ''} overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.025] lg:hidden`}>
        <div className="border-b border-white/8 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex min-w-0 gap-3 overflow-x-auto pr-2">
              <button className="border-b-2 border-[#D6B47A] px-2 pb-4 text-sm font-black uppercase tracking-[0.16em] text-[#D6B47A]">
                Lista ({clientes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSegment(activeSegment === 'fieis' ? 'all' : 'fieis')}
                className="px-2 pb-4 text-sm font-black uppercase tracking-[0.16em] text-white/45"
              >
                Grupos
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_64px] gap-3">
            <div className="relative">
              <Search className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-white/35" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar cliente..."
                className="h-16 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-14 pr-4 text-base text-white outline-none placeholder:text-white/35 focus:border-[#D6B47A]/40"
              />
            </div>
            <button
              type="button"
              onClick={() => setActiveSegment(prev => prev === 'all' ? 'novos' : prev === 'novos' ? 'fieis' : prev === 'fieis' ? 'ausentes' : 'all')}
              className="flex h-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/55"
            >
              <Filter className="h-7 w-7" />
            </button>
          </div>
        </div>

        {segmented.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center px-8 py-14 text-center">
            <div className="relative">
              <div className="flex h-36 w-36 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/40">
                <Users className="h-16 w-16" />
              </div>
              <span className="absolute -bottom-2 -right-2 flex h-14 w-14 items-center justify-center rounded-full border border-[#D6B47A]/25 bg-[#D6B47A]/10 text-[#D6B47A]">
                <Search className="h-7 w-7" />
              </span>
            </div>
            <h3 className="mt-10 text-2xl font-black text-white">Nenhum cliente encontrado</h3>
            <p className="mt-4 max-w-xs text-lg leading-relaxed text-white/50">Adicione seu primeiro cliente ou ajuste os filtros para encontrar resultados.</p>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-8 flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#D6B47A]/12 px-7 text-sm font-black uppercase tracking-[0.18em] text-[#D6B47A]"
            >
              <Plus className="h-5 w-5" />
              Novo cliente
            </button>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {segmented.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCliente(c)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4 text-left active:border-[#D6B47A]/40"
              >
                <span className="flex min-w-0 items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#D6B47A] text-xl font-black text-black">
                    {c.nome?.charAt(0)?.toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-black uppercase text-white">{c.nome}</span>
                    <span className="block truncate text-sm text-white/45">{c.telefone || c.email || 'Sem contato'}</span>
                    <span className="mt-1 block text-xs font-bold text-white/35">
                      {(c.agendamentos?.length || 0)} agendamento{(c.agendamentos?.length || 0) === 1 ? '' : 's'}
                    </span>
                  </span>
                </span>
                <span className="text-sm font-black text-[#D6B47A]">{money(c.receitaTotal || 0)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="hidden min-h-[680px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] lg:grid lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <aside className={`border-r border-white/8 ${selectedCliente ? 'hidden lg:flex' : 'flex'} flex-col`}>
          <div className="border-b border-white/8 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex gap-1">
                {[
                  { id: 'all', label: `Lista (${clientes.length})` },
                  { id: 'fieis', label: 'Grupos' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSegment(tab.id as Segment)}
                    className={`px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] ${
                      activeSegment === tab.id ? 'border-b-2 border-[#D6B47A] text-[#D6B47A]' : 'text-white/45'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAddForm(true)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D6B47A] text-black">
                <UserPlus className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_48px] gap-2">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar cliente..."
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-3 text-sm text-white outline-none focus:border-[#D6B47A]/40"
                />
              </div>
              <button type="button" onClick={() => setActiveSegment(prev => prev === 'all' ? 'novos' : prev === 'novos' ? 'fieis' : prev === 'fieis' ? 'ausentes' : 'all')} className="flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55">
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-4">
            {segmented.length === 0 ? (
              <div className="py-20 text-center text-sm text-white/35">Nenhum cliente encontrado.</div>
            ) : (
              'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => {
                const group = segmented.filter(c => c.nome?.toUpperCase().startsWith(letter));
                if (!group.length) return null;
                return (
                  <div key={letter} className="space-y-2">
                    <p className="px-2 text-[11px] font-black uppercase text-white/35">{letter}</p>
                    {group.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCliente(c)}
                        className={`flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition-all ${
                          selectedCliente?.id === c.id
                            ? 'border-[#D6B47A]/30 bg-[#D6B47A]/10'
                            : 'border-white/8 bg-white/[0.025] hover:bg-white/[0.055]'
                        }`}
                      >
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl font-black ${
                          selectedCliente?.id === c.id ? 'bg-[#D6B47A] text-black' : 'bg-white/[0.06] text-white/70'
                        }`}>
                          {c.nome?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-black uppercase text-white">{c.nome}</p>
                          {c.bloqueado && <p className="text-[10px] font-black uppercase tracking-widest text-[#ff8a8a]">Bloqueado</p>}
                          <p className="truncate text-sm text-white/45">{c.telefone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-white/8 p-4 text-sm text-white/45">
            Mostrando 1 a {segmented.length} de {clientes.length} clientes
          </div>
        </aside>

        <main className={`min-w-0 ${!selectedCliente ? 'hidden lg:block' : ''}`}>
          {selectedCliente ? (
            <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0 overflow-y-auto p-5 lg:p-8">
                <ClientProfileHeader cliente={selectedCliente} onClose={() => setSelectedCliente(null)} onEdit={handleEditSelectedClient} />
                <ClientActivityTabs cliente={selectedCliente} />
              </div>

              <aside className="hidden border-l border-white/8 p-6 lg:block">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <h3 className="mb-5 text-[12px] font-black uppercase tracking-[0.24em] text-white/65">Resumo geral</h3>
                  <SummaryRow label="Agendamentos" value={summary?.agendamentos ?? 0} color="accent" />
                  <SummaryRow label="Nao comparecimentos" value={summary?.ausencias ?? 0} color="yellow" />
                  <SummaryRow label="Cancelamentos" value={summary?.cancelamentos ?? 0} color="red" />
                  <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-4">
                    <span className="text-white/60">Receita total</span>
                    <span className="font-black text-[#D6B47A]">{money(summary?.receita || 0)}</span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <h3 className="mb-4 text-[12px] font-black uppercase tracking-[0.24em] text-white/65">Acoes rapidas</h3>
                  <div className="grid gap-2">
                    <QuickAction icon={Mail} label="Enviar e-mail" onClick={() => selectedCliente.email && window.open(`mailto:${selectedCliente.email}`)} />
                    <QuickAction icon={Phone} label="Chamar" onClick={() => selectedCliente.telefone && window.open(`tel:${selectedCliente.telefone}`)} />
                    <QuickAction icon={CalendarDays} label="Novo agendamento" onClick={() => router.push('/gestao/agenda')} />
                    <QuickAction icon={MoreHorizontal} label="Editar dados" onClick={handleEditSelectedClient} />
                    <QuickAction icon={MoreHorizontal} label={selectedCliente.bloqueado ? 'Liberar cliente' : 'Bloquear cliente'} onClick={handleToggleBlockSelectedClient} />
                  </div>
                </div>
              </aside>
            </div>
          ) : (
            <div className="flex h-full min-h-[560px] flex-col items-center justify-center text-center text-white/25">
              <Users className="mb-6 h-16 w-16" />
              <h3 className="text-2xl font-black uppercase">Selecione um cliente</h3>
              <p className="mt-2 text-sm">Escolha alguem da lista para ver detalhes.</p>
            </div>
          )}
        </main>
      </div>

      {showAddForm && (
        <ClientForm
          onClose={() => setShowAddForm(false)}
          onSave={handleSaveClient}
        />
      )}
    </div>
  );
}

function SummaryRow({ label, value, color }: any) {
  const colors: Record<string, string> = {
    accent: 'text-[#D6B47A]',
    yellow: 'text-yellow-300',
    red: 'text-[#ff4d4d]',
  };
  return (
    <div className="flex items-center justify-between border-b border-white/8 py-3">
      <span className="text-white/60">{label}</span>
      <span className={`font-black ${colors[color]}`}>{value}</span>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: any) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-4 py-3 text-left font-bold text-white/70 hover:bg-white/[0.07]">
      <Icon className="h-4 w-4 text-[#D6B47A]" />
      {label}
    </button>
  );
}
