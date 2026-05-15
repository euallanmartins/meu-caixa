'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Check, Copy, Mail, ShieldCheck, UserPlus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildPublicUrl } from '@/lib/publicUrl';

type InviteRole = 'admin' | 'gerente' | 'barbeiro' | 'funcionario';

type CreatedInvite = {
  id: string;
  barbearia_id: string;
  email: string;
  nome: string | null;
  role: string;
  token: string;
  status: string;
  expires_at: string;
};

interface TeamInviteModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  currentRole?: string | null;
  barbers?: Array<{ id: string; nome: string; ativo?: boolean | null }>;
}

const BASE_ROLES: Array<{ value: InviteRole; label: string; hint: string }> = [
  { value: 'gerente', label: 'Gerente', hint: 'Acesso operacional ampliado' },
  { value: 'barbeiro', label: 'Barbeiro', hint: 'Somente a propria agenda' },
  { value: 'funcionario', label: 'Funcionario', hint: 'Acesso operacional basico' },
];

function inviteLink(token: string) {
  return buildPublicUrl(`/convite/equipe?token=${encodeURIComponent(token)}`);
}

export function TeamInviteModal({ open, onClose, onCreated, currentRole, barbers = [] }: TeamInviteModalProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [role, setRole] = useState<InviteRole>('barbeiro');
  const [barbeiroId, setBarbeiroId] = useState('');
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canInviteAdmin = currentRole === 'owner' || currentRole === 'proprietario';
  const roleOptions = useMemo(() => (
    canInviteAdmin
      ? [{ value: 'admin' as InviteRole, label: 'Admin', hint: 'Administracao da barbearia' }, ...BASE_ROLES]
      : BASE_ROLES
  ), [canInviteAdmin]);

  if (!open) return null;

  async function handleCreate() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      if (role === 'barbeiro' && !barbeiroId) {
        setError('Selecione qual barbeiro recebera este acesso.');
        setLoading(false);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('rpc_create_team_invite', {
        p_email: email.trim(),
        p_nome: nome.trim() || null,
        p_telefone: telefone.trim() || null,
        p_role: role,
        p_barbeiro_id: role === 'barbeiro' ? barbeiroId : null,
      });

      if (rpcError) throw rpcError;
      const invite = Array.isArray(data) ? data[0] : data;
      if (!invite?.token) throw new Error('Nao foi possivel gerar o convite.');

      setCreated(invite as CreatedInvite);
      void fetch('/api/automations/n8n-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'team_invite_created',
          barbearia_id: invite.barbearia_id,
          permission: 'equipe.manage',
          payload: {
            invite_id: invite.id,
            nome: invite.nome,
            email: invite.email,
            telefone,
            role: invite.role,
            barbeiro_id: role === 'barbeiro' ? barbeiroId : null,
            link: inviteLink(invite.token),
            expires_at: invite.expires_at,
          },
        }),
      }).then(async response => {
        await supabase
          .from('team_invites')
          .update({
            email_status: response.ok ? 'enviado_para_automacao' : 'erro',
            email_sent_to_n8n_at: response.ok ? new Date().toISOString() : null,
            email_last_error: response.ok ? null : 'Falha ao enviar para n8n',
          })
          .eq('id', invite.id);
      }).catch(async err => {
        console.warn('[TeamInviteModal] Falha ao enviar convite para n8n:', err);
        await supabase.from('team_invites').update({ email_status: 'erro', email_last_error: 'Falha ao enviar para n8n' }).eq('id', invite.id);
      });
      onCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel criar o convite.';
      setError(message.includes('permission') || message.includes('permissao')
        ? 'Voce nao tem permissao para convidar funcionarios.'
        : message);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!created?.token) return;
    const link = inviteLink(created.token);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch (err) {
      console.warn('[TeamInviteModal] Clipboard indisponivel:', err);
      window.prompt('Copie o link do convite:', link);
      setCopied(true);
    }
  }

  function closeAndReset() {
    setNome('');
    setEmail('');
    setTelefone('');
    setRole('barbeiro');
    setBarbeiroId('');
    setCreated(null);
    setCopied(false);
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#080808] shadow-2xl shadow-black">
        <div className="flex items-center justify-between border-b border-white/8 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D6B47A]/12 text-[#D6B47A]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Convidar funcionario</h2>
              <p className="text-xs text-white/45">Acesso seguro por link unico</p>
            </div>
          </div>
          <button type="button" onClick={closeAndReset} className="rounded-xl p-2 text-white/45 hover:bg-white/[0.06] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[78vh] space-y-5 overflow-y-auto p-5">
          {error && (
            <div className="flex gap-3 rounded-2xl border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 p-4 text-sm text-[#ff8a8a]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {created ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#D6B47A]/30 bg-[#D6B47A]/10 p-5">
                <p className="flex items-center gap-2 font-black text-[#D6B47A]">
                  <Check className="h-5 w-5" />
                  Convite criado
                </p>
                <p className="mt-2 text-sm text-white/60">
                  Envie este link para {created.email}. Ele expira em 7 dias.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Link do convite</p>
                <p className="mt-3 break-all text-sm font-bold text-white">{inviteLink(created.token)}</p>
              </div>

              <button
                type="button"
                onClick={copyLink}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] font-black text-black"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'Link copiado' : 'Copiar link'}
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Nome</span>
                  <input
                    value={nome}
                    onChange={event => setNome(event.target.value)}
                    className="h-13 w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none focus:border-[#D6B47A]/50"
                    placeholder="Nome do funcionario"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Telefone opcional</span>
                  <input
                    value={telefone}
                    onChange={event => setTelefone(event.target.value)}
                    className="h-13 w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none focus:border-[#D6B47A]/50"
                    placeholder="(00) 00000-0000"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">E-mail do convite</span>
                <span className="relative block">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                  <input
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    className="h-13 w-full rounded-2xl border border-white/12 bg-white/[0.04] pl-12 pr-4 font-bold text-white outline-none focus:border-[#D6B47A]/50"
                    placeholder="funcionario@email.com"
                  />
                </span>
              </label>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Funcao</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {roleOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRole(option.value)}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        role === option.value
                          ? 'border-[#D6B47A]/60 bg-[#D6B47A]/12'
                          : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.06]'
                      }`}
                    >
                      <p className="font-black text-white">{option.label}</p>
                      <p className="mt-1 text-xs text-white/50">{option.hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              {role === 'barbeiro' && (
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Barbeiro vinculado</span>
                  <select
                    value={barbeiroId}
                    onChange={event => setBarbeiroId(event.target.value)}
                    className="h-13 w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none focus:border-[#D6B47A]/50"
                  >
                    <option value="">Selecione o barbeiro</option>
                    {barbers.filter(barber => barber.ativo !== false).map(barber => (
                      <option key={barber.id} value={barber.id}>{barber.nome}</option>
                    ))}
                  </select>
                  <span className="block text-xs leading-relaxed text-white/45">
                    Este usuario vai acessar somente a agenda, bloqueios e ganhos deste profissional.
                  </span>
                </label>
              )}

              <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#D6B47A]" />
                <p>O funcionario so ganha acesso depois de entrar com o mesmo e-mail do convite e aceitar o link.</p>
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={loading || !email.trim() || (role === 'barbeiro' && !barbeiroId)}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Criando convite...' : 'Criar convite'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
