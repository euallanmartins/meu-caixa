import { useState } from 'react';
import { DollarSign, CreditCard, Banknote, Sparkles, TrendingDown, Plus, History } from 'lucide-react';
import { TransactionList } from './TransactionList';
import { ClosingReportModal } from './ClosingReportModal';

interface DailyCashViewProps {
  transactions: any[];
  barbers: any[];
  refreshData: () => void;
}

export function DailyCashView({ transactions, barbers, refreshData }: DailyCashViewProps) {
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  
  // Calculations based on the prompt requirements
  const totalIncomes = transactions.filter(t => t.type === 'income');
  const totalTips = transactions.filter(t => t.type === 'tip');
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const byMethod = {
    dinheiro: transactions.filter(t => t.type === 'income').reduce((acc, t) => {
      if (t.payments && t.payments.length > 0) {
        return acc + t.payments.filter((p: any) => p.metodo === 'dinheiro').reduce((sum: number, p: any) => sum + p.valor, 0);
      }
      return t.method === 'dinheiro' ? acc + t.amount : acc;
    }, 0),
    pix: transactions.filter(t => t.type === 'income').reduce((acc, t) => {
      if (t.payments && t.payments.length > 0) {
        return acc + t.payments.filter((p: any) => p.metodo === 'pix').reduce((sum: number, p: any) => sum + p.valor, 0);
      }
      return t.method === 'pix' ? acc + t.amount : acc;
    }, 0),
    cartao: transactions.filter(t => t.type === 'income').reduce((acc, t) => {
      if (t.payments && t.payments.length > 0) {
        return acc + t.payments.filter((p: any) => p.metodo === 'cartao').reduce((sum: number, p: any) => sum + p.valor, 0);
      }
      return t.method === 'cartao' ? acc + t.amount : acc;
    }, 0),
  };

  const tipsInCash = totalTips.filter(t => t.method === 'dinheiro').reduce((acc, t) => acc + t.amount, 0);
  const totalDay = byMethod.dinheiro + byMethod.pix + byMethod.cartao;
  
  // Cálculo exato conforme solicitado pelo usuário:
  // (Total do Dia - Cartão - Pix) = Dinheiro Disponível
  // (Dinheiro Disponível - Saídas) = Valor que tem que ter no caixa
  const cashAvailable = totalDay - byMethod.cartao - byMethod.pix;
  const finalCashBalance = cashAvailable - totalExpenses;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Caixa do Dia</h2>
          <p className="text-sm text-muted">Controle total da sua gaveta física</p>
        </div>
        <button 
          onClick={() => setIsClosingModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent p-3 sm:p-2.5 px-5 font-bold text-black hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_15px_rgba(20,255,214,0.3)] w-full sm:w-auto"
        >
          <History className="h-4 w-4" />
          Fechar Dia
        </button>
      </div>

      <ClosingReportModal 
        isOpen={isClosingModalOpen} 
        onClose={() => setIsClosingModalOpen(false)} 
        transactions={transactions}
        barbers={barbers}
      />

      {/* Main Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-6 border border-border/50">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted">Total do Dia (Bruto)</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalDay)}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-border/50">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted">Dinheiro Disponível</p>
              <p className="text-xl font-bold text-white">{formatCurrency(cashAvailable)}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-border/50">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-accent-gold/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-accent-gold" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted">Gorjetas (Caixinhas)</p>
              <p className="text-xl font-bold text-accent-gold">{formatCurrency(totalTips.reduce((acc, t) => acc + t.amount, 0))}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass p-4 rounded-2xl border border-white/5 bg-white/5 flex justify-between items-center">
           <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-accent-gold opacity-50" />
              <span className="text-xs text-muted uppercase font-bold tracking-tighter">Comissões da Equipe</span>
           </div>
           <span className="text-sm font-bold text-white">{formatCurrency(transactions.reduce((acc, t) => acc + (t.comissao || 0), 0))}</span>
        </div>
        <div className="glass p-4 rounded-2xl border border-white/5 bg-white/5 flex justify-between items-center">
           <div className="flex items-center gap-3">
              <div className="flex gap-1">
                 <div className="h-2 w-2 rounded-full bg-accent-gold"></div>
                 <div className="h-2 w-2 rounded-full bg-accent"></div>
              </div>
              <span className="text-xs text-muted uppercase font-bold tracking-tighter">Métodos: Pix/Cartão</span>
           </div>
           <span className="text-sm font-bold text-white">{formatCurrency(byMethod.pix + byMethod.cartao)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Drawer and Expenses */}
        <div className="lg:col-span-1 space-y-6">
          {/* Final Drawer Status (The Green Card) */}
          <div className="glass rounded-2xl p-6 border-2 border-accent/20 bg-accent/5 ring-1 ring-accent/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase font-bold text-accent tracking-widest">Valor que tem que ter no caixa</p>
              <div className="p-2 bg-accent rounded-lg">
                <Banknote className="h-4 w-4 text-black" />
              </div>
            </div>
            <h3 className="text-2xl sm:text-4xl font-black text-white">{formatCurrency(finalCashBalance)}</h3>
            <p className="mt-4 text-[10px] text-muted italic">
              Cálculo: (Total - Pix - Cartão) - Saídas
            </p>
          </div>

          {/* Expenses Section */}
          <div className="glass rounded-2xl p-6 border border-border shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-white flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-danger" />
                Saídas
              </h4>
              <button className="p-1 px-3 rounded-lg bg-danger/10 text-danger text-[10px] font-bold uppercase hover:bg-danger/20 transition-all">
                + Adicionar
              </button>
            </div>

            {totalExpenses === 0 ? (
              <p className="text-sm text-center py-4 text-muted border border-dashed border-border rounded-xl">Nenhuma saída registrada</p>
            ) : (
              <div className="space-y-4">
                {transactions.filter(t => t.type === 'expense').map(exp => (
                  <div key={exp.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <div>
                      <p className="font-bold text-sm text-white">{exp.description}</p>
                      <p className="text-[10px] text-muted uppercase tracking-tighter">Saída de caixa</p>
                    </div>
                    <p className="font-bold text-danger">-{formatCurrency(exp.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Full Log */}
        <div className="lg:col-span-2">
           <TransactionList transactions={transactions} onRefresh={refreshData} />
        </div>
      </div>
    </div>
  );
}
