'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  History,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Scissors,
  Search,
  User,
} from 'lucide-react';
import { supabase, supabasePublic } from '@/lib/supabase';

type ClienteAgendamento = {
  agendamento_id: string;
  barbearia_id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  status: string;
  valor_estimado: number | null;
  observacoes: string | null;
  servico_nome: string | null;
  barbeiro_nome: string | null;
  barbearia_nome: string | null;
};

type StoredCliente = {
  id?: string;
  nome?: string;
  email?: string;
  telefone?: string;
};

const statusStyle: Record<string, string> = {
  pendente: 'bg-yellow-300/12 text-yellow-300 border-yellow-300/20',
  aceito: 'bg-[#D6B47A]/12 text-[#D6B47A] border-[#D6B47A]/20',
  confirmado: 'bg-[#D6B47A]/12 text-[#D6B47A] border-[#D6B47A]/20',
  recusado: 'bg-[#ff4d4d]/12 text-[#ff8a8a] border-[#ff4d4d]/20',
  atendido: 'bg-blue-400/12 text-blue-300 border-blue-400/20',
  realizado: 'bg-blue-400/12 text-blue-300 border-blue-400/20',
  concluido: 'bg-blue-400/12 text-blue-300 border-blue-400/20',
  cancelado: 'bg-[#ff4d4d]/12 text-[#ff6b6b] border-[#ff4d4d]/20',
};

const statusLabel: Record<string, string> = {
  pendente: 'Aguardando confirmacao',
  aceito: 'Agendamento aceito',
  confirmado: 'Agendamento aceito',
  recusado: 'Agendamento recusado',
  cancelado: 'Cancelado',
  concluido: 'Concluido',
  atendido: 'Concluido',
  realizado: 'Concluido',
};

