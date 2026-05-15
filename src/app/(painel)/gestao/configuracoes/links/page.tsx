/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Clipboard, ExternalLink, Link2, Loader2, QrCode } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { ProfessionalMobileHeader } from '@/components/layout/ProfessionalMobileHeader';
import { FeatureGate } from '@/components/saas/FeatureGate';

type BarbeariaLinks = {
  id: string;
  nome: string;
  slug: string | null;
};

export default function ConfiguracoesLinksPage() {
  const { barbeariaId, loading: roleLoading } = useUserRole();
  const [barbearia, setBarbearia] = useState<BarbeariaLinks | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!barbeariaId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('barbearias')
        .select('id, nome, slug')
        .eq('id', barbeariaId)
        .maybeSingle();

      if (!active) return;
      setBarbearia(data as BarbeariaLinks | null);
      setLoading(false);
    }

    if (!roleLoading) load();
    return () => {
      active = false;
    };
  }, [roleLoading, barbeariaId]);

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_APP_URL || '';
    return window.location.origin;
  }, []);

  const profileTarget = barbearia?.slug || barbearia?.id || barbeariaId || '';
  const links = [
    { title: 'Perfil publico', href: profileTarget ? `${baseUrl}/barbearia/${profileTarget}` : '' },
    { title: 'Agendamento direto', href: barbeariaId ? `${baseUrl}/agendar?id=${barbeariaId}` : '' },
    { title: 'Avaliacao', href: barbeariaId ? `${baseUrl}/avaliar?id=${barbeariaId}` : '' },
  ];

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage('Link copiado.');
    } catch {
      setMessage(value);
    }
  }

  if (roleLoading || loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-[#D6B47A]" /></div>;

  return (
    <FeatureGate
      barbeariaId={barbeariaId}
      featureKey="qr_code_links"
      fallbackTitle="Links e QR Code"
      fallbackDescription="Links publicos e QR Codes personalizados fazem parte do plano STARTER."
      requiredPlan="STARTER"
    >
    <div className="space-y-8 animate-in fade-in duration-500">
      <ProfessionalMobileHeader icon={Link2} title="Links" subtitle="Perfil, agendamento e QR Code" />
      <div className="hidden lg:block">
        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#D6B47A]">Divulgacao</p>
        <h1 className="mt-2 text-4xl font-black text-white">Links publicos</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/50">Copie links e QR Codes para usar no Instagram, WhatsApp, balcao e materiais impressos.</p>
      </div>

      {message && <div className="rounded-2xl border border-[#D6B47A]/20 bg-[#D6B47A]/10 p-4 text-sm font-bold text-[#D6B47A]">{message}</div>}

      <section className="grid gap-5 lg:grid-cols-3">
        {links.map(item => (
          <article key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">{item.title}</p>
            <p className="mt-3 break-all text-sm font-bold text-white/70">{item.href || 'Indisponivel'}</p>
            {item.href && (
              <>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(item.href)}`}
                  alt={`QR Code - ${item.title}`}
                  className="mt-5 h-44 w-44 rounded-2xl border border-white/10 bg-white p-3"
                />
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button onClick={() => copy(item.href)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-black text-white"><Clipboard className="h-4 w-4" />Copiar</button>
                  <Link href={item.href} target="_blank" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#D6B47A] text-sm font-black text-black"><ExternalLink className="h-4 w-4" />Abrir</Link>
                </div>
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodeURIComponent(item.href)}`}
                  download
                  className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D6B47A]/30 bg-[#D6B47A]/10 text-sm font-black text-[#D6B47A]"
                >
                  <QrCode className="h-4 w-4" />
                  Baixar QR Code
                </a>
              </>
            )}
          </article>
        ))}
      </section>
    </div>
    </FeatureGate>
  );
}
