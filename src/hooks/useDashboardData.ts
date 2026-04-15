import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type TransactionType = 'income' | 'expense' | 'tip';

export interface DashboardTransaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  method: 'dinheiro' | 'cartao' | 'pix' | 'outro';
  barbeiro_id?: string;
  comissao?: number;
  payments?: { metodo: string, valor: number }[];
}

export function useDashboardData(barbeariaId: string | null) {
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchTransactions() {
    if (!barbeariaId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // 1. Buscar Barbeiros
      const { data: barbersData } = await supabase
        .from('barbeiros')
        .select('*')
        .eq('barbearia_id', barbeariaId)
        .eq('ativo', true);
      
      setBarbers(barbersData || []);

      // 2. Buscar transações (Entradas) ...
      // 1. Buscar transações (Entradas) com os pagamentos, servicos e barbeiros
      const { data: transacoesData, error: transError } = await supabase
        .from('transacoes')
        .select(`
          id,
          valor_total,
          data,
          cliente_nome,
          barbeiro_id,
          servicos ( nome ),
          barbeiros ( nome, comissao, comissao_tipo ),
          transacao_pagamentos ( metodo, valor )
        `)
        .eq('barbearia_id', barbeariaId);

      if (transError) throw transError;

      const formattedIncomes = (transacoesData || []).map((t: any) => {
        // Se houver pagamentos detalhados, pega o principal, se não assume um
        const payments = t.transacao_pagamentos || [];
        const method = payments.length > 0 ? payments[0].metodo : 'outro';
        
        const servName = t.servicos ? t.servicos.nome : 'Serviço';
        const clientName = t.cliente_nome ? ` - ${t.cliente_nome}` : '';
          
        return {
          id: t.id,
          description: `${servName}${clientName}`,
          amount: Number(t.valor_total),
          type: 'income' as TransactionType,
          date: t.data,
          method: method as DashboardTransaction['method'],
          payments: payments.map((p: any) => ({ metodo: p.metodo, valor: Number(p.valor) })),
          barbeiro_id: t.barbeiro_id,
          comissao: t.barbeiros ? (
             t.barbeiros.comissao_tipo === 'percentual' 
             ? (Number(t.valor_total) * (Number(t.barbeiros.comissao) / 100))
             : Number(t.barbeiros.comissao)
          ) : 0
        };
      });

      // 2. Buscar despesas (Saídas)
      const { data: despesasData, error: despError } = await supabase
        .from('despesas')
        .select('id, descricao, valor, data')
        .eq('barbearia_id', barbeariaId);

      if (despError) throw despError;

      const formattedExpenses = (despesasData || []).map((d: any) => ({
        id: d.id,
        description: d.descricao,
        amount: Number(d.valor),
        type: 'expense' as TransactionType,
        date: d.data,
        method: 'outro' as DashboardTransaction['method'] // Despesas por enquanto não listamos o método de saída no mockup
      }));

      // 3. Buscar caixinhas (Gorjetas)
      const { data: caixinhasData, error: caixingaError } = await supabase
        .from('caixinhas')
        .select('id, valor, metodo, data, barbeiro_id, barbeiros(nome)')
        .eq('barbearia_id', barbeariaId);

      if (caixingaError) throw caixingaError;

      const formattedTips = (caixinhasData || []).map((c: any) => ({
        id: c.id,
        description: `Caixinha - ${c.barbeiros ? c.barbeiros.nome : 'Barbeiro'}`,
        amount: Number(c.valor),
        type: 'tip' as TransactionType,
        date: c.data,
        method: c.metodo as DashboardTransaction['method'],
        barbeiro_id: c.barbeiro_id
      }));

      // 4. Buscar vendas de produtos
      const { data: vendasProdutosData, error: vendasError } = await supabase
        .from('venda_produtos')
        .select('id, valor_total, created_at, produto_id, comissao_total, barbeiro_id, produtos(nome), barbeiros(nome)')
        .eq('barbearia_id', barbeariaId);

      if (vendasError) throw vendasError;

      const formattedProductSales = (vendasProdutosData || []).map((v: any) => ({
        id: v.id,
        description: `Venda: ${v.produtos ? v.produtos.nome : 'Produto'} (${v.barbeiros ? v.barbeiros.nome : 'Barbeiro'})`,
        amount: Number(v.valor_total),
        type: 'income' as TransactionType,
        date: v.created_at,
        method: 'pix' as DashboardTransaction['method'], // Simplificação
        barbeiro_id: v.barbeiro_id,
        comissao: Number(v.comissao_total)
      }));

      // Une tudo e ordena por data (mais recente primeiro)
      const allTransactions = [
        ...formattedIncomes, 
        ...formattedExpenses, 
        ...formattedTips,
        ...formattedProductSales
      ];
      
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Erro ao buscar dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTransactions();
  }, [barbeariaId]);

  return {
    transactions,
    barbers,
    loading,
    refreshData: fetchTransactions
  };
}
