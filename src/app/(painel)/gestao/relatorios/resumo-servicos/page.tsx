/* eslint-disable */
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReportTable } from '@/components/relatorios/ReportTable';
import { appointmentService, appointmentValue, isCancelStatus, money } from '@/lib/reportUtils';
import { useRelatoriosContext } from '../layout';

export default function ResumoServicosPage() {
  const { agendamentos, formattedLabel } = useRelatoriosContext();

  const services = new Map<string, { servico: string; categoria: string; reservas: number; valor: number }>();
  agendamentos.forEach((item: any) => {
    if (isCancelStatus(item.status)) return;
    const servico = appointmentService(item);
    const current = services.get(servico) || {
      servico,
      categoria: servico.toLowerCase().includes('barba') ? 'Barbearia' : 'Cabelo / Corte',
      reservas: 0,
      valor: 0,
    };
    services.set(servico, {
      ...current,
      reservas: current.reservas + 1,
      valor: current.valor + appointmentValue(item),
    });
  });

  const serviceRows = Array.from(services.values()).sort((a, b) => b.valor - a.valor).slice(0, 10);

  const categories = new Map<string, { categoria: string; reservas: number; valor: number }>();
  serviceRows.forEach(item => {
    const current = categories.get(item.categoria) || { categoria: item.categoria, reservas: 0, valor: 0 };
    categories.set(item.categoria, {
      categoria: item.categoria,
      reservas: current.reservas + item.reservas,
      valor: current.valor + item.valor,
    });
  });

  return (
    <div className="space-y-8 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
      <div className="flex items-center gap-4 border-b border-white/8 pb-5">
        <Link href="/gestao/relatorios/agendamentos" className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white hover:bg-white/[0.08]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h3 className="text-xl font-black uppercase tracking-[0.14em] text-white">Resumo de categorias e servicos</h3>
          <p className="mt-1 text-sm text-white/45">{formattedLabel}</p>
        </div>
      </div>

      <section className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-[0.14em] text-white">Categorias mais populares</h4>
        <ReportTable
          columns={[
            { header: 'Categoria', cell: row => <span className="font-black text-white">{row.categoria}</span> },
            { header: 'Reservas', align: 'right', cell: row => row.reservas },
            { header: 'Valor', align: 'right', cell: row => money(row.valor) },
          ]}
          data={Array.from(categories.values())}
        />
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-[0.14em] text-white">Servicos mais populares</h4>
        <ReportTable
          columns={[
            { header: 'Servico', cell: row => <span className="font-black text-white">{row.servico}</span> },
            { header: 'Categoria', cell: row => row.categoria },
            { header: 'Reservas', align: 'right', cell: row => row.reservas },
            { header: 'Valor', align: 'right', cell: row => money(row.valor) },
          ]}
          data={serviceRows}
        />
      </section>
    </div>
  );
}
