'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, LockKeyhole, Mail, Scissors, ShieldCheck, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildPublicUrl } from '@/lib/publicUrl';

function isDuplicateSignup(errorMessage?: string | null, identities?: unknown[] | null) {
  const message = (errorMessage || '').toLowerCase();
  return (
    message.includes('already')
    || message.includes('registered')
    || message.includes('exists')
    || (Array.isArray(identities) && identities.length === 0)
  );
}

function safeInviteRedirect(value: string | null) {
  if (!value) return null;
  return value.startsWith('/convite/equipe?token=') || value.startsWith('/convite/proprietario?token=') ? value : null;
}

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = useMemo(() => safeInviteRedirect(searchParams.get('redirectTo')), [searchParams]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleInviteRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!redirectTo || loading) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        emailRedirectTo: buildPublicUrl(redirectTo),
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (isDuplicateSignup(signUpError?.message, data.user?.identities)) {
      setError('Este e-mail ja possui cadastro. Entre com sua conta ou recupere a senha.');
      setLoading(false);
      return;
    }

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.replace(redirectTo);
      return;
    }

    setMessage('Conta criada. Confirme seu e-mail e depois entre para aceitar o convite.');
    setLoading(false);
  }

  if (redirectTo) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8 sm:py-12">
        <div className="glass w-full max-w-md rounded-2xl p-8 shadow-2xl">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 neon-border">
              <ShieldCheck className="h-8 w-8 text-accent" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Criar conta para convite</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Sua conta nasce comum. O acesso profissional so e liberado depois que voce aceitar um convite valido.
            </p>
          </div>

          <form onSubmit={handleInviteRegister} className="space-y-5">
            {error && <div className="rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
            {message && <div className="rounded-lg border border-accent/20 bg-accent/10 p-3 text-sm text-accent">{message}</div>}

            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted px-1">Nome completo</span>
              <span className="relative block">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-xl border border-border bg-card/50 py-3 pl-11 pr-4 text-white outline-none transition-all focus:border-accent"
                  placeholder="Seu nome"
                />
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted px-1">E-mail do convite</span>
              <span className="relative block">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-border bg-card/50 py-3 pl-11 pr-4 text-white outline-none transition-all focus:border-accent"
                  placeholder="voce@email.com"
                />
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted px-1">Senha</span>
              <span className="relative block">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-border bg-card/50 py-3 pl-11 pr-12 text-white outline-none transition-all focus:border-accent"
                  placeholder="Minimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-accent py-4 font-bold text-black transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Criar conta comum'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Ja tem conta?{' '}
            <Link href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`} className="font-medium text-accent hover:underline">
              Entrar para aceitar
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8 sm:py-12">
      <div className="glass w-full max-w-md rounded-2xl p-8 text-center shadow-2xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 neon-border">
            <LockKeyhole className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Cadastro profissional restrito</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Contas de dono, admin e equipe sao criadas por convite ou por um administrador da barbearia.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <p className="font-bold text-white">Cliente continua pelo agendamento</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                O cadastro publico cria somente conta de cliente para agendar, acompanhar horarios e avaliar atendimentos.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3">
          <Link href="/login" className="flex h-13 items-center justify-center rounded-xl bg-accent px-5 font-bold text-black transition-all hover:scale-[1.01] active:scale-[0.98]">
            Entrar como profissional
          </Link>
          <Link href="/" className="flex h-13 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-5 font-bold text-white transition-all hover:bg-white/[0.07]">
            <Scissors className="h-4 w-4 text-accent" />
            Agendar como cliente
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-background" />}>
      <RegisterInner />
    </Suspense>
  );
}
