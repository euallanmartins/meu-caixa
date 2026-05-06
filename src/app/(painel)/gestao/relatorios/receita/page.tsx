/* eslint-disable */
'use client';

import { useMemo } from 'react';
import { AreaChartBase } from '@/components/relatorios/AreaChartBase';
import { ReportCard } from '@/components/relatorios/ReportCard';
import { ReportTable } from '@/components/relatorios/ReportTable';
import { dailyCountSeries, money } from '@/lib/reportUtils';
import { useRelatoriosContext } from '../layout';

export default function ReceitaPage() {
  const { receitaMensal, agendamentos } = useRelatoriosContext();

  const total = useMemo(() => receitaMensal.reduce((sum: number, item: any) => sum + Number(item.valor_total || 0), 0), [receitaMensal]);
  const series = useMemo(() => dailyCountSeries(receitaMensal, (item: any) => Number(item.valor_total || 0)), [receitaMensal]);

  const rows = [
    { tipo: 'Servicos', percent: 70, receita: total * 0.7 },
    { tipo: 'Produtos', percent: 15, receita: total * 0.15 },
    { tipo: 'Pacotes', percent: 8, receita: total * 0.08 },
    { tipo: 'Gorjetas', percent: 7, receita: total * 0.07 },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <ReportCard title="Receita total" value={money(total)} />
            <ReportCard title="Transacoes" value={receitaMensal.length} />
            <ReportCard title="Reservas" value={agendamentos.length} />
          </div>
          <AreaChartBase
            data={series.length ? series : [{ mes: 'Sem dados', valor: 0 }]}
            color="#2f7cff"
            gradientId="revenueDetail"
            label="Receita"
            formatValue={money}
            height={280}
          />
        </div>

        <ReportTable
          columns={[
            { header: 'Tipo', cell: row => <span className="font-black text-white">{row.tipo}</span> },
            { header: 'Porcentagem', align: 'right', cell: row => `${row.percent}%` },
            { header: 'Receita', align: 'right', cell: row => <span className="font-black text-[#D6B47A]">{money(row.receita)}</span> },
          ]}
          data={rows}
        />
      </section>

      <aside className="space-y-4">
        <ReportCard title="Ticket medio" value={money(receitaMensal.length ? total / receitaMensal.length : 0)} hint="Por transacao" />
        <ReportCard title="Receita liquida" value={money(total)} hint="Sem descontos aplicados" />
        <ReportCard title="Melhor fonte" value="Servicos" hint="Maior participacao" />
      </aside>
    </div>
  );
}
