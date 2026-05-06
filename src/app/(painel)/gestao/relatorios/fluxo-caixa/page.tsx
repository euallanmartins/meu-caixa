/* eslint-disable */
'use client';

import { ReportCard } from '@/components/relatorios/ReportCard';
import { ReportTable } from '@/components/relatorios/ReportTable';
import { money } from '@/lib/reportUtils';
import { useRelatoriosContext } from '../layout';

export default function FluxoCaixaPage() {
  const { caixaSessoes } = useRelatoriosContext();

  const abertura = caixaSessoes.reduce((sum: number, item: any) => sum + Number(item.saldo_inicial || 0), 0);
  const fechamento = caixaSessoes.reduce((sum: number, item: any) => sum + Number(item.saldo_final || 0), 0);
  const abertas = caixaSessoes.filter((item: any) => item.status === 'aberto').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <ReportCard title="Abertura total" value={money(abertura)} />
        <ReportCard title="Fechamento total" value={money(fechamento)} />
        <ReportCard title="Fluxo liquido" value={money(fechamento - abertura)} />
        <ReportCard title="Sessoes abertas" value={abertas} />
      </div>

      <ReportTable
        columns={[
          { header: 'Abertura', cell: row => new Date(row.aberto_em || row.created_at).toLocaleString('pt-BR') },
          { header: 'Fechamento', cell: row => row.fechado_em ? new Date(row.fechado_em).toLocaleString('pt-BR') : '-' },
          { header: 'Status', cell: row => <span className={row.status === 'aberto' ? 'font-black text-[#D6B47A]' : 'font-black text-white'}>{row.status}</span> },
          { header: 'Saldo inicial', align: 'right', cell: row => money(row.saldo_inicial) },
          { header: 'Saldo final', align: 'right', cell: row => money(row.saldo_final) },
        ]}
        data={caixaSessoes}
        empty="Nenhuma sessao de caixa encontrada."
      />
    </div>
  );
}
