'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReportTable } from '@/components/relatorios/ReportTable';
import {
  appointmentBarber,
  appointmentClient,
  appointmentDate,
  appointmentService,
  appointmentValue,
  money,
  statusLabel,
} from '@/lib/reportUtils';
import { useRelatoriosContext } from '../layout';

export default function ListaAgendamentosPage() {
  const { agendamentos, formattedLabel } = useRelatoriosContext();

  return (
    <DetailShell title="Lista de agendamentos" subtitle={formattedLabel} back="/gestao/relatorios/agendamentos">
      <ReportTable
        columns={[
          { header: 'Data e hora', cell: row => new Date(appointmentDate(row)).toLocaleString('pt-BR') },
          { header: 'Cliente', cell: row => appointmentClient(row) },
          { header: 'Servico', cell: row => <span className="font-black text-white">{appointmentService(row)}</span> },
          { header: 'Profissional', cell: row => appointmentBarber(row) },
          { header: 'Status', cell: row => statusLabel(row.status) },
          { header: 'Valor', align: 'right', cell: row => money(appointmentValue(row)) },
        ]}
        data={agendamentos}
        empty="Nenhum agendamento encontrado neste periodo."
      />
    </DetailShell>
  );
}

function DetailShell({ title, subtitle, back, children }: { title: string; subtitle: string; back: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
      <div className="flex items-center gap-4 border-b border-white/8 pb-5">
        <Link href={back} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white hover:bg-white/[0.08]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h3 className="text-xl font-black uppercase tracking-[0.14em] text-white">{title}</h3>
          <p className="mt-1 text-sm text-white/45">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
