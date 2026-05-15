'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock3, Copy, Send, ShieldAlert, UserPlus, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildPublicUrl } from '@/lib/publicUrl';
import { TeamInviteModal } from './TeamInviteModal';

type TeamInvite = {
  id: string;
  email: string;
  nome: string | null;
  telefone: string | null;
  role: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  created_at: string;
  email_status?: string | null;
  barbeiro_id?: string | null;
  barbeiros?: { nome?: string | null } | null;
};

interface TeamInvitesPanelProps {
  barbeariaId: string | null;
  currentRole?: string | null;
  barbers?: Array<{ id: string; nome: string; ativo?: boolean | null }>;
}

const ADMIN_ROLES = new Set(['owner', 'admin', 'proprietario', 'gerente', 'platform_admin', 'super_admin']);

function inviteLink(token: string) {
  return buildPublicUrl(`/convite/equipe?token=${encodeURIComponent(token)}`);
}

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

export function TeamInvitesPanel({ barbeariaId, currentRole, barbers = [] }: TeamInvitesPanelProps) {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManageInvites = Boolean(currentRole && ADMIN_ROLES.has(currentRole));
  const pendingInvites = useMemo(() => invites.filter(invite => invite.status === 'pending'), [invites]);

  const loadInvites = useCallback(async () => {
    if (!barbeariaId || !canManageInvites) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from('team_invites')
        .select('id, email, nome, telefone, role, token, status, expires_at, created_at, email_status, barbeiro_id, barbeiros(nome)')
        .eq('barbearia_id', barbeariaId)
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      setInvites((data || []) as TeamInvite[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel carregar convites.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [barbeariaId, canManageInvites]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  async function copyInvite(invite: TeamInvite) {
    const link = inviteLink(invite.token);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch (err) {
      console.warn('[TeamInvitesPanel] Clipboard indisponivel:', err);
      window.prompt('Copie o link do convite:', link);
      setCopiedId(invite.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    }
  }

  async function cancelInvite(invite: TeamInvite) {
    if (invite.status !== 'pending') return;
    setError(null);

    const { error: rpcError } = await supabase.rpc('rpc_cancel_team_invite', {
      p_invite_id: invite.id,
    });

    if (rpcError) {
      setError(rpcError.message || 'Nao foi possivel cancelar o convite.');
      return;
    }

    await loadInvites();
  }

  async function resendInvite(invite: TeamInvite) {
    if (!barbeariaId) return;
    setError(null);
    const response = await fetch('/api/automations/n8n-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'team_invite_created',
        barbearia_id: barbeariaId,
        permission: 'equipe.manage',
        payload: {
          invite_id: invite.id,
          nome: invite.nome,
          email: invite.email,
          telefone: invite.telefone,
          role: invite.role,
          barbeiro_id: invite.barbeiro_id,
          barbeiro_nome: invite.barbeiros?.nome,
          link: inviteLink(invite.token),
          expires_at: invite.expires_at,
        },
      }),
    });

    await supabase
      .from('team_invites')
      .update({
        email_status: response.ok ? 'enviado_para_automacao' : 'erro',
        email_sent_to_n8n_at: response.ok ? new Date().toISOString() : null,
        email_last_error: response.ok ? null : 'Falha ao enviar para n8n',
      })
      .eq('id', invite.id)
      .eq('barbearia_id', barbeariaId);

    await loadInvites();
  }

  if (!canManageInvites) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#D6B47A]" />
          <div>
            <h3 className="font-black text-white">Convites restritos</h3>
            <p className="mt-1 text-sm text-white/55">
              Apenas owner, proprietario ou admin pode convidar funcionarios.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <TeamInviteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={loadInvites}
        currentRole={currentRole}
        barbers={barbers}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D6B47A]">Acessos da equipe</p>
          <h3 className="mt-2 text-2xl font-black text-white">Convites pendentes</h3>
          <p className="mt-1 text-sm text-white/55">Crie links seguros para vincular funcionarios a esta barbearia.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] px-5 font-black text-black"
        >
          <UserPlus className="h-4 w-4" />
          Convidar funcionario
        </button>
      </div>

      {error && (
        <div className="flex gap-3 rounded-2xl border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 p-4 text-sm text-[#ff8a8a]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/8 bg-black/20 p-6 text-sm text-white/45">Carregando convites...</div>
      ) : pendingInvites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-black/20 p-6 text-center">
          <Send className="mx-auto h-8 w-8 text-white/30" />
          <p className="mt-3 font-black text-white">Nenhum convite pendente</p>
          <p className="mt-1 text-sm text-white/50">Quando voce criar um convite, o link aparece aqui.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {pendingInvites.map(invite => (
            <article key={invite.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-black text-white">{invite.nome || invite.email}</h4>
                    <span className="rounded-full border border-[#D6B47A]/30 bg-[#D6B47A]/10 px-2.5 py-1 text-[10px] font-black uppercase text-[#D6B47A]">
                      {roleLabel(invite.role)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-white/55">{invite.email}</p>
                  {invite.role === 'barbeiro' && (
                    <p className="mt-1 truncate text-xs font-bold text-[#D6B47A]/80">
                      Vinculado a {invite.barbeiros?.nome || 'barbeiro selecionado'}
                    </p>
                  )}
                  <p className="mt-2 flex items-center gap-2 text-xs text-white/40">
                    <Clock3 className="h-3.5 w-3.5" />
                    Expira em {new Date(invite.expires_at).toLocaleDateString('pt-BR')} | envio: {invite.email_status || 'nao_enviado'}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => resendInvite(invite)}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D6B47A]/25 px-4 text-sm font-black text-[#D6B47A] hover:bg-[#D6B47A]/10"
                  >
                    <Send className="h-4 w-4" />
                    Reenviar
                  </button>
                  <button
                    type="button"
                    onClick={() => copyInvite(invite)}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-black text-white hover:bg-white/[0.06]"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedId === invite.id ? 'Copiado' : 'Copiar link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelInvite(invite)}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#ff4d4d]/25 px-4 text-sm font-black text-[#ff8a8a] hover:bg-[#ff4d4d]/10"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
