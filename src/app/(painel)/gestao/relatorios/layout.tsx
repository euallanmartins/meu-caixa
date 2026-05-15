/* eslint-disable */
'use client';

import React, { createContext, Suspense, useContext, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, ChevronDown, Download } from 'lucide-react';
import { useDateFilter } from '@/hooks/useDateFilter';
import { useRelatorios } from '@/hooks/useRelatorios';
import { useExportPDF } from '@/hooks/useExportPDF';
import { supabase } from '@/lib/supabase';
import {
  appointmentBarber,
  appointmentClient,
  appointmentDate,
  appointmentService,
  appointmentValue,
  isCancelStatus,
  money,
  statusLabel,
} from '@/lib/reportUtils';
import { DateFilterModal } from '@/components/relatorios/DateFilterModal';

export type RelatoriosContextType = ReturnType<typeof useDateFilter> & ReturnType<typeof useRelatorios> & {
  barbeariaId?: string;
};

const RelatoriosContext = createContext<RelatoriosContextType | null>(null);

export const useRelatoriosContext = () => {
  const context = useContext(RelatoriosContext);
  if (!context) throw new Error('Must be used within RelatoriosProvider');
  return context;
};

const TABS = [
  { id: 'painel', label: 'Geral', href: '/gestao/relatorios/painel' },
  { id: 'receita', label: 'Financeiro', href: '/gestao/relatorios/receita' },
  { id: 'clientes', label: 'Clientes', href: '/gestao/relatorios/clientes' },
  { id: 'agendamentos', label: 'Servicos', href: '/gestao/relatorios/agendamentos' },
  { id: 'fluxo', label: 'Fluxo de Caixa', href: '/gestao/relatorios/fluxo-caixa' },
  { id: 'estoque', label: 'Estoque', href: '/gestao/relatorios/estoque' },
  { id: 'equipe', label: 'Equipe', href: '/gestao/relatorios/equipe' },
];

