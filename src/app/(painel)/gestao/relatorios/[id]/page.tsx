/* eslint-disable */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ReportTable } from '@/components/relatorios/ReportTable';
import {
  appointmentBarber,
  appointmentClient,
  appointmentDate,
  appointmentService,
  appointmentValue,
  isCancelStatus,
  isDoneStatus,
  isNoShowStatus,
  money,
  statusLabel,
} from '@/lib/reportUtils';
import { useRelatoriosContext } from '../layout';

const REPORTS: Record<string, { title: string; subtitle: string; back: string; kind: string }> = {
  'lista-clientes': { title: 'Lista de clientes', subtitle: 'Clientes cadastrados no periodo', back: '/gestao/relatorios/clientes', kind: 'clients' },
  'novos-clientes': { title: 'Novos clientes', subtitle: 'Clientes adquiridos recentemente', back: '/gestao/relatorios/clientes', kind: 'clients' },
  'nao-compareceram': { title: 'Nao compareceram', subtitle: 'Agendamentos com ausencia', back: '/gestao/relatorios/clientes', kind: 'noshow' },
  'lista-vendas': { title: 'Lista de vendas', subtitle: 'Transacoes e vendas efetuadas', back: '/gestao/relatorios/receita', kind: 'sales' },
  'vendas-servico': { title: 'Vendas por servico', subtitle: 'Receita agrupada por servico', back: '/gestao/relatorios/receita', kind: 'service-sales' },
  'comissoes': { title: 'Comissoes', subtitle: 'Comissao estimada por profissional', back: '/gestao/relatorios/equipe', kind: 'team' },
  'horas-trabalhadas': { title: 'Horas trabalhadas', subtitle: 'Volume de atendimentos por profissional', back: '/gestao/relatorios/equipe', kind: 'team' },
  'agendamentos-servico': { title: 'Agendamentos por servico', subtitle: 'Agendamentos agrupados por servico', back: '/gestao/relatorios/agendamentos', kind: 'appointments' },
  'agendamentos-funcionario': { title: 'Agendamentos por funcionario', subtitle: 'Agendamentos agrupados por profissional', back: '/gestao/relatorios/agendamentos', kind: 'appointments' },
  'estoque-disponivel': { title: 'Estoque disponivel', subtitle: 'Produtos com saldo positivo', back: '/gestao/relatorios/estoque', kind: 'stock-available' },
  'estoque-baixo': { title: 'Estoque baixo', subtitle: 'Produtos com poucas unidades', back: '/gestao/relatorios/estoque', kind: 'stock-low' },
  'estoque-completo': { title: 'Relatorio completo de estoque', subtitle: 'Inventario total de produtos', back: '/gestao/relatorios/estoque', kind: 'stock' },
  'caixa-registradora': { title: 'Caixa registradora', subtitle: 'Sessoes de caixa abertas e fechadas', back: '/gestao/relatorios/fluxo-caixa', kind: 'cash' },
  'transacoes-caixa': { title: 'Transacoes de caixa', subtitle: 'Movimentacoes financeiras do periodo', back: '/gestao/relatorios/fluxo-caixa', kind: 'sales' },
};

export default function GenericReportPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;
  const config = REPORTS[reportId];
  const context = useRelatoriosContext();

  useEffect(() => {
    if (!config) router.push('/gestao/relatorios/painel');
  }, [config, router]);

  const data = useMemo(() => {
    if (!config) return [];
    const { agendamentos, clientesNovos, estoque, caixaSessoes, receitaMensal } = context;

    if (config.kind === 'clients') return clientesNovos;
    if (config.kind === 'noshow') return agendamentos.filter((item: any) => isNoShowStatus(item.status));
    if (config.kind === 'sales') return receitaMensal.length ? receitaMensal : agendamentos.filter((item: any) => isDoneStatus(item.status));
    if (config.kind === 'stock-available') return estoque.filter((item: any) => Number(item.estoque || 0) > 0);
    if (config.kind === 'stock-low') return estoque.filter((item: any) => Number(item.estoque || 0) <= 3);
    if (config.kind === 'stock') return estoque;
    if (config.kind === 'cash') return caixaSessoes;

    if (config.kind === 'team') {
      const map = new Map<string, { nome: string; reservas: number; receita: number; comissao: number }>();
      agendamentos.forEach((item: any) => {
        if (isCancelStatus(item.status)) return;
        const nome = appointmentBarber(item);
        const current = map.get(nome) || { nome, reservas: 0, receita: 0, comissao: 0 };
        const value = appointmentValue(item);
        map.set(nome, { nome, reservas: current.reservas + 1, receita: current.receita + value, comissao: current.comissao + value * 0.5 });
      });
      return Array.from(map.values());
    }

    if (config.kind === 'service-sales') {
      const map = new Map<string, { servico: string; quantidade: number; receita: number }>();
      agendamentos.forEach((item: any) => {
        if (isCancelStatus(item.status)) return;
        const servico = appointmentService(item);
        const current = map.get(servico) || { servico, quantidade: 0, receita: 0 };
        map.set(servico, { servico, quantidade: current.quantidade + 1, receita: current.receita + appointmentValue(item) });
      });
      return Array.from(map.values());
    }

    return agendamentos;
  }, [config, context]);

  if (!config) return null;

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
      <div className="flex items-center gap-4 border-b border-white/8 pb-5">
        <Link href={config.back} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white hover:bg-white/[0.08]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h3 className="text-xl font-black uppercase tracking-[0.14em] text-white">{config.title}</h3>
          <p className="mt-1 text-sm text-white/45">{config.subtitle} - {context.formattedLabel}</p>
        </div>
      </div>

      <ReportTable columns={columnsFor(config.kind)} data={data} />
    </div>
  );
}

