'use client';

import { useEffect, useState } from 'react';
import { Bell, Loader2, Save, Smartphone, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ProfessionalMobileHeader } from '@/components/layout/ProfessionalMobileHeader';
import { FeatureGate } from '@/components/saas/FeatureGate';

type Profile = {
  role: string | null;
  barbearia_id: string | null;
  barbeiro_id: string | null;
};

type BarberProfile = {
  id: string;
  nome: string;
  foto_url: string | null;
  telefone: string | null;
  titulo: string | null;
  especialidade: string | null;
  tags: string[] | null;
  barbearias?: { nome?: string | null } | null;
};

const inputClass = 'h-13 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none focus:border-[#D6B47A]/50';
const textareaClass = 'min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-bold text-white outline-none focus:border-[#D6B47A]/50';

export default function MeuPerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [barber, setBarber] = useState<BarberProfile | null>(null);
  const [fotoUrl, setFotoUrl] = useState('');
  const [telefone, setTelefone] = useState('');
  const [titulo, setTitulo] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const user = userData.user;
        if (!user) throw new Error('Login necessario.');

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role, barbearia_id, barbeiro_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        const resolvedProfile = profileData as Profile | null;
        setProfile(resolvedProfile);

        if (resolvedProfile?.role !== 'barbeiro' || !resolvedProfile.barbearia_id || !resolvedProfile.barbeiro_id) {
          throw new Error('Seu acesso profissional ainda nao esta vinculado a um barbeiro.');
        }

        const { data: barberData, error: barberError } = await supabase
          .from('barbeiros')
          .select('id, nome, foto_url, telefone, titulo, especialidade, tags, barbearias(nome)')
          .eq('barbearia_id', resolvedProfile.barbearia_id)
          .eq('id', resolvedProfile.barbeiro_id)
          .maybeSingle();

        if (barberError) throw barberError;
        const resolvedBarber = barberData as BarberProfile | null;
        setBarber(resolvedBarber);
        setFotoUrl(resolvedBarber?.foto_url || '');
        setTelefone(resolvedBarber?.telefone || '');
        setTitulo(resolvedBarber?.titulo || '');
        setEspecialidade(resolvedBarber?.especialidade || '');
        setTagsText((resolvedBarber?.tags || []).join(', '));
      } catch (err) {
        console.error('[MeuPerfil] Falha ao carregar perfil:', err);
        setError(err instanceof Error ? err.message : 'Nao foi possivel carregar seu perfil.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function saveProfile() {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const tags = tagsText
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
        .slice(0, 8);

      const { data, error: rpcError } = await supabase.rpc('rpc_barbeiro_atualizar_meu_perfil', {
        p_foto_url: fotoUrl.trim() || null,
        p_telefone: telefone.trim() || null,
        p_titulo: titulo.trim() || null,
        p_especialidade: especialidade.trim() || null,
        p_tags: tags,
      });

      if (rpcError) throw rpcError;
      const result = data as { success?: boolean } | null;
      if (!result?.success) throw new Error('Nao foi possivel salvar seu perfil.');

      setMessage('Perfil atualizado com sucesso.');
    } catch (err) {
      console.error('[MeuPerfil] Falha ao salvar perfil:', err);
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar seu perfil.');
    } finally {
      setSaving(false);
    }
  }

  function requestDeviceNotifications() {
    setNotificationMessage(null);

    if (typeof window === 'undefined') return;

    const webView = (window as Window & {
      ReactNativeWebView?: { postMessage: (message: string) => void };
    }).ReactNativeWebView;

    if (!webView) {
      setNotificationMessage('Abra pelo app mobile para ativar as notificacoes deste dispositivo.');
      return;
    }

    webView.postMessage(JSON.stringify({
      type: 'REQUEST_EXPO_PUSH_TOKEN',
      context: {
        barbearia_id: profile?.barbearia_id || null,
        barbeiro_id: profile?.barbeiro_id || null,
      },
    }));

    setNotificationMessage('Solicitacao enviada ao app. Se permitido, este dispositivo recebera avisos da agenda.');
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D6B47A]" />
      </div>
    );
  }

  if (error && !barber) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
        <UserRound className="mx-auto h-10 w-10 text-[#D6B47A]" />
        <h1 className="mt-4 text-2xl font-black text-white">Perfil indisponivel</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfessionalMobileHeader icon={UserRound} title="Meu perfil" subtitle="Dados publicos do profissional" />

      <section className="rounded-3xl border border-white/10 bg-[#111]/80 p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D6B47A]">Barbeiro</p>
        <h1 className="mt-2 text-3xl font-black text-white">{barber?.nome || 'Meu perfil'}</h1>
        <p className="mt-1 text-sm text-white/45">{barber?.barbearias?.nome || 'Barbearia vinculada'}</p>
      </section>

      {(message || error) && (
        <div className={`rounded-2xl border p-4 text-sm font-bold ${message ? 'border-[#D6B47A]/25 bg-[#D6B47A]/10 text-[#D6B47A]' : 'border-red-400/25 bg-red-400/10 text-red-100'}`}>
          {message || error}
        </div>
      )}

      <FeatureGate
        barbeariaId={profile?.barbearia_id}
        featureKey="push_notifications"
        fallbackTitle="Notificacoes push"
        fallbackDescription="Avisos de agenda no app mobile fazem parte do plano PRO."
        requiredPlan="PRO"
      >
      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#D6B47A]/20 bg-[#D6B47A]/10 text-[#D6B47A]">
              <Bell className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D6B47A]">Notificacoes do dispositivo</p>
              <h2 className="mt-1 text-xl font-black text-white">Avisos da agenda</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/50">
                Ative no app mobile para receber novos agendamentos, aceite e recusa de horarios.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={requestDeviceNotifications}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/10 px-5 text-sm font-black text-[#D6B47A] transition hover:bg-[#D6B47A]/15"
          >
            <Smartphone className="h-4 w-4" />
            Ativar notificacoes
          </button>
        </div>

        {notificationMessage && (
          <p className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm font-bold text-white/60">
            {notificationMessage}
          </p>
        )}
      </section>
      </FeatureGate>

      <section className="grid gap-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5">
        <Field label="Foto URL">
          <input value={fotoUrl} onChange={event => setFotoUrl(event.target.value)} className={inputClass} placeholder="https://..." />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone">
            <input value={telefone} onChange={event => setTelefone(event.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
          </Field>
          <Field label="Titulo">
            <input value={titulo} onChange={event => setTitulo(event.target.value)} className={inputClass} placeholder="Especialista em cortes" />
          </Field>
        </div>

        <Field label="Especialidades">
          <textarea value={especialidade} onChange={event => setEspecialidade(event.target.value)} className={textareaClass} placeholder="Descreva seus principais estilos e atendimentos." />
        </Field>

        <Field label="Tags">
          <input value={tagsText} onChange={event => setTagsText(event.target.value)} className={inputClass} placeholder="fade, barba, sobrancelha" />
        </Field>

        <button
          type="button"
          onClick={saveProfile}
          disabled={saving || profile?.role !== 'barbeiro'}
          className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] font-black text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? 'Salvando...' : 'Salvar perfil'}
        </button>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{label}</span>
      {children}
    </label>
  );
}
