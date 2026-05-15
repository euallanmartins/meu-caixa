'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  User,
} from 'lucide-react';
import type { ClienteInput, ReminderChannel, SignupData } from '@/hooks/useAgendamento';
import { ReminderChannelSelector } from './ReminderChannelSelector';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────

interface Props {
  cliente: ClienteInput;
  barbeariaId: string;
  authUser: SupabaseUser | null;
  onSubmit: (cliente: ClienteInput) => void;
  onAuthLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onAuthSignup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  resetPassword?: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  onVincularAuth?: () => Promise<ClienteInput | null>;
  onLogout?: () => Promise<{ success: boolean; error?: string } | void>;
  reminderChannel: ReminderChannel;
  onReminderChannelChange: (channel: ReminderChannel) => void;
  onVoltar?: () => void;
}

type CustomerMode = 'login' | 'signup';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function formatBirthDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────

export function StepIdentificacao({
  cliente,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  barbeariaId: _barbeariaId,
  authUser,
  onSubmit,
  onAuthLogin,
  onAuthSignup,
  resetPassword,
  onVincularAuth,
  onLogout,
  reminderChannel,
  onReminderChannelChange,
  onVoltar,
}: Props) {
  // ── Estado de modo ──
  const [customerMode, setCustomerMode] = useState<CustomerMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Login ──
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  // ── Signup ──
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [telefone, setTelefone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupSenha, setSignupSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [nascimento, setNascimento] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Já logado: vincular automaticamente ──
  const [vinculando, setVinculando] = useState(false);

  // Preencher campos de signup com dados do cliente se já houver
  useEffect(() => {
    if (cliente.nome && !nome) setNome(cliente.nome);
    if (cliente.email && !signupEmail) setSignupEmail(cliente.email);
    if (cliente.telefone && !telefone) setTelefone(cliente.telefone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente]);

  // Auto-advance: quando authUser muda (login/signup resolveu)
  useEffect(() => {
    if (authUser && cliente.email && !vinculando) {
      onSubmit(cliente);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // ─────────────────────────────────────────────
  // CARD: Já está logado
  // ─────────────────────────────────────────────

  if (authUser && !vinculando) {
    const displayName = cliente.nome
      || authUser.user_metadata?.full_name
      || authUser.user_metadata?.name
      || authUser.email?.split('@')[0]
      || 'Cliente';

    async function handleContinuarLogado() {
      setVinculando(true);
      setError(null);
      try {
        if (onVincularAuth) {
          const linked = await onVincularAuth();
          if (linked) {
            onSubmit(linked);
            return;
          }
        }
        // Fallback: usar dados do cliente já no state
        onSubmit({
          ...cliente,
          email: cliente.email || authUser?.email || '',
          nome: cliente.nome || displayName,
        });
      } catch {
        setError('Nao foi possivel continuar. Tente novamente.');
      } finally {
        setVinculando(false);
      }
    }

    async function handleUsarOutraConta() {
      if (onLogout) {
        const result = await onLogout();
        if (result && !result.success && result.error) {
          setError(result.error);
        }
      }
    }

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="mb-8 space-y-3">
          <p className="text-center text-[11px] font-black uppercase tracking-[0.35em] text-white/45">
            Etapa 1 de 5
          </p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Voce ja esta conectado <span className="text-[#D6B47A]">.</span>
          </h2>
        </div>

        <div className="rounded-2xl border border-[#D6B47A]/30 bg-[#D6B47A]/8 p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-[#D6B47A]/20 flex items-center justify-center shrink-0">
              <User className="h-7 w-7 text-[#D6B47A]" />
            </div>
            <div className="min-w-0">
              <p className="font-black text-white text-lg truncate">{displayName}</p>
              <p className="text-sm text-white/55 truncate">{authUser.email}</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-[#ff4d4d]">{error}</p>
          )}

          <button
            type="button"
            onClick={handleContinuarLogado}
            disabled={vinculando}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#D6B47A] px-6 font-black text-black transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
          >
            {vinculando ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
            Continuar para servicos
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={handleUsarOutraConta}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.03] font-black text-white/65 text-sm transition-all hover:bg-white/[0.06] hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Usar outra conta
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // HANDLER: Login
  // ─────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    if (!isValidEmail(loginEmail.trim())) {
      setError('Informe um e-mail valido.');
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    const result = await onAuthLogin(loginEmail.trim(), loginPassword);

    if (result.success) {
      // O hook já fez setCliente; vamos submeter para avançar
      // Precisamos esperar um tick para os dados do cliente chegarem via state
      setTimeout(() => {
        setLoading(false);
      }, 100);
      return;
    }

    setError(result.error || 'Verifique seus dados e tente novamente.');
    setLoading(false);
  }

  // ─────────────────────────────────────────────
  // HANDLER: Reset de Senha
  // ─────────────────────────────────────────────

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setError('Informe o e-mail para recuperar a senha.');
      return;
    }
    if (!isValidEmail(loginEmail.trim())) {
      setError('Informe um e-mail valido.');
      return;
    }
    if (!resetPassword) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    const result = await resetPassword(loginEmail.trim());
    setLoading(false);

    if (result.success) {
      setNotice(result.message || 'Verifique seu e-mail para as instrucoes de recuperacao.');
    } else {
      setError(result.error || 'Nao foi possivel enviar o link agora.');
    }
  }

  // ─────────────────────────────────────────────
  // HANDLER: Signup
  // ─────────────────────────────────────────────

  function validateSignup(): boolean {
    const errs: Record<string, string> = {};

    if (!nome.trim()) errs.nome = 'Nome obrigatorio';
    if (!signupEmail.trim()) errs.email = 'E-mail obrigatorio';
    else if (!isValidEmail(signupEmail.trim())) errs.email = 'E-mail invalido';
    if (!telefone.trim()) errs.telefone = 'WhatsApp obrigatorio';
    else if (telefone.replace(/\D/g, '').length < 10) errs.telefone = 'WhatsApp incompleto';
    if (!signupSenha) errs.senha = 'Crie uma senha';
    else if (signupSenha.length < 6) errs.senha = 'Minimo 6 caracteres';
    else if (signupSenha !== confirmSenha) errs.senha = 'As senhas nao conferem';

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!validateSignup()) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    const signupData: SignupData = {
      nome: nome.trim(),
      apelido: apelido.trim() || undefined,
      telefone: telefone.trim(),
      email: signupEmail.trim(),
      senha: signupSenha,
      nascimento: nascimento || undefined,
      observacoesPessoais: observacoes.trim() || undefined,
      reminderChannel,
    };

    const result = await onAuthSignup(signupData);

    if (result.success) {
      if (result.error) {
        // success=true + error = "verifique seu e-mail" (info, não erro)
        setNotice(result.error);
      }
      // O hook já fez setCliente; aguardar state update
      setTimeout(() => {
        setLoading(false);
      }, 100);
      return;
    }

    setError(result.error || 'Nao foi possivel criar sua conta.');
    setLoading(false);
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  const inputBase = 'h-14 w-full rounded-2xl border bg-white/[0.03] text-base font-bold text-white outline-none transition-all placeholder:text-white/25';
  const inputNormal = `${inputBase} border-white/15 focus:border-[#D6B47A]/60`;
  const inputError = `${inputBase} border-[#ff4d4d]/70 focus:border-[#ff4d4d]`;
  const labelCls = 'text-[11px] uppercase font-black text-white/45 tracking-[0.2em]';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* ── Título ── */}
      <div className="mb-8 space-y-3">
        <p className="text-center text-[11px] font-black uppercase tracking-[0.35em] text-white/45">
          Etapa 1 de 5
        </p>
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Entre ou crie sua conta <span className="text-[#D6B47A]">.</span>
          </h2>
          <p className="text-sm sm:text-base text-white/55">
            Use sua conta para agendar mais rapido e acompanhar seus horarios.
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="mb-7 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2 grid-cols-2">
        <button
          type="button"
          onClick={() => { setCustomerMode('login'); setError(null); setNotice(null); }}
          className={`min-h-14 rounded-xl px-4 text-sm font-black uppercase tracking-[0.12em] transition-all ${
            customerMode === 'login'
              ? 'bg-[#D6B47A] text-black shadow-lg shadow-[#D6B47A]/15'
              : 'border border-white/10 bg-white/[0.03] text-white/65 hover:text-white'
          }`}
        >
          Ja sou cliente
        </button>
        <button
          type="button"
          onClick={() => { setCustomerMode('signup'); setError(null); setNotice(null); }}
          className={`min-h-14 rounded-xl px-4 text-sm font-black uppercase tracking-[0.12em] transition-all ${
            customerMode === 'signup'
              ? 'bg-[#D6B47A] text-black shadow-lg shadow-[#D6B47A]/15'
              : 'border border-white/10 bg-white/[0.03] text-white/65 hover:text-white'
          }`}
        >
          Criar cadastro
        </button>
      </div>

      {/* ── Feedback ── */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#ff4d4d]/30 bg-[#ff4d4d]/10 p-4 animate-in fade-in duration-200">
          <Mail className="h-4 w-4 text-[#ff4d4d] shrink-0 mt-0.5" />
          <p className="text-sm text-[#ff8a8a]">{error}</p>
        </div>
      )}
      {notice && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#D6B47A]/30 bg-[#D6B47A]/10 p-4 animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4 text-[#D6B47A] shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-[#D6B47A]">{notice}</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* MODO A: Login                               */}
      {/* ═══════════════════════════════════════════ */}
      {customerMode === 'login' && !resetMode && (
        <form onSubmit={handleLogin} noValidate className="space-y-6">
          {/* E-mail */}
          <div className="space-y-2">
            <label htmlFor="ag-login-email" className={labelCls}>E-mail</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                id="ag-login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={loginEmail}
                onChange={e => { setLoginEmail(e.target.value); setError(null); }}
                placeholder="voce@email.com"
                className={`${inputNormal} pl-12 pr-4`}
              />
            </div>
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <label htmlFor="ag-login-pw" className={labelCls}>Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                id="ag-login-pw"
                type={showLoginPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={loginPassword}
                onChange={e => { setLoginPassword(e.target.value); setError(null); }}
                placeholder="Sua senha"
                className={`${inputNormal} pl-12 pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowLoginPw(p => !p)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 hover:text-white transition-colors"
                aria-label={showLoginPw ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showLoginPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Esqueci minha senha */}
          {resetPassword && (
            <button
              type="button"
              onClick={() => { setResetMode(true); setError(null); setNotice(null); }}
              className="flex items-center gap-2 text-sm font-bold text-[#D6B47A] hover:text-[#E7C992] transition-colors"
            >
              <KeyRound className="h-4 w-4" />
              Esqueci minha senha
            </button>
          )}

          {/* Botões */}
          <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr] pt-2">
            <button
              type="button"
              onClick={onVoltar}
              disabled={!onVoltar}
              className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.03] font-black text-white transition-all hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </button>
            <button
              type="submit"
              disabled={loading || !loginEmail.trim() || !loginPassword}
              className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#D6B47A] px-6 font-black text-black transition-all hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
              Entrar e continuar
            </button>
          </div>
        </form>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* MODO: Reset de senha                        */}
      {/* ═══════════════════════════════════════════ */}
      {customerMode === 'login' && resetMode && (
        <form onSubmit={handleResetPassword} noValidate className="space-y-6">
          <div className="rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/8 p-5">
            <p className="font-black text-white">Recuperar senha</p>
            <p className="mt-2 text-sm text-white/55">
              Informe seu e-mail e enviaremos um link para criar uma nova senha.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="ag-reset-email" className={labelCls}>E-mail</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                id="ag-reset-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={loginEmail}
                onChange={e => { setLoginEmail(e.target.value); setError(null); }}
                placeholder="voce@email.com"
                className={`${inputNormal} pl-12 pr-4`}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <button
              type="button"
              onClick={() => { setResetMode(false); setError(null); setNotice(null); }}
              className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.03] font-black text-white transition-all hover:bg-white/[0.06]"
            >
              <ArrowLeft className="h-5 w-5" />
              Voltar ao login
            </button>
            <button
              type="submit"
              disabled={loading || !loginEmail.trim()}
              className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#D6B47A] px-6 font-black text-black transition-all hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
              Enviar link
            </button>
          </div>
        </form>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* MODO B: Criar cadastro                      */}
      {/* ═══════════════════════════════════════════ */}
      {customerMode === 'signup' && (
        <form onSubmit={handleSignup} noValidate className="space-y-6">
          {/* Nome completo */}
          <div className="space-y-2">
            <label htmlFor="ag-nome" className={labelCls}>Nome completo *</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                id="ag-nome"
                type="text"
                autoComplete="name"
                value={nome}
                onChange={e => {
                  setNome(e.target.value);
                  if (!apelido || apelido === nome.split(' ')[0]) {
                    setApelido(e.target.value.split(' ')[0] ?? '');
                  }
                  if (fieldErrors.nome) setFieldErrors(p => ({ ...p, nome: '' }));
                }}
                placeholder="Nome Sobrenome"
                className={`${fieldErrors.nome ? inputError : inputNormal} pl-12 pr-4`}
              />
            </div>
            {fieldErrors.nome && <p className="text-[#ff4d4d] text-xs">{fieldErrors.nome}</p>}
          </div>

          {/* Apelido */}
          <div className="space-y-2">
            <label htmlFor="ag-apelido" className={labelCls}>Como prefere ser chamado</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                id="ag-apelido"
                type="text"
                value={apelido}
                onChange={e => setApelido(e.target.value)}
                placeholder={nome.split(' ')[0] || 'Apelido'}
                className={`${inputNormal} pl-12 pr-4`}
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div className="space-y-2">
            <label htmlFor="ag-tel" className={labelCls}>WhatsApp *</label>
            <div className={`relative flex h-16 overflow-hidden rounded-2xl border bg-white/[0.03] focus-within:border-[#D6B47A]/60 ${fieldErrors.telefone ? 'border-[#ff4d4d]/70' : 'border-white/15'}`}>
              <div className="flex w-24 shrink-0 items-center justify-center gap-1.5 border-r border-white/10 text-sm font-black text-white">
                <Phone className="h-4 w-4 text-white/40" />
                +55
                <ChevronDown className="h-3.5 w-3.5 text-white/40" />
              </div>
              <input
                id="ag-tel"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={telefone}
                onChange={e => {
                  setTelefone(e.target.value);
                  if (fieldErrors.telefone) setFieldErrors(p => ({ ...p, telefone: '' }));
                }}
                placeholder="(37) 4749-8484"
                className="min-w-0 flex-1 bg-transparent px-4 text-base font-bold text-white outline-none placeholder:text-white/25"
              />
            </div>
            {fieldErrors.telefone && <p className="text-[#ff4d4d] text-xs">{fieldErrors.telefone}</p>}
            <p className="flex items-center gap-2 text-xs text-white/55">
              <MessageCircle className="h-4 w-4 text-[#D6B47A]" />
              Usaremos este numero para confirmar seu agendamento.
            </p>
          </div>

          {/* E-mail */}
          <div className="space-y-2">
            <label htmlFor="ag-signup-email" className={labelCls}>E-mail *</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                id="ag-signup-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={signupEmail}
                onChange={e => {
                  setSignupEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: '' }));
                }}
                placeholder="voce@email.com"
                className={`${fieldErrors.email ? inputError : inputNormal} pl-12 pr-4`}
              />
            </div>
            {fieldErrors.email && <p className="text-[#ff4d4d] text-xs">{fieldErrors.email}</p>}
          </div>

          {/* Senha + Confirmar */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="ag-signup-pw" className={labelCls}>Senha *</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                <input
                  id="ag-signup-pw"
                  type={showSignupPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={signupSenha}
                  onChange={e => {
                    setSignupSenha(e.target.value);
                    if (fieldErrors.senha) setFieldErrors(p => ({ ...p, senha: '' }));
                  }}
                  placeholder="Min. 6 caracteres"
                  className={`${fieldErrors.senha ? inputError : inputNormal} pl-12 pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPw(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 hover:text-white transition-colors"
                  aria-label={showSignupPw ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showSignupPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="ag-signup-pw-confirm" className={labelCls}>Confirmar senha *</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                <input
                  id="ag-signup-pw-confirm"
                  type={showSignupPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmSenha}
                  onChange={e => setConfirmSenha(e.target.value)}
                  placeholder="Repita a senha"
                  className={`${fieldErrors.senha ? inputError : inputNormal} pl-12 pr-4`}
                />
              </div>
            </div>
          </div>
          {fieldErrors.senha && <p className="text-[#ff4d4d] text-xs -mt-3">{fieldErrors.senha}</p>}

          {/* Informações adicionais (recolhível) */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowExtras(v => !v)}
              className="flex h-14 w-full items-center justify-between gap-3 px-5 font-black text-white/70 hover:text-white transition-colors"
            >
              <span className="text-sm">Informacoes adicionais</span>
              <ChevronDown className={`h-5 w-5 transition-transform ${showExtras ? 'rotate-180' : ''}`} />
            </button>

            {showExtras && (
              <div className="space-y-5 px-5 pb-5 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Nascimento */}
                <div className="space-y-2">
                  <label htmlFor="ag-nasc" className={labelCls}>Data de nascimento</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                    <input
                      id="ag-nasc"
                      type="text"
                      inputMode="numeric"
                      autoComplete="bday"
                      maxLength={10}
                      value={nascimento}
                      onChange={e => setNascimento(formatBirthDate(e.target.value))}
                      placeholder="15/07/1996"
                      className={`${inputNormal} pl-12 pr-4`}
                    />
                  </div>
                </div>

                {/* Lembretes */}
                <div className="space-y-3">
                  <p className="font-black text-white text-sm">Preferencia de lembrete</p>
                  <ReminderChannelSelector
                    name="signup-reminder"
                    value={reminderChannel}
                    onChange={onReminderChannelChange}
                    variant="large"
                  />
                </div>

                {/* Observação */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <label htmlFor="ag-obs" className="text-sm font-black text-white">
                      Observacao sobre voce
                    </label>
                    <span className="text-xs text-white/45">Opcional</span>
                  </div>
                  <div className="relative">
                    <textarea
                      id="ag-obs"
                      maxLength={120}
                      value={observacoes}
                      onChange={e => setObservacoes(e.target.value)}
                      placeholder="Ex.: Prefiro degrade alto, tenho alergia a algum produto..."
                      className="min-h-28 w-full resize-none rounded-2xl border border-white/15 bg-white/[0.03] p-4 pb-8 text-sm text-white outline-none transition-all placeholder:text-white/30 focus:border-[#D6B47A]/60"
                    />
                    <span className="absolute bottom-3 right-4 text-xs text-white/45">
                      {observacoes.length}/120
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr] pt-2">
            <button
              type="button"
              onClick={onVoltar}
              disabled={!onVoltar}
              className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.03] font-black text-white transition-all hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#D6B47A] px-6 font-black text-black transition-all hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
              Criar conta e continuar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
