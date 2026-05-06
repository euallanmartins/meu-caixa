/* eslint-disable */
'use client';

import { useMemo } from 'react';
import { Clock, ListChecks, Scissors, ShoppingBag, Users } from 'lucide-react';
import { AreaChartBase } from '@/components/relatorios/AreaChartBase';
import { ReportCard } from '@/components/relatorios/ReportCard';
import {
  appointmentValue,
  dailyCountSeries,
  isCancelStatus,
  isDoneStatus,
  isNoShowStatus,
  money,
  safePercent,
} from '@/lib/reportUtils';
import { useRelatoriosContext } from '../layout';

export default function PainelPage() {
  const { agendamentos, clientesNovos, receitaMensal, loading } = useRelatoriosContext();

  const metrics = useMemo(() => {
    const total = agendamentos.length;
    const done = agendamentos.filter((a: any) => isDoneStatus(a.status)).length;
    const canceled = agendamentos.filter((a: any) => isCancelStatus(a.status)).length;
    const noShow = agendamentos.filter((a: any) => isNoShowStatus(a.status)).length;
    const receita = receitaMensal.reduce((sum: number, item: any) => sum + Number(item.valor_total || 0), 0);
    const paymentBreakdown = receitaMensal.reduce((acc: Record<string, number>, item: any) => {
      const payments = item.transacao_pagamentos || [];
      if (!payments.length) {
        acc.outros += Number(item.valor_total || 0);
        return acc;
      }
      payments.forEach((payment: any) => {
        const method = ['dinheiro', 'cartao', 'pix'].includes(payment.metodo) ? payment.metodo : 'outros';
        acc[method] += Number(payment.valor || 0);
      });
      return acc;
    }, { dinheiro: 0, cartao: 0, pix: 0, outros: 0 });
    const ticket = done ? receita / done : 0;
    const servicesSold = agendamentos.filter((a: any) => !isCancelStatus(a.status)).length;
    const peakHour = Object.entries(
      agendamentos.reduce((acc: Record<string, number>, item: any) => {
        if (!item.data_hora_inicio) return acc;
        const hour = new Date(item.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || 'Sem dados';

    return {
      total,
      done,
      canceled,
      noShow,
      receita,
      ticket,
      paymentBreakdown,
      servicesSold,
      peakHour,
      occupancy: total ? safePercent(done, total) : 0,
      retention: total ? safePercent(Math.max(0, total - clientesNovos.length), total) : 0,
    };
  }, [agendamentos, clientesNovos.length, receitaMensal]);

  const appointmentsSeries = useMemo(() => dailyCountSeries(agendamentos), [agendamentos]);
  const occupiedSeries = useMemo(() => dailyCountSeries(agendamentos.filter((a: any) => !isCancelStatus(a.status))), [agendamentos]);
  const revenueSeries = useMemo(() => dailyCountSeries(receitaMensal, (item: any) => Number(item.valor_total || 0)), [receitaMensal]);
  const expectedRevenueSeries = useMemo(() => dailyCountSeries(agendamentos, appointmentValue), [agendamentos]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="space-y-6">
        <ChartPanel title="Agendamentos e horarios reservados" loading={loading}>
          <div className="mb-4 flex flex-wrap justify-end gap-2">
            <Legend label="Agendamentos" color="bg-[#D6B47A]" />
            <Legend label="Horarios ocupados" color="bg-[#D6B47A]" dotted />
          </div>
          <AreaChartBase
            data={appointmentsSeries.map((item, index) => ({ ...item, projecao: occupiedSeries[index]?.valor }))}
            color="#D6B47A"
            gradientId="reportsAppointments"
            label="Agendamentos"
            height={260}
          />
        </ChartPanel>

        <ChartPanel title="Receita" loading={loading}>
          <AreaChartBase
            data={revenueSeries.map((item, index) => ({ ...item, projecao: expectedRevenueSeries[index]?.valor }))}
            color="#2f7cff"
            gradientId="reportsRevenue"
            label="Receita"
            height={260}
            formatValue={money}
          />
        </ChartPanel>

        <div className="grid gap-4 md:grid-cols-5">
          <ReportCard icon={ShoppingBag} title="Ticket medio" value={money(metrics.ticket)} />
          <ReportCard icon={ListChecks} title="Servicos mais vendidos" value={metrics.servicesSold} hint="Ver relatorio" />
          <ReportCard icon={Clock} title="Horario de pico" value={metrics.peakHour} hint="Ver relatorio" />
          <ReportCard icon={Scissors} title="Taxa de ocupacao" value={`${metrics.occupancy}%`} />
          <ReportCard icon={Users} title="Retorno de clientes" value={`${metrics.retention}%`} />
        </div>

        <p className="text-sm text-white/45">Os dados exibidos sao referentes ao periodo selecionado.</p>
      </section>

      <aside className="space-y-5">
        <ReportCard title="Agendamentos" value={metrics.total}>
          <ProgressRow label="Concluidos" value={metrics.done} total={metrics.total} color="bg-[#D6B47A]" />
          <ProgressRow label="Cancelados" value={metrics.canceled} total={metrics.total} color="bg-[#ff4d4d]" />
          <ProgressRow label="Nao compareceram" value={metrics.noShow} total={metrics.total} color="bg-yellow-300" />
        </ReportCard>

        <ReportCard title="Receita total" value={money(metrics.receita)}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <MiniMoney label="Dinheiro" value={metrics.paymentBreakdown.dinheiro} />
            <MiniMoney label="Cartao" value={metrics.paymentBreakdown.cartao} />
            <MiniMoney label="Pix" value={metrics.paymentBreakdown.pix} />
            <MiniMoney label="Outros" value={metrics.paymentBreakdown.outros} />
          </div>
        </ReportCard>

        <ReportCard title="Clientes" value={clientesNovos.length}>
          <ProgressRow label="Novos" value={clientesNovos.length} total={Math.max(clientesNovos.length, metrics.total)} color="bg-[#D6B47A]" />
          <ProgressRow label="Recorrentes" value={Math.max(0, metrics.total - clientesNovos.length)} total={Math.max(clientesNovos.length, metrics.total)} color="bg-[#D6B47A]" />
        </ReportCard>
      </aside>
    </div>
  );
}

function ChartPanel({ title, loading, children }: { title: string; loading?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      {loading && <div className="absolute inset-0 z-10 rounded-2xl bg-black/40 backdrop-blur-sm" />}
      <h3 className="mb-2 text-sm font-black uppercase tracking-[0.14em] text-white">{title}</h3>
      {children}
    </div>
  );
}

function Legend({ label, color, dotted }: { label: string; color: string; dotted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg bg-white/[0.08] px-3 py-2 text-[11px] font-black uppercase text-white/70">
      <span className={`h-2 w-2 rounded-full ${color} ${dotted ? 'opacity-60' : ''}`} />
      {label}
    </span>
  );
}

function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = safePercent(value, total);
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.12em] text-white/55">
        <span>{label}</span>
        <span className="text-white">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/12">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function MiniMoney({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/45">{label}</p>
      <p className="mt-1 font-black text-white">{money(value)}</p>
    </div>
  );
}
