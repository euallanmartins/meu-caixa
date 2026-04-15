import { DollarSign, TrendingDown, TrendingUp, Star } from 'lucide-react';

interface SummaryProps {
  income: number;
  expenses: number;
  tips: number;
}

export function TransactionSummary({ income, expenses, tips }: SummaryProps) {
  const balance = income - expenses;

  const stats = [
    {
      label: 'Saldo Geral',
      value: balance,
      icon: DollarSign,
      color: balance >= 0 ? 'text-accent' : 'text-danger',
      bg: balance >= 0 ? 'bg-accent/10' : 'bg-danger/10',
      border: balance >= 0 ? 'border-accent/20' : 'border-danger/20',
    },
    {
      label: 'Entradas',
      value: income,
      icon: TrendingUp,
      color: 'text-accent',
      bg: 'bg-accent/10',
      border: 'border-accent/20',
    },
    {
      label: 'Despesas',
      value: expenses,
      icon: TrendingDown,
      color: 'text-danger',
      bg: 'bg-danger/10',
      border: 'border-danger/20',
    },
    {
      label: 'Caixinhas',
      value: tips,
      icon: Star,
      color: 'text-accent-gold',
      bg: 'bg-accent-gold/10',
      border: 'border-accent-gold/20',
    },
  ];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className={`glass rounded-2xl border ${stat.border} p-6 transition-all hover:scale-[1.02]`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                {stat.label}
              </p>
              <h3 className={`mt-1 text-2xl font-bold ${stat.color}`}>
                {formatCurrency(stat.value)}
              </h3>
            </div>
            <div className={`rounded-xl ${stat.bg} p-3`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
