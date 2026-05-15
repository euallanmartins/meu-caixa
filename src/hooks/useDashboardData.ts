/* eslint-disable */
import { useEffect, useState } from 'react';
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
  payments?: { metodo: string; valor: number }[];
}

export interface DashboardBarber {
  id: string;
  nome: string;
  comissao: number;
  comissao_tipo: 'percentual' | 'fixo';
  ativo: boolean;
  barbearia_id: string;
  foto_url?: string;
  titulo?: string;
  telefone?: string;
  destaque_label?: string;
}

export interface CaixaSession {
  id: string;
  barbearia_id: string;
  aberto_por?: string;
  usuario_id?: string;
  data_abertura?: string;
  aberto_em?: string;
  created_at?: string;
  saldo_inicial?: number;
  saldo_final?: number;
  valor_inicial?: number;
  status: 'aberto' | 'fechado';
}

export interface DashboardAppointment {
  id: string;
  status: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  valor_estimado?: number;
  barbeiro_id?: string;
  clientes?: { nome?: string } | null;
  servicos?: { nome?: string; valor?: number } | null;
  barbeiros?: { nome?: string } | null;
}

export interface BarberPerformance {
  appointments: number;
  completed: number;
  canceled: number;
  revenue: number;
}

export interface DashboardStats {
  todayAppointments: DashboardAppointment[];
  upcomingAppointments: DashboardAppointment[];
  appointmentsToday: number;
  inService: number;
  absent: number;
  monthRevenue: number;
  monthAppointments: number;
  perBarber: Record<string, BarberPerformance>;
}

const emptyStats: DashboardStats = {
  todayAppointments: [],
  upcomingAppointments: [],
  appointmentsToday: 0,
  inService: 0,
  absent: 0,
  monthRevenue: 0,
  monthAppointments: 0,
  perBarber: {},
};

const startOfLocalDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfNextLocalDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

const startOfLocalMonth = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const startOfNextLocalMonth = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 1);

