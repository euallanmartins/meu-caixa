'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Scissors } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

const PLATFORM_ROLES = new Set(['platform_admin', 'super_admin']);
const PROFESSIONAL_ROLES = new Set(['owner', 'admin', 'proprietario', 'barbeiro', 'funcionario', 'gerente', ...PLATFORM_ROLES]);
const ADMIN_ROLES = new Set(['owner', 'admin', 'proprietario', 'gerente', ...PLATFORM_ROLES]);
const AUTH_TIMEOUT_MS = 15000;

type LoginResponse = {
  userId?: string;
  profile?: {
    role?: string | null;
    barbearia_id?: string | null;
    barbeiro_id?: string | null;
  } | null;
  hasClientAccount?: boolean;
  error?: string;
};

function safeRedirect(value: string | null) {
  if (!value) return null;
  if (value === '/admin/plataforma') return value;
  return value.startsWith('/convite/equipe?token=') || value.startsWith('/convite/proprietario?token=') ? value : null;
}

function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-white">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
    </div>
  );
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

function LoginInner() {
  const searchParams = useSearchParams();
  const redirectTo = useMemo(() => safeRedirect(searchParams.get('redirectTo')), [searchParams]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function redirectIfAlreadyLogged() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? (await supabase.auth.getUser()).data.user;
      if (!active || !user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, barbearia_id, barbeiro_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!active) return;
      if (profile?.role && PLATFORM_ROLES.has(profile.role)) {
        router.replace(profile.barbearia_id ? '/gestao/agenda' : '/admin/plataforma');
      }
    }

    redirectIfAlreadyLogged();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await withTimeout(
        fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.toLowerCase().trim(),
            password,
          }),
        }),
        'Login',
      );

      const result = await response.json() as LoginResponse;

      if (!response.ok) {
        setError(result.error || 'E-mail ou senha incorretos.');
        return;
      }

      const userId = result.userId;
      if (!userId) {
        router.replace('/');
        return;
      }

      if (redirectTo === '/admin/plataforma') {
        if (result.profile?.role && PLATFORM_ROLES.has(result.profile.role)) {
          router.replace(result.profile.barbearia_id ? '/gestao/agenda' : '/admin/plataforma');
        } else {
          router.replace('/gestao/agenda');
        }
        return;
      }

      const profile = result.profile;

      if (redirectTo && redirectTo !== '/admin/plataforma') {
        router.replace(redirectTo);
        return;
      }

      if (profile?.role && PLATFORM_ROLES.has(profile.role)) {
        router.replace(profile.barbearia_id ? '/gestao/agenda' : '/admin/plataforma');
        return;
      }

      if (profile?.role === 'barbeiro' && profile.barbearia_id && !profile.barbeiro_id) {
        setError('Seu acesso profissional ainda nao esta vinculado a um barbeiro. Fale com o administrador da barbearia.');
        return;
      }

      if (profile?.role && profile.barbearia_id && PROFESSIONAL_ROLES.has(profile.role)) {
        router.replace(ADMIN_ROLES.has(profile.role) ? '/gestao/caixa' : '/gestao/agenda');
        return;
      }

      router.replace(result.hasClientAccount ? '/cliente' : '/');
    } catch (err) {
      console.error('[Login] Falha ao entrar:', err);
      setError(err instanceof Error && err.message.includes('demorou demais')
        ? 'Nao foi possivel entrar agora. Verifique a conexao e tente novamente.'
        : 'Nao foi possivel concluir o login agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <div className="glass w-full max-w-md rounded-2xl p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 neon-border">
            <Scissors className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Acesso profissional</h1>
          <p className="text-muted text-sm mt-1">Proprietarios e funcionarios</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger border border-danger/20">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted px-1">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-card/50 py-3 pl-11 pr-4 text-white placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted px-1">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-card/50 py-3 pl-11 pr-12 text-white placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                placeholder="Digite sua senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                title={showPassword ? "Esconder senha" : "Ver senha"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent py-4 font-bold text-black transition-all hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(214,180,122,0.4)] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Nao tem acesso profissional? Peca um convite ao dono ou admin da barbearia.
        </p>

        <p className="mt-8 text-center text-xs text-muted">
          Cada equipe acessa apenas o seu estabelecimento.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginInner />
    </Suspense>
  );
}
