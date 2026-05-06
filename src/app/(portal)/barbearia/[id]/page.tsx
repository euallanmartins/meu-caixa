'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock3,
  MessageSquareText,
  MapPin,
  Phone,
  Scissors,
  ShieldCheck,
  Star,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DEFAULT_PUBLIC_BARBEARIA } from '@/lib/publicBarbearia';
import { supabasePublic } from '@/lib/supabase';

type Horario = {
  dia_semana: number;
  aberto: boolean;
  hora_inicio: string | null;
  hora_fim: string | null;
};

type Servico = {
  id: string;
  nome: string;
  descricao?: string | null;
  valor: number | string | null;
  duracao_minutos?: number | null;
  ativo?: boolean | null;
  foto_url?: string | null;
};

type Barbeiro = {
  id: string;
  nome: string;
  foto_url?: string | null;
  titulo?: string | null;
  especialidade?: string | null;
  tags?: string[] | null;
  avaliacao?: number | null;
  total_avaliacoes?: number | null;
  destaque_label?: string | null;
  ativo?: boolean | null;
};

type FotoPortfolio = {
  id: string;
  url: string;
  ordem?: number | null;
};

type Avaliacao = {
  id: string;
  nome_cliente: string;
  nota: number;
  depoimento: string;
  fotos: string[] | null;
  created_at: string;
};

type Barbearia = {
  id: string;
  nome: string;
  descricao?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  logo_url?: string | null;
  capa_url?: string | null;
  ativo?: boolean | null;
  mensagem_boas_vindas?: string | null;
};

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const QUERY_TIMEOUT_MS = 7000;

type QueryResult<T> = {
  data: T | null;
  error: unknown;
};

