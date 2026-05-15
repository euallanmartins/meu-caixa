'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, supabasePublic } from '@/lib/supabase';
import { buildPublicUrl } from '@/lib/publicUrl';
import { trackAnalyticsEvent } from '@/lib/analytics/trackEvent';
import { addMinutes, parseISO, format } from 'date-fns';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { TEMPORARY_FAILURE_MESSAGE } from '@/lib/security/upload';

// ─────────────────────────────────────────────
// TIPOS EXPORTADOS
// ─────────────────────────────────────────────

export interface Barbearia {
  id: string;
  nome: string;
  agendamentos_pausados?: boolean | null;
}

export interface Servico {
  id: string;
  barbearia_id: string;
  nome: string;
  descricao?: string | null;
  valor: number;
  duracao_minutos: number;
  categoria?: string | null;
  ordem?: number | null;
  mais_vendido?: boolean | null;
  destaque?: boolean | null;
  ativo?: boolean | null;
}

export interface Barbeiro {
  id: string;
  barbearia_id: string;
  nome: string;
  foto_url?: string | null;
  titulo?: string | null;
  especialidade?: string | null;
  tags?: string[] | null;
  avaliacao?: number | null;
  total_avaliacoes?: number | null;
  destaque_label?: string | null;
  proxima_disponibilidade?: string | null;
}

export interface ClienteInput {
  id?: string;
  nome: string;
  email: string;
  telefone: string;
  senha?: string;
  observacoesPessoais?: string;
}

export interface SignupData {
  nome: string;
  apelido?: string;
  telefone: string;
  email: string;
  senha: string;
  nascimento?: string;
  observacoesPessoais?: string;
  reminderChannel?: ReminderChannel;
}

export interface SlotInfo {
  time: string;       // "09:00"
  available: boolean;
}

export type ReminderChannel = 'whatsapp' | 'email';

export interface CustomFormField {
  id: string;
  form_id: string;
  form_title: string;
  label: string;
  type: string;
  required: boolean;
  options?: unknown;
  sort_order: number;
}

type CustomFormRow = {
  id: string;
  titulo: string;
  servico_id: string | null;
  custom_form_fields?: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    options?: unknown;
    sort_order: number | null;
  }>;
};

export type Step = 1 | 2 | 3 | 4 | 5 | 6;

export interface AgendamentoState {
  step: Step;
  barbearia: Barbearia | null;
  cliente: ClienteInput;
  servicosSelecionados: Servico[];
  barbeiro: Barbeiro | null; // null = qualquer disponível
  data: Date | null;
  horario: string | null;
  observacoesAgendamento: string;
  reminderChannel: ReminderChannel;
  duracaoTotal: number;
  valorTotal: number;
}

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────

const SLOT_INICIO_MIN = 9 * 60;       // 09:00
const SLOT_FIM_MAX_MIN = 19 * 60;     // 19:00 (horário final máximo de término)
const SLOT_INTERVAL_MIN = 30;

const EMPTY_CLIENTE: ClienteInput = {
  nome: '',
  email: '',
  telefone: '',
  observacoesPessoais: '',
};

