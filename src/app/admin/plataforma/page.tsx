'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Ban,
  Building2,
  CalendarOff,
  CheckCircle2,
  Clipboard,
  CreditCard,
  LockKeyhole,
  Loader2,
  Plus,
  ShieldCheck,
  UnlockKeyhole,
  UserPlus,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildPublicUrl } from '@/lib/publicUrl';

type PlatformProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
  barbearia_id: string | null;
};

type PlatformBarbearia = {
  id: string;
  nome: string;
  status: 'pending_setup' | 'pending_approval' | 'active' | 'suspended' | 'inactive';
  ativo: boolean | null;
  plan_name: string | null;
  created_at: string | null;
  proprietario_id: string | null;
  agendamentos_pausados?: boolean | null;
  acesso_proprietario_bloqueado?: boolean | null;
  acesso_bloqueado_motivo?: string | null;
};

type PlatformBarbeariaQueryResponse = {
  data: Partial<PlatformBarbearia>[] | null;
  error: PlatformError | null;
};

type PlatformError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type OwnerInvite = {
  id: string;
  owner_name: string | null;
  owner_email: string;
  barbearia_name: string;
  plan_name: string | null;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  created_at: string | null;
  created_barbearia_id: string | null;
  email_status?: string | null;
};

type SubscriptionSummary = {
  barbearia_id: string;
  plan_id: 'free' | 'starter' | 'pro' | 'premium' | string;
  plan_name: string | null;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'suspended' | string;
  max_barbers: number | null;
  max_appointments_month: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

type InviteResult = {
  invite_id: string;
  token: string;
  owner_email: string;
  barbearia_name: string;
  expires_at: string;
};

const PLATFORM_ROLES = new Set(['platform_admin', 'super_admin']);
const QUERY_TIMEOUT_MS = 12000;
const STATUS_LABELS: Record<PlatformBarbearia['status'], string> = {
  pending_setup: 'Configuracao pendente',
  pending_approval: 'Aguardando aprovacao',
  active: 'Ativa',
  suspended: 'Suspensa',
  inactive: 'Inativa',
};

const INVITE_STATUS_LABELS: Record<OwnerInvite['status'], string> = {
  pending: 'Pendente',
  accepted: 'Aceito',
  expired: 'Expirado',
  cancelled: 'Cancelado',
};

const PLAN_OPTIONS = [
  { id: 'free', label: 'Free' },
  { id: 'starter', label: 'Starter' },
  { id: 'pro', label: 'Pro' },
  { id: 'premium', label: 'Premium' },
];

function inviteLink(token: string) {
  return buildPublicUrl(`/convite/proprietario?token=${encodeURIComponent(token)}`);
}

function shortDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

function withTimeout<T>(promise: PromiseLike<T>, label: string, ms = QUERY_TIMEOUT_MS) {
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

function isMissingSchemaError(error: unknown) {
  const err = error as PlatformError | null;
  const message = `${err?.code || ''} ${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`.toLowerCase();

  return Boolean(
    err?.code === '42703'
    || err?.code === '42883'
    || err?.code === 'PGRST202'
    || err?.code === 'PGRST204'
    || message.includes('could not find the function')
    || message.includes('schema cache')
    || message.includes('agendamentos_pausados')
    || message.includes('rpc_set_barbearia_agendamentos_pausados'),
  );
}

export default function PlataformaAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [barbearias, setBarbearias] = useState<PlatformBarbearia[]>([]);
  const [invites, setInvites] = useState<OwnerInvite[]>([]);
  const [profiles, setProfiles] = useState<PlatformProfile[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionSummary[]>([]);
  const [barbeariasLoading, setBarbeariasLoading] = useState(false);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [operationalControlsReady, setOperationalControlsReady] = useState(true);
  const [barbeariasError, setBarbeariasError] = useState<string | null>(null);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<InviteResult | null>(null);
  const [form, setForm] = useState({
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    barbeariaName: '',
    planName: '',
    internalNotes: '',
  });

  const loadBarbearias = useCallback(async () => {
    setBarbeariasLoading(true);
    setBarbeariasError(null);
    try {
      const fullSelect = 'id, nome, status, ativo, plan_name, created_at, proprietario_id, agendamentos_pausados, acesso_proprietario_bloqueado, acesso_bloqueado_motivo';
      const baseSelect = 'id, nome, status, ativo, plan_name, created_at, proprietario_id';

      let shopsRes = await withTimeout(
        supabase
          .from('barbearias')
          .select(fullSelect)
          .order('created_at', { ascending: false }),
        'Busca de barbearias',
      ) as PlatformBarbeariaQueryResponse;

      if (shopsRes.error?.code === '42703') {
        console.warn('Fallback barbearias sem controles operacionais:', shopsRes.error);
        setOperationalControlsReady(false);
        shopsRes = await withTimeout(
          supabase
            .from('barbearias')
            .select(baseSelect)
            .order('created_at', { ascending: false }),
          'Busca de barbearias',
        ) as PlatformBarbeariaQueryResponse;
      }

      if (shopsRes.error) throw shopsRes.error;
      if (shopsRes.data?.some(shop => 'agendamentos_pausados' in shop)) {
        setOperationalControlsReady(true);
      }
      setBarbearias(((shopsRes.data || []) as PlatformBarbearia[]).map(shop => ({
        ...shop,
        agendamentos_pausados: Boolean(shop.agendamentos_pausados),
        acesso_proprietario_bloqueado: Boolean(shop.acesso_proprietario_bloqueado),
      })));
    } catch (err) {
      console.error('Erro ao carregar barbearias da plataforma:', err);
      setBarbeariasError('Nao foi possivel carregar as barbearias. Tente novamente.');
    } finally {
      setBarbeariasLoading(false);
    }
  }, []);

  const loadInvites = useCallback(async () => {
    setInvitesLoading(true);
    setInvitesError(null);
    try {
      const invitesRes = await withTimeout(
        supabase
          .from('platform_owner_invites')
          .select('id, owner_name, owner_email, barbearia_name, plan_name, token, status, expires_at, created_at, created_barbearia_id, email_status')
          .order('created_at', { ascending: false }),
        'Busca de convites',
      );

      if (invitesRes.error) throw invitesRes.error;
      setInvites((invitesRes.data || []) as OwnerInvite[]);
    } catch (err) {
      console.error('Erro ao carregar convites de proprietario:', err);
      setInvitesError('Nao foi possivel carregar os convites agora.');
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    setProfilesLoading(true);
    try {
      const profilesRes = await withTimeout(
        supabase
          .from('profiles')
          .select('id, full_name, role, barbearia_id'),
        'Busca de profiles',
      );

      if (profilesRes.error) throw profilesRes.error;
      setProfiles((profilesRes.data || []) as PlatformProfile[]);
    } catch (err) {
      console.error('Erro ao carregar profiles para painel da plataforma:', err);
      setProfiles([]);
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  const loadSubscriptions = useCallback(async () => {
    setSubscriptionsLoading(true);
    try {
      const { data, error: rpcError } = await withTimeout(
        supabase.rpc('rpc_platform_get_subscription_summary'),
        'Busca de assinaturas',
      );

      if (rpcError) throw rpcError;
      setSubscriptions((data || []) as SubscriptionSummary[]);
    } catch (err) {
      console.error('Erro ao carregar assinaturas da plataforma:', err);
      setSubscriptions([]);
    } finally {
      setSubscriptionsLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);

    try {
      const { data: userData, error: userError } = await withTimeout(
        supabase.auth.getUser(),
        'Validacao de sessao',
      );

      if (userError) throw userError;
      const user = userData.user;
      if (!user) {
        router.replace('/login?redirectTo=/admin/plataforma');
        return;
      }

      const { data: profile, error: profileError } = await withTimeout(
        supabase
          .from('profiles')
          .select('id, full_name, role, barbearia_id')
          .eq('id', user.id)
          .maybeSingle(),
        'Validacao de permissao',
      );

      if (profileError) throw profileError;
      if (!profile?.role || !PLATFORM_ROLES.has(profile.role)) {
        setAccessDenied(true);
        return;
      }

      await Promise.allSettled([loadBarbearias(), loadInvites(), loadProfiles(), loadSubscriptions()]);
    } catch (err) {
      console.error('Erro ao validar acesso ao painel da plataforma:', err);
      setError('Nao foi possivel validar seu acesso. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [loadBarbearias, loadInvites, loadProfiles, loadSubscriptions, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const ownerByBarbearia = useMemo(() => {
    const map = new Map<string, PlatformProfile>();
    profiles.forEach(profile => {
      if (profile.barbearia_id && ['owner', 'proprietario'].includes(profile.role || '')) {
        map.set(profile.barbearia_id, profile);
      }
    });
    return map;
  }, [profiles]);

  const subscriptionByBarbearia = useMemo(() => {
    const map = new Map<string, SubscriptionSummary>();
    subscriptions.forEach(subscription => map.set(subscription.barbearia_id, subscription));
    return map;
  }, [subscriptions]);

  const summary = useMemo(() => ({
    active: barbearias.filter(item => item.status === 'active').length,
    pending: barbearias.filter(item => item.status === 'pending_setup' || item.status === 'pending_approval').length,
    suspended: barbearias.filter(item => item.status === 'suspended').length,
    inactive: barbearias.filter(item => item.status === 'inactive').length,
    pausedBookings: barbearias.filter(item => item.agendamentos_pausados).length,
    blockedOwners: barbearias.filter(item => item.acesso_proprietario_bloqueado).length,
    invites: invites.filter(item => item.status === 'pending').length,
    premiumPlans: subscriptions.filter(item => ['pro', 'premium'].includes(item.plan_id)).length,
  }), [barbearias, invites, subscriptions]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Link copiado.');
    } catch (err) {
      console.warn('[Plataforma] Clipboard indisponivel:', err);
      window.prompt('Copie o link do convite:', text);
      setSuccess('Link pronto para copiar.');
    }
  }

  async function createInvite() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setCreatedInvite(null);

    try {
      const { data, error: rpcError } = await withTimeout(
        supabase.rpc('rpc_create_platform_owner_invite', {
          p_owner_name: form.ownerName.trim(),
          p_owner_email: form.ownerEmail.trim(),
          p_owner_phone: form.ownerPhone.trim() || null,
          p_barbearia_name: form.barbeariaName.trim(),
          p_plan_name: form.planName.trim() || null,
          p_internal_notes: form.internalNotes.trim() || null,
        }),
        'Criacao de convite',
      );

      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Convite nao retornado.');

      setCreatedInvite(row as InviteResult);
      void fetch('/api/automations/n8n-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'owner_invite_created',
          barbearia_id: null,
          permission: 'platform.manage',
          payload: {
            invite_id: row.invite_id,
            nome: form.ownerName.trim(),
            email: row.owner_email,
            telefone: form.ownerPhone.trim() || null,
            barbearia_nome: row.barbearia_name,
            plano: form.planName.trim() || null,
            link: inviteLink(row.token),
            expires_at: row.expires_at,
          },
        }),
      }).then(async response => {
        await supabase
          .from('platform_owner_invites')
          .update({
            email_status: response.ok ? 'enviado_para_automacao' : 'erro',
            email_sent_to_n8n_at: response.ok ? new Date().toISOString() : null,
            email_last_error: response.ok ? null : 'Falha ao enviar para n8n',
          })
          .eq('id', row.invite_id);
      }).catch(async err => {
        console.warn('[Plataforma] Falha ao enviar convite para n8n:', err);
        await supabase.from('platform_owner_invites').update({ email_status: 'erro', email_last_error: 'Falha ao enviar para n8n' }).eq('id', row.invite_id);
      });
      setSuccess('Convite de proprietario criado.');
      setForm({ ownerName: '', ownerEmail: '', ownerPhone: '', barbeariaName: '', planName: '', internalNotes: '' });
      await loadData();
    } catch (err) {
      console.error('Erro ao criar convite de proprietario:', err);
      setError('Nao foi possivel criar o convite. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function cancelInvite(inviteId: string) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: rpcError } = await withTimeout(
        supabase.rpc('rpc_cancel_platform_owner_invite', {
          p_invite_id: inviteId,
        }),
        'Cancelamento de convite',
      );

      if (rpcError) throw rpcError;
      setSuccess('Convite cancelado.');
      await loadInvites();
    } catch (err) {
      console.error('Erro ao cancelar convite de proprietario:', err);
      setError('Nao foi possivel cancelar o convite agora.');
    } finally {
      setSaving(false);
    }
  }

  async function resendOwnerInvite(invite: OwnerInvite) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/automations/n8n-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'owner_invite_created',
          barbearia_id: null,
          permission: 'platform.manage',
          payload: {
            invite_id: invite.id,
            nome: invite.owner_name,
            email: invite.owner_email,
            barbearia_nome: invite.barbearia_name,
            plano: invite.plan_name,
            link: inviteLink(invite.token),
            expires_at: invite.expires_at,
          },
        }),
      });

      await supabase
        .from('platform_owner_invites')
        .update({
          email_status: response.ok ? 'enviado_para_automacao' : 'erro',
          email_sent_to_n8n_at: response.ok ? new Date().toISOString() : null,
          email_last_error: response.ok ? null : 'Falha ao enviar para n8n',
        })
        .eq('id', invite.id);

      setSuccess(response.ok ? 'Convite reenviado para automacao.' : 'Automacao retornou erro.');
      await loadInvites();
    } catch (err) {
      console.error('Erro ao reenviar convite de proprietario:', err);
      setError('Nao foi possivel reenviar o convite agora.');
    } finally {
      setSaving(false);
    }
  }

  async function setBarbeariaStatus(barbeariaId: string, status: PlatformBarbearia['status']) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: rpcError } = await withTimeout(
        supabase.rpc('rpc_set_barbearia_status', {
          p_barbearia_id: barbeariaId,
          p_status: status,
        }),
        'Atualizacao de status da barbearia',
      );

      if (rpcError) throw rpcError;
      setSuccess(status === 'active' ? 'Barbearia ativada.' : 'Status atualizado.');
      await loadBarbearias();
    } catch (err) {
      console.error('Erro ao atualizar status da barbearia:', err);
      setError('Nao foi possivel atualizar o status da barbearia.');
    } finally {
      setSaving(false);
    }
  }

  async function setSubscriptionPlan(barbeariaId: string, planId: string) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: rpcError } = await withTimeout(
        supabase.rpc('rpc_platform_set_subscription_plan', {
          p_barbearia_id: barbeariaId,
          p_plan_id: planId,
        }),
        'Atualizacao do plano',
      );

      if (rpcError) throw rpcError;
      setSuccess('Plano atualizado.');
      await Promise.allSettled([loadBarbearias(), loadSubscriptions()]);
    } catch (err) {
      console.error('Erro ao atualizar plano da barbearia:', err);
      setError('Nao foi possivel atualizar o plano desta barbearia.');
    } finally {
      setSaving(false);
    }
  }

  async function setSubscriptionStatus(barbeariaId: string, status: SubscriptionSummary['status']) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: rpcError } = await withTimeout(
        supabase.rpc('rpc_platform_update_subscription_status', {
          p_barbearia_id: barbeariaId,
          p_status: status,
        }),
        'Atualizacao da assinatura',
      );

      if (rpcError) throw rpcError;
      setSuccess(status === 'active' ? 'Assinatura reativada.' : 'Assinatura atualizada.');
      await loadSubscriptions();
    } catch (err) {
      console.error('Erro ao atualizar assinatura:', err);
      setError('Nao foi possivel atualizar a assinatura desta barbearia.');
    } finally {
      setSaving(false);
    }
  }

  async function setBookingsPaused(barbeariaId: string, paused: boolean) {
    if (saving) return;
    if (!operationalControlsReady) {
      setError('Controle de pausa ainda nao esta aplicado no Supabase. Aplique a migration 20260512_platform_admin_barbearia_controls.sql.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error: rpcError } = await withTimeout(
        supabase.rpc('rpc_set_barbearia_agendamentos_pausados', {
          p_barbearia_id: barbeariaId,
          p_pausado: paused,
        }),
        'Atualizacao dos agendamentos',
      );

      if (rpcError) {
        if (!isMissingSchemaError(rpcError)) throw rpcError;

        console.warn('RPC de pausa indisponivel; tentando update direto protegido por RLS:', rpcError);
        const { error: updateError } = await withTimeout(
          supabase
            .from('barbearias')
            .update({
              agendamentos_pausados: paused,
              agendamentos_pausados_em: paused ? new Date().toISOString() : null,
              agendamentos_pausados_por: paused ? userData.user?.id ?? null : null,
            })
            .eq('id', barbeariaId),
          'Atualizacao direta dos agendamentos',
        );

        if (updateError) throw updateError;
      }
      setSuccess(paused ? 'Agendamentos pausados para clientes.' : 'Agendamentos liberados para clientes.');
      await loadBarbearias();
    } catch (err) {
      console.error('Erro ao pausar agendamentos da barbearia:', err);
      setError(isMissingSchemaError(err)
        ? 'Controle de pausa ainda nao esta aplicado no Supabase. Aplique a migration 20260512_platform_admin_barbearia_controls.sql.'
        : 'Nao foi possivel atualizar os agendamentos desta barbearia.');
    } finally {
      setSaving(false);
    }
  }

  async function setOwnerBlocked(barbeariaId: string, blocked: boolean) {
    if (saving) return;
    const motivo = blocked ? window.prompt('Motivo do bloqueio', 'Inadimplencia') : null;
    if (blocked && motivo === null) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: rpcError } = await withTimeout(
        supabase.rpc('rpc_set_barbearia_owner_access_blocked', {
          p_barbearia_id: barbeariaId,
          p_bloqueado: blocked,
          p_motivo: motivo,
        }),
        'Atualizacao de acesso do proprietario',
      );

      if (rpcError) throw rpcError;
      setSuccess(blocked ? 'Acesso do proprietario bloqueado.' : 'Acesso do proprietario liberado.');
      await loadBarbearias();
    } catch (err) {
      console.error('Erro ao bloquear acesso do proprietario:', err);
      setError('Nao foi possivel atualizar o acesso do proprietario.');
    } finally {
      setSaving(false);
    }
  }

  async function accessBarbearia(barbeariaId: string) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: rpcError } = await withTimeout(
        supabase.rpc('rpc_platform_set_active_barbearia', {
          p_barbearia_id: barbeariaId,
        }),
        'Selecao de barbearia',
      );

      if (rpcError) throw rpcError;
      router.push('/gestao/agenda');
    } catch (err) {
      console.error('Erro ao acessar gestao da barbearia:', err);
      setError('Nao foi possivel acessar a gestao desta barbearia.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#050505] text-white">
        <Loader2 className="h-10 w-10 animate-spin text-[#D6B47A]" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#050505] p-5 text-white">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-[#D6B47A]" />
          <h1 className="mt-5 text-2xl font-black">Acesso negado</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            Esta area e exclusiva para administradores da plataforma Meu Caixa.
          </p>
          <button
            type="button"
            onClick={() => router.replace('/cliente')}
            className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-[#D6B47A] font-black text-black"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] max-w-full overflow-x-hidden bg-[#050505] px-4 py-6 text-white sm:px-6 lg:px-10">
      <main className="mx-auto w-full max-w-7xl min-w-0 space-y-7">
        <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#D6B47A]">Meu Caixa</p>
            <h1 className="mt-3 break-words text-3xl font-black tracking-tight sm:text-5xl">Painel da plataforma</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
              Convide proprietarios, acompanhe barbearias contratantes e controle a visibilidade no marketplace.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] px-5 font-black text-black sm:w-auto"
          >
            <Plus className="h-5 w-5" />
            Convidar proprietario
          </button>
        </header>

        {(error || success) && (
          <div className={`flex gap-3 rounded-2xl border p-4 text-sm font-bold ${
            error ? 'border-[#ff5c5c]/25 bg-[#ff5c5c]/10 text-[#ff8a8a]' : 'border-[#D6B47A]/25 bg-[#D6B47A]/10 text-[#D6B47A]'
          }`}>
            {error ? <AlertCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
            {error || success}
          </div>
        )}

        <section className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard icon={Building2} label="Barbearias ativas" value={summary.active} />
          <SummaryCard icon={CalendarOff} label="Agendas pausadas" value={summary.pausedBookings} />
          <SummaryCard icon={LockKeyhole} label="Acessos bloqueados" value={summary.blockedOwners} />
          <SummaryCard icon={CreditCard} label="Planos PRO/Premium" value={summary.premiumPlans} />
          <SummaryCard icon={UserPlus} label="Convites pendentes" value={summary.invites} />
          <SummaryCard icon={ShieldCheck} label="Pendentes" value={summary.pending} />
          <SummaryCard icon={Ban} label="Suspensas" value={summary.suspended} />
          <SummaryCard icon={X} label="Removidas" value={summary.inactive} />
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,430px)]">
          <div className="mobile-safe-panel rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Barbearias</h2>
              <span className="text-xs font-bold text-white/40">{barbeariasLoading ? 'Carregando...' : `${barbearias.length} cadastrada(s)`}</span>
            </div>
            {!operationalControlsReady && (
              <div className="mb-4 rounded-2xl border border-[#fbbf24]/25 bg-[#fbbf24]/10 p-4 text-sm font-bold text-[#fbbf24]">
                Controles de pausa/bloqueio pendentes no Supabase. Aplique a migration <span className="font-black">20260512_platform_admin_barbearia_controls.sql</span>.
              </div>
            )}
            <div className="space-y-3">
              {barbeariasLoading ? (
                <SectionLoader text="Carregando barbearias..." />
              ) : barbeariasError ? (
                <ErrorCard text={barbeariasError} onRetry={loadBarbearias} />
              ) : barbearias.length === 0 ? (
                <Empty text="Nenhuma barbearia cadastrada ainda." />
              ) : barbearias.map(shop => {
                const owner = ownerByBarbearia.get(shop.id);
                const subscription = subscriptionByBarbearia.get(shop.id);
                return (
                  <article key={shop.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-xl font-black text-white">{shop.nome}</h3>
                          <StatusBadge status={shop.status} />
                          {shop.agendamentos_pausados && (
                            <span className="rounded-full border border-[#fbbf24]/25 bg-[#fbbf24]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#fbbf24]">
                              Agenda pausada
                            </span>
                          )}
                          {shop.acesso_proprietario_bloqueado && (
                            <span className="rounded-full border border-[#ff5c5c]/25 bg-[#ff5c5c]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#ff8a8a]">
                              Proprietario bloqueado
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-white/50">
                          Proprietario: <span className="font-bold text-white/75">{owner?.full_name || shop.proprietario_id || 'Nao vinculado'}</span>
                        </p>
                        <p className="mt-1 text-xs font-bold text-white/35">
                          Plano: {subscription?.plan_name || shop.plan_name || 'Nao informado'} | Assinatura: {subscription?.status || 'sem registro'} | Criada em {shortDate(shop.created_at)}
                        </p>
                        <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            value={subscription?.plan_id || 'free'}
                            onChange={event => setSubscriptionPlan(shop.id, event.target.value)}
                            disabled={saving || subscriptionsLoading}
                            className="h-11 w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-3 text-xs font-black uppercase tracking-[0.08em] text-white outline-none sm:w-auto sm:tracking-[0.12em]"
                          >
                            {PLAN_OPTIONS.map(plan => <option key={plan.id} value={plan.id}>{plan.label}</option>)}
                          </select>
                          <span className="min-w-0 break-words rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/45">
                            Limite: {subscription?.max_barbers ?? 'ilimitado'} barbeiros / {subscription?.max_appointments_month ?? 'ilimitado'} agendamentos
                          </span>
                        </div>
                        {shop.acesso_bloqueado_motivo && (
                          <p className="mt-2 text-xs font-bold text-[#ff8a8a]/80">
                            Bloqueio: {shop.acesso_bloqueado_motivo}
                          </p>
                        )}
                      </div>
                      <div className="grid min-w-0 grid-cols-1 gap-2 min-[430px]:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
                        <button
                          type="button"
                          onClick={() => accessBarbearia(shop.id)}
                          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white"
                        >
                          Acessar gestao
                        </button>
                        <button
                          type="button"
                          onClick={() => setBarbeariaStatus(shop.id, 'active')}
                          disabled={shop.status === 'active'}
                          className="rounded-2xl bg-[#D6B47A] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-black disabled:opacity-45"
                        >
                          Ativar
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubscriptionStatus(shop.id, subscription?.status === 'suspended' ? 'active' : 'suspended')}
                          className="rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#D6B47A]"
                        >
                          {subscription?.status === 'suspended' ? 'Reativar assinatura' : 'Suspender assinatura'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBookingsPaused(shop.id, !shop.agendamentos_pausados)}
                          disabled={!operationalControlsReady}
                          title={!operationalControlsReady ? 'Aplique a migration de controles operacionais no Supabase.' : undefined}
                          className="rounded-2xl border border-[#fbbf24]/25 bg-[#fbbf24]/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#fbbf24] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {shop.agendamentos_pausados ? 'Retomar agenda' : 'Pausar agenda'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOwnerBlocked(shop.id, !shop.acesso_proprietario_bloqueado)}
                          disabled={!operationalControlsReady}
                          title={!operationalControlsReady ? 'Aplique a migration de controles operacionais no Supabase.' : undefined}
                          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {shop.acesso_proprietario_bloqueado ? <UnlockKeyhole className="h-4 w-4 text-[#D6B47A]" /> : <LockKeyhole className="h-4 w-4 text-[#ff8a8a]" />}
                          {shop.acesso_proprietario_bloqueado ? 'Liberar acesso' : 'Bloquear dono'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBarbeariaStatus(shop.id, 'suspended')}
                          disabled={shop.status === 'suspended'}
                          className="rounded-2xl border border-[#ff5c5c]/25 bg-[#ff5c5c]/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#ff8a8a] disabled:opacity-45"
                        >
                          Suspender
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Remover esta barbearia do app? Os dados serao preservados, mas ela ficara inativa.')) {
                              setBarbeariaStatus(shop.id, 'inactive');
                            }
                          }}
                          disabled={shop.status === 'inactive'}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white/60 disabled:opacity-45"
                        >
                          Remover perfil
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mobile-safe-panel rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Convites</h2>
              <span className="text-xs font-bold text-white/40">{invitesLoading ? 'Carregando...' : `${invites.length} total`}</span>
            </div>
            <div className="space-y-3">
              {profilesLoading && (
                <p className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs font-bold text-white/35">
                  Atualizando dados auxiliares...
                </p>
              )}
              {invitesLoading ? (
                <SectionLoader text="Carregando convites..." />
              ) : invitesError ? (
                <ErrorCard text={invitesError} onRetry={loadInvites} />
              ) : invites.length === 0 ? (
                <Empty text="Nenhum convite criado." />
              ) : invites.map(invite => (
                <article key={invite.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-black text-white">{invite.barbearia_name}</h3>
                      <p className="mt-1 break-words text-sm text-white/55">{invite.owner_name || 'Proprietario'} | {invite.owner_email}</p>
                      <p className="mt-1 break-words text-xs font-bold text-white/35">
                        {INVITE_STATUS_LABELS[invite.status]} | expira em {shortDate(invite.expires_at)} | envio: {invite.email_status || 'nao_enviado'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
                      invite.status === 'pending'
                        ? 'border border-[#D6B47A]/25 bg-[#D6B47A]/10 text-[#D6B47A]'
                        : 'border border-white/10 bg-white/[0.04] text-white/45'
                    }`}>
                      {INVITE_STATUS_LABELS[invite.status]}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 min-[430px]:grid-cols-2 sm:flex sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => copy(inviteLink(invite.token))}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white"
                    >
                      <Clipboard className="h-4 w-4 text-[#D6B47A]" />
                      Copiar link
                    </button>
                    {invite.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => resendOwnerInvite(invite)}
                        className="rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#D6B47A]"
                      >
                        Reenviar
                      </button>
                    )}
                    {invite.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => cancelInvite(invite.id)}
                        className="rounded-2xl border border-[#ff5c5c]/25 bg-[#ff5c5c]/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#ff8a8a]"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
          <section className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0d0d0d] p-5 shadow-2xl shadow-black sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#D6B47A]">Novo contrato</p>
                <h2 className="mt-2 text-2xl font-black">Convidar proprietario</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Nome do proprietario" value={form.ownerName} onChange={ownerName => setForm(prev => ({ ...prev, ownerName }))} />
              <Field label="Email do proprietario" value={form.ownerEmail} onChange={ownerEmail => setForm(prev => ({ ...prev, ownerEmail }))} />
              <Field label="Telefone opcional" value={form.ownerPhone} onChange={ownerPhone => setForm(prev => ({ ...prev, ownerPhone }))} />
              <Field label="Nome da barbearia" value={form.barbeariaName} onChange={barbeariaName => setForm(prev => ({ ...prev, barbeariaName }))} />
              <Field label="Plano contratado" value={form.planName} onChange={planName => setForm(prev => ({ ...prev, planName }))} />
              <Field label="Observacoes internas" value={form.internalNotes} onChange={internalNotes => setForm(prev => ({ ...prev, internalNotes }))} />
            </div>

            {createdInvite && (
              <div className="mt-5 rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/10 p-4">
                <p className="text-sm font-black text-[#D6B47A]">Link gerado</p>
                <button
                  type="button"
                  onClick={() => copy(inviteLink(createdInvite.token))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 p-3 text-left text-xs font-bold text-white/75"
                >
                  {inviteLink(createdInvite.token)}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={createInvite}
              disabled={saving}
              className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] font-black text-black disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
              {saving ? 'Criando convite...' : 'Criar convite'}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
      <Icon className="h-6 w-6 text-[#D6B47A]" />
      <p className="mt-4 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-white/40">{label}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: PlatformBarbearia['status'] }) {
  const active = status === 'active';
  const danger = status === 'suspended';
  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
      active
        ? 'border border-[#D6B47A]/25 bg-[#D6B47A]/10 text-[#D6B47A]'
        : danger
          ? 'border border-[#ff5c5c]/25 bg-[#ff5c5c]/10 text-[#ff8a8a]'
          : 'border border-white/10 bg-white/[0.04] text-white/50'
    }`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="ml-1 break-words text-[10px] font-black uppercase tracking-[0.12em] text-white/40 sm:tracking-[0.18em]">{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-2 h-12 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none placeholder:text-white/25 focus:border-[#D6B47A]/45"
      />
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.025] p-8 text-center text-sm font-bold text-white/45">
      {text}
    </div>
  );
}

function SectionLoader({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.025] p-8 text-sm font-bold text-white/50">
      <Loader2 className="h-5 w-5 animate-spin text-[#D6B47A]" />
      {text}
    </div>
  );
}

function ErrorCard({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-[#ff5c5c]/25 bg-[#ff5c5c]/10 p-5">
      <div className="flex gap-3 text-sm font-bold text-[#ff8a8a]">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p>{text}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 flex h-11 items-center justify-center rounded-2xl bg-[#D6B47A] px-4 text-sm font-black text-black"
      >
        Tentar novamente
      </button>
    </div>
  );
}
