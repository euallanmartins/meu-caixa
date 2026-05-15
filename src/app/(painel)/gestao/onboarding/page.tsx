/* eslint-disable */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clipboard, ExternalLink, Loader2, Rocket, Scissors, Users, Image as ImageIcon, Clock3, Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BarbeariaProfileSettings } from '@/components/BarbeariaProfileSettings';
import { OpeningHoursView } from '@/components/OpeningHoursView';
import { ServicesView } from '@/components/ServicesView';
import { BarbersView } from '@/components/BarbersView';
import { BarbeariaPortfolioManager } from '@/components/BarbeariaPortfolioManager';
import { TeamInvitesPanel } from '@/components/team/TeamInvitesPanel';
import { ProfessionalMobileHeader } from '@/components/layout/ProfessionalMobileHeader';
import { useDashboardData } from '@/hooks/useDashboardData';

type StepId = 'perfil' | 'horarios' | 'servicos' | 'equipe' | 'portfolio' | 'publicacao';

const steps: Array<{ id: StepId; label: string; icon: typeof Store }> = [
  { id: 'perfil', label: 'Dados publicos', icon: Store },
  { id: 'horarios', label: 'Horarios', icon: Clock3 },
  { id: 'servicos', label: 'Servicos', icon: Scissors },
  { id: 'equipe', label: 'Equipe', icon: Users },
  { id: 'portfolio', label: 'Fotos', icon: ImageIcon },
  { id: 'publicacao', label: 'Publicacao', icon: Rocket },
];

