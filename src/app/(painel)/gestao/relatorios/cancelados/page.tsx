/* eslint-disable */
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReportCard } from '@/components/relatorios/ReportCard';
import { ReportTable } from '@/components/relatorios/ReportTable';
import {
  appointmentBarber,
  appointmentClient,
  appointmentDate,
  appointmentService,
  appointmentValue,
  isCancelStatus,
  money,
} from '@/lib/reportUtils';
import { useRelatoriosContext } from '../layout';

export default function CanceladosPage() {
  const { agendamentos, formattedLabel } = useRelatoriosContext();
  const cancelados = agendamentos.filter((item: any) => isCancelStatus(item.status));
  const loss = cancelados.reduce((sum: number, item: any) => sum + appointmentValue(item), 0);

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
      <div className="flex items-center gap-4 border-b border-white/8 pb-5">
        <Link href="/gestao/relatorios/agendamentos" className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white hover:bg-white/[0.08]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h3 className="text-xl font-black uppercase tracking-[0.14em] text-white">Agendamentos cancelados</h3>
          <p className="mt-1 text-sm text-white/45">{formattedLabel}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ReportCard title="Cancelamentos" value={cancelados.length} />
        <ReportCard title="Perda estimada" value={money(loss)} variation="Receita nao realizada" />
      </div>

      <ReportTable
        columns={[
          { header: 'Data e hora', cell: row => new Date(appointmentDate(row)).toLocaleString('pt-BR') },
          { header: 'Cliente', cell: row => appointmentClient(row) },
          { header: 'Servico', cell: row => appointmentService(row) },
          { header: 'Profissional', cell: row => appointmentBarber(row) },
          { header: 'Perda', align: 'right', cell: row => <span className="font-black text-[#ff4d4d]">{money(appointmentValue(row))}</span> },
        ]}
        data={cancelados}
        empty="Nenhum cancelamento registrado neste periodo."
      />
    </div>
  );
}
