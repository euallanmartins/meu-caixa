/* eslint-disable */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatISO } from 'date-fns';

export function useRelatorios({ 
  barbeariaId, 
  inicioMes, 
  fimMes 
}: { 
  barbeariaId?: string; 
  inicioMes: Date; 
  fimMes: Date; 
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    agendamentos: any[];
    clientesNovos: any[];
    receitaMensal: any[];
    estoque: any[];
    caixaSessoes: any[];
    funcionarios: any[];
    horasTrabalhadas: any[];
  }>({
    agendamentos: [],
    clientesNovos: [],
    receitaMensal: [],
    estoque: [],
    caixaSessoes: [],
    funcionarios: [],
    horasTrabalhadas: [],
  });

  // FIX: fetchData não precisa ser useCallback — o fetch é gerenciado pelo useEffect abaixo
  const fetchData = useCallback(async (bId: string, start: Date, end: Date) => {
    setLoading(true);

    const startISO = formatISO(start);
    const endISO = formatISO(end);

    try {
      // 1. Agendamentos no intervalo (FIX: 'barbeiros' em vez de 'profissionais')
      const { data: agends } = await supabase
        .from('agendamentos')
        .select(`
          id, data_hora_inicio, data_hora_fim, status, valor_estimado,
          clientes(nome, telefone),
          barbeiros(id, nome),
          servicos(nome, valor)
        `)
        .eq('barbearia_id', bId)
        .gte('data_hora_inicio', startISO)
        .lte('data_hora_inicio', endISO)
        .order('data_hora_inicio', { ascending: false });

      // 2. Clientes criados no intervalo
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, nome, created_at')
        .eq('barbearia_id', bId)
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      // 3. Receita (transações concluídas no intervalo)
      const { data: receita } = await supabase
        .from('transacoes')
        .select('id, valor_total, data, barbeiro_id, servico_id, transacao_pagamentos(metodo, valor)')
        .eq('barbearia_id', bId)
        .gte('data', startISO)
        .lte('data', endISO)
        .order('data', { ascending: true });

      // 4. Estoque (geral, sem filtro temporal)
      const { data: estq } = await supabase
        .from('produtos')
        .select('id, nome, estoque, valor_venda')
        .eq('barbearia_id', bId);

      // 5. Sessões de Caixa
      const { data: sessoes } = await supabase
        .from('caixa_sessoes')
        .select('*')
        .eq('barbearia_id', bId)
        .gte('aberto_em', startISO)
        .lte('aberto_em', endISO)
        .order('aberto_em', { ascending: false });

      // 6. Barbeiros da equipe
      const { data: funcs } = await supabase
        .from('barbeiros')
        .select('id, nome, comissao, comissao_tipo, ativo')
        .eq('barbearia_id', bId)
        .eq('ativo', true);

      setData({
        agendamentos: agends || [],
        clientesNovos: clientes || [],
        receitaMensal: receita || [],
        estoque: estq || [],
        caixaSessoes: sessoes || [],
        funcionarios: funcs || [],
        horasTrabalhadas: [],
      });
    } catch (err) {
      console.error('[useRelatorios] Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // FIX: useEffect interno no hook — evita loop no layout
  useEffect(() => {
    if (!barbeariaId) return;
    fetchData(barbeariaId, inicioMes, fimMes);
  }, [barbeariaId, inicioMes, fimMes, fetchData]);

  const totalReceita = data.receitaMensal.reduce(
    (acc, curr) => acc + (curr.valor_total || 0), 0
  );

  return {
    ...data,
    loading,
    // Mantido para compatibilidade com o layout (mas agora é no-op externo)
    fetchData: () => { if (barbeariaId) fetchData(barbeariaId, inicioMes, fimMes); },
    estatisticas: {
      receitaBruta: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(totalReceita),
      totalAgendamentos: data.agendamentos.length,
      novosClientes: data.clientesNovos.length,
      dadosGrafico: data.receitaMensal,
    },
  };
}
