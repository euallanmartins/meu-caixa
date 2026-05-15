/* eslint-disable */
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Image as ImageIcon, Info, Package, CreditCard, ChevronRight } from 'lucide-react';

interface ActivityTabsProps {
  cliente: any;
}

type Tab = 'agendamentos' | 'fotos' | 'sobre' | 'produtos' | 'pagamentos';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export function ClientActivityTabs({ cliente }: ActivityTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('agendamentos');
  const [viewMode, setViewMode] = useState<'proximos' | 'anteriores'>('anteriores');

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'agendamentos', label: 'Agendamentos', icon: Calendar },
    { id: 'fotos', label: 'Fotos', icon: ImageIcon },
    { id: 'sobre', label: 'Sobre o cliente', icon: Info },
    { id: 'produtos', label: 'Produtos', icon: Package },
    { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard },
  ];

  const now = new Date();
  const sortedAgendamentos = [...(cliente.agendamentos || [])].sort((a, b) =>
    new Date(b.data_hora_inicio).getTime() - new Date(a.data_hora_inicio).getTime()
  );

  const visitas = Array.from(sortedAgendamentos.reduce((map: Map<string, any>, app: any) => {
    const key = app.idempotency_key || app.id;
    const startMs = new Date(app.data_hora_inicio).getTime();
    const endMs = new Date(app.data_hora_fim || app.data_hora_inicio).getTime();
    const serviceValue = Number(app.servicos?.valor ?? app.valor_estimado ?? 0);
    const serviceDuration = Number(app.servicos?.duracao_minutos || 0);
    const current = map.get(key) || {
      id: key,
      start: app.data_hora_inicio,
      end: app.data_hora_fim || app.data_hora_inicio,
      startMs,
      endMs,
      statuses: [],
      barbeiro: app.barbeiros?.nome || 'Nao atribuido',
      total: 0,
      duracao: 0,
      servicos: [],
      observacoes: app.observacoes || null,
    };

    current.startMs = Math.min(current.startMs, startMs);
    current.endMs = Math.max(current.endMs, Number.isFinite(endMs) ? endMs : startMs);
    current.start = new Date(current.startMs).toISOString();
    current.end = new Date(current.endMs).toISOString();
    current.total += serviceValue;
    current.duracao += serviceDuration;
    current.statuses.push(app.status);
    current.servicos.push({
      id: app.id,
      nome: app.servicos?.nome || 'Servico personalizado',
      valor: serviceValue,
      duracao: serviceDuration,
    });

    map.set(key, current);
    return map;
  }, new Map<string, any>()).values()).sort((a, b) => b.startMs - a.startMs);

  const futureStatuses = ['pendente', 'aceito', 'confirmado'];
  const proximos = visitas
    .filter(visit => visit.startMs >= now.getTime() && visit.statuses.some((status: string) => futureStatuses.includes(status)))
    .sort((a, b) => a.startMs - b.startMs);
  const anteriores = visitas.filter(visit => !proximos.some(next => next.id === visit.id));
  const displayed = viewMode === 'proximos' ? proximos : anteriores;

  const transactions = [...(cliente.transacoes || [])].sort((a, b) =>
    new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime()
  );

  const productSales = transactions.flatMap((transaction: any) =>
    (transaction.venda_produtos || []).map((sale: any) => ({
      id: `${transaction.id}-${sale.produtos?.nome || 'produto'}`,
      date: transaction.data,
      product: sale.produtos?.nome || 'Produto',
      quantity: Number(sale.quantidade || 1),
      total: Number(transaction.valor_total || 0),
    }))
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'atendido':
      case 'realizado':
      case 'concluido':
        return 'bg-[#D6B47A]/10 border-[#D6B47A]/20 text-[#D6B47A]';
      case 'confirmado':
      case 'aceito':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'pendente':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300';
      case 'cancelado':
      case 'recusado':
        return 'bg-red-500/10 border-red-500/20 text-red-500';
      case 'ausente':
      case 'nao_compareceu':
        return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      default:
        return 'bg-white/10 border-white/20 text-white/40';
    }
  };

  const getVisitStatus = (statuses: string[]) => {
    if (statuses.includes('pendente')) return 'pendente';
    if (statuses.includes('aceito')) return 'aceito';
    if (statuses.includes('confirmado')) return 'confirmado';
    if (statuses.some(status => ['atendido', 'realizado', 'concluido'].includes(status))) return 'concluido';
    if (statuses.includes('recusado')) return 'recusado';
    if (statuses.includes('cancelado')) return 'cancelado';
    return statuses[0] || 'sem_status';
  };

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a] lg:bg-transparent">
      <div className="no-scrollbar sticky top-0 z-10 flex items-center overflow-x-auto border-b border-white/5 bg-white/5 px-4 lg:bg-transparent">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto p-6 pb-24 lg:pb-6">
        {activeTab === 'agendamentos' && (
          <div className="space-y-6">
            <div className="flex w-fit items-center rounded-2xl border border-white/5 bg-white/5 p-1">
              <button
                onClick={() => setViewMode('proximos')}
                className={`rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'proximos' ? 'bg-white/10 text-white shadow-lg' : 'text-muted hover:text-white'}`}
              >
                Proximos ({proximos.length})
              </button>
              <button
                onClick={() => setViewMode('anteriores')}
                className={`rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'anteriores' ? 'bg-white/10 text-white shadow-lg' : 'text-muted hover:text-white'}`}
              >
                Anteriores ({anteriores.length})
              </button>
            </div>

            <div className="space-y-4">
              {displayed.length === 0 ? (
                <EmptyState label="Nenhum agendamento encontrado." />
              ) : (
                displayed.map((visit) => {
                  const dateObj = new Date(visit.start);
                  const mes = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                  const dia = dateObj.toLocaleDateString('pt-BR', { day: '2-digit' });
                  const hora = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const horaFim = new Date(visit.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const status = getVisitStatus(visit.statuses);

                  return (
                    <div key={visit.id} className="group grid gap-4 rounded-[2rem] border border-white/5 bg-white/5 p-5 transition-all hover:bg-white/10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-12 w-12 flex-col items-center justify-center rounded-2xl border border-white/5 bg-background/40 group-hover:border-accent/20">
                          <span className="text-[10px] font-black uppercase tracking-tighter text-muted">{mes}</span>
                          <span className="text-sm font-black text-white">{dia}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter ${getStatusStyle(status)}`}>
                              {status === 'concluido' ? 'Finalizado' : status}
                            </span>
                            <span className="text-[10px] font-black text-white/40">{hora} - {horaFim}</span>
                          </div>
                          <h5 className="mt-1 break-words text-xs font-black uppercase tracking-wide text-white">
                            {visit.servicos.map((servico: any) => servico.nome).join(' + ')}
                          </h5>
                          <span className="text-[10px] font-bold tracking-tight text-muted opacity-70">
                            {visit.barbeiro} {visit.duracao ? `- ${visit.duracao}min` : ''}
                          </span>
                          <div className="mt-3 grid gap-1.5">
                            {visit.servicos.map((servico: any) => (
                              <div key={servico.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/15 px-3 py-2 text-[11px]">
                                <span className="min-w-0 truncate font-bold text-white/65">{servico.nome}</span>
                                <span className="shrink-0 font-black text-[#D6B47A]">{formatMoney(servico.valor)}</span>
                              </div>
                            ))}
                          </div>
                          {visit.observacoes && (
                            <p className="mt-3 rounded-xl border border-white/5 bg-black/15 px-3 py-2 text-xs text-white/45">
                              {visit.observacoes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <span className="text-sm font-black text-white">{formatMoney(Number(visit.total || 0))}</span>
                        <button type="button" onClick={() => router.push('/gestao/agenda')} className="rounded-xl border border-white/5 bg-white/5 p-2 text-white/40 shadow-lg transition-all hover:bg-accent hover:text-black">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'sobre' && (
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="Nome completo" value={cliente.nome || 'Nao informado'} />
            <InfoCard label="Telefone" value={cliente.telefone || 'Nao informado'} />
            <InfoCard label="E-mail" value={cliente.email || 'Nao informado'} />
            <InfoCard
              label="Cliente desde"
              value={cliente.created_at ? new Date(cliente.created_at).toLocaleDateString('pt-BR') : 'Nao informado'}
            />
            <InfoCard label="Agendamentos" value={String(cliente.agendamentos?.length || 0)} />
            <InfoCard label="Receita total" value={formatMoney(cliente.receitaTotal || 0)} accent />
          </div>
        )}

        {activeTab === 'produtos' && (
          <div className="space-y-3">
            {productSales.length === 0 ? (
              <EmptyState label="Nenhum produto comprado por este cliente." />
            ) : productSales.map((sale: any) => (
              <div key={sale.id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                <div>
                  <p className="font-black text-white">{sale.product}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {new Date(sale.date).toLocaleDateString('pt-BR')} - {sale.quantity} unidade(s)
                  </p>
                </div>
                <p className="font-black text-[#D6B47A]">{formatMoney(sale.total)}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'pagamentos' && (
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <EmptyState label="Nenhum pagamento registrado para este cliente." />
            ) : transactions.map((transaction: any) => {
              const methods = transaction.transacao_pagamentos?.length
                ? transaction.transacao_pagamentos.map((payment: any) => payment.metodo).join(' + ')
                : 'Nao informado';
              const product = transaction.venda_produtos?.[0]?.produtos?.nome;
              const service = transaction.servicos?.nome;

              return (
                <div key={transaction.id} className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-4 sm:grid-cols-[minmax(0,1fr)_120px_120px] sm:items-center">
                  <div>
                    <p className="font-black text-white">{product ? `Venda: ${product}` : service || 'Venda registrada'}</p>
                    <p className="mt-1 text-xs text-white/45">
                      {transaction.data ? new Date(transaction.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data nao informada'}
                    </p>
                  </div>
                  <p className="text-sm font-bold capitalize text-white/60">{methods}</p>
                  <p className="font-black text-[#D6B47A] sm:text-right">{formatMoney(Number(transaction.valor_total || 0))}</p>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'fotos' && (
          <EmptyState label="Nenhuma foto registrada para este cliente." />
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className={`mt-2 break-words text-lg font-black ${accent ? 'text-[#D6B47A]' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/10 py-20 text-center text-white/30">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-white/10">
        <Info size={32} />
      </div>
      <p className="text-sm font-bold uppercase tracking-widest">{label}</p>
    </div>
  );
}