export function useDashboardData(barbeariaId: string | null, scopeBarbeiroId?: string | null) {
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
  const [barbers, setBarbers] = useState<DashboardBarber[]>([]);
  const [currentSession, setCurrentSession] = useState<CaixaSession | null>(null);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);

  async function fetchTransactions() {
    if (!barbeariaId) {
      setTransactions([]);
      setBarbers([]);
      setStats(emptyStats);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const now = new Date();
      const dayStartISO = startOfLocalDay(now).toISOString();
      const dayEndISO = startOfNextLocalDay(now).toISOString();
      const monthStartISO = startOfLocalMonth(now).toISOString();
      const monthEndISO = startOfNextLocalMonth(now).toISOString();
      const scope = scopeBarbeiroId || null;

      let barbersQuery = supabase
        .from('barbeiros')
        .select('*')
        .eq('barbearia_id', barbeariaId)
        .eq('ativo', true)
        .order('nome');

      let transacoesQuery = supabase
        .from('transacoes')
        .select(`
          id,
          valor_total,
          data,
          cliente_nome,
          barbeiro_id,
          servicos ( nome ),
          barbeiros ( nome, comissao, comissao_tipo ),
          transacao_pagamentos ( metodo, valor ),
          venda_produtos ( quantidade, produtos ( nome ) )
        `)
        .eq('barbearia_id', barbeariaId)
        .gte('data', dayStartISO)
        .lt('data', dayEndISO)
        .order('data', { ascending: false });

      let caixinhasQuery = supabase
        .from('caixinhas')
        .select('id, valor, metodo, data, barbeiro_id, barbeiros(nome)')
        .eq('barbearia_id', barbeariaId)
        .gte('data', dayStartISO)
        .lt('data', dayEndISO);

      let vendasProdutosQuery = supabase
        .from('venda_produtos')
        .select('id, transacao_id, valor_total, created_at, produto_id, comissao_total, barbeiro_id, produtos(nome), barbeiros(nome)')
        .eq('barbearia_id', barbeariaId)
        .is('transacao_id', null)
        .gte('created_at', dayStartISO)
        .lt('created_at', dayEndISO);

      let todayAppointmentsQuery = supabase
        .from('agendamentos')
        .select(`
          id, status, data_hora_inicio, data_hora_fim, valor_estimado, barbeiro_id,
          clientes(nome),
          servicos(nome, valor),
          barbeiros(nome)
        `)
        .eq('barbearia_id', barbeariaId)
        .gte('data_hora_inicio', dayStartISO)
        .lt('data_hora_inicio', dayEndISO)
        .order('data_hora_inicio', { ascending: true });

      let monthAppointmentsQuery = supabase
        .from('agendamentos')
        .select('id, status, data_hora_inicio, valor_estimado, barbeiro_id, servicos(valor)')
        .eq('barbearia_id', barbeariaId)
        .gte('data_hora_inicio', monthStartISO)
        .lt('data_hora_inicio', monthEndISO);

      let monthTransactionsQuery = supabase
        .from('transacoes')
        .select('id, valor_total, barbeiro_id, data')
        .eq('barbearia_id', barbeariaId)
        .gte('data', monthStartISO)
        .lt('data', monthEndISO);

      let standaloneProductMonthQuery = supabase
        .from('venda_produtos')
        .select('id, transacao_id, valor_total, barbeiro_id, created_at')
        .eq('barbearia_id', barbeariaId)
        .is('transacao_id', null)
        .gte('created_at', monthStartISO)
        .lt('created_at', monthEndISO);

      if (scope) {
        barbersQuery = barbersQuery.eq('id', scope);
        transacoesQuery = transacoesQuery.eq('barbeiro_id', scope);
        caixinhasQuery = caixinhasQuery.eq('barbeiro_id', scope);
        vendasProdutosQuery = vendasProdutosQuery.eq('barbeiro_id', scope);
        todayAppointmentsQuery = todayAppointmentsQuery.eq('barbeiro_id', scope);
        monthAppointmentsQuery = monthAppointmentsQuery.eq('barbeiro_id', scope);
        monthTransactionsQuery = monthTransactionsQuery.eq('barbeiro_id', scope);
        standaloneProductMonthQuery = standaloneProductMonthQuery.eq('barbeiro_id', scope);
      }

      const [
        barbersRes,
        transacoesRes,
        despesasRes,
        caixinhasRes,
        vendasProdutosRes,
        todayAppointmentsRes,
        monthAppointmentsRes,
        monthTransactionsRes,
        standaloneProductMonthRes,
      ] = await Promise.all([
        barbersQuery,
        transacoesQuery,
        scope
          ? Promise.resolve({ data: [], error: null })
          : supabase
            .from('despesas')
            .select('id, descricao, valor, data')
            .eq('barbearia_id', barbeariaId)
            .gte('data', dayStartISO)
            .lt('data', dayEndISO),
        caixinhasQuery,
        vendasProdutosQuery,
        todayAppointmentsQuery,
        monthAppointmentsQuery,
        monthTransactionsQuery,
        standaloneProductMonthQuery,
      ]);

      if (barbersRes.error) throw barbersRes.error;
      if (transacoesRes.error) throw transacoesRes.error;
      if (despesasRes.error) throw despesasRes.error;
      if (caixinhasRes.error) throw caixinhasRes.error;
      if (vendasProdutosRes.error) throw vendasProdutosRes.error;
      if (todayAppointmentsRes.error) throw todayAppointmentsRes.error;
      if (monthAppointmentsRes.error) throw monthAppointmentsRes.error;
      if (monthTransactionsRes.error) throw monthTransactionsRes.error;
      if (standaloneProductMonthRes.error) throw standaloneProductMonthRes.error;

      const barbersData = barbersRes.data || [];
      const transacoesData = transacoesRes.data || [];
      const despesasData = despesasRes.data || [];
      const caixinhasData = caixinhasRes.data || [];
      const vendasProdutosData = vendasProdutosRes.data || [];

      setBarbers(barbersData);

      const formattedIncomes = (transacoesData || []).map((t: Record<string, any>) => {
        const payments = t.transacao_pagamentos || [];
        const method = payments.length > 0 ? payments[0].metodo : 'outro';
        const productSale = Array.isArray(t.venda_produtos) ? t.venda_produtos[0] : null;
        const servName = productSale?.produtos?.nome
          ? `Venda: ${productSale.produtos.nome}`
          : t.servicos?.nome || 'Venda registrada';
        const clientName = t.cliente_nome ? ` - ${t.cliente_nome}` : '';

        return {
          id: t.id,
          description: `${servName}${clientName}`,
          amount: Number(t.valor_total || 0),
          type: 'income' as TransactionType,
          date: t.data,
          method: method as DashboardTransaction['method'],
          payments: payments.map((p: Record<string, any>) => ({ metodo: p.metodo, valor: Number(p.valor || 0) })),
          barbeiro_id: t.barbeiro_id,
          comissao: t.barbeiros ? (
            t.barbeiros.comissao_tipo === 'percentual'
              ? (Number(t.valor_total || 0) * (Number(t.barbeiros.comissao || 0) / 100))
              : Number(t.barbeiros.comissao || 0)
          ) : 0,
        };
      });

      const formattedExpenses = (despesasData || []).map((d: Record<string, any>) => ({
        id: d.id,
        description: d.descricao,
        amount: Number(d.valor || 0),
        type: 'expense' as TransactionType,
        date: d.data,
        method: 'outro' as DashboardTransaction['method'],
      }));

      const formattedTips = (caixinhasData || []).map((c: Record<string, any>) => ({
        id: c.id,
        description: `Caixinha - ${c.barbeiros ? c.barbeiros.nome : 'Barbeiro'}`,
        amount: Number(c.valor || 0),
        type: 'tip' as TransactionType,
        date: c.data,
        method: c.metodo as DashboardTransaction['method'],
        barbeiro_id: c.barbeiro_id,
      }));

      const formattedProductSales = (vendasProdutosData || []).map((v: Record<string, any>) => ({
        id: v.id,
        description: `Venda: ${v.produtos ? v.produtos.nome : 'Produto'} (${v.barbeiros ? v.barbeiros.nome : 'Barbeiro'})`,
        amount: Number(v.valor_total || 0),
        type: 'income' as TransactionType,
        date: v.created_at,
        method: 'outro' as DashboardTransaction['method'],
        barbeiro_id: v.barbeiro_id,
        comissao: Number(v.comissao_total || 0),
      }));

      const allTransactions = [
        ...formattedIncomes,
        ...formattedExpenses,
        ...formattedTips,
        ...formattedProductSales,
      ];

      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTransactions);

      const todayAppointments = (todayAppointmentsRes.data || []) as DashboardAppointment[];
      const monthAppointments = (monthAppointmentsRes.data || []) as Record<string, any>[];
      const monthTransactions = (monthTransactionsRes.data || []) as Record<string, any>[];
      const standaloneProductMonth = (standaloneProductMonthRes.data || []) as Record<string, any>[];

      const activeStatuses = ['pendente', 'aceito', 'confirmado', 'em_atendimento'];
      const completedStatuses = ['atendido', 'realizado', 'concluido', 'concluído'];
      const canceledStatuses = ['cancelado', 'cancelada'];
      const absentStatuses = ['ausente', 'nao_compareceu', 'não_compareceu'];

      const upcomingAppointments = todayAppointments
        .filter(app => activeStatuses.includes(String(app.status)) && new Date(app.data_hora_inicio) >= now)
        .slice(0, 5);

      const inService = todayAppointments.filter(app => {
        const status = String(app.status);
        const start = new Date(app.data_hora_inicio).getTime();
        const end = new Date(app.data_hora_fim).getTime();
        return status === 'em_atendimento' || (['aceito', 'confirmado'].includes(status) && now.getTime() >= start && now.getTime() <= end);
      }).length;

      const perBarber = (barbersData || []).reduce((acc: Record<string, BarberPerformance>, barber: Record<string, any>) => {
        acc[barber.id] = { appointments: 0, completed: 0, canceled: 0, revenue: 0 };
        return acc;
      }, {});

      monthAppointments.forEach(app => {
        const barberId = app.barbeiro_id;
        if (!barberId) return;
        if (!perBarber[barberId]) perBarber[barberId] = { appointments: 0, completed: 0, canceled: 0, revenue: 0 };
        perBarber[barberId].appointments += 1;
        if (completedStatuses.includes(String(app.status))) perBarber[barberId].completed += 1;
        if (canceledStatuses.includes(String(app.status))) perBarber[barberId].canceled += 1;
      });

      const addRevenue = (row: Record<string, any>) => {
        const barberId = row.barbeiro_id;
        const value = Number(row.valor_total || 0);
        if (barberId) {
          if (!perBarber[barberId]) perBarber[barberId] = { appointments: 0, completed: 0, canceled: 0, revenue: 0 };
          perBarber[barberId].revenue += value;
        }
        return value;
      };

      const serviceRevenue = monthTransactions.reduce((acc, row) => acc + addRevenue(row), 0);
      const productRevenue = standaloneProductMonth.reduce((acc, row) => acc + addRevenue(row), 0);

      setStats({
        todayAppointments,
        upcomingAppointments,
        appointmentsToday: todayAppointments.length,
        inService,
        absent: todayAppointments.filter(app => absentStatuses.includes(String(app.status))).length,
        monthRevenue: serviceRevenue + productRevenue,
        monthAppointments: monthAppointments.length,
        perBarber,
      });
    } catch (error) {
      console.error('Erro ao buscar dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchActiveSession() {
    if (!barbeariaId) return;
    const { data, error } = await supabase
      .from('caixa_sessoes')
      .select('*')
      .eq('barbearia_id', barbeariaId)
      .eq('status', 'aberto')
      .maybeSingle();

    if (error) console.error('Erro ao buscar sessao ativa:', error);
    setCurrentSession(data);
  }

  useEffect(() => {
    fetchTransactions();
    fetchActiveSession();
  }, [barbeariaId, scopeBarbeiroId]);

  return {
    transactions,
    barbers,
    currentSession,
    stats,
    loading,
    refreshData: () => {
      fetchTransactions();
      fetchActiveSession();
    },
  };
}
