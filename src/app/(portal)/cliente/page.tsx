'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type ComponentType, type FormEvent } from 'react';
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
  XCircle,
  User,
} from 'lucide-react';
import { supabase, supabasePublic } from '@/lib/supabase';
import { buildPublicUrl } from '@/lib/publicUrl';

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
  idempotency_key?: string | null;
  servico_id?: string | null;
  barbeiro_id?: string | null;
  cliente_confirmou?: boolean | null;
  pode_cancelar?: boolean | null;
  pode_reagendar?: boolean | null;
  avaliacao_id?: string | null;
  avaliado?: boolean | null;
};

type StoredCliente = {
  id?: string;
  nome?: string;
  email?: string;
  telefone?: string;
};

type ClienteWaitlistEntry = {
  id: string;
  barbearia_id: string;
  cliente_nome: string;
  data_preferida: string | null;
  periodo_preferido: string;
  status: string;
  created_at: string;
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
const PLATFORM_ROLES = new Set(['platform_admin', 'super_admin']);
const PROFESSIONAL_ROLES = new Set(['owner', 'admin', 'proprietario', 'barbeiro', 'funcionario', 'gerente', ...PLATFORM_ROLES]);
const AUTH_TIMEOUT_MS = 15000;

type LoginResponse = {
  userId?: string;
  profile?: {
    role?: string | null;
    barbearia_id?: string | null;
  } | null;
  hasClientAccount?: boolean;
  error?: string;
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

function withTimeout<T>(promise: PromiseLike<T>, label: string, ms = AUTH_TIMEOUT_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} demorou demais para responder.`)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function isDuplicateSignup(errorMessage?: string | null, identities?: unknown[] | null) {
  const message = (errorMessage || '').toLowerCase();
  return (
    message.includes('already')
    || message.includes('registered')
    || message.includes('exists')
    || (Array.isArray(identities) && identities.length === 0)
  );
}

function ClientePortalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const barbeariaId = searchParams.get('id');
  const hasBarbeariaContext = Boolean(barbeariaId);
  const appointmentHref = barbeariaId ? `/agendar?id=${barbeariaId}` : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [barbeariaNome, setBarbeariaNome] = useState('Barbearia');
  const [agendamentos, setAgendamentos] = useState<ClienteAgendamento[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<ClienteWaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authHelpVisible, setAuthHelpVisible] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authActionLoading, setAuthActionLoading] = useState<'create' | 'email' | null>(null);
  const [activeTab, setActiveTab] = useState<'proximos' | 'historico'>('proximos');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<ClienteAgendamento | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState('');

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
      p_barbearia_id: barbeariaId ?? null,
    });
    if (rpcError) throw rpcError;

    const rows = (data || []) as ClienteAgendamento[];
    setAgendamentos(rows);

    const { data: waitlistData, error: waitlistError } = await supabase
      .from('waitlist_entries')
      .select('id, barbearia_id, cliente_nome, data_preferida, periodo_preferido, status, created_at')
      .eq(barbeariaId ? 'barbearia_id' : 'status', barbeariaId ?? 'aguardando')
      .order('created_at', { ascending: false });

    if (!waitlistError) setWaitlistEntries((waitlistData || []) as ClienteWaitlistEntry[]);
    setLoaded(true);
  }, [barbeariaId]);

  const retryLoadAppointments = useCallback(async () => {
    try {
      await loadAppointments();
    } catch (err) {
      console.error('[ClientePortal] Erro ao tentar recarregar agenda:', err);
      setError('Nao foi possivel carregar seus agendamentos agora. Tente novamente em instantes.');
      setAgendamentos([]);
      setLoaded(true);
    }
  }, [loadAppointments]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? (await supabase.auth.getUser()).data.user;
      if (!active) return;

      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, barbearia_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.warn('[ClientePortal] Nao foi possivel verificar perfil profissional; seguindo como cliente.', {
            code: profileError.code,
            message: profileError.message,
          });
        }
        if (profile?.role && PLATFORM_ROLES.has(profile.role)) {
          router.replace(profile.barbearia_id ? '/gestao/agenda' : '/admin/plataforma');
          return;
        }

        if (!barbeariaId && profile?.role && PROFESSIONAL_ROLES.has(profile.role) && profile?.barbearia_id) {
          router.replace('/gestao/agenda');
          return;
        }
      }

      if (barbeariaId) {
        const { data: shop } = await supabasePublic
          .from('barbearias')
          .select('nome')
          .eq('id', barbeariaId)
          .maybeSingle();

        if (active && shop?.nome) setBarbeariaNome(shop.nome);
      } else if (active) {
        setBarbeariaNome('Meu Caixa');
      }

      if (!user) {
        setLoading(false);
        return;
      }

      setAccountEmail(user.email ?? null);

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
  }, [barbeariaId, ensureClienteLink, loadAppointments, router]);

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

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setAuthNotice(null);

    const normalizedEmail = email.toLowerCase().trim();

    try {
      const { data: authData, error: authError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        }),
        'Login',
      );

      if (authError || !authData.user) {
        const authMessage = authError?.message?.toLowerCase() || '';
        setAuthHelpVisible(true);
        setError(
          authMessage.includes('email not confirmed')
            ? 'Seu e-mail ainda precisa ser confirmado antes de entrar.'
            : 'E-mail ou senha incorretos. Se voce agendou antes de criar uma senha, crie seu acesso de cliente abaixo.'
        );
        return;
      }

      setAuthHelpVisible(false);
      const response = await withTimeout(
        fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password }),
        }),
        'Login',
      );

      const result = await response.json() as LoginResponse;

      if (!response.ok) {
        setError(result.error || 'E-mail ou senha incorretos.');
        return;
      }

      if (result.profile?.role && PLATFORM_ROLES.has(result.profile.role)) {
        router.replace(result.profile.barbearia_id ? '/gestao/agenda' : '/admin/plataforma');
        return;
      }

      if (result.profile?.role && result.profile.barbearia_id && PROFESSIONAL_ROLES.has(result.profile.role)) {
        router.replace('/gestao/agenda');
        return;
      }

      setAccountEmail(normalizedEmail);

      await ensureClienteLink(normalizedEmail);
      await loadAppointments();
    } catch (err) {
      console.error('[ClientePortal] Erro apos login:', err);
      setAuthHelpVisible(true);
      setError(err instanceof Error && err.message.includes('demorou demais')
        ? 'Nao foi possivel entrar agora. Verifique a conexao e tente novamente.'
        : 'Nao foi possivel carregar seus agendamentos agora. Tente novamente em instantes.');
      setAgendamentos([]);
      setLoaded(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function createClientAccess() {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail.includes('@') || password.length < 6) {
      setError('Informe um e-mail valido e uma senha com pelo menos 6 caracteres.');
      return;
    }

    setAuthActionLoading('create');
    setError(null);
    setAuthNotice(null);

    try {
      const { data, error: signUpError } = await withTimeout(
        supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: buildPublicUrl(barbeariaId ? `/cliente?id=${barbeariaId}` : '/cliente'),
            data: {
              account_type: 'cliente',
              barbearia_id: barbeariaId ?? null,
              full_name: normalizedEmail.split('@')[0],
              telefone: '',
            },
          },
        }),
        'Criacao de acesso',
      );

      if (isDuplicateSignup(signUpError?.message, data.user?.identities)) {
        setAuthHelpVisible(true);
        setError('Essa conta ja existe. Use a recuperacao de senha para receber um novo link de acesso.');
        return;
      }

      if (signUpError) throw signUpError;

      if (!data.session) {
        setAuthHelpVisible(true);
        setAuthNotice('Acesso criado. Confira seu e-mail para confirmar a conta antes de entrar.');
        return;
      }

      await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      setAccountEmail(normalizedEmail);
      setAuthHelpVisible(false);
      setAuthNotice('Acesso criado com sucesso.');
      await ensureClienteLink(normalizedEmail);
      await loadAppointments();
    } catch (err) {
      console.error('[ClientePortal] Erro ao criar acesso de cliente:', err);
      setAuthHelpVisible(true);
      setError('Nao foi possivel criar seu acesso agora. Tente novamente em instantes.');
    } finally {
      setAuthActionLoading(null);
    }
  }

  async function sendAccessEmail() {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail.includes('@')) {
      setError('Informe um e-mail valido para receber o link.');
      return;
    }

    setAuthActionLoading('email');
    setError(null);
    setAuthNotice(null);

    const redirectTo = buildPublicUrl(barbeariaId ? `/cliente?id=${barbeariaId}` : '/cliente');

    try {
      const [{ error: resetError }, { error: resendError }] = await Promise.all([
        supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo }),
        supabase.auth.resend({ type: 'signup', email: normalizedEmail, options: { emailRedirectTo: redirectTo } }),
      ]);

      if (resetError && resendError) throw resetError;

      setAuthHelpVisible(true);
      setAuthNotice('Se existir uma conta para este e-mail, enviamos um link de confirmacao ou recuperacao.');
    } catch (err) {
      console.error('[ClientePortal] Erro ao enviar link de acesso:', err);
      setError('Nao foi possivel enviar o link agora. Tente novamente em instantes.');
    } finally {
      setAuthActionLoading(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setAccountEmail(null);
    setAgendamentos([]);
    setLoaded(false);
    setPassword('');
  }

  async function handleCancelAppointment(appointment: ClienteAgendamento) {
    if (!window.confirm('Cancelar este agendamento?')) return;

    setActionLoadingId(appointment.agendamento_id);
    setActionMessage(null);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('rpc_cliente_cancelar_agendamento', {
        p_agendamento_id: appointment.agendamento_id,
      });

      if (rpcError) throw rpcError;

      const result = data as { success?: boolean; message?: string } | null;
      if (result && result.success === false) {
        setError(result.message || 'Nao foi possivel cancelar este agendamento.');
        return;
      }

      setActionMessage('Agendamento cancelado com sucesso.');
      await loadAppointments();
    } catch (err) {
      console.error('[ClientePortal] Erro ao cancelar agendamento:', err);
      setError('Nao foi possivel cancelar agora. Tente novamente em instantes.');
    } finally {
      setActionLoadingId(null);
    }
  }

  function openReschedule(appointment: ClienteAgendamento) {
    const currentDate = new Date(appointment.data_hora_inicio);
    const value = new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setRescheduleTarget(appointment);
    setRescheduleValue(value);
    setActionMessage(null);
    setError(null);
  }

  async function handleRescheduleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!rescheduleTarget || !rescheduleValue) return;

    setActionLoadingId(rescheduleTarget.agendamento_id);
    setActionMessage(null);
    setError(null);

    try {
      const novoInicio = new Date(rescheduleValue);
      const { data, error: rpcError } = await supabase.rpc('rpc_cliente_reagendar_agendamento', {
        p_agendamento_id: rescheduleTarget.agendamento_id,
        p_novo_inicio: novoInicio.toISOString(),
      });

      if (rpcError) throw rpcError;

      const result = data as { success?: boolean; message?: string } | null;
      if (result && result.success === false) {
        setError(result.message || 'Nao foi possivel reagendar este horario.');
        return;
      }

      setActionMessage('Agendamento reagendado com sucesso.');
      setRescheduleTarget(null);
      await loadAppointments();
    } catch (err) {
      console.error('[ClientePortal] Erro ao reagendar agendamento:', err);
      const message = err instanceof Error ? err.message : '';
      setError(
        /ocupado|conflito|overlap/i.test(message)
          ? 'Esse horario acabou de ser ocupado. Escolha outro horario.'
          : 'Nao foi possivel reagendar agora. Tente novamente em instantes.'
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#050505] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#D6B47A]" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#050505] text-white">
      <div className="blob top-[-12%] left-[-20%]" />
      <div className="blob bottom-[10%] right-[-18%] bg-purple-500/10" style={{ animationDelay: '2s' }} />

      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#050505]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href={appointmentHref}
              aria-label={hasBarbeariaContext ? 'Voltar para agendamento' : 'Ver barbearias'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.035] text-white/70 transition-all hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D6B47A]/18 text-[#D6B47A]">
              <Scissors className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-lg font-black leading-tight text-white sm:text-2xl">{barbeariaNome}</h1>
              <p className="text-[10px] font-black uppercase leading-tight tracking-[0.14em] text-white/55">Area do cliente</p>
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
              href={appointmentHref}
              className="hidden rounded-xl border border-white/12 bg-white/[0.035] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/70 transition-all hover:bg-white/[0.07] hover:text-white sm:block"
            >
              {hasBarbeariaContext ? 'Novo agendamento' : 'Ver barbearias'}
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
                ? hasBarbeariaContext
                  ? 'Veja seus proximos horarios e o historico desta barbearia.'
                  : 'Veja seus proximos horarios e o historico completo das barbearias onde voce agendou.'
                : 'Entre com o e-mail e a senha criados no seu primeiro agendamento.'}
            </p>

            {!accountEmail ? (
              <div className="mt-7 space-y-5">
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

                {authNotice && (
                  <div className="flex gap-3 rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/10 p-4 text-sm font-bold text-[#D6B47A]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{authNotice}</p>
                  </div>
                )}

                {authHelpVisible && (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-sm leading-relaxed text-white/55">
                      Se voce ja agendou mas nunca criou uma senha de cliente, crie o acesso com este e-mail. Se a conta ja existir, envie um link por e-mail.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={createClientAccess}
                        disabled={Boolean(authActionLoading)}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#D6B47A]/25 bg-[#D6B47A]/10 px-3 text-sm font-black text-[#D6B47A] disabled:opacity-55"
                      >
                        {authActionLoading === 'create' && <Loader2 className="h-4 w-4 animate-spin" />}
                        Criar acesso
                      </button>
                      <button
                        type="button"
                        onClick={sendAccessEmail}
                        disabled={Boolean(authActionLoading)}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-white/75 disabled:opacity-55"
                      >
                        {authActionLoading === 'email' && <Loader2 className="h-4 w-4 animate-spin" />}
                        Enviar link
                      </button>
                    </div>
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
                      onClick={retryLoadAppointments}
                      className="font-black text-[#D6B47A] underline-offset-4 hover:underline"
                    >
                      Tentar carregar novamente
                    </button>
                  </div>
                )}
                {actionMessage && (
                  <div className="mt-4 rounded-2xl border border-[#D6B47A]/20 bg-[#D6B47A]/10 p-4 text-sm font-bold text-[#D6B47A]">
                    {actionMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          <Link
            href={appointmentHref}
            className="flex min-h-16 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-5 font-black text-white transition-all hover:bg-white/[0.07] sm:hidden"
          >
            <CalendarDays className="h-5 w-5 text-[#D6B47A]" />
            {hasBarbeariaContext ? 'Fazer novo agendamento' : 'Ver barbearias'}
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
                A conta e criada no agendamento novo. Depois disso, voce entra aqui com e-mail e senha.
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
                <AppointmentCard
                  key={appointment.agendamento_id}
                  appointment={appointment}
                  loading={actionLoadingId === appointment.agendamento_id}
                  onCancel={handleCancelAppointment}
                  onReschedule={openReschedule}
                />
              ))}
            </div>
          )}

          {accountEmail && loaded && waitlistEntries.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <h3 className="text-xl font-black text-white">Lista de espera</h3>
              <div className="mt-4 grid gap-3">
                {waitlistEntries.map(entry => (
                  <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="font-black text-white">{entry.data_preferida || 'Sem data definida'}</p>
                    <p className="mt-1 text-sm text-white/50">{entry.periodo_preferido} | {entry.status}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
          <form
            onSubmit={handleRescheduleSubmit}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101010] p-6 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#D6B47A]">Reagendar</p>
                <h3 className="mt-2 text-2xl font-black text-white">Escolha novo horario</h3>
                <p className="mt-2 text-sm text-white/50">A disponibilidade sera validada antes de salvar.</p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55"
                aria-label="Fechar"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-6 block space-y-2">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">Nova data e horario</span>
              <input
                type="datetime-local"
                required
                value={rescheduleValue}
                onChange={event => setRescheduleValue(event.target.value)}
                className="h-14 w-full rounded-2xl border border-white/15 bg-white/[0.03] px-4 font-bold text-white outline-none transition-all focus:border-[#D6B47A]/60"
              />
            </label>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="h-14 rounded-2xl border border-white/10 bg-white/[0.04] font-black text-white"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={actionLoadingId === rescheduleTarget.agendamento_id}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] font-black text-black disabled:opacity-60"
              >
                {actionLoadingId === rescheduleTarget.agendamento_id && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function AppointmentCard({
  appointment,
  loading,
  onCancel,
  onReschedule,
}: {
  appointment: ClienteAgendamento;
  loading: boolean;
  onCancel: (appointment: ClienteAgendamento) => void;
  onReschedule: (appointment: ClienteAgendamento) => void;
}) {
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

      {(appointment.pode_cancelar || appointment.pode_reagendar || (appointment.avaliado === false && ['concluido', 'realizado', 'atendido'].includes(appointment.status))) && (
        <div className="flex flex-col gap-3 border-t border-white/8 p-5 sm:flex-row sm:items-center sm:justify-end">
          {appointment.avaliado === false && ['concluido', 'realizado', 'atendido'].includes(appointment.status) && (
            <Link
              href={`/avaliar?id=${appointment.barbearia_id}&agendamento=${appointment.agendamento_id}`}
              className="flex h-11 items-center justify-center rounded-xl border border-[#D6B47A]/30 bg-[#D6B47A]/10 px-4 text-sm font-black text-[#D6B47A]"
            >
              Avaliar atendimento
            </Link>
          )}
          {appointment.pode_reagendar && (
            <button
              type="button"
              onClick={() => onReschedule(appointment)}
              disabled={loading}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white transition-all hover:bg-white/[0.08] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Reagendar
            </button>
          )}
          {appointment.pode_cancelar && (
            <button
              type="button"
              onClick={() => onCancel(appointment)}
              disabled={loading}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 px-4 text-sm font-black text-[#ff8a8a] transition-all hover:bg-[#ff4d4d]/15 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancelar
            </button>
          )}
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
        <p className={`mt-1 break-words font-black ${highlight ? 'text-[#D6B47A]' : 'text-white'}`}>{value}</p>
      </div>
    </div>
  );
}

export default function ClientePortalPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#050505] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#D6B47A]" />
      </div>
    }>
      <ClientePortalInner />
    </Suspense>
  );
}
