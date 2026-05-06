'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase, supabasePublic } from '@/lib/supabase';
import { addMinutes, parseISO, format } from 'date-fns';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// TIPOS EXPORTADOS
// ─────────────────────────────────────────────

export interface Barbearia {
  id: string;
  nome: string;
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

export interface SlotInfo {
  time: string;       // "09:00"
  available: boolean;
}

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
  const [state, setState] = useState<AgendamentoState>({
    step: 1,
    barbearia: null,
    cliente: EMPTY_CLIENTE,
    servicosSelecionados: [],
    barbeiro: null,
    data: null,
    horario: null,
    observacoesAgendamento: '',
    duracaoTotal: 0,
    valorTotal: 0,
  });

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [slots, setSlots] = useState<SlotInfo[]>([]);

  const [loadingBarbearia, setLoadingBarbearia] = useState(true);
  const [loadingServicos, setLoadingServicos] = useState(false);
  const [loadingBarbeiros, setLoadingBarbeiros] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const oauthError =
      url.searchParams.get('error') ||
      hashParams.get('error') ||
      url.searchParams.get('error_code') ||
      hashParams.get('error_code');
    const oauthDescription =
      url.searchParams.get('error_description') ||
      hashParams.get('error_description');

    if (!oauthError && !oauthDescription) return;

    sessionStorage.removeItem('meu_caixa_google_after_login');
    setError(
      oauthDescription?.includes('Unable to exchange external code')
        ? 'Nao foi possivel concluir o login com Google. O Google aceitou a conta, mas o Supabase nao conseguiu trocar o codigo OAuth. Verifique a configuracao do provedor Google no Supabase e tente novamente.'
        : 'Nao foi possivel concluir o login com Google. Tente novamente.',
    );

    ['error', 'error_code', 'error_description', 'sb'].forEach(param => {
      url.searchParams.delete(param);
    });
    url.hash = '';
    window.history.replaceState(null, '', url.toString());
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAuthUser() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? (await supabase.auth.getUser()).data.user;
      if (!active) return;
      setAuthUser(user ?? null);

      if (user?.email) {
        sessionStorage.removeItem('meu_caixa_google_after_login');
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
        sessionStorage.removeItem('meu_caixa_google_after_login');
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
        duracaoTotal: 0,
        valorTotal: 0,
      }));
      try {
        const { data, error: dbError } = await supabasePublic
          .from('barbearias')
          .select('id, nome')
          .eq('id', barbeariaId)
          .single();

        if (dbError) throw dbError;
        if (!data) throw new Error('Barbearia não encontrada.');

        setState(prev => ({ ...prev, barbearia: data as Barbearia }));

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
  }, [barbeariaId]);

  const setBarbeiro = useCallback((barbeiro: Barbeiro | null) => {
    if (barbeiro && (!barbeariaId || barbeiro.barbearia_id !== barbeariaId)) {
      setError('Este profissional nao pertence a barbearia selecionada.');
      return;
    }

    setState(prev => ({ ...prev, barbeiro, data: null, horario: null }));
    setSlots([]);
  }, [barbeariaId]);

  const setData = useCallback((data: Date) => {
    setState(prev => ({ ...prev, data, horario: null }));
  }, []);

  const setHorario = useCallback((horario: string) => {
    setState(prev => ({ ...prev, horario }));
  }, []);

  const setObservacoes = useCallback((obs: string) => {
    setState(prev => ({ ...prev, observacoesAgendamento: obs }));
  }, []);

  const loginComGoogle = useCallback(async () => {
    if (!barbeariaId) {
      setError('Link de agendamento invalido.');
      return;
    }

    setError(null);
    const redirectUrl = new URL('/agendar', window.location.origin);
    redirectUrl.searchParams.set('id', barbeariaId);
    redirectUrl.searchParams.set('next', 'agendar');
    sessionStorage.setItem('meu_caixa_google_after_login', `${redirectUrl.pathname}${redirectUrl.search}`);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl.toString(),
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (authError) setError(authError.message);
  }, [barbeariaId]);

  // ── Confirmar agendamento ─────────────────────────────────────
  const confirmarAgendamento = useCallback(async (): Promise<boolean> => {
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

    setSubmitting(true);
    setError(null);

    try {
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
        const { error: signupError } = await supabase.auth.signUp({
          email: cliente.email.toLowerCase().trim(),
          password: cliente.senha,
          options: {
            data: {
              account_type: 'cliente',
              barbearia_id: barbearia.id,
              cliente_id: clienteId,
              full_name: cliente.nome.trim(),
              telefone: cliente.telefone.trim(),
            },
          },
        });

        const alreadyRegistered = signupError?.message?.toLowerCase().includes('already');
        if (signupError && !alreadyRegistered) throw signupError;
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
        p_observacoes:  observacoesAgendamento.trim() || null
      });

      if (agError) throw agError;
      
      const rpcResult = resRpc as { success: boolean; message?: string; ids?: string[] };
      if (!rpcResult.success) {
        throw new Error(rpcResult.message || 'Erro ao confirmar agendamento.');
      }

      goToStep(6);
      return true;
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError('Erro inesperado ao confirmar o agendamento.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [state, barbeariaId, goToStep, authUser]);

  // ── Reset completo ────────────────────────────────────────────
  const resetAgendamento = useCallback(() => {
    setState(prev => ({
      step: 1,
      barbearia: prev.barbearia,
      cliente: prev.cliente, // mantém cliente para facilitar re-agendamento
      servicosSelecionados: [],
      barbeiro: null,
      data: null,
      horario: null,
      observacoesAgendamento: '',
      duracaoTotal: 0,
      valorTotal: 0,
    }));
    setSlots([]);
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
    // Loading flags
    loadingBarbearia,
    loadingServicos,
    loadingBarbeiros,
    loadingSlots,
    submitting,
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
    loginComGoogle,
    authUser,
    isClienteAutenticado: Boolean(authUser),
    // Queries
    loadServicos,
    loadBarbeiros,
    loadSlots,
    lookupCliente,
    confirmarAgendamento,
    resetAgendamento,
    clearError: () => setError(null),
    // Formatados prontos para UI
    valorFormatado,
    duracaoFormatada,
  };
}
