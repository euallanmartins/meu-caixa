'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Scissors, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ProfessionalMobileHeader } from '@/components/layout/ProfessionalMobileHeader';
import { FeatureGate } from '@/components/saas/FeatureGate';

type Profile = {
  role: string | null;
  barbearia_id: string | null;
  barbeiro_id: string | null;
};

type Barber = {
  id: string;
  nome: string;
  comissao: number | null;
  comissao_tipo: 'percentual' | 'fixo' | null;
};

type Appointment = {
  id: string;
  status: string | null;
  data_hora_inicio: string;
  valor_estimado: number | null;
  servicos?: { nome?: string | null; valor?: number | null } | null;
  clientes?: { nome?: string | null } | null;
};

type Transaction = {
  id: string;
  valor_total: number | null;
  data: string;
  servicos?: { nome?: string | null } | null;
};

type Tip = {
  id: string;
  valor: number | null;
  data: string;
};

const COMPLETED_STATUSES = new Set(['concluido', 'realizado', 'atendido']);

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfLocalWeek(date = new Date()) {
  const start = startOfLocalDay(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  return start;
}

function startOfLocalMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function estimateCommission(value: number, barber: Barber | null) {
  if (!barber) return 0;
  const commission = Number(barber.comissao || 0);
  if (!commission) return 0;
  return barber.comissao_tipo === 'fixo' ? commission : value * (commission / 100);
}

export default function MeusGanhosPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const user = userData.user;
        if (!user) throw new Error('Login necessario.');

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role, barbearia_id, barbeiro_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        const resolvedProfile = profileData as Profile | null;
        setProfile(resolvedProfile);

        if (resolvedProfile?.role !== 'barbeiro' || !resolvedProfile.barbearia_id || !resolvedProfile.barbeiro_id) {
          throw new Error('Esta area e exclusiva para barbeiros com acesso vinculado.');
        }

        const monthStart = startOfLocalMonth().toISOString();
        const now = new Date().toISOString();

        const [barberRes, appointmentsRes, transactionsRes, tipsRes] = await Promise.all([
          supabase
            .from('barbeiros')
            .select('id, nome, comissao, comissao_tipo')
            .eq('barbearia_id', resolvedProfile.barbearia_id)
            .eq('id', resolvedProfile.barbeiro_id)
            .maybeSingle(),
          supabase
            .from('agendamentos')
            .select('id, status, data_hora_inicio, valor_estimado, servicos(nome, valor), clientes(nome)')
            .eq('barbearia_id', resolvedProfile.barbearia_id)
            .eq('barbeiro_id', resolvedProfile.barbeiro_id)
            .gte('data_hora_inicio', monthStart)
            .lte('data_hora_inicio', now)
            .order('data_hora_inicio', { ascending: false }),
          supabase
            .from('transacoes')
            .select('id, valor_total, data, servicos(nome)')
            .eq('barbearia_id', resolvedProfile.barbearia_id)
            .eq('barbeiro_id', resolvedProfile.barbeiro_id)
            .gte('data', monthStart)
            .lte('data', now)
            .order('data', { ascending: false }),
          supabase
            .from('caixinhas')
            .select('id, valor, data')
            .eq('barbearia_id', resolvedProfile.barbearia_id)
            .eq('barbeiro_id', resolvedProfile.barbeiro_id)
            .gte('data', monthStart)
            .lte('data', now)
            .order('data', { ascending: false }),
        ]);

        if (barberRes.error) throw barberRes.error;
        if (appointmentsRes.error) throw appointmentsRes.error;
        if (transactionsRes.error) throw transactionsRes.error;
        if (tipsRes.error) throw tipsRes.error;

        setBarber((barberRes.data as Barber | null) ?? null);
        setAppointments((appointmentsRes.data || []) as Appointment[]);
        setTransactions((transactionsRes.data || []) as Transaction[]);
        setTips((tipsRes.data || []) as Tip[]);
      } catch (err) {
        console.error('[MeusGanhos] Falha ao carregar ganhos:', err);
        setError(err instanceof Error ? err.message : 'Nao foi possivel carregar seus ganhos.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const summary = useMemo(() => {
    const now = new Date();
    const dayStart = startOfLocalDay(now).getTime();
    const weekStart = startOfLocalWeek(now).getTime();
    const completedAppointments = appointments.filter(item => COMPLETED_STATUSES.has(String(item.status || '')));
    const gross = transactions.reduce((sum, row) => sum + Number(row.valor_total || 0), 0);
    const tipsValue = tips.reduce((sum, row) => sum + Number(row.valor || 0), 0);
    const commission = transactions.reduce((sum, row) => sum + estimateCommission(Number(row.valor_total || 0), barber), 0);
    const todayGross = transactions
      .filter(row => new Date(row.data).getTime() >= dayStart)
      .reduce((sum, row) => sum + Number(row.valor_total || 0), 0);
    const weekGross = transactions
      .filter(row => new Date(row.data).getTime() >= weekStart)
      .reduce((sum, row) => sum + Number(row.valor_total || 0), 0);

    return {
      completed: completedAppointments.length,
      gross,
      tipsValue,
      commission,
      todayGross,
      weekGross,
      monthGross: gross,
    };
  }, [appointments, barber, tips, transactions]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#D6B47A] border-t-transparent" />
      </div>
    );
  }

  if (error || profile?.role !== 'barbeiro') {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
        <Wallet className="mx-auto h-10 w-10 text-[#D6B47A]" />
        <h1 className="mt-4 text-2xl font-black text-white">Acesso indisponivel</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">{error || 'Esta area e exclusiva para barbeiros.'}</p>
      </div>
    );
  }

  return (
    <FeatureGate
      barbeariaId={profile?.barbearia_id}
      featureKey="barber_commissions"
      fallbackTitle="Meus ganhos"
      fallbackDescription="Comissoes individuais e ganhos por profissional fazem parte do plano PRO."
      requiredPlan="PRO"
    >
    <div className="space-y-6">
      <ProfessionalMobileHeader icon={Wallet} title="Meus ganhos" subtitle="Resumo individual do mes" />

      <section className="rounded-3xl border border-white/10 bg-[#111]/80 p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D6B47A]">Profissional</p>
        <h1 className="mt-2 text-3xl font-black text-white">{barber?.nome || 'Barbeiro'}</h1>
        <p className="mt-1 text-sm text-white/45">Valores filtrados apenas para sua agenda.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GainCard icon={Wallet} label="Hoje" value={money(summary.todayGross)} />
        <GainCard icon={CalendarDays} label="Semana" value={money(summary.weekGross)} />
        <GainCard icon={TrendingUp} label="Mes" value={money(summary.monthGross)} />
        <GainCard icon={Scissors} label="Atendimentos" value={summary.completed} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <GainCard icon={Wallet} label="Comissao estimada" value={money(summary.commission)} />
        <GainCard icon={TrendingUp} label="Caixinhas" value={money(summary.tipsValue)} />
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-xl font-black text-white">Historico recente</h2>
        <div className="mt-4 grid gap-3">
          {transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
              Nenhum atendimento finalizado no periodo.
            </div>
          ) : (
            transactions.slice(0, 12).map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="min-w-0">
                  <p className="truncate font-black text-white">{row.servicos?.nome || 'Atendimento'}</p>
                  <p className="mt-1 text-xs text-white/40">{new Date(row.data).toLocaleDateString('pt-BR')}</p>
                </div>
                <p className="font-black text-[#D6B47A]">{money(Number(row.valor_total || 0))}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
    </FeatureGate>
  );
}

function GainCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
      <Icon className="h-6 w-6 text-[#D6B47A]" />
      <p className="mt-5 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{label}</p>
    </div>
  );
}