function columnsFor(kind: string) {
  if (kind === 'clients') {
    return [
      { header: 'Nome', cell: (row: any) => <span className="font-black text-white">{row.nome}</span> },
      { header: 'Cadastro', cell: (row: any) => row.created_at ? new Date(row.created_at).toLocaleDateString('pt-BR') : '-' },
    ];
  }

  if (kind.startsWith('stock')) {
    return [
      { header: 'Produto', cell: (row: any) => <span className="font-black text-white">{row.nome}</span> },
      { header: 'Estoque', align: 'right' as const, cell: (row: any) => row.estoque || 0 },
      { header: 'Preco', align: 'right' as const, cell: (row: any) => money(row.valor_venda) },
      { header: 'Total', align: 'right' as const, cell: (row: any) => money(Number(row.valor_venda || 0) * Number(row.estoque || 0)) },
    ];
  }

  if (kind === 'cash') {
    return [
      { header: 'Abertura', cell: (row: any) => new Date(row.aberto_em || row.created_at).toLocaleString('pt-BR') },
      { header: 'Fechamento', cell: (row: any) => row.fechado_em ? new Date(row.fechado_em).toLocaleString('pt-BR') : '-' },
      { header: 'Status', cell: (row: any) => row.status },
      { header: 'Saldo inicial', align: 'right' as const, cell: (row: any) => money(row.saldo_inicial) },
      { header: 'Saldo final', align: 'right' as const, cell: (row: any) => money(row.saldo_final) },
    ];
  }

  if (kind === 'team') {
    return [
      { header: 'Profissional', cell: (row: any) => <span className="font-black text-white">{row.nome}</span> },
      { header: 'Reservas', align: 'right' as const, cell: (row: any) => row.reservas },
      { header: 'Receita', align: 'right' as const, cell: (row: any) => money(row.receita) },
      { header: 'Comissao', align: 'right' as const, cell: (row: any) => money(row.comissao) },
    ];
  }

  if (kind === 'service-sales') {
    return [
      { header: 'Servico', cell: (row: any) => <span className="font-black text-white">{row.servico}</span> },
      { header: 'Quantidade', align: 'right' as const, cell: (row: any) => row.quantidade },
      { header: 'Receita', align: 'right' as const, cell: (row: any) => money(row.receita) },
    ];
  }

  if (kind === 'sales') {
    return [
      { header: 'Data', cell: (row: any) => row.data ? new Date(row.data).toLocaleString('pt-BR') : new Date(appointmentDate(row)).toLocaleString('pt-BR') },
      { header: 'Descricao', cell: (row: any) => appointmentService(row) },
      { header: 'Valor', align: 'right' as const, cell: (row: any) => money(row.valor_total ?? appointmentValue(row)) },
    ];
  }

  return [
    { header: 'Data', cell: (row: any) => new Date(appointmentDate(row)).toLocaleString('pt-BR') },
    { header: 'Cliente', cell: (row: any) => appointmentClient(row) },
    { header: 'Servico', cell: (row: any) => appointmentService(row) },
    { header: 'Profissional', cell: (row: any) => appointmentBarber(row) },
    { header: 'Status', cell: (row: any) => statusLabel(row.status) },
    { header: 'Valor', align: 'right' as const, cell: (row: any) => money(appointmentValue(row)) },
  ];
}
