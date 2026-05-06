'use client';

import { useMemo } from 'react';
import { AreaChartBase } from '@/components/relatorios/AreaChartBase';
import { ReportCard } from '@/components/relatorios/ReportCard';
import { ReportTable } from '@/components/relatorios/ReportTable';
import { dailyCountSeries, money, safePercent } from '@/lib/reportUtils';
import { useRelatoriosContext } from '../layout';

export default function ClientesPage() {
  const { clientesNovos, agendamentos } = useRelatoriosContext();
  const series = useMemo(() => dailyCountSeries(clientesNovos, () => 1), [clientesNovos]);
  const recurring = Math.max(0, agendamentos.length - clientesNovos.length);
  const total = clientesNovos.length + recurring;

  const rows = [
    { tipo: 'Novos', clientes: clientesNovos.length, percent: safePercent(clientesNovos.length, total) },
    { tipo: 'Recorrentes', clientes: recurring, percent: safePercent(recurring, total) },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h3 className="mb-6 text-sm font-black uppercase tracking-[0.14em] text-white">Clientes novos e recorrentes</h3>
          <AreaChartBase
            data={series.length ? series : [{ mes: 'Sem dados', valor: 0 }]}
            color="#8b5cf6"
            gradientId="clientsDetail"
            label="Clientes"
            height={280}
          />
        </div>
        <ReportTable
          columns={[
            { header: 'Tipo', cell: row => <span className="font-black text-white">{row.tipo}</span> },
            { header: 'Porcentagem', align: 'right', cell: row => `${row.percent}%` },
            { header: 'Clientes', align: 'right', cell: row => row.clientes },
          ]}
          data={rows}
        />
      </section>

      <aside className="space-y-4">
        <ReportCard title="Clientes" value={total} />
        <ReportCard title="Novos" value={clientesNovos.length} hint={`${safePercent(clientesNovos.length, total)}% do periodo`} />
        <ReportCard title="Receita estimada" value={money(0)} hint="Disponivel apos vendas vinculadas" />
      </aside>
    </div>
  );
}
