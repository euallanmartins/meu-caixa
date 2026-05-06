/* eslint-disable */
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AreaChartBase } from '@/components/relatorios/AreaChartBase';
import { ReportCard } from '@/components/relatorios/ReportCard';
import { ReportTable } from '@/components/relatorios/ReportTable';
import {
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

export default function AgendamentosPage() {
  const { agendamentos } = useRelatoriosContext();
  const series = useMemo(() => dailyCountSeries(agendamentos), [agendamentos]);

  const statusRows = useMemo(() => {
    const total = agendamentos.length;
    const done = agendamentos.filter((a: any) => isDoneStatus(a.status));
    const canceled = agendamentos.filter((a: any) => isCancelStatus(a.status));
    const noShow = agendamentos.filter((a: any) => isNoShowStatus(a.status));
    const pending = agendamentos.filter((a: any) => !isDoneStatus(a.status) && !isCancelStatus(a.status) && !isNoShowStatus(a.status));
    return [
      { status: 'Concluidos', items: done, color: 'text-[#D6B47A]' },
      { status: 'Pendentes/confirmados', items: pending, color: 'text-blue-400' },
      { status: 'Cancelados', items: canceled, color: 'text-[#ff4d4d]' },
      { status: 'Nao compareceram', items: noShow, color: 'text-yellow-300' },
    ].map(row => ({
      status: row.status,
      quantidade: row.items.length,
      percent: safePercent(row.items.length, total),
      valor: row.items.reduce((sum: number, item: any) => sum + appointmentValue(item), 0),
      color: row.color,
    }));
  }, [agendamentos]);

  const topServices = useMemo(() => {
    const map = new Map<string, { nome: string; reservas: number; valor: number }>();
    agendamentos.forEach((item: any) => {
      if (isCancelStatus(item.status)) return;
      const nome = appointmentService(item);
      const current = map.get(nome) || { nome, reservas: 0, valor: 0 };
      map.set(nome, { nome, reservas: current.reservas + 1, valor: current.valor + appointmentValue(item) });
    });
    return Array.from(map.values()).sort((a, b) => b.reservas - a.reservas).slice(0, 10);
  }, [agendamentos]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h3 className="mb-6 text-sm font-black uppercase tracking-[0.14em] text-white">Agendamentos e horario reservado</h3>
          <AreaChartBase
            data={series.length ? series : [{ mes: 'Sem dados', valor: 0 }]}
            color="#D6B47A"
            gradientId="appointmentsDetail"
            label="Agendamentos"
            height={260}
          />
        </div>

        <ReportTable
          columns={[
            { header: 'Status', cell: row => <span className={`font-black ${row.color}`}>{row.status}</span> },
            { header: 'Quantidade', align: 'right', cell: row => row.quantidade },
            { header: 'Porcentagem', align: 'right', cell: row => `${row.percent}%` },
            { header: 'Valor', align: 'right', cell: row => money(row.valor) },
          ]}
          data={statusRows}
        />

        <ReportTable
          columns={[
            { header: 'Servico', cell: row => <span className="font-black text-white">{row.nome}</span> },
            { header: 'Reservas', align: 'right', cell: row => row.reservas },
            { header: 'Valor', align: 'right', cell: row => money(row.valor) },
          ]}
          data={topServices}
          empty="Nenhum servico encontrado."
        />
      </section>

      <aside className="space-y-4">
        <ReportCard title="Total" value={agendamentos.length} />
        <Link href="/gestao/relatorios/lista-agendamentos" className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 font-black text-[#D6B47A] hover:bg-white/[0.07]">
          Lista de agendamentos
        </Link>
        <Link href="/gestao/relatorios/cancelados" className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 font-black text-[#ff4d4d] hover:bg-white/[0.07]">
          Cancelados
        </Link>
        <Link href="/gestao/relatorios/resumo-servicos" className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 font-black text-white hover:bg-white/[0.07]">
          Resumo de servicos
        </Link>
      </aside>
    </div>
  );
}