function RelatoriosContent({ children }: { children: React.ReactNode }) {
  const dateFilter = useDateFilter();
  const pathname = usePathname();
  const { exportToPDF } = useExportPDF();
  const [barbeariaId, setBarbeariaId] = React.useState<string>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  React.useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('barbearia_id')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.barbearia_id) setBarbeariaId(profile.barbearia_id);
    }
    getUser();
  }, []);

  const relatorios = useRelatorios({
    barbeariaId,
    inicioMes: dateFilter.startDate,
    fimMes: dateFilter.endDate,
  });

  const providerValue = { ...dateFilter, ...relatorios, barbeariaId };
  const pdfConfig = useMemo(
    () => buildPdfConfig(pathname, providerValue, dateFilter.formattedLabel),
    [pathname, providerValue, dateFilter.formattedLabel]
  );

  async function handleDownloadPDF() {
    if (!pdfConfig || pdfConfig.data.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      await exportToPDF(pdfConfig);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <RelatoriosContext.Provider value={providerValue}>
      <div className="max-w-full space-y-7 overflow-hidden pb-10 animate-in fade-in duration-500">
        <header className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-black uppercase tracking-tight text-white sm:text-4xl">
              Estatisticas e relatorios
            </h2>
            <p className="mt-2 text-base text-white/50">Acompanhe o desempenho da sua barbearia</p>
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex h-12 min-w-0 items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition-all hover:bg-white/[0.07] sm:px-5 sm:tracking-[0.12em]"
            >
              <Calendar className="h-4 w-4 text-white/60" />
              {dateFilter.formattedLabel}
              <ChevronDown className="h-4 w-4 text-white/40" />
            </button>
            <button
              id="download-pdf-btn"
              onClick={handleDownloadPDF}
              disabled={!pdfConfig || pdfConfig.data.length === 0 || isExporting}
              title={!pdfConfig || pdfConfig.data.length === 0 ? 'Sem dados para exportar neste periodo' : 'Baixar relatorio em PDF'}
              className="flex h-12 min-w-0 items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition-all hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-35 sm:px-5 sm:tracking-[0.12em]"
            >
              <Download className="h-4 w-4 text-white/60" />
              {isExporting ? 'Gerando...' : 'Baixar PDF'}
            </button>
          </div>
        </header>

        <nav className="flex max-w-full gap-5 overflow-x-auto border-b border-white/10 no-scrollbar sm:gap-8">
          {TABS.map(tab => {
            const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`shrink-0 border-b-2 px-1 pb-4 text-[12px] font-black uppercase tracking-[0.14em] transition-all ${
                  isActive ? 'border-[#D6B47A] text-[#D6B47A]' : 'border-transparent text-white/45 hover:text-white'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>

      <DateFilterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentMode={dateFilter.mode}
        startDate={dateFilter.startDate}
        endDate={dateFilter.endDate}
        onApply={(start, end, mode) => dateFilter.updateRange(start, end, mode)}
      />
    </RelatoriosContext.Provider>
  );
}

function formatDate(dateLike?: string) {
  if (!dateLike) return '-';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function normalizeAppointment(item: any) {
  return {
    data: formatDate(appointmentDate(item)),
    cliente: appointmentClient(item),
    servico: appointmentService(item),
    profissional: appointmentBarber(item),
    status: statusLabel(item.status),
    valor: money(appointmentValue(item)),
  };
}

function groupByService(agendamentos: any[]) {
  const map = new Map<string, { servico: string; reservas: number; valor: number }>();
  agendamentos.forEach((item) => {
    if (isCancelStatus(item.status)) return;
    const servico = appointmentService(item);
    const current = map.get(servico) || { servico, reservas: 0, valor: 0 };
    map.set(servico, {
      servico,
      reservas: current.reservas + 1,
      valor: current.valor + appointmentValue(item),
    });
  });
  return Array.from(map.values()).map(row => ({
    ...row,
    valor: money(row.valor),
  }));
}

function groupByStatus(agendamentos: any[]) {
  const map = new Map<string, { status: string; quantidade: number; valor: number }>();
  agendamentos.forEach((item) => {
    const status = statusLabel(item.status);
    const current = map.get(status) || { status, quantidade: 0, valor: 0 };
    map.set(status, {
      status,
      quantidade: current.quantidade + 1,
      valor: current.valor + appointmentValue(item),
    });
  });
  return Array.from(map.values()).map(row => ({
    ...row,
    valor: money(row.valor),
  }));
}

function groupTeam(funcionarios: any[], agendamentos: any[], receitaMensal: any[]) {
  return funcionarios.map((funcionario: any) => {
    const apps = agendamentos.filter((item: any) => item.barbeiros?.id === funcionario.id || item.barbeiro_id === funcionario.id);
    const receita = receitaMensal
      .filter((item: any) => item.barbeiro_id === funcionario.id)
      .reduce((sum: number, item: any) => sum + Number(item.valor_total || 0), 0);
    return {
      profissional: funcionario.nome,
      agendamentos: apps.length,
      receita: money(receita),
      comissao: funcionario.comissao_tipo === 'fixo' ? money(Number(funcionario.comissao || 0)) : `${Number(funcionario.comissao || 0)}%`,
      status: funcionario.ativo === false ? 'Inativo' : 'Ativo',
    };
  });
}

function buildPdfConfig(pathname: string, relatorios: RelatoriosContextType, periodo: string) {
  const baseSubtitle = `Periodo: ${periodo}`;
  const route = pathname.split('/').filter(Boolean).pop() || 'painel';
  const {
    agendamentos,
    clientesNovos,
    receitaMensal,
    estoque,
    caixaSessoes,
    funcionarios,
    estatisticas,
  } = relatorios;

  const configs: Record<string, { title: string; filename: string; headers: string[]; keys: string[]; data: any[] }> = {
    painel: {
      title: 'Relatorio geral',
      filename: 'relatorio-geral',
      headers: ['Indicador', 'Valor'],
      keys: ['indicador', 'valor'],
      data: [
        { indicador: 'Receita bruta', valor: estatisticas.receitaBruta },
        { indicador: 'Total de agendamentos', valor: estatisticas.totalAgendamentos },
        { indicador: 'Novos clientes', valor: estatisticas.novosClientes },
        { indicador: 'Transacoes', valor: receitaMensal.length },
        { indicador: 'Produtos em estoque', valor: estoque.length },
      ],
    },
    receita: {
      title: 'Relatorio financeiro',
      filename: 'relatorio-financeiro',
      headers: ['Data', 'Valor', 'Metodo de pagamento'],
      keys: ['data', 'valor', 'metodo'],
      data: receitaMensal.map((item: any) => ({
        data: formatDate(item.data),
        valor: money(Number(item.valor_total || 0)),
        metodo: item.transacao_pagamentos?.map((payment: any) => payment.metodo).join(' + ') || '-',
      })),
    },
    clientes: {
      title: 'Relatorio de clientes',
      filename: 'relatorio-clientes',
      headers: ['Cliente', 'Criado em'],
      keys: ['cliente', 'criado_em'],
      data: clientesNovos.map((item: any) => ({
        cliente: item.nome || '-',
        criado_em: formatDate(item.created_at),
      })),
    },
    agendamentos: {
      title: 'Relatorio de servicos',
      filename: 'relatorio-servicos',
      headers: ['Servico', 'Reservas', 'Valor'],
      keys: ['servico', 'reservas', 'valor'],
      data: groupByService(agendamentos),
    },
    'lista-agendamentos': {
      title: 'Lista de agendamentos',
      filename: 'lista-agendamentos',
      headers: ['Data', 'Cliente', 'Servico', 'Profissional', 'Status', 'Valor'],
      keys: ['data', 'cliente', 'servico', 'profissional', 'status', 'valor'],
      data: agendamentos.map(normalizeAppointment),
    },
    cancelados: {
      title: 'Agendamentos cancelados',
      filename: 'agendamentos-cancelados',
      headers: ['Data', 'Cliente', 'Servico', 'Profissional', 'Status', 'Valor'],
      keys: ['data', 'cliente', 'servico', 'profissional', 'status', 'valor'],
      data: agendamentos.filter((item: any) => isCancelStatus(item.status)).map(normalizeAppointment),
    },
    'resumo-servicos': {
      title: 'Resumo de servicos',
      filename: 'resumo-servicos',
      headers: ['Servico', 'Reservas', 'Valor'],
      keys: ['servico', 'reservas', 'valor'],
      data: groupByService(agendamentos),
    },
    'resumo-visitas': {
      title: 'Resumo de visitas',
      filename: 'resumo-visitas',
      headers: ['Status', 'Quantidade', 'Valor'],
      keys: ['status', 'quantidade', 'valor'],
      data: groupByStatus(agendamentos),
    },
    'fluxo-caixa': {
      title: 'Relatorio de fluxo de caixa',
      filename: 'relatorio-fluxo-caixa',
      headers: ['Abertura', 'Fechamento', 'Saldo inicial', 'Saldo final', 'Status'],
      keys: ['abertura', 'fechamento', 'saldo_inicial', 'saldo_final', 'status'],
      data: caixaSessoes.map((item: any) => ({
        abertura: formatDate(item.aberto_em || item.data_abertura || item.created_at),
        fechamento: formatDate(item.fechado_em),
        saldo_inicial: money(Number(item.saldo_inicial || item.valor_inicial || 0)),
        saldo_final: money(Number(item.saldo_final || 0)),
        status: item.status || '-',
      })),
    },
    estoque: {
      title: 'Relatorio de estoque',
      filename: 'relatorio-estoque',
      headers: ['Produto', 'Estoque', 'Valor unitario', 'Valor em estoque'],
      keys: ['produto', 'estoque', 'valor_unitario', 'valor_total'],
      data: estoque.map((item: any) => ({
        produto: item.nome || '-',
        estoque: Number(item.estoque || 0),
        valor_unitario: money(Number(item.valor_venda || 0)),
        valor_total: money(Number(item.valor_venda || 0) * Number(item.estoque || 0)),
      })),
    },
    equipe: {
      title: 'Relatorio de equipe',
      filename: 'relatorio-equipe',
      headers: ['Profissional', 'Agendamentos', 'Receita', 'Comissao', 'Status'],
      keys: ['profissional', 'agendamentos', 'receita', 'comissao', 'status'],
      data: groupTeam(funcionarios, agendamentos, receitaMensal),
    },
  };

  const config = configs[route] || configs.painel;
  return {
    filename: `${config.filename}_${new Date().getTime()}`,
    title: config.title,
    subtitle: baseSubtitle,
    headers: config.headers,
    keys: config.keys,
    data: config.data,
  };
}

export default function RelatoriosLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="m-6 h-20 animate-pulse rounded-3xl bg-white/5" />}>
      <RelatoriosContent>{children}</RelatoriosContent>
    </Suspense>
  );
}
