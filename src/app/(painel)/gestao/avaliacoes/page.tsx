/* eslint-disable */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  EyeOff,
  Loader2,
  MessageSquareText,
  Star,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ReviewStatus = 'pendente' | 'aprovada' | 'oculta';

type Review = {
  id: string;
  barbearia_id: string;
  nome_cliente: string;
  nota: number;
  depoimento: string;
  fotos: string[] | null;
  status: ReviewStatus;
  created_at: string;
};

const statusClasses: Record<ReviewStatus, string> = {
  pendente: 'border-yellow-300/25 bg-yellow-300/10 text-yellow-200',
  aprovada: 'border-[#D6B47A]/25 bg-[#D6B47A]/10 text-[#D6B47A]',
  oculta: 'border-white/10 bg-white/[0.04] text-white/45',
};

function storagePathFromPublicUrl(url: string) {
  const marker = '/storage/v1/object/public/barber-photos/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

export default function GestaoAvaliacoesPage() {
  const router = useRouter();
  const [barbeariaId, setBarbeariaId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | 'todas'>('pendente');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReviews(targetBarbeariaId: string) {
    setError(null);
    const { data, error: dbError } = await supabase
      .from('avaliacoes')
      .select('*')
      .eq('barbearia_id', targetBarbeariaId)
      .order('created_at', { ascending: false });

    if (dbError) throw dbError;
    setReviews((data || []) as Review[]);
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('barbearia_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile?.barbearia_id) {
          router.push('/login');
          return;
        }

        setBarbeariaId(profile.barbearia_id);
        await loadReviews(profile.barbearia_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nao foi possivel carregar avaliacoes.');
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [router]);

  const filteredReviews = useMemo(
    () => filter === 'todas' ? reviews : reviews.filter(review => review.status === filter),
    [filter, reviews],
  );

  const counts = useMemo(() => ({
    todas: reviews.length,
    pendente: reviews.filter(review => review.status === 'pendente').length,
    aprovada: reviews.filter(review => review.status === 'aprovada').length,
    oculta: reviews.filter(review => review.status === 'oculta').length,
  }), [reviews]);

  async function moderate(review: Review, status: ReviewStatus) {
    if (!barbeariaId || busyId) return;
    setBusyId(review.id);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc('rpc_moderar_avaliacao', {
        p_avaliacao_id: review.id,
        p_novo_status: status,
      });

      if (rpcError) throw rpcError;
      await loadReviews(barbeariaId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel moderar avaliacao.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(review: Review) {
    if (!barbeariaId || busyId) return;
    setBusyId(review.id);
    setError(null);

    try {
      const { error: dbError } = await supabase
        .from('avaliacoes')
        .delete()
        .eq('id', review.id)
        .eq('barbearia_id', barbeariaId);

      if (dbError) throw dbError;

      const storagePaths = (review.fotos || [])
        .map(storagePathFromPublicUrl)
        .filter(Boolean) as string[];

      if (storagePaths.length) {
        await supabase.storage.from('barber-photos').remove(storagePaths);
      }

      await loadReviews(barbeariaId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel excluir avaliacao.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#D6B47A]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[2.4rem] font-black uppercase leading-none tracking-tight text-white sm:text-5xl">
            Avaliacoes
          </h1>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.22em] text-white/45">
            Moderacao de depoimentos da sua barbearia
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-white/[0.035] p-3 text-center sm:flex">
          <Kpi label="Pendentes" value={counts.pendente} />
          <Kpi label="Aprovadas" value={counts.aprovada} />
          <Kpi label="Ocultas" value={counts.oculta} />
        </div>
      </header>

      {error && (
        <div className="flex gap-3 rounded-2xl border border-[#ff5c5c]/25 bg-[#ff5c5c]/10 p-4 text-sm font-bold text-[#ff8a8a]">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto border-b border-white/10 pb-4">
        {(['pendente', 'aprovada', 'oculta', 'todas'] as const).map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`whitespace-nowrap rounded-2xl px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
              filter === item ? 'bg-[#D6B47A] text-black' : 'border border-white/10 bg-white/[0.04] text-white/55'
            }`}
          >
            {item} ({counts[item]})
          </button>
        ))}
      </div>

      {filteredReviews.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.025] p-12 text-center">
          <MessageSquareText className="mx-auto h-12 w-12 text-white/25" />
          <h2 className="mt-4 text-2xl font-black text-white">Nenhuma avaliacao encontrada</h2>
          <p className="mt-2 text-sm text-white/50">Quando clientes enviarem depoimentos, eles aparecerao aqui.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredReviews.map(review => (
            <article key={review.id} className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-black text-white">{review.nome_cliente}</h2>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusClasses[review.status]}`}>
                      {review.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-yellow-300">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className={`h-4 w-4 ${index < review.nota ? 'fill-current' : 'opacity-25'}`} />
                    ))}
                    <span className="ml-2 text-xs font-bold text-white/35">
                      {new Date(review.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ActionButton disabled={busyId === review.id} onClick={() => moderate(review, 'aprovada')} icon={CheckCircle2} label="Aprovar" className="text-[#D6B47A]" />
                  <ActionButton disabled={busyId === review.id} onClick={() => moderate(review, 'oculta')} icon={EyeOff} label="Ocultar" className="text-yellow-200" />
                  <ActionButton disabled={busyId === review.id} onClick={() => remove(review)} icon={Trash2} label="Excluir" className="text-[#ff5c5c]" />
                </div>
              </div>

              <p className="mt-5 text-base leading-relaxed text-white/72">{review.depoimento}</p>

              {!!review.fotos?.length && (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {review.fotos.slice(0, 4).map((foto, index) => (
                    <a key={`${review.id}-${index}`} href={foto} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                      <img src={foto} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-2">
      <p className="text-2xl font-black text-[#D6B47A]">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{label}</p>
    </div>
  );
}

function ActionButton({
  disabled,
  onClick,
  icon: Icon,
  label,
  className,
}: {
  disabled: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50 ${className}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
