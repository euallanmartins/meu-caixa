/* eslint-disable */
'use client';

import { useMemo } from 'react';
import { Ban, CalendarCheck, Clock, ListChecks, Percent, Repeat2, Scissors, ShoppingBag, Star, TrendingUp, Trophy, UserPlus, Users } from 'lucide-react';
import { AreaChartBase } from '@/components/relatorios/AreaChartBase';
import { ReportCard } from '@/components/relatorios/ReportCard';
import { FeatureGate } from '@/components/saas/FeatureGate';
import {
  appointmentBarber,
  appointmentService,
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
  const {
    agendamentos,
    clientesNovos,
    receitaMensal,
    receitaPeriodoAnterior,
    analyticsEvents,
    premiumRpcMetrics,
    barbeariaId,
    loading,
  } = useRelatoriosContext();

  const metrics = useMemo(() => {
    const total = agendamentos.length;
    const done = agendamentos.filter((a: any) => isDoneStatus(a.status)).length;
    const canceled = agendamentos.filter((a: any) => isCancelStatus(a.status)).length;
    const noShow = agendamentos.filter((a: any) => isNoShowStatus(a.status)).length;
    const receita = receitaMensal.reduce((sum: number, item: any) => sum + Number(item.valor_total || 0), 0);
    const receitaAnterior = receitaPeriodoAnterior.reduce((sum: number, item: any) => sum + Number(item.valor_total || 0), 0);
    const growth = receitaAnterior > 0 ? Math.round(((receita - receitaAnterior) / receitaAnterior) * 100) : (receita > 0 ? 100 : 0);
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
    const pending = agendamentos.filter((a: any) => a.status === 'pendente').length;
    const accepted = agendamentos.filter((a: any) => ['aceito', 'confirmado'].includes(a.status)).length;
    const refused = agendamentos.filter((a: any) => a.status === 'recusado').length;
    const uniqueClients = new Set(agendamentos.map((a: any) => a.clientes?.id || a.clientes?.nome).filter(Boolean));
    const newClientNames = new Set(clientesNovos.map((client: any) => client.id || client.nome).filter(Boolean));
    const recurringClients = Array.from(uniqueClients).filter(client => !newClientNames.has(client)).length;
    const returnRate = safePercent(recurringClients, Math.max(1, uniqueClients.size));
    const peakHour = Object.entries(
      agendamentos.reduce((acc: Record<string, number>, item: any) => {
        if (!item.data_hora_inicio) return acc;
        const hour = new Date(item.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || 'Sem dados';
    const peakWeekDay = Object.entries(
      agendamentos.reduce((acc: Record<string, number>, item: any) => {
        if (!item.data_hora_inicio) return acc;
        const day = new Date(item.data_hora_inicio).toLocaleDateString('pt-BR', { weekday: 'short' });
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || 'Sem dados';
    const serviceRank = Object.entries(
      agendamentos.reduce((acc: Record<string, number>, item: any) => {
        if (isCancelStatus(item.status)) return acc;
        const service = appointmentService(item);
        acc[service] = (acc[service] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => Number(b[1]) - Number(a[1]));
    const barberRank = Object.entries(
      agendamentos.reduce((acc: Record<string, { total: number; receita: number }>, item: any) => {
        const barber = appointmentBarber(item);
        const current = acc[barber] || { total: 0, receita: 0 };
        acc[barber] = {
          total: current.total + 1,
          receita: current.receita + appointmentValue(item),
        };
        return acc;
      }, {})
    ).sort((a, b) => b[1].receita - a[1].receita);
    const analytics = analyticsEvents.reduce((acc: Record<string, number>, item: any) => {
      acc[item.event_type] = (acc[item.event_type] || 0) + 1;
      return acc;
    }, {});
    const profileViews = Number(premiumRpcMetrics?.profile_views ?? analytics.public_profile_view ?? 0);
    const clickAgendar = Number(premiumRpcMetrics?.click_agendar ?? analytics.click_agendar ?? 0);
    const conversion = safePercent(clickAgendar, profileViews);

    return {
      total,
      done,
      pending,
      canceled,
      noShow,
      accepted,
      refused,
      receita,
      receitaAnterior,
      growth,
      ticket,
      paymentBreakdown,
      servicesSold,
      peakHour,
      peakWeekDay,
      occupancy: total ? safePercent(done, total) : 0,
      retention: returnRate,
      recurringClients,
      cancellationRate: safePercent(canceled, total),
      acceptanceRate: safePercent(accepted, accepted + refused),
      refusalRate: safePercent(refused, accepted + refused),
      topService: serviceRank[0]?.[0] || 'Sem dados',
      topBarber: barberRank[0]?.[0] || 'Sem dados',
      profileViews,
      clickAgendar,
      clickWhatsapp: Number(premiumRpcMetrics?.click_whatsapp ?? analytics.click_whatsapp ?? 0),
      clickInstagram: Number(premiumRpcMetrics?.click_instagram ?? analytics.click_instagram ?? 0),
      conversion,
    };
  }, [agendamentos, analyticsEvents, clientesNovos, premiumRpcMetrics, receitaMensal, receitaPeriodoAnterior]);

  const appointmentsSeries = useMemo(() => dailyCountSeries(agendamentos), [agendamentos]);
  const occupiedSeries = useMemo(() => dailyCountSeries(agendamentos.filter((a: any) => !isCancelStatus(a.status))), [agendamentos]);
  const revenueSeries = useMemo(() => dailyCountSeries(receitaMensal, (item: any) => Number(item.valor_total || 0)), [receitaMensal]);
  const expectedRevenueSeries = useMemo(() => dailyCountSeries(agendamentos, appointmentValue), [agendamentos]);

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
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

        <FeatureGate
          barbeariaId={barbeariaId}
          featureKey="premium_reports"
          softFailOpen
          fallbackTitle="Relatorios premium"
          fallbackDescription="Libere os indicadores avancados de crescimento, retorno e produtividade no plano PRO."
        >
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <ReportCard icon={TrendingUp} title="Faturamento hoje" value={money(receitaMensal.filter((item: any) => new Date(item.data).toDateString() === new Date().toDateString()).reduce((sum: number, item: any) => sum + Number(item.valor_total || 0), 0))} />
            <ReportCard icon={ShoppingBag} title="Faturamento do mes" value={money(metrics.receita)} variation={`${metrics.growth >= 0 ? '+' : ''}${metrics.growth}% vs anterior`} />
            <ReportCard icon={CalendarCheck} title="Concluidos" value={metrics.done} hint={`${metrics.occupancy}% de ocupacao`} />
            <ReportCard icon={Clock} title="Pendentes" value={metrics.pending} />
            <ReportCard icon={Ban} title="Cancelados" value={metrics.canceled} hint={`${metrics.cancellationRate}% taxa`} />
            <ReportCard icon={ShoppingBag} title="Ticket medio" value={money(metrics.ticket)} />
            <ReportCard icon={UserPlus} title="Clientes novos" value={clientesNovos.length} />
            <ReportCard icon={Repeat2} title="Clientes recorrentes" value={metrics.recurringClients} hint={`${metrics.retention}% retorno`} />
            <ReportCard icon={Trophy} title="Barbeiro destaque" value={metrics.topBarber} />
            <ReportCard icon={Scissors} title="Servico mais vendido" value={metrics.topService} />
            <ReportCard icon={Clock} title="Horario de pico" value={metrics.peakHour} hint={metrics.peakWeekDay} />
            <ReportCard icon={Percent} title="Taxa de aceite" value={`${metrics.acceptanceRate}%`} hint={`${metrics.refusalRate}% recusa`} />
            <ReportCard icon={Star} title="Views do perfil" value={metrics.profileViews} hint={`${metrics.conversion}% conversao`} />
            <ReportCard icon={ListChecks} title="Cliques em agendar" value={metrics.clickAgendar} />
            <ReportCard icon={Users} title="WhatsApp / Instagram" value={`${metrics.clickWhatsapp} / ${metrics.clickInstagram}`} />
          </div>
        </FeatureGate>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <ReportCard icon={ShoppingBag} title="Ticket medio" value={money(metrics.ticket)} />
          <ReportCard icon={ListChecks} title="Servicos mais vendidos" value={metrics.servicesSold} hint="Ver relatorio" />
          <ReportCard icon={Clock} title="Horario de pico" value={metrics.peakHour} hint="Ver relatorio" />
          <ReportCard icon={Scissors} title="Taxa de ocupacao" value={`${metrics.occupancy}%`} />
          <ReportCard icon={Users} title="Retorno de clientes" value={`${metrics.retention}%`} />
        </div>

        <p className="text-sm text-white/45">Os dados exibidos sao referentes ao periodo selecionado.</p>
      </section>

      <aside className="min-w-0 space-y-5">
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
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
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
