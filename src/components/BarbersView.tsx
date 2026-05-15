/* eslint-disable */
'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  CalendarCheck,
  ChevronDown,
  KeyRound,
  MoreVertical,
  Pencil,
  Percent,
  Search,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import { BarberFormModal } from './BarberFormModal';
import type { DashboardStats } from '@/hooks/useDashboardData';

interface BarbersViewProps {
  barbers: any[];
  barbeariaId: string | null;
  refreshData: () => void;
  loading: boolean;
  stats?: DashboardStats;
  accessPanel?: ReactNode;
}

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

function performanceLabel(performance?: { appointments: number; completed: number; canceled: number }) {
  if (!performance || performance.appointments === 0) return { label: 'Sem dados', className: 'text-white/45' };
  const completionRate = performance.completed / performance.appointments;
  if (completionRate >= 0.8) return { label: 'Excelente', className: 'text-[#D6B47A]' };
  if (completionRate >= 0.5) return { label: 'Muito bom', className: 'text-yellow-300' };
  return { label: 'Em acompanhamento', className: 'text-blue-400' };
}

export function BarbersView({ barbers, barbeariaId, refreshData, loading, stats, accessPanel }: BarbersViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('Profissionais');
  const [onlyActive, setOnlyActive] = useState(true);
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    return barbers
      .filter(b => b.nome?.toLowerCase().includes(search.toLowerCase()))
      .filter(b => !onlyActive || b.ativo !== false)
      .sort((a, b) => sortAsc ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome));
  }, [barbers, search, onlyActive, sortAsc]);

  const activeCount = barbers.filter(b => b.ativo !== false).length;
  const avgCommission = activeCount
    ? Math.round(barbers.reduce((acc, b) => acc + Number(b.comissao || 0), 0) / activeCount)
    : 0;
  const appointmentsToday = stats?.appointmentsToday || 0;
  const monthRevenue = stats?.monthRevenue || 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#D6B47A] border-t-transparent" />
      </div>
    );
  }

  if (!barbeariaId) return null;

  function openCreate() {
    setEditingBarber(null);
    setIsModalOpen(true);
  }

  function openEdit(barber: any) {
    setEditingBarber(barber);
    setIsModalOpen(true);
  }

  return (
    <div className="space-y-6 pb-10 lg:space-y-8">
      <BarberFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refreshData}
        barbeariaId={barbeariaId}
        editingBarber={editingBarber}
      />

      <div className="flex flex-col gap-5 border-b border-white/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
          <h2 className="text-[2.25rem] font-black uppercase leading-none tracking-tight text-white sm:text-4xl">Gestao de equipe</h2>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.22em] text-white/45 sm:text-sm sm:tracking-[0.25em]">
            Profissionais, acessos e permissoes
          </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            aria-label="Novo barbeiro"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#D6B47A]/30 bg-[#D6B47A]/10 text-[#D6B47A] shadow-[0_0_24px_rgba(214,180,122,0.12)] lg:hidden"
          >
            <UserRoundPlus className="h-8 w-8" />
          </button>
        </div>
        <button
          onClick={openCreate}
          className="flex h-16 items-center justify-center gap-4 rounded-2xl bg-gradient-to-r from-[#B8935F] to-[#E0C28D] px-6 text-sm font-black uppercase tracking-[0.22em] text-black transition-all hover:scale-[1.01] lg:h-12 lg:rounded-xl lg:text-base lg:normal-case lg:tracking-normal"
        >
          <UserRoundPlus className="h-5 w-5" />
          Novo Barbeiro
        </button>
      </div>

      <div className="flex gap-8 overflow-x-auto border-b border-white/8">
        {['Profissionais', 'Acessos', 'Permissoes', 'Funcoes'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-sm font-black uppercase tracking-[0.14em] ${
              activeTab === tab ? 'border-b-2 border-[#D6B47A] text-[#D6B47A]' : 'text-white/45 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <section className="space-y-5">
        <div>
          <h3 className="text-2xl font-black text-white">Equipe</h3>
          <p className="mt-1 text-white/55">Gerencie os profissionais, funcoes e comissoes da sua barbearia.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <TeamKpi icon={Users} label="Profissionais ativos" value={activeCount} hint="100% da equipe" />
          <TeamKpi icon={Percent} label="Comissao media" value={`${avgCommission}%`} hint="Entre os profissionais" />
          <TeamKpi icon={CalendarCheck} label="Agendamentos (hoje)" value={appointmentsToday} hint="Total da equipe" />
          <TeamKpi icon={BarChart3} label="Faturamento (mes)" value={money(monthRevenue)} hint="Total da equipe" />
        </div>
      </section>

      {activeTab === 'Profissionais' ? (
      <section className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_220px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar profissional..."
              className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-12 pr-4 text-white outline-none focus:border-[#D6B47A]/40 lg:rounded-xl"
            />
          </div>
          <button type="button" onClick={() => setOnlyActive(prev => !prev)} className="flex h-14 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 font-bold text-white/65 lg:rounded-xl">
            Status: {onlyActive ? 'Ativos' : 'Todos'}
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setSortAsc(prev => !prev)} className="flex h-14 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 font-bold text-white/65 lg:rounded-xl">
            Ordenar por: {sortAsc ? 'Nome A-Z' : 'Nome Z-A'}
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 lg:hidden">
          {filtered.length === 0 ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] px-6 py-14 text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/35">
                <Users className="h-11 w-11" />
              </div>
              <p className="mt-6 text-xl font-black text-white">Nenhum profissional encontrado</p>
              <p className="mt-2 text-sm leading-relaxed text-white/50">Adicione um barbeiro ou ajuste os filtros para encontrar resultados.</p>
              <button
                type="button"
                onClick={openCreate}
                className="mx-auto mt-6 flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A]/12 px-5 text-sm font-black uppercase tracking-[0.16em] text-[#D6B47A]"
              >
                <UserRoundPlus className="h-5 w-5" />
                Novo barbeiro
              </button>
            </div>
          ) : (
            filtered.map((barber) => {
              const perf = stats?.perBarber?.[barber.id];
              const label = performanceLabel(perf);

              return (
                <article key={barber.id} className="rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20">
                  <div className="flex items-start gap-4">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#D6B47A]/12 text-2xl font-black text-[#D6B47A]">
                      {barber.foto_url ? (
                        <img src={barber.foto_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        barber.nome?.charAt(0)?.toUpperCase()
                      )}
                      <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-[#D6B47A] ring-2 ring-[#111]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xl font-black text-white">{barber.nome}</p>
                          <p className="mt-1 truncate text-sm text-white/50">{barber.telefone || barber.titulo || 'Profissional'}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#D6B47A]/12 px-3 py-1 text-[11px] font-black text-[#D6B47A]">
                          Ativo
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Comissao</p>
                          <p className="mt-1 text-lg font-black text-[#D6B47A]">{barber.comissao}{barber.comissao_tipo === 'fixo' ? ' R$' : '%'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Desempenho</p>
                          <p className={`mt-1 truncate text-sm font-black ${label.className}`}>{label.label}</p>
                          <p className="text-xs text-white/45">{perf?.appointments || 0} atend.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                    <div>
                      <span className="rounded-lg border border-[#D6B47A]/30 px-2 py-1 text-[10px] font-black uppercase text-[#D6B47A]">
                        Barbeiro
                      </span>
                      <p className="mt-1 text-xs text-white/45">{barber.titulo || 'Profissional'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(barber)} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-white/60 active:bg-white/[0.08]">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <Link href="/gestao/relatorios/equipe" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-white/60 active:bg-white/[0.08]">
                        <BarChart3 className="h-4 w-4" />
                      </Link>
                      <button type="button" onClick={() => openEdit(barber)} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-white/60 active:bg-white/[0.08]">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] lg:block">
          <div className="hidden grid-cols-[minmax(240px,1fr)_180px_140px_200px_120px_160px] border-b border-white/8 px-6 py-4 text-[11px] font-black uppercase tracking-[0.14em] text-white/45 lg:grid">
            <span>Profissional</span>
            <span>Funcao</span>
            <span>Comissao</span>
            <span>Desempenho</span>
            <span>Status</span>
            <span className="text-right">Acoes</span>
          </div>

          <div className="divide-y divide-white/8">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-white/45">Nenhum barbeiro encontrado.</div>
            ) : (
              filtered.map((barber) => (
                <div
                  key={barber.id}
                  className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(240px,1fr)_180px_140px_200px_120px_160px] lg:items-center lg:px-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[#D6B47A]/12 font-black text-[#D6B47A]">
                      {barber.foto_url ? (
                        <img src={barber.foto_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        barber.nome?.charAt(0)?.toUpperCase()
                      )}
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#D6B47A] ring-2 ring-[#111]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-white">{barber.nome}</p>
                        {barber.destaque_label && (
                          <span className="rounded-full bg-[#D6B47A]/12 px-2 py-0.5 text-[10px] font-black text-[#D6B47A]">
                            {barber.destaque_label}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-white/50">{barber.telefone || barber.titulo || 'Sem telefone cadastrado'}</p>
                    </div>
                  </div>

                  <div>
                    <span className="rounded-lg border border-[#D6B47A]/30 px-2 py-1 text-[11px] font-black uppercase text-[#D6B47A]">
                      Barbeiro
                    </span>
                    <p className="mt-1 text-sm text-white/50">{barber.titulo || 'Profissional'}</p>
                  </div>

                  <div>
                    <p className="text-xl font-black text-[#D6B47A]">{barber.comissao}{barber.comissao_tipo === 'fixo' ? ' R$' : '%'}</p>
                    <p className="text-sm text-white/50">Comissao</p>
                  </div>

                  <div>
                    {(() => {
                      const perf = stats?.perBarber?.[barber.id];
                      const label = performanceLabel(perf);
                      return (
                        <>
                          <p className={`font-black ${label.className}`}>{label.label}</p>
                          <p className="text-sm text-white/50">{perf?.appointments || 0} atendimentos no mes</p>
                        </>
                      );
                    })()}
                  </div>

                  <div>
                    <span className="rounded-full bg-[#D6B47A]/12 px-3 py-1 text-xs font-black text-[#D6B47A]">
                      Ativo
                    </span>
                  </div>

                  <div className="flex justify-start gap-2 lg:justify-end">
                    <button onClick={() => openEdit(barber)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/55 hover:bg-white/[0.08] hover:text-white">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <Link href="/gestao/relatorios/equipe" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/55 hover:bg-white/[0.08]">
                      <BarChart3 className="h-4 w-4" />
                    </Link>
                    <button type="button" onClick={() => openEdit(barber)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/55 hover:bg-white/[0.08]">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-white/50">
          <span>Mostrando 1 a {filtered.length} de {barbers.length} profissionais</span>
          <span className="rounded-xl border border-[#D6B47A]/40 px-4 py-2 font-black text-[#D6B47A]">1</span>
        </div>
      </section>
      ) : activeTab === 'Acessos' ? (
        <AccessSection barbers={barbers} accessPanel={accessPanel} />
      ) : activeTab === 'Permissoes' ? (
        <PermissionsSection />
      ) : (
        <RolesSection barbers={barbers} />
      )}
    </div>
  );
}

function TeamKpi({ icon: Icon, label, value, hint }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D6B47A]/10 text-[#D6B47A] lg:h-14 lg:w-14 lg:rounded-full">
          <Icon className="h-6 w-6 lg:h-7 lg:w-7" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45 lg:text-[11px] lg:tracking-[0.16em]">{label}</p>
          <p className="mt-1 text-2xl font-black text-[#D6B47A]">{value}</p>
          <p className="mt-1 text-xs text-white/55 lg:text-sm">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function AccessSection({ barbers, accessPanel }: { barbers: any[]; accessPanel?: ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-[#D6B47A]" />
            <div>
              <h3 className="text-xl font-black text-white">Acessos profissionais</h3>
              <p className="mt-1 text-sm text-white/50">Controle quem consegue entrar no app profissional.</p>
            </div>
          </div>
          <div className="mt-5 divide-y divide-white/8">
            {barbers.length === 0 ? (
              <p className="py-8 text-sm text-white/45">Nenhum profissional cadastrado.</p>
            ) : barbers.map(barber => (
              <div key={barber.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_160px_180px] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-black text-white">{barber.nome}</p>
                  <p className="mt-1 truncate text-sm text-white/45">{barber.email_acesso || barber.email || 'Sem e-mail de acesso vinculado'}</p>
                </div>
                <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-black uppercase text-white/55">
                  {barber.barbeiro_id || barber.auth_user_id || barber.user_id ? 'Acesso ativo' : 'Sem acesso'}
                </span>
                <span className="text-sm text-white/45">Convite via aba de convites</span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0">{accessPanel}</div>
      </div>
    </section>
  );
}

function PermissionsSection() {
  const roles = [
    { role: 'Proprietario / Owner', access: 'Acesso completo da barbearia, configuracoes, equipe, caixa, relatorios e convites.' },
    { role: 'Admin', access: 'Gestao operacional ampla, com limites para propriedade e configuracoes sensiveis.' },
    { role: 'Gerente', access: 'Agenda, clientes, equipe operacional e relatorios basicos.' },
    { role: 'Barbeiro', access: 'Minha agenda, aceite/recusa dos proprios agendamentos, bloqueios proprios e meus ganhos.' },
    { role: 'Funcionario', access: 'Acesso operacional limitado conforme permissao configurada.' },
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {roles.map(item => (
        <article key={item.role} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#D6B47A]">Permissao</p>
          <h3 className="mt-2 text-xl font-black text-white">{item.role}</h3>
          <p className="mt-3 text-sm leading-relaxed text-white/55">{item.access}</p>
        </article>
      ))}
    </section>
  );
}

function RolesSection({ barbers }: { barbers: any[] }) {
  const grouped = barbers.reduce<Record<string, number>>((acc, barber) => {
    const key = barber.titulo || 'Barbeiro';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <h3 className="text-xl font-black text-white">Funcoes da equipe</h3>
        <p className="mt-2 text-sm text-white/50">Acompanhe cargos, titulos e comissoes configuradas nos profissionais.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(grouped).map(([role, total]) => (
          <article key={role} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-3xl font-black text-[#D6B47A]">{total}</p>
            <h4 className="mt-2 font-black text-white">{role}</h4>
            <p className="mt-1 text-sm text-white/45">Profissionais nesta funcao</p>
          </article>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="grid grid-cols-[minmax(0,1fr)_160px_140px] border-b border-white/8 px-5 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/45">
          <span>Profissional</span>
          <span>Funcao</span>
          <span>Comissao</span>
        </div>
        {barbers.map(barber => (
          <div key={barber.id} className="grid grid-cols-[minmax(0,1fr)_160px_140px] gap-3 border-b border-white/8 px-5 py-4 last:border-b-0">
            <span className="truncate font-black text-white">{barber.nome}</span>
            <span className="truncate text-white/55">{barber.titulo || 'Barbeiro'}</span>
            <span className="font-black text-[#D6B47A]">{barber.comissao}{barber.comissao_tipo === 'fixo' ? ' R$' : '%'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