export default function GestaoOnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [barbearia, setBarbearia] = useState<any>(null);
  const [activeStep, setActiveStep] = useState<StepId>('perfil');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { barbers, stats, loading: dashboardLoading, refreshData } = useDashboardData(profile?.barbearia_id ?? null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;

      if (!user) {
        router.replace('/login?redirectTo=/gestao/onboarding');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, barbearia_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        console.error('[Onboarding] Erro ao buscar perfil:', profileError);
        setError('Nao foi possivel validar seu acesso agora.');
        setLoading(false);
        return;
      }

      if (!profileData?.barbearia_id) {
        router.replace('/cliente');
        return;
      }

      setProfile(profileData);

      const { data: barbeariaData, error: barbeariaError } = await supabase
        .from('barbearias')
        .select('id, nome, slug, status, onboarding_completed, onboarding_completed_at')
        .eq('id', profileData.barbearia_id)
        .maybeSingle();

      if (!active) return;

      if (barbeariaError) {
        console.error('[Onboarding] Erro ao buscar barbearia:', barbeariaError);
        setError('Nao foi possivel carregar os dados da barbearia.');
      } else {
        setBarbearia(barbeariaData);
      }

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [router]);

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_APP_URL || '';
    return window.location.origin;
  }, []);

  const publicTarget = barbearia?.slug || barbearia?.id || profile?.barbearia_id;
  const publicProfileLink = publicTarget ? `${baseUrl}/barbearia/${publicTarget}` : '';
  const bookingLink = profile?.barbearia_id ? `${baseUrl}/agendar?id=${profile.barbearia_id}` : '';
  const reviewLink = profile?.barbearia_id ? `${baseUrl}/avaliar?id=${profile.barbearia_id}` : '';
  const activeIndex = steps.findIndex(step => step.id === activeStep);
  const progress = Math.round(((activeIndex + 1) / steps.length) * 100);

  async function copyLink(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage('Link copiado.');
    } catch {
      setMessage(value);
    }
  }

  async function markCompleted() {
    if (!profile?.barbearia_id || saving) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('rpc_mark_onboarding_completed', {
        p_barbearia_id: profile.barbearia_id,
      });

      if (rpcError) throw rpcError;
      const result = data as { success?: boolean; message?: string } | null;
      if (result?.success === false) {
        setError(result.message || 'Nao foi possivel concluir o onboarding.');
        return;
      }

      setBarbearia((prev: any) => prev ? { ...prev, onboarding_completed: true, onboarding_completed_at: new Date().toISOString() } : prev);
      setMessage('Onboarding concluido. Sua barbearia esta pronta para revisao/publicacao.');
    } catch (err) {
      console.error('[Onboarding] Erro ao concluir:', err);
      setError('Nao foi possivel concluir agora. Tente novamente em instantes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-9 w-9 animate-spin text-[#D6B47A]" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="rounded-3xl border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 p-6 text-[#ff9a9a]">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ProfessionalMobileHeader icon={Rocket} title="Onboarding" subtitle="Primeira configuracao da barbearia" />

      <div className="hidden lg:block">
        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#D6B47A]">Meu Caixa Premium</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Configure sua barbearia</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          Complete os dados essenciais para publicar o perfil, receber agendamentos e organizar a operacao.
        </p>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-white/45">{barbearia?.nome || 'Barbearia'}</p>
            <h2 className="mt-1 text-2xl font-black text-white">{progress}% configurado</h2>
          </div>
          <span className={`w-fit rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${
            barbearia?.onboarding_completed
              ? 'border-[#D6B47A]/30 bg-[#D6B47A]/10 text-[#D6B47A]'
              : 'border-white/10 bg-white/[0.04] text-white/45'
          }`}>
            {barbearia?.onboarding_completed ? 'Concluido' : 'Em configuracao'}
          </span>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-[#D6B47A]" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
          {steps.map(step => {
            const Icon = step.icon;
            const active = activeStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`flex min-w-fit items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black transition-all ${
                  active
                    ? 'bg-[#D6B47A] text-black'
                    : 'border border-white/10 bg-white/[0.04] text-white/60 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {step.label}
              </button>
            );
          })}
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-[#D6B47A]/20 bg-[#D6B47A]/10 p-4 text-sm font-bold text-[#D6B47A]">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 p-4 text-sm font-bold text-[#ff9a9a]">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-6">
        {activeStep === 'perfil' && <BarbeariaProfileSettings barbeariaId={profile?.barbearia_id} />}
        {activeStep === 'horarios' && <OpeningHoursView barbeariaId={profile?.barbearia_id} />}
        {activeStep === 'servicos' && <ServicesView barbeariaId={profile?.barbearia_id} />}
        {activeStep === 'equipe' && (
          <div className="space-y-6">
            <BarbersView
              barbers={barbers}
              barbeariaId={profile?.barbearia_id}
              refreshData={refreshData}
              loading={dashboardLoading}
              stats={stats}
            />
            <TeamInvitesPanel barbeariaId={profile?.barbearia_id} currentRole={profile?.role || 'funcionario'} />
          </div>
        )}
        {activeStep === 'portfolio' && <BarbeariaPortfolioManager barbeariaId={profile?.barbearia_id} />}
        {activeStep === 'publicacao' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-white">Links publicos</h2>
              <p className="mt-2 text-sm text-white/50">
                Copie os links para Instagram, WhatsApp e materiais impressos. A barbearia so aparece no marketplace quando estiver ativa.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <PublicLinkCard title="Perfil publico" href={publicProfileLink} onCopy={copyLink} />
              <PublicLinkCard title="Agendamento direto" href={bookingLink} onCopy={copyLink} />
              <PublicLinkCard title="Avaliacoes" href={reviewLink} onCopy={copyLink} />
            </div>

            {bookingLink && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">QR Code do agendamento</p>
                <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(bookingLink)}`}
                    alt="QR Code do link de agendamento"
                    className="h-44 w-44 rounded-2xl border border-white/10 bg-white p-3"
                  />
                  <div>
                    <p className="font-black text-white">Use este QR Code no balcao, espelho ou Instagram.</p>
                    <a
                      href={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(bookingLink)}`}
                      download
                      className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-[#D6B47A] px-5 text-sm font-black text-black"
                    >
                      Baixar QR Code
                    </a>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-white/45">
                Status atual: <span className="font-black text-white">{barbearia?.status || 'pending_setup'}</span>
              </p>
              <button
                type="button"
                onClick={markCompleted}
                disabled={saving}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] px-6 font-black text-black disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Concluir onboarding
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function PublicLinkCard({ title, href, onCopy }: { title: string; href: string; onCopy: (value: string) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{title}</p>
      <p className="mt-3 truncate text-sm font-bold text-white/70">{href || 'Indisponivel'}</p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => href && onCopy(href)}
          disabled={!href}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-black text-white disabled:opacity-40"
        >
          <Clipboard className="h-4 w-4" />
          Copiar
        </button>
        {href && (
          <Link
            href={href}
            target="_blank"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