async function withTimeout<T>(promise: PromiseLike<T>, fallback: T, ms = QUERY_TIMEOUT_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function fallbackBarbearia(barbeariaId: string): Barbearia | null {
  if (barbeariaId !== DEFAULT_PUBLIC_BARBEARIA.id) return null;

  return {
    id: DEFAULT_PUBLIC_BARBEARIA.id,
    nome: DEFAULT_PUBLIC_BARBEARIA.nome,
    endereco: DEFAULT_PUBLIC_BARBEARIA.cidade,
    descricao: 'Agendamento online para a dsbarbershop.',
    ativo: true,
  };
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function hour(value?: string | null) {
  return value ? value.slice(0, 5) : '--:--';
}

function minutesFromTime(value?: string | null) {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function getStatus(horarios: Horario[]) {
  const today = new Date().getDay();
  const current = horarios.find(item => Number(item.dia_semana) === today);
  if (!current || !current.aberto) return { open: false, label: 'Fechado hoje' };

  const start = minutesFromTime(current.hora_inicio);
  const end = minutesFromTime(current.hora_fim);
  if (start === null || end === null) return { open: false, label: 'Horario nao informado' };

  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  if (currentMinute < start) return { open: false, label: `Abre as ${hour(current.hora_inicio)}` };
  if (currentMinute >= end) return { open: false, label: `Fechado desde ${hour(current.hora_fim)}` };
  return { open: true, label: `Aberto ate ${hour(current.hora_fim)}` };
}

export default function PublicBarbeariaPage() {
  const params = useParams<{ id: string }>();
  const barbeariaId = params.id;

  const [barbearia, setBarbearia] = useState<Barbearia | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [fotos, setFotos] = useState<FotoPortfolio[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const initialFallback = fallbackBarbearia(barbeariaId);
        if (initialFallback) {
          setBarbearia(initialFallback);
          setLoading(false);
        }

        const shopRes = await withTimeout<QueryResult<Barbearia>>(
          supabasePublic.from('barbearias').select('*').eq('id', barbeariaId).maybeSingle(),
          { data: null, error: null }
        );

        if (!active) return;

        const shop = shopRes.data || fallbackBarbearia(barbeariaId);
        if (!shop || shop.ativo === false) throw new Error('Barbearia nao encontrada.');

        setBarbearia(shop);
        setLoading(false);

        const emptyList = { data: [], error: null };
        const [servicesRes, barbersRes, hoursRes, photosRes, reviewsRes] = await Promise.all([
          withTimeout<QueryResult<Servico[]>>(supabasePublic.from('servicos').select('*').eq('barbearia_id', barbeariaId).order('nome'), emptyList),
          withTimeout<QueryResult<Barbeiro[]>>(supabasePublic.from('barbeiros').select('*').eq('barbearia_id', barbeariaId).order('nome'), emptyList),
          withTimeout<QueryResult<Horario[]>>(supabasePublic.from('horarios_funcionamento').select('*').eq('barbearia_id', barbeariaId).order('dia_semana'), emptyList),
          withTimeout<QueryResult<FotoPortfolio[]>>(supabasePublic.from('barbearia_fotos').select('*').eq('barbearia_id', barbeariaId).eq('tipo', 'portfolio').order('ordem'), emptyList),
          withTimeout<QueryResult<Avaliacao[]>>(supabasePublic.from('avaliacoes').select('*').eq('barbearia_id', barbeariaId).eq('status', 'aprovada').order('created_at', { ascending: false }), emptyList),
        ]);

        if (!active) return;

        setServicos(((servicesRes.data || []) as Servico[]).filter(item => item.ativo !== false));
        setBarbeiros(((barbersRes.data || []) as Barbeiro[]).filter(item => item.ativo !== false));
        setHorarios((hoursRes.data || []) as Horario[]);
        setFotos((photosRes.data || []) as FotoPortfolio[]);
        setAvaliacoes((reviewsRes.data || []) as Avaliacao[]);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Erro ao carregar barbearia.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [barbeariaId]);

  const status = useMemo(() => getStatus(horarios), [horarios]);
  const agendarHref = `/agendar?id=${barbeariaId}`;
  const avaliarHref = `/avaliar?id=${barbeariaId}`;
  const portfolio = fotos.length ? fotos : servicos.filter(servico => servico.foto_url).map(servico => ({
    id: servico.id,
    url: servico.foto_url || '',
    ordem: 0,
  }));
  const reviewAverage = avaliacoes.length
    ? avaliacoes.reduce((acc, review) => acc + Number(review.nota || 0), 0) / avaliacoes.length
    : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#D6B47A] border-t-transparent" />
      </div>
    );
  }

  if (error || !barbearia) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] p-5 text-white">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <AlertCircle className="mx-auto h-11 w-11 text-[#ff5c5c]" />
          <h1 className="mt-4 text-xl font-black">Barbearia nao encontrada</h1>
          <p className="mt-2 text-sm text-white/55">{error || 'Verifique o link e tente novamente.'}</p>
          <Link href="/" className="mt-6 flex h-12 items-center justify-center rounded-2xl bg-[#D6B47A] font-black text-black">
            Voltar para lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#050505]/85 px-4 py-4 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04]">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Link href={agendarHref} prefetch={false} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] px-5 text-sm font-black text-black">
            Agendar
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-16">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-8">
            {barbearia.capa_url ? (
              <img src={barbearia.capa_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(214,180,122,0.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/62 to-transparent" />
            <div className="relative z-10 flex h-full min-h-[360px] flex-col justify-end">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-[#D6B47A]/25 bg-[#D6B47A]/12 text-[#D6B47A]">
                {barbearia.logo_url ? <img src={barbearia.logo_url} alt="" className="h-full w-full object-cover" /> : <Scissors className="h-10 w-10" />}
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${status.open ? 'border-[#D6B47A]/25 bg-[#D6B47A]/12 text-[#D6B47A]' : 'border-white/10 bg-white/8 text-white/60'}`}>
                  {status.label}
                </span>
                <span className="flex items-center gap-1 text-sm font-bold text-yellow-300">
                  <Star className="h-4 w-4 fill-yellow-300" />
                  4,9
                </span>
              </div>
              <h1 className="mt-4 text-5xl font-black leading-none tracking-tight sm:text-7xl">{barbearia.nome}</h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/68 sm:text-lg">
                {barbearia.descricao || barbearia.mensagem_boas_vindas || 'Perfil publico da barbearia com servicos, profissionais e horarios disponiveis para agendamento.'}
              </p>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <div className="space-y-5">
              <Info icon={MapPin} title="Endereco" text={barbearia.endereco || 'Endereco nao informado'} />
              <Info icon={Phone} title="Contato" text={barbearia.whatsapp || barbearia.telefone || 'Contato nao informado'} />
              <Info icon={ShieldCheck} title="Agendamento seguro" text="Seus dados ficam vinculados apenas a esta barbearia." />
            </div>
            <Link href={agendarHref} prefetch={false} className="mt-6 flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#D6B47A] text-base font-black text-black">
              Agendar agora
              <ChevronRight className="h-5 w-5" />
            </Link>
            <Link href={avaliarHref} prefetch={false} className="mt-3 flex h-13 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-black text-white">
              Avaliar esta barbearia
              <MessageSquareText className="h-4 w-4 text-[#D6B47A]" />
            </Link>
          </aside>
        </section>

        {portfolio.length > 0 && (
          <section className="mt-8">
            <SectionTitle title="Portfolio" subtitle="Fotos e resultados publicados pela barbearia" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {portfolio.slice(0, 8).map((foto) => (
                <div key={foto.id} className="aspect-square overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
                  <img src={foto.url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <SectionTitle title="Servicos disponiveis" subtitle="Escolha um servico para iniciar o agendamento" />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {servicos.length === 0 ? (
              <Empty icon={Scissors} text="Nenhum servico ativo cadastrado." />
            ) : (
              servicos.map(servico => (
                <Link
                  key={servico.id}
                  href={`/agendar?id=${barbeariaId}&servico=${servico.id}`}
                  prefetch={false}
                  className="group rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition-all hover:border-[#D6B47A]/40 hover:bg-[#D6B47A]/[0.04]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#D6B47A]/12 text-[#D6B47A]">
                      <Scissors className="h-7 w-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-xl font-black text-white">{servico.nome}</h3>
                        <p className="shrink-0 text-lg font-black text-[#D6B47A]">{money(servico.valor)}</p>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/55">{servico.descricao || 'Servico profissional disponivel para agendamento.'}</p>
                      <p className="mt-4 flex items-center gap-2 text-sm font-bold text-white/45">
                        <Clock3 className="h-4 w-4" />
                        {servico.duracao_minutos || 30}min
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="mt-10">
          <SectionTitle title="Profissionais" subtitle="Equipe vinculada a esta barbearia" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {barbeiros.length === 0 ? (
              <Empty icon={UserRound} text="Nenhum profissional ativo cadastrado." />
            ) : (
              barbeiros.map(barbeiro => (
                <article key={barbeiro.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#D6B47A]/12 text-2xl font-black text-[#D6B47A]">
                      {barbeiro.foto_url ? <img src={barbeiro.foto_url} alt="" className="h-full w-full object-cover" /> : barbeiro.nome.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black text-white">{barbeiro.nome}</h3>
                        {barbeiro.destaque_label && <span className="rounded-full bg-[#D6B47A]/12 px-2 py-1 text-[10px] font-black text-[#D6B47A]">{barbeiro.destaque_label}</span>}
                      </div>
                      <p className="mt-1 text-sm text-white/55">{barbeiro.titulo || barbeiro.especialidade || 'Profissional'}</p>
                      <p className="mt-2 text-sm font-bold text-yellow-300">
                        {Number(barbeiro.avaliacao || 5).toFixed(1)} ({barbeiro.total_avaliacoes || 0} avaliacoes)
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionTitle title="Avaliacoes dos clientes" subtitle="Depoimentos aprovados desta barbearia" />
            <Link href={avaliarHref} prefetch={false} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/10 px-5 text-sm font-black text-[#D6B47A]">
              Avaliar esta barbearia
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-300/12 text-yellow-300">
                <Star className="h-8 w-8 fill-current" />
              </div>
              <div>
                <p className="text-3xl font-black text-white">{reviewAverage ? reviewAverage.toFixed(1) : '0,0'}</p>
                <p className="text-sm font-bold text-white/45">{avaliacoes.length} avaliacao{avaliacoes.length === 1 ? '' : 'es'} aprovada{avaliacoes.length === 1 ? '' : 's'}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {avaliacoes.length === 0 ? (
              <Empty icon={MessageSquareText} text="Ainda nao ha avaliacoes aprovadas para esta barbearia." />
            ) : (
              avaliacoes.slice(0, 8).map(review => (
                <article key={review.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black text-white">{review.nome_cliente}</h3>
                      <p className="mt-1 text-xs font-bold text-white/35">
                        {new Date(review.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-300">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} className={`h-4 w-4 ${index < review.nota ? 'fill-current' : 'opacity-25'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-white/65">{review.depoimento}</p>
                  {!!review.fotos?.length && (
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {review.fotos.slice(0, 4).map((foto, index) => (
                        <a key={`${review.id}-${index}`} href={foto} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                          <img src={foto} alt="" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="mt-10">
          <SectionTitle title="Horarios" subtitle="Funcionamento configurado pela barbearia" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {horarios.length === 0 ? (
              <Empty icon={CalendarDays} text="Horario de funcionamento nao informado." />
            ) : (
              horarios.map(item => (
                <div key={item.dia_semana} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="font-black text-white">{DIAS[item.dia_semana] || 'Dia'}</p>
                  <p className={item.aberto ? 'mt-1 text-sm font-bold text-[#D6B47A]' : 'mt-1 text-sm font-bold text-white/40'}>
                    {item.aberto ? `${hour(item.hora_inicio)} - ${hour(item.hora_fim)}` : 'Fechado'}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#050505]/90 p-4 backdrop-blur-2xl lg:hidden">
        <Link href={agendarHref} prefetch={false} className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#D6B47A] font-black text-black">
          Agendar agora
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}

function Info({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-1 h-5 w-5 shrink-0 text-[#D6B47A]" />
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">{title}</p>
        <p className="mt-1 text-sm font-bold leading-relaxed text-white/80">{text}</p>
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-3xl font-black tracking-tight text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{subtitle}</p>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.025] p-8 text-center sm:col-span-2 lg:col-span-full">
      <Icon className="mx-auto h-10 w-10 text-white/28" />
      <p className="mt-3 text-sm font-bold text-white/50">{text}</p>
    </div>
  );
}