function clienteStorageKey(barbeariaId: string): string {
  return `meu_caixa_cliente_${barbeariaId}`;
}

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, marker => {
    const value = Math.floor(Math.random() * 16);
    return (marker === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function isScheduleConflictError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /hor[aá]rio ocupado|ocupado ou indisponivel|overlap|conflict|prevent_agendamento_overlap/i.test(message);
}

function isIdempotencyDuplicate(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /duplicate key|idx_agendamentos_idempotency/i.test(message);
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

// Gera array de horários de início (strings "HH:mm") dado duração total
function gerarSlotsIniciais(duracaoMin: number): string[] {
  const slots: string[] = [];
  for (let m = SLOT_INICIO_MIN; m + duracaoMin <= SLOT_FIM_MAX_MIN; m += SLOT_INTERVAL_MIN) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return slots;
}

// ─────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────

export function useAgendamento(barbeariaId: string | null, preselectedServicoId?: string | null) {
  const idempotencyKeyRef = useRef(newIdempotencyKey());
  const submittingRef = useRef(false);
  const [state, setState] = useState<AgendamentoState>({
    step: 1,
    barbearia: null,
    cliente: EMPTY_CLIENTE,
    servicosSelecionados: [],
    barbeiro: null,
    data: null,
    horario: null,
    observacoesAgendamento: '',
    reminderChannel: 'whatsapp',
    duracaoTotal: 0,
    valorTotal: 0,
  });

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [customFormFields, setCustomFormFields] = useState<CustomFormField[]>([]);
  const [customFormAnswers, setCustomFormAnswers] = useState<Record<string, string>>({});

  const [loadingBarbearia, setLoadingBarbearia] = useState(true);
  const [loadingServicos, setLoadingServicos] = useState(false);
  const [loadingBarbeiros, setLoadingBarbeiros] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState('Agendamento enviado e aguardando confirmação do profissional.');
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);

  const renewIdempotencyKey = useCallback(() => {
    idempotencyKeyRef.current = newIdempotencyKey();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAuthUser() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? (await supabase.auth.getUser()).data.user;
      if (!active) return;
      setAuthUser(user ?? null);

      if (user?.email) {
        const metadata = user.user_metadata ?? {};
        const fullName =
          typeof metadata.full_name === 'string'
            ? metadata.full_name
            : typeof metadata.name === 'string'
              ? metadata.name
              : '';

        setState(prev => ({
          ...prev,
          cliente: {
            ...prev.cliente,
            nome: prev.cliente.nome || fullName,
            email: user.email || prev.cliente.email || '',
            senha: undefined,
          },
        }));
      }
    }

    loadAuthUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setAuthUser(user);

      if (user?.email) {
        const metadata = user.user_metadata ?? {};
        const fullName =
          typeof metadata.full_name === 'string'
            ? metadata.full_name
            : typeof metadata.name === 'string'
              ? metadata.name
              : '';

        setState(prev => ({
          ...prev,
          cliente: {
            ...prev.cliente,
            nome: prev.cliente.nome || fullName,
            email: user.email || prev.cliente.email || '',
            senha: undefined,
          },
        }));
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // ── Carregar dados da barbearia ───────────────────────────────
  useEffect(() => {
    if (!barbeariaId) {
      setLoadingBarbearia(false);
      return;
    }

    async function loadBarbearia() {
      setLoadingBarbearia(true);
      setServicos([]);
      setBarbeiros([]);
      setSlots([]);
      setState(prev => ({
        ...prev,
        step: 1,
        barbearia: null,
        servicosSelecionados: [],
        barbeiro: null,
        data: null,
        horario: null,
        reminderChannel: 'whatsapp',
        duracaoTotal: 0,
        valorTotal: 0,
      }));
      try {
        let barbeariaRes = await supabasePublic
          .from('barbearias')
          .select('id, nome, agendamentos_pausados')
          .eq('id', barbeariaId)
          .eq('status', 'active')
          .eq('ativo', true)
          .single();

        if (barbeariaRes.error?.code === '42703') {
          console.warn('Fallback agendamento sem barbearias.agendamentos_pausados:', barbeariaRes.error);
          barbeariaRes = await supabasePublic
            .from('barbearias')
            .select('id, nome')
            .eq('id', barbeariaId)
            .eq('status', 'active')
            .eq('ativo', true)
            .single();
        }

        const { data, error: dbError } = barbeariaRes;
        if (dbError) throw dbError;
        if (!data) throw new Error('Barbearia não encontrada.');

        setState(prev => ({ ...prev, barbearia: data as Barbearia }));

        if ((data as Barbearia).agendamentos_pausados) {
          setError('Os agendamentos desta barbearia estao temporariamente pausados.');
          return;
        }

        // Recuperar cliente salvo no localStorage (reconhecimento de retorno)
        // barbeariaId é garantidamente string neste ponto (guard acima)
        const stored = localStorage.getItem(clienteStorageKey(barbeariaId as string));
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as ClienteInput;
            if (parsed.email) {
              setState(prev => ({
                ...prev,
                cliente: {
                  ...prev.cliente,
                  ...parsed,
                  email: prev.cliente.email || parsed.email,
                  senha: undefined,
                },
              }));
            }
          } catch {
            // JSON inválido — ignorar silenciosamente
          }
        }
      } catch (e: unknown) {
        if (e instanceof Error) setError(e.message);
        else setError('Erro ao carregar dados da barbearia.');
      } finally {
        setLoadingBarbearia(false);
      }
    }

    loadBarbearia();
  }, [barbeariaId]);

  // ── Carregar serviços ─────────────────────────────────────────
  const loadServicos = useCallback(async () => {
    if (!barbeariaId) return;
    setLoadingServicos(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabasePublic
        .from('servicos')
        .select('*')
        .eq('barbearia_id', barbeariaId)
        .eq('ativo', true)
        .order('nome');

      if (dbError) throw dbError;
      const nextServicos = (data ?? []) as Servico[];
      setServicos(nextServicos);

      if (preselectedServicoId) {
        const selected = nextServicos.find(servico =>
          servico.id === preselectedServicoId && servico.barbearia_id === barbeariaId
        );

        if (selected) {
          setState(prev => ({
            ...prev,
            servicosSelecionados: [selected],
            duracaoTotal: selected.duracao_minutos,
            valorTotal: Number(selected.valor),
          }));
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError('Erro ao carregar serviços.');
    } finally {
      setLoadingServicos(false);
    }
  }, [barbeariaId, preselectedServicoId]);

  // ── Carregar barbeiros ativos ─────────────────────────────────
  const loadBarbeiros = useCallback(async () => {
    if (!barbeariaId) return;
    setLoadingBarbeiros(true);
    setError(null);
    try {
      const selectBase = () =>
        supabasePublic
          .from('barbeiros')
          .select('id, barbearia_id, nome')
          .eq('barbearia_id', barbeariaId)
          .eq('ativo', true)
          .order('nome');

      const { data, error: dbError } = await supabasePublic
        .from('barbeiros')
        .select('id, barbearia_id, nome, foto_url, titulo, especialidade, tags, avaliacao, total_avaliacoes, destaque_label, proxima_disponibilidade')
        .eq('barbearia_id', barbeariaId)
        .eq('ativo', true)
        .order('nome');

      if (!dbError) {
        setBarbeiros((data ?? []) as Barbeiro[]);
        return;
      }

      if (dbError.code !== '42703') throw dbError;

      const { data: baseData, error: baseError } = await selectBase();
      if (baseError) throw baseError;
      setBarbeiros((baseData ?? []) as Barbeiro[]);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError('Erro ao carregar profissionais.');
    } finally {
      setLoadingBarbeiros(false);
    }
  }, [barbeariaId]);

  // ── Verificar disponibilidade de slots ────────────────────────
  const loadSlots = useCallback(async (
    data: Date,
    barbeiroId: string | null,
    duracaoTotal: number,
  ) => {
    if (!barbeariaId || duracaoTotal === 0) return;

    setLoadingSlots(true);
    setError(null);

    try {
      const dateStr = format(data, 'yyyy-MM-dd');
      // Buscar disponibilidade unificada (Agendamentos + Bloqueios) via RPC segura
      const { data: unifiedList, error: resError } = await supabasePublic.rpc('rpc_get_disponibilidade', {
        p_barbearia_id: barbeariaId,
        p_data: dateStr
      });

      if (resError) throw resError;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemsFinal = (unifiedList ?? []) as Array<Record<string, any>>;
      const agListFinal = itemsFinal.filter(i => i.tipo === 'agendamento');
      const blListFinal = itemsFinal.filter(i => i.tipo === 'bloqueio');
      const slotTimes = gerarSlotsIniciais(duracaoTotal);

      const slotsComDisp: SlotInfo[] = slotTimes.map(time => {
        const [hStr, mStr] = time.split(':');
        const slotInicio = new Date(data);
        slotInicio.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
        const slotFim = addMinutes(slotInicio, duracaoTotal);

        // Slot no passado → indisponível
        if (slotInicio <= new Date()) {
          return { time, available: false };
        }

        const temSobreposicao = (inicio: string, fim: string) => {
          const agInicio = parseISO(inicio);
          const agFim = parseISO(fim);
          return agInicio < slotFim && agFim > slotInicio;
        };

        const profissionalTemConflito = (profissionalId: string) => {
          const comAgendamento = agListFinal.some(ag => {
            if (ag.barbeiro_id !== profissionalId) return false;
            return temSobreposicao(String(ag.inicio), String(ag.fim));
          });

          if (comAgendamento) return true;

          return blListFinal.some(bl => {
            if (bl.barbeiro_id && bl.barbeiro_id !== profissionalId) return false;
            return temSobreposicao(String(bl.inicio), String(bl.fim));
          });
        };

        if (!barbeiroId) {
          return {
            time,
            available: barbeiros.some(profissional => !profissionalTemConflito(profissional.id)),
          };
        }

        // 1. Verifica conflito com agendamentos existentes
        const comAgendamento = agListFinal.some(ag => {
          if (ag.barbeiro_id !== barbeiroId) return false;
          const agInicio = parseISO(ag.inicio);
          const agFim    = parseISO(ag.fim);
          return agInicio < slotFim && agFim > slotInicio;
        });

        if (comAgendamento) return { time, available: false };

        // 2. Verifica conflito com bloqueios (já calculados pela RPC)
        const bloqueado = blListFinal.some(bl => {
          if (barbeiroId && bl.barbeiro_id && bl.barbeiro_id !== barbeiroId) return false;
          const blInicio = parseISO(bl.inicio);
          const blFim    = parseISO(bl.fim);
          return blInicio < slotFim && blFim > slotInicio;
        });

        return { time, available: !bloqueado };
      });

      setSlots(slotsComDisp);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError('Erro ao verificar disponibilidade.');
    } finally {
      setLoadingSlots(false);
    }
  }, [barbeariaId, barbeiros]);

  // ── Lookup de cliente por e-mail + telefone ───────────────────
  const lookupCliente = useCallback(async (email: string, telefone: string): Promise<ClienteInput | null> => {
    if (!barbeariaId || !email.trim() || telefone.replace(/\D/g, '').length < 10) return null;
    try {
      const { data, error: dbError } = await supabase.rpc('rpc_lookup_cliente', {
        p_barbearia_id: barbeariaId,
        p_email: email.toLowerCase().trim(),
        p_telefone: telefone.trim()
      });

      if (dbError) throw dbError;
      if (!data || data.length === 0) return null;

      const clientData = data[0];
      return {
        id:       clientData.id,
        nome:     clientData.nome,
        email,
        telefone: clientData.telefone,
      };
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      return null;
    }
  }, [barbeariaId]);


  // ── Navegação entre steps ─────────────────────────────────────
  const goToStep = useCallback((step: Step) => {
    setState(prev => ({ ...prev, step }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => {
      const next = Math.min(prev.step + 1, 6) as Step;
      return { ...prev, step: next };
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => {
      const back = Math.max(prev.step - 1, 1) as Step;
      return { ...prev, step: back };
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ── Atualizadores de estado ───────────────────────────────────
  const setCliente = useCallback((cliente: ClienteInput) => {
    setState(prev => ({ ...prev, cliente }));
    if (barbeariaId) {
      // Salvar apenas dados não-sensíveis (sem senha)
      const toSave: ClienteInput = {
        id:       cliente.id,
        nome:     cliente.nome,
        email:    cliente.email,
        telefone: cliente.telefone,
      };
      localStorage.setItem(clienteStorageKey(barbeariaId), JSON.stringify(toSave));
    }
  }, [barbeariaId]);

  // ── Vincular cliente autenticado à barbearia atual ────────────
  const vincularClienteAuthAtual = useCallback(async (): Promise<ClienteInput | null> => {
    if (!barbeariaId) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;

    const metadata = user.user_metadata ?? {};
    const fullName =
      typeof metadata.full_name === 'string'
        ? metadata.full_name
        : typeof metadata.name === 'string'
          ? metadata.name
          : '';
    const telefone = typeof metadata.telefone === 'string' ? metadata.telefone : '';

    try {
      const { data: clienteId, error: linkError } = await supabase.rpc('rpc_vincular_cliente_auth', {
        p_barbearia_id: barbeariaId,
        p_nome: fullName.trim() || user.email.split('@')[0],
        p_email: user.email.toLowerCase().trim(),
        p_telefone: telefone.trim() || '0000000000',
      });

      if (linkError) throw linkError;

      const { data: lookup } = await supabase.rpc('rpc_lookup_cliente', {
        p_barbearia_id: barbeariaId,
        p_email: user.email.toLowerCase().trim(),
        p_telefone: telefone.trim() || '0000000000',
      });

      const c = lookup?.[0];
      const clienteData: ClienteInput = {
        id: (clienteId as string) ?? (c?.id ?? undefined),
        nome: c?.nome ?? (fullName || user.email.split('@')[0]),
        email: user.email,
        telefone: c?.telefone ?? telefone,
        senha: undefined,
      };

      setCliente(clienteData);
      return clienteData;
    } catch (e: unknown) {
      console.warn('[Agendamento] Falha ao vincular cliente auth atual:', e);
      return null;
    }
  }, [barbeariaId, setCliente]);

  // ── Login de cliente na tela de agendamento ────────────────────
  const loginCliente = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!barbeariaId) return { success: false, error: 'Barbearia nao identificada.' };

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser && currentUser.user_metadata?.account_type !== 'cliente') {
      return { success: false, error: 'Você está logado como profissional. Use uma aba anônima para testar como outro cliente.' };
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (authError || !authData.user) {
        const msg = authError?.message?.toLowerCase() || '';
        if (msg.includes('email not confirmed')) {
          return { success: false, error: 'Seu e-mail precisa ser confirmado antes de entrar. Verifique sua caixa de entrada.' };
        }
        return { success: false, error: 'E-mail ou senha invalidos. Verifique seus dados e tente novamente.' };
      }

      const metadata = authData.user.user_metadata ?? {};
      const fullName =
        typeof metadata.full_name === 'string'
          ? metadata.full_name
          : typeof metadata.name === 'string'
            ? metadata.name
            : '';
      const telefone = typeof metadata.telefone === 'string' ? metadata.telefone : '';

      const { error: linkError } = await supabase.rpc('rpc_vincular_cliente_auth', {
        p_barbearia_id: barbeariaId,
        p_nome: fullName.trim() || authData.user.email?.split('@')[0] || 'Cliente',
        p_email: (authData.user.email || email).toLowerCase().trim(),
        p_telefone: telefone.trim() || '0000000000',
      });

      if (linkError) {
        console.warn('[Agendamento] Erro ao vincular cliente pos-login:', linkError);
      }

      const { data: lookup } = await supabase.rpc('rpc_lookup_cliente', {
        p_barbearia_id: barbeariaId,
        p_email: (authData.user.email || email).toLowerCase().trim(),
        p_telefone: telefone.trim() || '0000000000',
      });

      const c = lookup?.[0];
      const clienteData: ClienteInput = {
        id: c?.id ?? undefined,
        nome: c?.nome ?? (fullName || authData.user.email?.split('@')[0] || ''),
        email: authData.user.email || email,
        telefone: c?.telefone ?? telefone,
        senha: undefined,
      };

      setCliente(clienteData);
      return { success: true };
    } catch (e: unknown) {
      console.error('[Agendamento] Erro no loginCliente:', e);
      return { success: false, error: 'Nao foi possivel entrar agora. Tente novamente em instantes.' };
    }
  }, [barbeariaId, setCliente]);

  // ── Cadastro de cliente na tela de agendamento ────────────────
  const signupCliente = useCallback(async (
    signupInput: SignupData,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!barbeariaId) return { success: false, error: 'Barbearia nao identificada.' };

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser && currentUser.user_metadata?.account_type !== 'cliente') {
      return { success: false, error: 'Você está logado como profissional. Use uma aba anônima para testar como outro cliente.' };
    }

    try {
      const { data: upsertId, error: upsertError } = await supabase.rpc('rpc_upsert_cliente', {
        p_barbearia_id: barbeariaId,
        p_nome: signupInput.nome.trim(),
        p_email: signupInput.email.toLowerCase().trim(),
        p_telefone: signupInput.telefone.trim(),
      });

      if (upsertError) throw upsertError;
      const clienteId = upsertId as string | null;
      if (!clienteId) throw new Error('Falha ao preparar dados do cliente.');

      const emailRedirectTo = buildPublicUrl(`/cliente?id=${barbeariaId}`);
      const { data: signupResult, error: signupError } = await supabase.auth.signUp({
        email: signupInput.email.toLowerCase().trim(),
        password: signupInput.senha,
        options: {
          emailRedirectTo,
          data: {
            account_type: 'cliente',
            barbearia_id: barbeariaId,
            cliente_id: clienteId,
            full_name: signupInput.nome.trim(),
            telefone: signupInput.telefone.trim(),
          },
        },
      });

      if (isDuplicateSignup(signupError?.message, signupResult.user?.identities)) {
        return { success: false, error: 'Ja existe uma conta com esse e-mail. Entre como cliente para continuar.' };
      }

      if (signupError) {
        const msg = signupError.message?.toLowerCase() || '';
        if (msg.includes('password')) {
          return { success: false, error: 'A senha precisa ter pelo menos 6 caracteres.' };
        }
        throw signupError;
      }

      if (signupResult.session?.user) {
        try {
          await supabase.rpc('rpc_vincular_cliente_auth', {
            p_barbearia_id: barbeariaId,
            p_nome: signupInput.nome.trim(),
            p_email: signupInput.email.toLowerCase().trim(),
            p_telefone: signupInput.telefone.trim(),
          });
        } catch (linkErr) {
          console.warn('[Agendamento] Vinculo pos-signup:', linkErr);
        }
      }

      const clienteData: ClienteInput = {
        id: clienteId,
        nome: signupInput.nome.trim(),
        email: signupInput.email.toLowerCase().trim(),
        telefone: signupInput.telefone.trim(),
        observacoesPessoais: signupInput.observacoesPessoais?.trim(),
        senha: undefined,
      };

      setCliente(clienteData);

      if (!signupResult.session) {
        return { success: true, error: 'Conta criada! Verifique seu e-mail para confirmar. Voce ja pode continuar agendando.' };
      }

      return { success: true };
    } catch (e: unknown) {
      console.error('[Agendamento] Erro no signupCliente:', e);
      return { success: false, error: 'Nao foi possivel criar sua conta agora. Tente novamente em instantes.' };
    }
  }, [barbeariaId, setCliente]);

  // ── Recuperar senha ───────────────────────────────────────────
  const resetPassword = useCallback(async (
    email: string,
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const redirectTo = buildPublicUrl(barbeariaId ? `/cliente?id=${barbeariaId}` : '/cliente');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        { redirectTo },
      );

      if (resetError) throw resetError;

      return {
        success: true,
        message: 'Se esse e-mail estiver cadastrado, enviaremos as instrucoes de recuperacao.',
      };
    } catch (e: unknown) {
      console.error('[Agendamento] Erro ao resetar senha:', e);
      return { success: false, error: 'Nao foi possivel enviar o link agora. Tente novamente.' };
    }
  }, [barbeariaId]);

  // ── Logout de cliente (apenas contexto público) ───────────────
  const logoutCliente = useCallback(async (): Promise<{ success: boolean; error?: string } | void> => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (currentUser && currentUser.user_metadata?.account_type !== 'cliente') {
      return { success: false, error: 'Você está logado como profissional. Para usar outra conta, saia do painel ou use aba anônima.' };
    }

    await supabase.auth.signOut();
    setAuthUser(null);
    setState(prev => ({
      ...prev,
      cliente: EMPTY_CLIENTE,
    }));
    if (barbeariaId) {
      localStorage.removeItem(clienteStorageKey(barbeariaId));
    }
  }, [barbeariaId]);

  const toggleServico = useCallback((servico: Servico) => {
    if (!barbeariaId || servico.barbearia_id !== barbeariaId) {
      setError('Este servico nao pertence a barbearia selecionada.');
      return;
    }

    setState(prev => {
      const existe = prev.servicosSelecionados.some(s => s.id === servico.id);
      const atualizados = existe
        ? prev.servicosSelecionados.filter(s => s.id !== servico.id)
        : [...prev.servicosSelecionados, servico];

      const duracaoTotal = atualizados.reduce((acc, s) => acc + s.duracao_minutos, 0);
      const valorTotal   = atualizados.reduce((acc, s) => acc + Number(s.valor), 0);

      return { ...prev, servicosSelecionados: atualizados, duracaoTotal, valorTotal };
    });
    renewIdempotencyKey();
  }, [barbeariaId, renewIdempotencyKey]);

  const setBarbeiro = useCallback((barbeiro: Barbeiro | null) => {
    if (barbeiro && (!barbeariaId || barbeiro.barbearia_id !== barbeariaId)) {
      setError('Este profissional nao pertence a barbearia selecionada.');
      return;
    }

    setState(prev => ({ ...prev, barbeiro, data: null, horario: null }));
    setSlots([]);
    renewIdempotencyKey();
  }, [barbeariaId, renewIdempotencyKey]);

  const setData = useCallback((data: Date) => {
    setState(prev => ({ ...prev, data, horario: null }));
    renewIdempotencyKey();
  }, [renewIdempotencyKey]);

  const setHorario = useCallback((horario: string) => {
    setState(prev => ({ ...prev, horario }));
    renewIdempotencyKey();
  }, [renewIdempotencyKey]);

  const setObservacoes = useCallback((obs: string) => {
    setState(prev => ({ ...prev, observacoesAgendamento: obs }));
  }, []);

  const setReminderChannel = useCallback((channel: ReminderChannel) => {
    setState(prev => ({ ...prev, reminderChannel: channel }));
  }, []);

  const setCustomFormAnswer = useCallback((fieldId: string, value: string) => {
    setCustomFormAnswers(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  const loadCustomForms = useCallback(async () => {
    if (!barbeariaId || state.servicosSelecionados.length === 0) {
      setCustomFormFields([]);
      setCustomFormAnswers({});
      return;
    }

    const selectedServiceIds = new Set(state.servicosSelecionados.map(servico => servico.id));

    try {
      const { data, error: dbError } = await supabasePublic
        .from('custom_forms')
        .select('id, titulo, servico_id, custom_form_fields(id, label, type, required, options, sort_order)')
        .eq('barbearia_id', barbeariaId)
        .eq('ativo', true);

      if (dbError) throw dbError;

      const fields = ((data || []) as CustomFormRow[])
        .filter(form => !form.servico_id || selectedServiceIds.has(form.servico_id))
        .flatMap(form => (form.custom_form_fields || []).map(field => ({
          id: field.id,
          form_id: form.id,
          form_title: form.titulo,
          label: field.label,
          type: field.type,
          required: Boolean(field.required),
          options: field.options,
          sort_order: Number(field.sort_order || 0),
        })))
        .sort((a: CustomFormField, b: CustomFormField) => a.form_title.localeCompare(b.form_title) || a.sort_order - b.sort_order);

      setCustomFormFields(fields);
      setCustomFormAnswers(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => fields.some(field => field.id === key))));
    } catch (err) {
      console.warn('[Agendamento] Nao foi possivel carregar formularios personalizados:', err);
      setCustomFormFields([]);
    }
  }, [barbeariaId, state.servicosSelecionados]);

  // ── Confirmar agendamento ─────────────────────────────────────
  const confirmarAgendamento = useCallback(async (): Promise<boolean> => {
    if (submittingRef.current) return false;

    const {
      barbearia,
      cliente,
      servicosSelecionados,
      barbeiro,
      data,
      horario,
      observacoesAgendamento,
    } = state;

    if (!barbearia || !data || !horario || servicosSelecionados.length === 0) {
      setError('Dados incompletos. Por favor, revise o agendamento.');
      return false;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const missingRequiredField = customFormFields.find(field => field.required && !String(customFormAnswers[field.id] || '').trim());
      if (missingRequiredField) {
        setError(`Responda: ${missingRequiredField.label}`);
        return false;
      }

      const servicosInvalidos = servicosSelecionados.some(servico => servico.barbearia_id !== barbearia.id);
      const barbeiroInvalido = Boolean(barbeiro && barbeiro.barbearia_id !== barbearia.id);

      if (servicosInvalidos || barbeiroInvalido) {
        throw new Error('Os itens selecionados nao pertencem a barbearia atual. Recarregue o agendamento e tente novamente.');
      }

      const emailFinal = authUser?.email || cliente.email;
      let clienteId: string | null = null;

      if (authUser) {
        const { data: linkedClienteId, error: linkError } = await supabase.rpc('rpc_vincular_cliente_auth', {
          p_barbearia_id: barbearia.id,
          p_nome: cliente.nome.trim(),
          p_email: emailFinal.toLowerCase().trim(),
          p_telefone: cliente.telefone.trim()
        });

        if (linkError) throw linkError;
        clienteId = linkedClienteId as string | null;
      } else {
        // 1. Upsert do cliente via RPC (Email + Barbearia_id)
        const { data: upsertClienteId, error: clienteError } = await supabase.rpc('rpc_upsert_cliente', {
          p_barbearia_id: barbearia.id,
          p_nome:     cliente.nome.trim(),
          p_email:    cliente.email.toLowerCase().trim(),
          p_telefone: cliente.telefone.trim()
        });

        if (clienteError) throw clienteError;
        clienteId = upsertClienteId as string | null;
      }

      if (!clienteId) throw new Error('Falha ao processar dados do cliente.');

      // Persistir ID no localStorage
      const stored: ClienteInput = { ...cliente, id: clienteId, email: emailFinal };
      if (!authUser && cliente.senha) {
        const emailRedirectTo = buildPublicUrl(`/cliente?id=${barbearia.id}`);
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: cliente.email.toLowerCase().trim(),
          password: cliente.senha,
          options: {
            emailRedirectTo,
            data: {
              account_type: 'cliente',
              barbearia_id: barbearia.id,
              cliente_id: clienteId,
              full_name: cliente.nome.trim(),
              telefone: cliente.telefone.trim(),
            },
          },
        });

        if (isDuplicateSignup(signupError?.message, signupData.user?.identities)) {
          throw new Error('Este e-mail ja tem cadastro. Entre como cliente ou recupere sua senha antes de agendar.');
        }

        if (signupError) throw signupError;
      }

      if (barbeariaId) {
        // A senha nunca fica no localStorage; ela serve apenas para criar a conta Auth.
        const safeStored = { ...stored };
        delete safeStored.senha;
        localStorage.setItem(clienteStorageKey(barbeariaId), JSON.stringify(safeStored));
      }
      setState(prev => ({ ...prev, cliente: { ...stored, senha: undefined } }));

      // 2. Definir os serviços para a RPC
      const servicosParaRpc = servicosSelecionados.map(s => ({
        id: s.id
      }));

      // 3. Confirmar agendamento atômico via RPC
      const [hStr, mStr] = horario.split(':');
      const inicio = new Date(data);
      inicio.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);

      const { data: resRpc, error: agError } = await supabase.rpc('rpc_confirmar_agendamento_multi', {
        p_barbearia_id: barbearia.id,
        p_cliente_id:   clienteId,
        p_barbeiro_id:  barbeiro?.id || null,
        p_servicos:     servicosParaRpc,
        p_data_inicio:  inicio.toISOString(),
        p_observacoes:  observacoesAgendamento.trim() || null,
        p_idempotency_key: idempotencyKeyRef.current
      });

      if (agError) throw agError;
      
      const rpcResult = resRpc as { success: boolean; message?: string; ids?: string[]; status?: string; idempotent?: boolean };
      if (!rpcResult.success) {
        throw new Error(rpcResult.message || 'Erro ao confirmar agendamento.');
      }

      setConfirmationMessage(
        rpcResult.status === 'pendente'
          ? 'Agendamento enviado e aguardando confirmação do profissional.'
          : 'Agendamento confirmado com sucesso.',
      );

      const appointmentIds = rpcResult.ids || [];
      if (appointmentIds.length > 0) {
        void trackAnalyticsEvent({
          barbearia_id: barbearia.id,
          event_type: 'appointment_created',
          event_source: 'public_booking',
          cliente_id: clienteId,
          barbeiro_id: barbeiro?.id || null,
          agendamento_id: appointmentIds[0],
          metadata: {
            status: rpcResult.status || null,
            servicos: servicosSelecionados.map(servico => servico.nome),
          },
        });
      }

      if (rpcResult.status === 'pendente' && appointmentIds.length > 0) {
        void fetch('/api/push/appointment-created', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agendamento_ids: appointmentIds,
            barbearia_id: barbearia.id,
            idempotency_key: idempotencyKeyRef.current,
          }),
        }).catch((pushError) => {
          console.warn('Falha ao disparar push de novo agendamento:', pushError);
        });
      }

      if (customFormFields.length > 0 && appointmentIds[0]) {
        const grouped = customFormFields.reduce<Record<string, Record<string, string>>>((acc, field) => {
          acc[field.form_id] = acc[field.form_id] || {};
          acc[field.form_id][field.id] = customFormAnswers[field.id] || '';
          return acc;
        }, {});

        await Promise.all(Object.entries(grouped).map(([formId, answers]) =>
          supabase.rpc('rpc_save_custom_form_response', {
            p_barbearia_id: barbearia.id,
            p_agendamento_id: appointmentIds[0],
            p_cliente_id: clienteId,
            p_form_id: formId,
            p_answers: answers,
          })
        ));
      }

      goToStep(6);
      return true;
    } catch (e: unknown) {
      if (isIdempotencyDuplicate(e)) {
        setConfirmationMessage('Agendamento enviado e aguardando confirmação do profissional.');
        goToStep(6);
        return true;
      } else if (isScheduleConflictError(e)) {
        setError('Esse horário acabou de ser ocupado. Escolha outro horário.');
        if (data) {
          await loadSlots(data, barbeiro?.id ?? null, servicosSelecionados.reduce((acc, s) => acc + s.duracao_minutos, 0));
        }
        goToStep(4);
      } else if (e instanceof Error && e.message) {
        setError(e.message.includes('Failed to fetch') || e.message.includes('NetworkError') ? TEMPORARY_FAILURE_MESSAGE : e.message);
      } else setError(TEMPORARY_FAILURE_MESSAGE);
      return false;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [state, barbeariaId, goToStep, authUser, loadSlots, customFormFields, customFormAnswers]);

  // ── Reset completo ────────────────────────────────────────────
  const entrarListaEspera = useCallback(async () => {
    const {
      barbearia,
      cliente,
      servicosSelecionados,
      barbeiro,
      data,
      observacoesAgendamento,
    } = state;

    if (!barbearia || servicosSelecionados.length === 0) {
      setError('Escolha pelo menos um servico antes de entrar na lista de espera.');
      return false;
    }

    if (!cliente.nome.trim() || !cliente.telefone.trim()) {
      setError('Informe nome e telefone para entrar na lista de espera.');
      return false;
    }

    setWaitlistLoading(true);
    setWaitlistMessage(null);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc('rpc_create_waitlist_entry', {
        p_barbearia_id: barbearia.id,
        p_cliente_nome: cliente.nome.trim(),
        p_cliente_telefone: cliente.telefone.trim(),
        p_cliente_email: (authUser?.email || cliente.email || '').toLowerCase().trim() || null,
        p_barbeiro_id: barbeiro?.id || null,
        p_servico_ids: servicosSelecionados.map(servico => servico.id),
        p_data_preferida: data ? format(data, 'yyyy-MM-dd') : null,
        p_periodo_preferido: 'qualquer',
        p_observacao: observacoesAgendamento.trim() || null,
      });

      if (rpcError) throw rpcError;

      const payload = result as { success?: boolean; message?: string } | null;
      if (payload?.success === false) {
        setError(payload.message || 'Nao foi possivel entrar na lista de espera agora.');
        return false;
      }

      setWaitlistMessage(payload?.message || 'Voce entrou na lista de espera.');
      return true;
    } catch (e: unknown) {
      console.error('[Agendamento] Erro ao entrar na lista de espera:', e);
      setError('Nao foi possivel entrar na lista de espera agora. Tente novamente em instantes.');
      return false;
    } finally {
      setWaitlistLoading(false);
    }
  }, [state, authUser]);

  const resetAgendamento = useCallback(() => {
    idempotencyKeyRef.current = newIdempotencyKey();
    submittingRef.current = false;
    setConfirmationMessage('Agendamento enviado e aguardando confirmação do profissional.');
    setState(prev => ({
      step: 1,
      barbearia: prev.barbearia,
      cliente: prev.cliente, // mantém cliente para facilitar re-agendamento
      servicosSelecionados: [],
      barbeiro: null,
      data: null,
      horario: null,
      observacoesAgendamento: '',
      reminderChannel: prev.reminderChannel,
      duracaoTotal: 0,
      valorTotal: 0,
    }));
    setSlots([]);
    setCustomFormFields([]);
    setCustomFormAnswers({});
    setError(null);
  }, []);

  // ── Valores formatados ────────────────────────────────────────
  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(state.valorTotal);

  const duracaoFormatada = (() => {
    const d = state.duracaoTotal;
    if (d === 0) return '—';
    const h = Math.floor(d / 60);
    const m = d % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  })();

  return {
    // Estado
    ...state,
    // Listas de dados
    servicos,
    barbeiros,
    slots,
    customFormFields,
    customFormAnswers,
    // Loading flags
    loadingBarbearia,
    loadingServicos,
    loadingBarbeiros,
    loadingSlots,
    submitting,
    waitlistLoading,
    waitlistMessage,
    error,
    // Ações de navegação
    goToStep,
    nextStep,
    prevStep,
    // Ações de dados
    setCliente,
    toggleServico,
    setBarbeiro,
    setData,
    setHorario,
    setObservacoes,
    setReminderChannel,
    setCustomFormAnswer,
    authUser,
    isClienteAutenticado: Boolean(authUser),
    confirmationMessage,
    // Queries
    loadServicos,
    loadBarbeiros,
    loadSlots,
    loadCustomForms,
    lookupCliente,
    confirmarAgendamento,
    entrarListaEspera,
    resetAgendamento,
    clearError: () => setError(null),
    // Auth de cliente (Etapa 1)
    loginCliente,
    signupCliente,
    resetPassword,
    logoutCliente,
    vincularClienteAuthAtual,
    // Formatados prontos para UI
    valorFormatado,
    duracaoFormatada,
  };
}
