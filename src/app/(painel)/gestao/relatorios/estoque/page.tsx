/* eslint-disable */
'use client';

import { Package, TriangleAlert } from 'lucide-react';
import { ReportCard } from '@/components/relatorios/ReportCard';
import { ReportTable } from '@/components/relatorios/ReportTable';
import { money } from '@/lib/reportUtils';
import { useRelatoriosContext } from '../layout';

export default function EstoquePage() {
  const { estoque } = useRelatoriosContext();
  const totalValue = estoque.reduce((sum: number, item: any) => sum + Number(item.valor_venda || 0) * Number(item.estoque || 0), 0);
  const lowStock = estoque.filter((item: any) => Number(item.estoque || 0) <= 3);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <ReportCard icon={Package} title="Produtos" value={estoque.length} hint="Itens cadastrados" />
        <ReportCard title="Valor total" value={money(totalValue)} />
        <ReportCard icon={TriangleAlert} title="Baixo estoque" value={lowStock.length} variation={lowStock.length ? 'Atencao' : undefined} />
      </div>

      <ReportTable
        columns={[
          { header: 'Produto', cell: row => <span className="font-black text-white">{row.nome}</span> },
          { header: 'Quantidade', align: 'right', cell: row => row.estoque || 0 },
          { header: 'Preco de venda', align: 'right', cell: row => money(row.valor_venda) },
          { header: 'Valor em estoque', align: 'right', cell: row => money(Number(row.valor_venda || 0) * Number(row.estoque || 0)) },
        ]}
        data={estoque}
        empty="Nenhum produto encontrado."
      />
    </div>
  );
}
