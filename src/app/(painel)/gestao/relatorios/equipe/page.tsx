/* eslint-disable */
'use client';

import { useMemo } from 'react';
import { ReportCard } from '@/components/relatorios/ReportCard';
import { ReportTable } from '@/components/relatorios/ReportTable';
import { appointmentBarber, appointmentValue, isCancelStatus, money } from '@/lib/reportUtils';
import { useRelatoriosContext } from '../layout';

export default function EquipePage() {
  const { agendamentos, funcionarios } = useRelatoriosContext();

  const rows = useMemo(() => {
    const map = new Map<string, { nome: string; reservas: number; receita: number; comissao: number }>();
    agendamentos.forEach((item: any) => {
      if (isCancelStatus(item.status)) return;
      const nome = appointmentBarber(item);
      const value = appointmentValue(item);
      const current = map.get(nome) || { nome, reservas: 0, receita: 0, comissao: 0 };
      map.set(nome, {
        nome,
        reservas: current.reservas + 1,
        receita: current.receita + value,
        comissao: current.comissao + value * 0.5,
      });
    });
    return Array.from(map.values()).sort((a, b) => b.receita - a.receita);
  }, [agendamentos]);

  const totalRevenue = rows.reduce((sum, row) => sum + row.receita, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <ReportCard title="Profissionais" value={funcionarios.length || rows.length} />
        <ReportCard title="Reservas" value={rows.reduce((sum, row) => sum + row.reservas, 0)} />
        <ReportCard title="Receita" value={money(totalRevenue)} />
        <ReportCard title="Comissao estimada" value={money(rows.reduce((sum, row) => sum + row.comissao, 0))} />
      </div>

      <ReportTable
        columns={[
          { header: 'Profissional', cell: row => <span className="font-black text-white">{row.nome}</span> },
          { header: 'Reservas', align: 'right', cell: row => row.reservas },
          { header: 'Receita', align: 'right', cell: row => money(row.receita) },
          { header: 'Comissao', align: 'right', cell: row => <span className="font-black text-[#D6B47A]">{money(row.comissao)}</span> },
        ]}
        data={rows}
        empty="Nenhum desempenho encontrado."
      />
    </div>
  );
}