function formatCurrency(value: number | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return {
    day: date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
    time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

function ClientePortalInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const barbeariaId = searchParams.get('id');
  const nextParam = searchParams.get('next');
  const agendarPath = barbeariaId ? `/agendar?id=${barbeariaId}` : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [barbeariaNome, setBarbeariaNome] = useState('Barbearia');
  const [agendamentos, setAgendamentos] = useState<ClienteAgendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'proximos' | 'historico'>('proximos');

  const ensureClienteLink = useCallback(async (userEmail?: string | null) => {
    if (typeof window === 'undefined') return;
    if (!barbeariaId) return;

    const stored = localStorage.getItem(`meu_caixa_cliente_${barbeariaId}`);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as StoredCliente;
      const telefone = parsed.telefone?.trim();
      const email = (userEmail || parsed.email || '').trim();
      const nome = (parsed.nome || email.split('@')[0] || 'Cliente').trim();

      if (!telefone || telefone.replace(/\D/g, '').length < 10 || !email.includes('@')) return;

      const { error: linkError } = await supabase.rpc('rpc_vincular_cliente_auth', {
        p_barbearia_id: barbeariaId,
        p_nome: nome,
        p_email: email.toLowerCase(),
        p_telefone: telefone,
      });

      if (linkError) {
        console.warn('[ClientePortal] Nao foi possivel vincular cliente salvo:', linkError);
      }
    } catch (err) {
      console.warn('[ClientePortal] Cliente salvo localmente invalido:', err);
    }
  }, [barbeariaId]);

  const loadAppointments = useCallback(async () => {
    setError(null);
    setLoaded(false);

    const { data, error: rpcError } = await supabase.rpc('rpc_cliente_meus_agendamentos_auth', {
      p_barbearia_id: null,
    });
    if (rpcError) throw rpcError;

    const rows = (data || []) as ClienteAgendamento[];
    setAgendamentos(rows);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!barbeariaId) {
        setLoading(false);
        return;
      }

      const { data: shop } = await supabasePublic
        .from('barbearias')
        .select('nome')
        .eq('id', barbeariaId)
        .maybeSingle();

      if (active && shop?.nome) setBarbeariaNome(shop.nome);

      const oauthError = searchParams.get('error_description') || searchParams.get('error');
      if (oauthError && active) {
        setError('O login com Google nao foi concluido. Tente novamente pelo botao de Google no agendamento.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? (await supabase.auth.getUser()).data.user;
      if (!active) return;

      const pendingAfterLogin = sessionStorage.getItem('meu_caixa_google_after_login');
      const shouldReturnToSchedule = nextParam === 'agendar';

      if (!user) {
        if (oauthError && shouldReturnToSchedule) {
          sessionStorage.removeItem('meu_caixa_google_after_login');
          router.replace(agendarPath);
          return;
        }

        setLoading(false);
        return;
      }

      setAccountEmail(user.email ?? null);

      if (shouldReturnToSchedule) {
        sessionStorage.removeItem('meu_caixa_google_after_login');
        router.replace(pendingAfterLogin?.startsWith('/agendar') ? pendingAfterLogin : agendarPath);
        return;
      }

      if (pendingAfterLogin?.startsWith('/agendar')) {
        sessionStorage.removeItem('meu_caixa_google_after_login');
      }

      try {
        await ensureClienteLink(user.email);
        await loadAppointments();
      } catch (err) {
        console.error('[ClientePortal] Erro ao carregar agenda:', err);
        if (active) {
          setError('Nao foi possivel carregar seus agendamentos agora. Tente entrar novamente ou marque um novo horario.');
          setAgendamentos([]);
          setLoaded(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [barbeariaId, agendarPath, ensureClienteLink, loadAppointments, nextParam, router, searchParams]);

  const proximos = useMemo(
    () => agendamentos.filter(item => (
      new Date(item.data_hora_inicio).getTime() >= Date.now()
      && ['pendente', 'aceito', 'confirmado'].includes(item.status)
    )),
    [agendamentos],
  );

  const historico = useMemo(
    () => agendamentos.filter(item => (
      new Date(item.data_hora_inicio).getTime() < Date.now()
      || ['recusado', 'cancelado', 'concluido', 'atendido', 'realizado'].includes(item.status)
    )),
    [agendamentos],
  );

  const visibleAppointments = activeTab === 'proximos' ? proximos : historico;
  const firstName = accountEmail?.split('@')[0] || 'cliente';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (loginError) {
      setError('E-mail ou senha incorretos.');
      setSubmitting(false);
      return;
    }

    setAccountEmail(data.user?.email ?? email.toLowerCase().trim());

    try {
      await ensureClienteLink(data.user?.email ?? email.toLowerCase().trim());
      await loadAppointments();
    } catch (err) {
      console.error('[ClientePortal] Erro apos login:', err);
      setError('Login feito, mas essa conta nao possui agendamentos de cliente vinculados.');
      setAgendamentos([]);
      setLoaded(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    if (!barbeariaId) {
      setError('Link da barbearia invalido.');
      return;
    }

    setSubmitting(true);
    setError(null);
    sessionStorage.setItem(
      'meu_caixa_google_after_login',
      nextParam === 'agendar' ? agendarPath : `/cliente?id=${barbeariaId}`,
    );

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/cliente?id=${barbeariaId}${nextParam === 'agendar' ? '&next=agendar' : ''}`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setAccountEmail(null);
    setAgendamentos([]);
    setLoaded(false);
    setPassword('');
  }

  if (!barbeariaId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] p-6 text-white">
        <div className="max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-[#ff4d4d]" />
          <h1 className="mt-4 text-xl font-black">Link da barbearia ausente</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            Escolha uma barbearia na pagina inicial para acessar a area do cliente correta.
          </p>
          <Link href="/" className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-[#D6B47A] px-6 font-black text-black">
            Ver barbearias
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <div className="blob top-[-12%] left-[-20%]" />
      <div className="blob bottom-[10%] right-[-18%] bg-purple-500/10" style={{ animationDelay: '2s' }} />

      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#050505]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href={`/agendar?id=${barbeariaId}`}
              aria-label="Voltar para agendamento"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.035] text-white/70 transition-all hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D6B47A]/18 text-[#D6B47A]">
              <Scissors className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black text-white sm:text-2xl">{barbeariaNome}</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/55">Area do cliente</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {accountEmail && (
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-white/[0.035] text-white/70 transition-all hover:bg-white/[0.07] hover:text-white sm:w-auto sm:px-4"
                aria-label="Sair da conta"
              >
                <LogOut className="h-4 w-4" />
                <span className="ml-2 hidden text-xs font-black uppercase tracking-[0.16em] sm:inline">Sair</span>
              </button>
            )}
            <Link
              href={`/agendar?id=${barbeariaId}`}
              className="hidden rounded-xl border border-white/12 bg-white/[0.035] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/70 transition-all hover:bg-white/[0.07] hover:text-white sm:block"
            >
              Novo agendamento
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[390px_minmax(0,1fr)] lg:py-12">
        <section className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#D6B47A]">Meus agendamentos</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
              {accountEmail ? 'Conta conectada' : 'Entre na sua conta'}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              {accountEmail
                ? 'Veja seus proximos horarios e o historico completo das barbearias onde voce agendou.'
                : 'Entre com Google ou use a senha criada no seu primeiro agendamento.'}
            </p>

            {!accountEmail ? (
              <div className="mt-7 space-y-5">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={submitting}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.03] font-black text-white transition-all hover:border-[#D6B47A]/35 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base font-black text-black">G</span>
                  Entrar com Google
                </button>

                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-white/30">
                  <span className="h-px flex-1 bg-white/10" />
                  ou use e-mail e senha
                  <span className="h-px flex-1 bg-white/10" />
                </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <label className="block space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">E-mail</span>
                  <span className="relative block">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      placeholder="voce@email.com"
                      className="h-14 w-full rounded-2xl border border-white/15 bg-white/[0.03] pl-12 pr-4 font-bold text-white outline-none transition-all placeholder:text-white/25 focus:border-[#D6B47A]/60"
                    />
                  </span>
                </label>

                <label className="block space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">Senha</span>
                  <span className="relative block">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      placeholder="Sua senha"
                      className="h-14 w-full rounded-2xl border border-white/15 bg-white/[0.03] pl-12 pr-12 font-bold text-white outline-none transition-all placeholder:text-white/25 focus:border-[#D6B47A]/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 transition-colors hover:text-white"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </span>
                </label>

                {error && (
                  <div className="flex gap-3 rounded-2xl border border-[#ff4d4d]/30 bg-[#ff4d4d]/10 p-4 text-sm text-[#ff8a8a]">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#D6B47A] font-black text-black transition-all hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                  Entrar e ver agenda
                </button>
              </form>
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-[#D6B47A]/20 bg-[#D6B47A]/10 p-5">
                <p className="flex items-center gap-3 font-black text-[#D6B47A]">
                  <CheckCircle2 className="h-5 w-5" />
                  {accountEmail}
                </p>
                {error && (
                  <div className="mt-4 space-y-2 text-sm text-[#ff8a8a]">
                    <p>{error}</p>
                    <button
                      type="button"
                      onClick={loadAppointments}
                      className="font-black text-[#D6B47A] underline-offset-4 hover:underline"
                    >
                      Tentar carregar novamente
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <Link
            href={`/agendar?id=${barbeariaId}`}
            className="flex min-h-16 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-5 font-black text-white transition-all hover:bg-white/[0.07] sm:hidden"
          >
            <CalendarDays className="h-5 w-5 text-[#D6B47A]" />
            Fazer novo agendamento
          </Link>
        </section>

        <section className="min-w-0 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-white/45">Ola, {firstName}</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Sua agenda no Meu Caixa</h2>
              </div>
              {loaded && (
                <div className="flex items-center gap-2 rounded-2xl border border-[#D6B47A]/20 bg-[#D6B47A]/10 px-4 py-3 text-sm font-black text-[#D6B47A]">
                  <CheckCircle2 className="h-4 w-4" />
                  {agendamentos.length} encontrados
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-white/[0.035] p-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('proximos')}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-black transition-all ${activeTab === 'proximos' ? 'bg-[#D6B47A] text-black' : 'text-white/55 hover:text-white'}`}
              >
                <Clock3 className="h-4 w-4" />
                Proximos ({proximos.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('historico')}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-black transition-all ${activeTab === 'historico' ? 'bg-[#D6B47A] text-black' : 'text-white/55 hover:text-white'}`}
              >
                <History className="h-4 w-4" />
                Antigos ({historico.length})
              </button>
            </div>
          </div>

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map(item => (
                <div key={item} className="h-32 animate-pulse rounded-3xl border border-white/8 bg-white/[0.04]" />
              ))}
            </div>
          )}

          {!accountEmail && !loading && (
            <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.025] px-6 py-16 text-center">
              <Lock className="mx-auto h-12 w-12 text-white/25" />
              <h3 className="mt-5 text-xl font-black text-white">Login necessario</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/45">
                A conta e criada no agendamento novo. Depois disso, voce entra aqui com Google ou e-mail e senha.
              </p>
            </div>
          )}

          {accountEmail && loaded && !loading && visibleAppointments.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.025] px-6 py-16 text-center">
              <User className="mx-auto h-12 w-12 text-white/25" />
              <h3 className="mt-5 text-xl font-black text-white">
                {activeTab === 'proximos' ? 'Nenhum agendamento futuro' : 'Nenhum agendamento antigo'}
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/45">
                {activeTab === 'proximos'
                  ? 'Quando voce marcar um novo horario, ele aparece aqui.'
                  : 'Seu historico aparece aqui depois dos atendimentos.'}
              </p>
            </div>
          )}

          {accountEmail && loaded && !loading && visibleAppointments.length > 0 && (
            <div className="space-y-4">
              {visibleAppointments.map(appointment => (
                <AppointmentCard key={appointment.agendamento_id} appointment={appointment} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function AppointmentCard({ appointment }: { appointment: ClienteAgendamento }) {
  const { day, time } = formatDateTime(appointment.data_hora_inicio);
  const statusClass = statusStyle[appointment.status] || 'bg-white/8 text-white/60 border-white/10';

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
      <div className="flex flex-col gap-4 border-b border-white/8 bg-white/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-3xl font-black text-[#D6B47A]">{time}</p>
          <p className="mt-1 text-sm capitalize text-white/60">{day}</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass}`}>
          {statusLabel[appointment.status] || appointment.status}
        </span>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <InfoBlock label="Servico" value={appointment.servico_nome || 'Servico'} icon={Scissors} />
        <InfoBlock label="Profissional" value={appointment.barbeiro_nome || 'A definir'} icon={User} />
        <InfoBlock label="Barbearia" value={appointment.barbearia_nome || 'Barbearia'} icon={CalendarDays} />
        <InfoBlock label="Valor" value={formatCurrency(appointment.valor_estimado)} icon={CalendarDays} highlight />
      </div>

      {appointment.observacoes && (
        <div className="border-t border-white/8 px-5 py-4 text-sm text-white/50">
          {appointment.observacoes}
        </div>
      )}
    </article>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-1 h-5 w-5 shrink-0 text-white/35" />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{label}</p>
        <p className={`mt-1 truncate font-black ${highlight ? 'text-[#D6B47A]' : 'text-white'}`}>{value}</p>
      </div>
    </div>
  );
}

export default function ClientePortalPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#D6B47A]" />
      </div>
    }>
      <ClientePortalInner />
    </Suspense>
  );
}
