/* eslint-disable */
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReportTable } from '@/components/relatorios/ReportTable';
import {
  appointmentDate,
  appointmentValue,
  isCancelStatus,
  isDoneStatus,
  isNoShowStatus,
  money,
  safePercent,
} from '@/lib/reportUtils';
import { useRelatoriosContext } from '../layout';

export default function ResumoVisitasPage() {
  const { agendamentos, formattedLabel } = useRelatoriosContext();
  const total = agendamentos.length;

  const statusRows = [
    { status: 'Incompleto', items: agendamentos.filter((a: any) => !isDoneStatus(a.status) && !isCancelStatus(a.status) && !isNoShowStatus(a.status)) },
    { status: 'Concluida', items: agendamentos.filter((a: any) => isDoneStatus(a.status)) },
    { status: 'Nao comparecimentos', items: agendamentos.filter((a: any) => isNoShowStatus(a.status)) },
    { status: 'Cancelado', items: agendamentos.filter((a: any) => isCancelStatus(a.status)) },
  ].map(row => ({
    status: row.status,
    quantidade: row.items.length,
    percent: safePercent(row.items.length, total),
    valor: row.items.reduce((sum: number, item: any) => sum + appointmentValue(item), 0),
  }));

  const dayRows = ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado'].map((label, index) => {
    const items = agendamentos.filter((item: any) => new Date(appointmentDate(item)).getDay() === index);
    return {
      dia: label,
      reservas: items.length,
      percent: safePercent(items.length, total),
      valor: items.reduce((sum: number, item: any) => sum + appointmentValue(item), 0),
    };
  });

  const hourMap = new Map<string, number>();
  agendamentos.forEach((item: any) => {
    const date = new Date(appointmentDate(item));
    if (Number.isNaN(date.getTime())) return;
    const hour = `${String(date.getHours()).padStart(2, '0')}:00`;
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
  });
  const hourRows = Array.from(hourMap.entries()).map(([hora, reservas]) => ({ hora, reservas })).sort((a, b) => b.reservas - a.reservas);

  return (
    <div className="space-y-8 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
      <div className="flex items-center gap-4 border-b border-white/8 pb-5">
        <Link href="/gestao/relatorios/agendamentos" className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white hover:bg-white/[0.08]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h3 className="text-xl font-black uppercase tracking-[0.14em] text-white">Resumo de visitas</h3>
          <p className="mt-1 text-sm text-white/45">{formattedLabel}</p>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="space-y-4">
          <h4 className="text-sm font-black uppercase tracking-[0.14em] text-white">Visitas por status</h4>
          <ReportTable
            columns={[
              { header: 'Status', cell: row => <span className="font-black text-white">{row.status}</span> },
              { header: 'Qtd', align: 'right', cell: row => row.quantidade },
              { header: '%', align: 'right', cell: row => `${row.percent}%` },
              { header: 'Valor', align: 'right', cell: row => money(row.valor) },
            ]}
            data={statusRows}
          />
        </section>

        <section className="space-y-4">
          <h4 className="text-sm font-black uppercase tracking-[0.14em] text-white">Dias com melhores resultados</h4>
          <ReportTable
            columns={[
              { header: 'Dia', cell: row => <span className="font-black text-white">{row.dia}</span> },
              { header: 'Reservas', align: 'right', cell: row => row.reservas },
              { header: '%', align: 'right', cell: row => `${row.percent}%` },
              { header: 'Valor', align: 'right', cell: row => money(row.valor) },
            ]}
            data={dayRows}
          />
        </section>
      </div>

      <section className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-[0.14em] text-white">Horas com melhores resultados</h4>
        <ReportTable
          columns={[
            { header: 'Hora', cell: row => <span className="font-black text-white">{row.hora}</span> },
            { header: 'Reservas', align: 'right', cell: row => row.reservas },
          ]}
          data={hourRows}
          empty="Nenhum horario encontrado."
        />
      </section>
    </div>
  );
}
