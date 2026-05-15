'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail, Scissors, ShieldCheck, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type InviteInfo = {
  barbearia_nome: string;
  email: string;
  nome: string | null;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  barbeiro_id?: string | null;
  barbeiro_nome?: string | null;
};

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    proprietario: 'Proprietario',
    gerente: 'Gerente',
    barbeiro: 'Barbeiro',
    funcionario: 'Funcionario',
  };
  return labels[role] || role;
}

function redirectPath(token: string) {
  return `/convite/equipe?token=${encodeURIComponent(token)}`;
}

function InviteTeamInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnTo = useMemo(() => redirectPath(token), [token]);

  const loadInvite = useCallback(async () => {
    if (!token) {
      setError('Convite invalido.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [{ data: inviteData, error: inviteError }, { data: sessionData }] = await Promise.all([
        supabase.rpc('rpc_get_team_invite_by_token', { p_token: token }),
        supabase.auth.getSession(),
      ]);

      if (inviteError) throw inviteError;
      const row = Array.isArray(inviteData) ? inviteData[0] : inviteData;
      if (!row) {
        setInvite(null);
        setError('Convite invalido.');
      } else {
        setInvite(row as InviteInfo);
      }

      const sessionUser = sessionData.session?.user ?? (await supabase.auth.getUser()).data.user;
      setUserEmail(sessionUser?.email ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel carregar o convite.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInvite();
  }, [loadInvite]);

  async function acceptInvite() {
    if (!token || accepting) return;
    setAccepting(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc('rpc_accept_team_invite', {
        p_token: token,
      });

      if (rpcError) throw rpcError;
      router.replace('/gestao/agenda');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel aceitar o convite.';
      setError(message);
      await loadInvite();
    } finally {
      setAccepting(false);
    }
  }

  const emailMismatch = Boolean(invite?.email && userEmail && invite.email.toLowerCase() !== userEmail.toLowerCase());
  const unavailableMessage =
    invite?.status === 'accepted'
      ? 'Convite ja utilizado.'
      : invite?.status === 'expired'
        ? 'Convite expirado.'
        : invite?.status === 'cancelled'
          ? 'Convite cancelado.'
          : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] px-4 py-8 text-white sm:px-6">
      <div className="blob left-[-20%] top-[-12%]" />
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
        <section className="w-full rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-7 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D6B47A]/15 text-[#D6B47A]">
              <UserPlus className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#D6B47A]">Meu Caixa</p>
              <h1 className="mt-1 text-2xl font-black text-white">Convite de equipe</h1>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-56 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#D6B47A]" />
            </div>
          ) : (
            <div className="space-y-5">
              {error && (
                <div className="flex gap-3 rounded-2xl border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 p-4 text-sm text-[#ff8a8a]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {!invite ? (
                <StateBlock icon={AlertCircle} title="Convite invalido" text="Verifique se o link esta completo ou peca um novo convite ao administrador." />
              ) : unavailableMessage ? (
                <StateBlock icon={Lock} title={unavailableMessage} text="Solicite um novo convite ao dono ou administrador da barbearia." />
              ) : (
                <>
                  <div className="rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/10 p-5">
                    <p className="font-black text-[#D6B47A]">Voce foi convidado para {invite.barbearia_nome}</p>
                    <p className="mt-2 text-sm text-white/60">
                      Funcao: <span className="font-black text-white">{roleLabel(invite.role)}</span>
                    </p>
                    {invite.role === 'barbeiro' && invite.barbeiro_nome && (
                      <p className="mt-1 text-sm text-white/60">
                        Agenda vinculada: <span className="font-black text-white">{invite.barbeiro_nome}</span>
                      </p>
                    )}
                    <p className="mt-1 text-sm text-white/60">
                      Expira em {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-white">
                      <Mail className="h-4 w-4 text-[#D6B47A]" />
                      {invite.email}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-white/45">
                      Por seguranca, o convite so pode ser aceito por uma conta com este mesmo e-mail.
                    </p>
                  </div>

                  {!userEmail ? (
                    <div className="grid gap-3">
                      <Link
                        href={`/login?redirectTo=${encodeURIComponent(returnTo)}`}
                        className="flex h-13 items-center justify-center rounded-2xl bg-[#D6B47A] font-black text-black"
                      >
                        Entrar para aceitar
                      </Link>
                      <Link
                        href={`/register?redirectTo=${encodeURIComponent(returnTo)}`}
                        className="flex h-13 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] font-black text-white"
                      >
                        Criar conta para aceitar
                      </Link>
                    </div>
                  ) : emailMismatch ? (
                    <StateBlock icon={ShieldCheck} title="Este convite foi enviado para outro email." text={`Voce esta logado como ${userEmail}. Saia e entre com ${invite.email}.`} />
                  ) : (
                    <button
                      type="button"
                      onClick={acceptInvite}
                      disabled={accepting}
                      className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] font-black text-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {accepting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                      {accepting ? 'Aceitando convite...' : 'Aceitar convite'}
                    </button>
                  )}
                </>
              )}

              <Link href="/" className="flex h-12 items-center justify-center gap-2 text-sm font-bold text-white/45 hover:text-white">
                <Scissors className="h-4 w-4" />
                Voltar ao Meu Caixa
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StateBlock({
  icon: Icon,
  title,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-center">
      <Icon className="mx-auto h-9 w-9 text-[#D6B47A]" />
      <p className="mt-4 font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{text}</p>
    </div>
  );
}

export default function InviteTeamPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#D6B47A]" />
      </div>
    }>
      <InviteTeamInner />
    </Suspense>
  );
}
