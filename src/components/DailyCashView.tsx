/* eslint-disable */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  CalendarDays,
  DollarSign,
  Lock,
  Plus,
  Star,
  TrendingDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TransactionList } from './TransactionList';
import { ClosingReportModal } from './ClosingReportModal';
import { CashierSessionManager } from './CashierSessionManager';

interface DailyCashViewProps {
  transactions: any[];
  barbers: any[];
  currentSession: any;
  barbeariaId: string;
  refreshData: () => void;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export function DailyCashView({ transactions, barbers, currentSession, barbeariaId, refreshData }: DailyCashViewProps) {
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const incomes = transactions.filter(t => t.type === 'income');
  const tips = transactions.filter(t => t.type === 'tip');
  const expenses = transactions.filter(t => t.type === 'expense');
  const totalExpenses = expenses.reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalByMethod = (method: string) =>
    incomes.reduce((acc, t) => {
      if (t.payments?.length) {
        return acc + t.payments.filter((p: any) => p.metodo === method).reduce((sum: number, p: any) => sum + Number(p.valor || 0), 0);
      }
      return t.method === method ? acc + Number(t.amount || 0) : acc;
    }, 0);

  const cashIncomes = totalByMethod('dinheiro');
  const cardIncomes = totalByMethod('cartao');
  const pixIncomes = totalByMethod('pix');
  const totalDay = cashIncomes + cardIncomes + pixIncomes;
  const totalTips = tips.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const initialBalance = Number(currentSession?.saldo_inicial || 0);
  const drawerNow = initialBalance + cashIncomes;
  const expectedFinal = initialBalance + cashIncomes - totalExpenses;

  async function handleCloseSession() {
    if (!currentSession || closing) return;
    setClosing(true);
    try {
      const { error } = await supabase
        .from('caixa_sessoes')
        .update({
          status: 'fechado',
          fechado_em: new Date().toISOString(),
          saldo_final: expectedFinal,
        })
        .eq('id', currentSession.id)
        .eq('barbearia_id', barbeariaId);

      if (error) throw error;
      refreshData();
    } catch (err: any) {
      alert('Erro ao fechar caixa: ' + err.message);
    } finally {
      setClosing(false);
    }
  }

  if (!currentSession) {
    return (
      <div className="space-y-8">
        <CashierSessionManager
          currentSession={currentSession}
          barbeariaId={barbeariaId}
          onRefresh={refreshData}
          formatCurrency={formatCurrency}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <ClosingReportModal
        isOpen={isClosingModalOpen}
        onClose={() => setIsClosingModalOpen(false)}
        transactions={transactions}
        barbers={barbers}
      />

      <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.045] p-6 text-center shadow-2xl shadow-black/20 sm:p-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#D6B47A]/25 bg-[#D6B47A]/12">
          <BriefcaseBusiness className="h-8 w-8 text-[#D6B47A]" />
        </div>
        <h2 className="text-2xl font-black uppercase text-white sm:text-3xl">Caixa aberto</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/55">
          O caixa ja esta aberto e voce pode lancar vendas, gerenciar faturamento do dia e controlar o fluxo de caixa.
        </p>

        <div className="mx-auto mt-6 grid max-w-md grid-cols-2 divide-x divide-white/10 text-left">
          <div className="pr-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Saldo inicial na gaveta</p>
            <p className="mt-2 text-2xl font-black text-[#D6B47A]">{formatCurrency(initialBalance)}</p>
          </div>
          <div className="pl-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Aberto as</p>
            <p className="mt-2 text-2xl font-black text-white">
              {new Date(currentSession.aberto_em || currentSession.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCloseSession}
          disabled={closing}
          className="mx-auto mt-6 flex h-14 w-full max-w-sm items-center justify-center gap-4 rounded-xl bg-[#D6B47A] font-black uppercase tracking-[0.18em] text-black transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          <Lock className="h-5 w-5" />
          {closing ? 'Fechando...' : 'Fechar caixa do dia'}
          <ArrowRight className="h-5 w-5" />
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Kpi icon={DollarSign} label="Total do dia (bruto)" value={formatCurrency(totalDay)} hint={`${incomes.length} atendimentos`} color="accent" />
        <Kpi icon={Banknote} label="Dinheiro na gaveta (atual)" value={formatCurrency(drawerNow)} hint="Estimado" color="blue" />
        <Kpi icon={Star} label="Gorjetas acumuladas" value={formatCurrency(totalTips)} hint={`${tips.length} gorjetas`} color="gold" />
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#D6B47A]/20 bg-[#D6B47A]/5 p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#D6B47A]">Saldo final esperado</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D6B47A] text-black">
                <Calculator className="h-5 w-5" />
              </div>
            </div>
            <p className="text-4xl font-black text-white">{formatCurrency(expectedFinal)}</p>
            <p className="mt-4 text-sm text-white/55">Calculo: (Inicio + Entradas em dinheiro) - Saidas</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-white">
                <TrendingDown className="h-4 w-4 text-[#ff4d4d]" />
                Saidas (sangrias)
              </h3>
              <Link href="/gestao/financeiro/saidas" className="rounded-lg bg-[#ff4d4d]/12 px-3 py-2 text-[10px] font-black uppercase text-[#ff4d4d]">
                + Lancar
              </Link>
            </div>
            <p className="text-3xl font-black text-white">{formatCurrency(totalExpenses)}</p>
            <p className="mt-3 text-sm text-white/55">{expenses.length} saidas lancadas</p>
          </div>
        </div>

        <TransactionList transactions={transactions} barbeariaId={barbeariaId} onRefresh={refreshData} />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <ActionButton icon={Plus} title="Nova venda" subtitle="Lancar atendimento ou produto" href="/gestao/caixa" primary />
        <ActionButton icon={Star} title="Lancar gorjeta" subtitle="Registrar gorjeta recebida" href="/gestao/financeiro/gorjetas" />
        <ActionButton icon={TrendingDown} title="Lancar saida" subtitle="Registrar saida (sangria)" href="/gestao/financeiro/saidas" danger />
        <button
          type="button"
          onClick={() => setIsClosingModalOpen(true)}
          className="flex min-h-20 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-left transition-all hover:bg-white/[0.08]"
        >
          <span className="flex items-center gap-4">
            <BarChart3 className="h-6 w-6 text-white/55" />
            <span>
              <span className="block font-black uppercase text-white">Relatorio do dia</span>
              <span className="text-sm text-white/55">Ver resumo completo</span>
            </span>
          </span>
          <ArrowRight className="h-5 w-5 text-white/60" />
        </button>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, color }: any) {
  const colors: Record<string, string> = {
    accent: 'bg-[#D6B47A]/12 text-[#D6B47A]',
    blue: 'bg-blue-500/12 text-blue-400',
    gold: 'bg-yellow-400/12 text-yellow-300',
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-6">
      <div className="flex items-center gap-5">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${colors[color]}`}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">{label}</p>
          <p className="mt-1 text-2xl font-black text-white">{value}</p>
          <p className="mt-1 text-sm font-bold text-[#D6B47A]">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, title, subtitle, primary, danger, href }: any) {
  const router = useRouter();
  const content = (
    <>
      <span className="flex items-center gap-4">
        <Icon className={`h-6 w-6 ${primary ? 'text-black' : danger ? 'text-[#ff4d4d]' : 'text-[#D6B47A]'}`} />
        <span>
          <span className={`block font-black uppercase ${primary ? 'text-black' : 'text-white'}`}>{title}</span>
          <span className={`text-sm ${primary ? 'text-black/75' : 'text-white/55'}`}>{subtitle}</span>
        </span>
      </span>
      <ArrowRight className={`h-5 w-5 ${primary ? 'text-black' : 'text-white/60'}`} />
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`flex min-h-20 min-w-0 items-center justify-between gap-4 rounded-2xl px-5 text-left transition-all hover:scale-[1.01] sm:px-6 ${
          primary
            ? 'bg-[#D6B47A]'
            : danger
              ? 'border border-[#ff4d4d]/20 bg-[#ff4d4d]/10'
              : 'border border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
        }`}
      >
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => router.push('/gestao/financeiro')} className="flex min-h-20 min-w-0 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-left transition-all hover:bg-white/[0.08] sm:px-6">
      {content}
    </button>
  );
}
