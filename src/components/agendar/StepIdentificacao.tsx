'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageCircle,
  Phone,
  User,
} from 'lucide-react';
import type { ClienteInput } from '@/hooks/useAgendamento';

interface Props {
  cliente: ClienteInput;
  onSubmit: (cliente: ClienteInput) => void;
  onLookup: (email: string, telefone: string) => Promise<ClienteInput | null>;
  onGoogleLogin: () => Promise<void>;
  isGoogleConnected: boolean;
  authEmail?: string | null;
  onVoltar?: () => void;
}

type LookupState = 'idle' | 'searching' | 'found' | 'new';
type ReminderChannel = 'whatsapp' | 'email';
type CustomerMode = 'existing' | 'new';

export function StepIdentificacao({
  cliente,
  onSubmit,
  onLookup,
  onGoogleLogin,
  isGoogleConnected,
  authEmail,
  onVoltar,
}: Props) {
  const [form, setForm] = useState<ClienteInput>(cliente);
  const [apelido, setApelido] = useState(() => cliente.nome.split(' ')[0] ?? '');
  const [nascimento, setNascimento] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [reminderChannel, setReminderChannel] = useState<ReminderChannel>('whatsapp');
  const [customerMode, setCustomerMode] = useState<CustomerMode>('existing');
  const [lookupState, setLookupState] = useState<LookupState>('idle');
  const [errors, setErrors] = useState<Partial<Record<keyof ClienteInput, string>>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectiveEmail = (isGoogleConnected ? authEmail || form.email : form.email).trim();

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      id: cliente.id ?? prev.id,
      nome: prev.nome || cliente.nome,
      email: isGoogleConnected ? authEmail || prev.email || cliente.email : prev.email || cliente.email,
      telefone: prev.telefone || cliente.telefone,
      senha: isGoogleConnected ? undefined : prev.senha,
    }));

    if (!apelido && cliente.nome) {
      setApelido(cliente.nome.split(' ')[0] ?? '');
    }
  }, [cliente, isGoogleConnected, authEmail, apelido]);

  useEffect(() => {
    if (isGoogleConnected) {
      setLookupState('idle');
      return;
    }

    const email = form.email.trim();
    const telefone = form.telefone.trim();
    const phoneDigits = telefone.replace(/\D/g, '');

    if (!email || !email.includes('@') || !email.includes('.') || phoneDigits.length < 10) {
      setLookupState('idle');
      return;
    }

    setLookupState('searching');

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const found = await onLookup(email, telefone);
      if (found) {
        setForm(prev => ({ ...prev, ...found, senha: undefined }));
        setConfirmSenha('');
        setApelido(found.nome.split(' ')[0] ?? '');
        setLookupState('found');
      } else {
        setLookupState('new');
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.email, form.telefone, isGoogleConnected, customerMode]);

  function handleChange(field: keyof ClienteInput, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
    if ((field === 'email' || field === 'telefone') && customerMode === 'existing') {
      setLookupState('idle');
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof ClienteInput, string>> = {};

    if (!effectiveEmail) newErrors.email = 'E-mail obrigatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveEmail)) {
      newErrors.email = 'E-mail invalido';
    }
    if (!form.telefone.trim()) newErrors.telefone = 'Telefone obrigatorio';
    else if (form.telefone.replace(/\D/g, '').length < 10) {
      newErrors.telefone = 'Telefone incompleto';
    }

    if (customerMode === 'existing' && !isGoogleConnected && lookupState !== 'found') {
      newErrors.email = lookupState === 'new'
        ? 'Nao encontramos esse cliente nesta barbearia. Use criar cadastro.'
        : 'Informe e-mail e WhatsApp para localizar seu cadastro.';
    }

    if ((customerMode === 'new' || lookupState === 'found' || isGoogleConnected) && !form.nome.trim()) {
      newErrors.nome = 'Nome obrigatorio';
    }

    if (customerMode === 'new' && lookupState !== 'found' && !isGoogleConnected) {
      if (!form.senha || form.senha.length < 6) {
        newErrors.senha = 'Crie uma senha com pelo menos 6 caracteres';
      } else if (form.senha !== confirmSenha) {
        newErrors.senha = 'As senhas nao conferem';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      ...form,
      email: effectiveEmail,
      senha: isGoogleConnected ? undefined : form.senha,
      observacoesPessoais: form.observacoesPessoais?.trim(),
    });
  }

  const passwordComplete = isGoogleConnected || lookupState === 'found' || Boolean(form.senha && form.senha.length >= 6 && confirmSenha === form.senha);
  const isExistingComplete = customerMode === 'existing' && lookupState === 'found' && form.nome.trim() && effectiveEmail && form.telefone.trim();
  const isNewComplete = customerMode === 'new' && form.nome.trim() && effectiveEmail && form.telefone.trim() && passwordComplete;
  const isComplete = isGoogleConnected
    ? Boolean(form.nome.trim() && effectiveEmail && form.telefone.trim())
    : Boolean(isExistingComplete || isNewComplete);
  const firstName = form.nome.trim().split(' ')[0] || 'cliente';
  const pageTitle = isGoogleConnected
    ? 'Complete seus dados'
    : customerMode === 'existing'
      ? 'Ja sou cliente'
      : 'Criar cadastro';
  const pageDescription = isGoogleConnected
    ? 'Confirme seus dados para continuar com sua conta Google.'
    : customerMode === 'existing'
      ? 'Encontre seu cadastro usando e-mail e WhatsApp.'
      : 'Crie seu cadastro para agendar e acompanhar seus horarios depois.';

  return (
    <form onSubmit={handleSubmit} noValidate className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mb-8 space-y-3">
        <p className="text-center text-[11px] font-black uppercase tracking-[0.35em] text-white/45">
          Etapa 1 de 5 - Seus dados
        </p>
        <div className="space-y-3">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {pageTitle} <span className="text-[#D6B47A]">.</span>
          </h2>
          <p className="text-sm sm:text-base text-white/60">
            {pageDescription}
          </p>
        </div>
      </div>

      {lookupState === 'found' && (
        <div className="mb-7 flex items-start gap-4 rounded-2xl border border-[#D6B47A]/40 bg-[#D6B47A]/10 p-5">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#D6B47A]" />
          <div>
            <p className="font-black text-[#D6B47A]">Seus dados foram preenchidos automaticamente.</p>
            <p className="mt-1 text-sm text-white/60">Voce pode editar se precisar, {firstName}.</p>
          </div>
        </div>
      )}

      {!isGoogleConnected && (
        <div className="mb-7 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setCustomerMode('existing');
              setConfirmSenha('');
              setForm(prev => ({ ...prev, senha: undefined }));
              setErrors({});
            }}
            className={`min-h-14 rounded-xl px-4 text-sm font-black uppercase tracking-[0.12em] transition-all ${
              customerMode === 'existing'
                ? 'bg-[#D6B47A] text-black shadow-lg shadow-[#D6B47A]/15'
                : 'border border-white/10 bg-white/[0.03] text-white/65 hover:text-white'
            }`}
          >
            Ja sou cliente
          </button>
          <button
            type="button"
            onClick={() => {
              setCustomerMode('new');
              setErrors({});
            }}
            className={`min-h-14 rounded-xl px-4 text-sm font-black uppercase tracking-[0.12em] transition-all ${
              customerMode === 'new'
                ? 'bg-[#D6B47A] text-black shadow-lg shadow-[#D6B47A]/15'
                : 'border border-white/10 bg-white/[0.03] text-white/65 hover:text-white'
            }`}
          >
            Criar cadastro
          </button>
        </div>
      )}

      {!isGoogleConnected && customerMode === 'existing' && (
        <div className="mb-7 rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/8 p-5">
          <p className="font-black text-white">Entre como cliente cadastrado</p>
          <p className="mt-2 text-sm leading-relaxed text-white/58">
            Informe o mesmo e-mail e WhatsApp usados em agendamentos anteriores. Se encontrarmos seu cadastro nesta barbearia, voce continua sem criar outra conta.
          </p>
          {lookupState === 'searching' && (
            <p className="mt-3 text-sm font-bold text-[#D6B47A]">Buscando seu cadastro...</p>
          )}
          {lookupState === 'new' && (
            <p className="mt-3 text-sm font-bold text-[#ff4d4d]">
              Nao encontramos esse cliente nesta barbearia. Toque em criar cadastro para continuar.
            </p>
          )}
        </div>
      )}

      {!isGoogleConnected && (
        <div className="mb-7 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <button
            type="button"
            onClick={onGoogleLogin}
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] px-4 font-black text-white transition-all hover:border-[#D6B47A]/35 hover:bg-white/[0.07]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base font-black text-black">
              G
            </span>
            Continuar com Google
          </button>
        </div>
      )}

      <div className="space-y-7">
        {isGoogleConnected ? (
          <div className="rounded-2xl border border-[#D6B47A]/35 bg-[#D6B47A]/10 p-5">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
                G
              </span>
              <div className="min-w-0">
                <p className="font-black text-[#D6B47A]">Conta Google conectada</p>
                <p className="mt-1 truncate text-sm text-white/65">{effectiveEmail}</p>
              </div>
              <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-[#D6B47A]" />
            </div>
            {errors.email && <p className="mt-3 text-xs text-[#ff4d4d]">{errors.email}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="ag-email" className="text-[11px] uppercase font-black text-white/45 tracking-[0.2em]">
              E-mail *
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                id="ag-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                placeholder="teste@gmail.com"
                className={`
                  h-14 w-full rounded-2xl border bg-white/[0.03] pl-12 pr-12 text-base font-bold text-white
                  outline-none transition-all placeholder:text-white/25
                  ${errors.email
                    ? 'border-[#ff4d4d]/70 focus:border-[#ff4d4d]'
                    : lookupState === 'found'
                    ? 'border-[#D6B47A]/60 focus:border-[#D6B47A]'
                    : 'border-white/15 focus:border-[#D6B47A]/60'
                  }
                `}
              />
              {lookupState === 'found' && (
                <CheckCircle2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D6B47A]" />
              )}
            </div>
            {errors.email && <p className="text-[#ff4d4d] text-xs">{errors.email}</p>}
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ag-nome" className="text-[11px] uppercase font-black text-white/45 tracking-[0.2em]">
              Nome completo *
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                id="ag-nome"
                type="text"
                autoComplete="name"
                value={form.nome}
                onChange={e => {
                  handleChange('nome', e.target.value);
                  if (!apelido || apelido === form.nome.split(' ')[0]) {
                    setApelido(e.target.value.split(' ')[0] ?? '');
                  }
                }}
                placeholder="Tales Augusto Silva"
                className={`h-14 w-full rounded-2xl border bg-white/[0.03] pl-12 pr-4 text-base font-bold text-white outline-none transition-all placeholder:text-white/25 ${errors.nome ? 'border-[#ff4d4d]/70 focus:border-[#ff4d4d]' : 'border-white/15 focus:border-[#D6B47A]/60'}`}
              />
            </div>
            {errors.nome && <p className="text-[#ff4d4d] text-xs">{errors.nome}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="ag-apelido" className="text-[11px] uppercase font-black text-white/45 tracking-[0.2em]">
              Como podemos te chamar?
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                id="ag-apelido"
                type="text"
                value={apelido}
                onChange={e => setApelido(e.target.value)}
                placeholder="Tales"
                className="h-14 w-full rounded-2xl border border-white/15 bg-white/[0.03] pl-12 pr-4 text-base font-bold text-white outline-none transition-all placeholder:text-white/25 focus:border-[#D6B47A]/60"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="ag-tel" className="text-[11px] uppercase font-black text-white/45 tracking-[0.2em]">
            Celular (WhatsApp) *
          </label>
          <div className="relative flex h-16 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03] focus-within:border-[#D6B47A]/60">
            <div className="flex w-28 shrink-0 items-center justify-center gap-2 border-r border-white/10 text-sm font-black text-white">
              <Phone className="h-4 w-4 text-white/40" />
              +55
              <ChevronDown className="h-4 w-4 text-white/40" />
            </div>
            <input
              id="ag-tel"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={form.telefone}
              onChange={e => handleChange('telefone', e.target.value)}
              placeholder="(37) 47494-8484"
              className="min-w-0 flex-1 bg-transparent px-5 text-base font-bold text-white outline-none placeholder:text-white/25"
            />
            {form.telefone.trim() && (
              <CheckCircle2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D6B47A]" />
            )}
          </div>
          {errors.telefone && <p className="text-[#ff4d4d] text-xs">{errors.telefone}</p>}
          <p className="flex items-center gap-2 text-xs text-white/55">
            <MessageCircle className="h-4 w-4 text-[#D6B47A]" />
            Usaremos este numero para confirmar seu agendamento.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="ag-nascimento" className="text-[11px] uppercase font-black text-white/45 tracking-[0.2em]">
            Data de nascimento
          </label>
          <div className="relative">
            <CalendarDays className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
            <input
              id="ag-nascimento"
              type="text"
              inputMode="numeric"
              value={nascimento}
              onChange={e => setNascimento(e.target.value)}
              placeholder="15/07/1996"
              className="h-14 w-full rounded-2xl border border-white/15 bg-white/[0.03] pl-12 pr-4 text-base font-bold text-white outline-none transition-all placeholder:text-white/25 focus:border-[#D6B47A]/60"
            />
          </div>
        </div>

        {customerMode === 'new' && lookupState !== 'found' && !isGoogleConnected && (
          <div className="rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/8 p-5">
            <div className="mb-4">
              <h3 className="text-lg font-black text-white">Crie sua senha de acesso</h3>
              <p className="mt-2 text-sm text-white/55">
                Com essa conta voce entra depois para ver seus proximos agendamentos e historico.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="ag-senha" className="text-[11px] uppercase font-black text-white/45 tracking-[0.2em]">
                  Senha *
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                  <input
                    id="ag-senha"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.senha ?? ''}
                    onChange={e => handleChange('senha', e.target.value)}
                    placeholder="Minimo 6 caracteres"
                    className={`h-14 w-full rounded-2xl border bg-white/[0.03] pl-12 pr-12 text-base font-bold text-white outline-none transition-all placeholder:text-white/25 ${errors.senha ? 'border-[#ff4d4d]/70 focus:border-[#ff4d4d]' : 'border-white/15 focus:border-[#D6B47A]/60'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 transition-colors hover:text-white"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="ag-confirma-senha" className="text-[11px] uppercase font-black text-white/45 tracking-[0.2em]">
                  Confirmar senha *
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                  <input
                    id="ag-confirma-senha"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmSenha}
                    onChange={e => setConfirmSenha(e.target.value)}
                    placeholder="Repita sua senha"
                    className={`h-14 w-full rounded-2xl border bg-white/[0.03] pl-12 pr-4 text-base font-bold text-white outline-none transition-all placeholder:text-white/25 ${errors.senha ? 'border-[#ff4d4d]/70 focus:border-[#ff4d4d]' : 'border-white/15 focus:border-[#D6B47A]/60'}`}
                  />
                </div>
              </div>
            </div>

            {errors.senha && <p className="mt-3 text-xs text-[#ff4d4d]">{errors.senha}</p>}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-black text-white">Como voce prefere receber lembretes?</h3>
            <p className="mt-2 text-sm text-white/55">Enviaremos confirmacoes e lembretes do seu agendamento.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setReminderChannel('whatsapp')}
              className={`flex min-h-20 items-center justify-between rounded-2xl border p-5 text-left transition-all ${reminderChannel === 'whatsapp' ? 'border-[#D6B47A] bg-[#D6B47A]/10' : 'border-white/15 bg-white/[0.03] hover:bg-white/[0.06]'}`}
            >
              <span className="flex items-center gap-4">
                <MessageCircle className="h-8 w-8 text-[#D6B47A]" />
                <span>
                  <span className="block font-black text-white">WhatsApp</span>
                  <span className="text-sm font-bold text-[#D6B47A]">Recomendado</span>
                </span>
              </span>
              {reminderChannel === 'whatsapp' ? <CheckCircle2 className="h-5 w-5 text-[#D6B47A]" /> : <Circle className="h-5 w-5 text-white/40" />}
            </button>

            <button
              type="button"
              onClick={() => setReminderChannel('email')}
              className={`flex min-h-20 items-center justify-between rounded-2xl border p-5 text-left transition-all ${reminderChannel === 'email' ? 'border-[#D6B47A] bg-[#D6B47A]/10' : 'border-white/15 bg-white/[0.03] hover:bg-white/[0.06]'}`}
            >
              <span className="flex items-center gap-4">
                <Mail className="h-8 w-8 text-white/50" />
                <span className="font-black text-white">E-mail</span>
              </span>
              {reminderChannel === 'email' ? <CheckCircle2 className="h-5 w-5 text-[#D6B47A]" /> : <Circle className="h-5 w-5 text-white/40" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="ag-obs" className="text-lg font-black text-white">
              Alguma observacao sobre voce?
            </label>
            <span className="text-sm text-white/55">Opcional</span>
          </div>
          <div className="relative">
            <textarea
              id="ag-obs"
              maxLength={120}
              value={form.observacoesPessoais ?? ''}
              onChange={e => handleChange('observacoesPessoais', e.target.value)}
              placeholder="Ex.: Prefiro degrade alto, tenho alergia a algum produto, etc."
              className="min-h-36 w-full resize-none rounded-2xl border border-white/15 bg-white/[0.03] p-5 pb-9 text-sm text-white outline-none transition-all placeholder:text-white/35 focus:border-[#D6B47A]/60"
            />
            <span className="absolute bottom-4 right-4 text-xs text-white/45">
              {(form.observacoesPessoais ?? '').length}/120
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
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
          disabled={!isComplete}
          className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#D6B47A] px-6 font-black text-black transition-all hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          Continuar para servicos
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
