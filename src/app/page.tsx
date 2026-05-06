'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Menu,
  MapPin,
  Scissors,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabasePublic } from '@/lib/supabase';
import { publicBarbearias } from '@/lib/publicBarbearia';

type LandingServico = {
  id?: string;
  nome: string;
  valor: number | null;
  duracao_minutos: number | null;
  descricao?: string | null;
};

type LandingHorario = {
  dia_semana: number;
  aberto: boolean;
  hora_inicio: string | null;
  hora_fim: string | null;
};

type LandingBarbearia = {
  id: string;
  nome: string;
  slug: string;
  cidade: string;
  endereco?: string | null;
  descricao?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  logo_url?: string | null;
  capa_url?: string | null;
  ativo?: boolean | null;
  horarios: LandingHorario[];
  servicos: LandingServico[];
  statusLabel: string;
  isOpen: boolean;
};

function formatMoney(value: number | null) {
  if (typeof value !== 'number') return 'Consultar';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatHour(value: string | null) {
  if (!value) return '';

  return value.slice(0, 5);
}

function minutesFromTime(value: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

function getBarbeariaStatus(horarios: LandingHorario[]) {
  if (!horarios.length) {
    return { statusLabel: 'Horario nao informado', isOpen: false };
  }

  const now = new Date();
  const today = now.getDay();
  const current = horarios.find(horario => Number(horario.dia_semana) === today);

  if (!current || !current.aberto) {
    return { statusLabel: 'Fechado hoje', isOpen: false };
  }

  const start = minutesFromTime(current.hora_inicio);
  const end = minutesFromTime(current.hora_fim);

  if (start === null || end === null) {
    return { statusLabel: 'Horario nao informado', isOpen: false };
  }

  const currentMinute = now.getHours() * 60 + now.getMinutes();

  if (currentMinute < start) {
    return { statusLabel: `Abre as ${formatHour(current.hora_inicio)}`, isOpen: false };
  }

  if (currentMinute >= end) {
    return { statusLabel: `Fechado desde ${formatHour(current.hora_fim)}`, isOpen: false };
  }

  return { statusLabel: `Aberto ate ${formatHour(current.hora_fim)}`, isOpen: true };
}

function buildFallbackBarbearias(): LandingBarbearia[] {
  return publicBarbearias.map(barbearia => ({
    ...barbearia,
    horarios: [],
    servicos: [],
    ...getBarbeariaStatus([]),
  }));
}

export default function BarbeariaSearchPage() {
  const [query, setQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [barbearias, setBarbearias] = useState<LandingBarbearia[]>(buildFallbackBarbearias);

  useEffect(() => {
    let active = true;

    async function loadPublicBarbearias() {
      const [barbeariasResponse, horariosResponse, servicosResponse] = await Promise.all([
        supabasePublic
          .from('barbearias')
          .select('*')
          .order('nome'),
        supabasePublic
          .from('horarios_funcionamento')
          .select('barbearia_id, dia_semana, aberto, hora_inicio, hora_fim')
          .order('dia_semana'),
        supabasePublic
          .from('servicos')
          .select('*')
          .order('nome'),
      ]);

      if (!active || barbeariasResponse.error || !barbeariasResponse.data?.length) return;

      const horariosByBarbearia = new Map<string, LandingHorario[]>();
      const servicosByBarbearia = new Map<string, LandingServico[]>();

      if (!horariosResponse.error) {
        horariosResponse.data?.forEach(horario => {
          const barbeariaId = String(horario.barbearia_id);
          const current = horariosByBarbearia.get(barbeariaId) ?? [];
          current.push({
            dia_semana: Number(horario.dia_semana),
            aberto: Boolean(horario.aberto),
            hora_inicio: horario.hora_inicio,
            hora_fim: horario.hora_fim,
          });
          horariosByBarbearia.set(barbeariaId, current);
        });
      }

      if (!servicosResponse.error) {
        servicosResponse.data?.forEach(servico => {
          if (servico.ativo === false) return;
          const barbeariaId = String(servico.barbearia_id);
          const current = servicosByBarbearia.get(barbeariaId) ?? [];
          current.push({
            id: servico.id,
            nome: servico.nome,
            valor: typeof servico.valor === 'number' ? servico.valor : Number(servico.valor ?? 0),
            duracao_minutos: servico.duracao_minutos,
            descricao: servico.descricao,
          });
          servicosByBarbearia.set(barbeariaId, current);
        });
      }

      setBarbearias(
        barbeariasResponse.data
        .filter(barbearia => barbearia.ativo !== false)
        .map(barbearia => {
          const horarios = horariosByBarbearia.get(barbearia.id) ?? [];
          const status = getBarbeariaStatus(horarios);

          return {
            id: barbearia.id,
            nome: barbearia.nome,
            slug: barbearia.nome.toLowerCase().replace(/\s+/g, '-'),
            cidade: barbearia.endereco || barbearia.cidade || 'Agendamento online',
            endereco: barbearia.endereco,
            descricao: barbearia.descricao,
            telefone: barbearia.telefone,
            whatsapp: barbearia.whatsapp,
            logo_url: barbearia.logo_url,
            capa_url: barbearia.capa_url,
            ativo: barbearia.ativo,
            horarios,
            servicos: (servicosByBarbearia.get(barbearia.id) ?? []).slice(0, 3),
            ...status,
          };
        }),
      );
    }

    loadPublicBarbearias();

    return () => {
      active = false;
    };
  }, []);

  const filteredBarbearias = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return barbearias;

    return barbearias.filter(barbearia =>
      [barbearia.nome, barbearia.slug, barbearia.cidade, barbearia.statusLabel, ...barbearia.servicos.map(servico => servico.nome)]
        .some(value => value.toLowerCase().includes(normalized))
    );
  }, [barbearias, query]);

  const firstBarbearia = barbearias[0] ?? buildFallbackBarbearias()[0];

  return (
    <div className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <header className="relative z-20 border-b border-white/8 bg-[#050505]/85 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-20 max-w-[1900px] items-center justify-between gap-2 px-4 py-4 min-[390px]:gap-3 min-[390px]:px-5 sm:gap-4 sm:px-6 lg:min-h-[108px] lg:px-[64px]">
          <div className="flex min-w-0 flex-1 items-center gap-2 min-[390px]:gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/12 text-[#D6B47A] min-[390px]:h-14 min-[390px]:w-14 sm:h-16 sm:w-16 lg:h-14 lg:w-14">
              <Scissors className="h-6 w-6 min-[390px]:h-7 min-[390px]:w-7 sm:h-8 sm:w-8 lg:h-7 lg:w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-black tracking-tight min-[390px]:text-xl sm:text-3xl lg:text-2xl">Meu Caixa</h1>
              <p className="mt-1 max-w-[118px] truncate text-[9px] font-black uppercase tracking-[0.18em] text-white/55 min-[390px]:max-w-[150px] min-[390px]:text-[10px] min-[390px]:tracking-[0.24em] sm:max-w-none sm:text-[12px] sm:tracking-[0.28em] lg:text-[10px]">
                Agendamento online
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              aria-label="Acesso profissional"
              prefetch={false}
              className="flex h-12 w-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.035] text-sm font-bold text-white transition-all hover:border-[#D6B47A]/40 hover:text-[#D6B47A] min-[430px]:w-auto min-[430px]:px-3 sm:h-16 sm:gap-3 sm:px-5 sm:text-lg lg:h-12 lg:px-6 lg:text-xs lg:font-black lg:uppercase lg:tracking-[0.18em]"
            >
              <Users className="h-5 w-5 shrink-0 text-[#D6B47A] sm:h-7 sm:w-7 lg:h-5 lg:w-5" />
              <span className="hidden leading-tight min-[430px]:inline">Acesso profissional</span>
              <ChevronRight className="hidden h-4 w-4 lg:block" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(current => !current)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.035] text-white transition-all active:scale-95 lg:hidden"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-home-menu"
            >
              <Menu className="h-8 w-8" />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav id="mobile-home-menu" className="border-t border-white/8 px-6 py-4 lg:hidden" aria-label="Menu mobile">
            <div className="grid gap-3">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                prefetch={false}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
              >
                Acesso profissional
                <ChevronRight className="h-5 w-5 text-[#D6B47A]" />
              </Link>
              <Link
                href={`/barbearia/${firstBarbearia?.id || ''}`}
                onClick={() => setMobileMenuOpen(false)}
                prefetch={false}
                className="flex items-center justify-between rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/10 px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-[#D6B47A]"
              >
                Ver {firstBarbearia?.nome ?? 'barbearia'}
                <ChevronRight className="h-5 w-5" />
              </Link>
              <a
                href="mailto:alin.tyga@gmail.com"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-white/75"
              >
                Suporte
                <ChevronRight className="h-5 w-5 text-white/35" />
              </a>
            </div>
          </nav>
        )}
      </header>

      <main className="relative z-10 mx-auto max-w-[1900px] px-5 pb-12 pt-8 sm:px-6 lg:px-[70px] lg:pb-8 lg:pt-10">
        <section className="relative grid gap-8 lg:grid-cols-[minmax(680px,1fr)_470px_420px] lg:items-start xl:grid-cols-[minmax(760px,1fr)_470px_420px]">
          <div className="space-y-6 lg:space-y-7 lg:pt-6">
            <div className="relative lg:hidden">
              <Image
                src="/agenda-mockup.png"
                alt=""
                width={1024}
                height={682}
                priority
                className="absolute right-[-170px] top-[-18px] h-[520px] w-[520px] max-w-none object-cover opacity-58 sm:right-[-120px] sm:h-[560px] sm:w-[560px]"
              />
              <div className="absolute -left-5 -right-5 -top-8 h-[560px] bg-gradient-to-r from-[#050505] via-[#050505]/88 to-[#050505]/30" />
              <div className="absolute -left-5 -right-5 top-[320px] h-48 bg-gradient-to-b from-transparent to-[#050505]" />
            </div>

            <div className="relative max-w-3xl">
              <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#D6B47A] sm:text-[13px] sm:tracking-[0.28em] lg:text-[13px]">
                Escolha onde voce quer agendar
              </p>
              <h2 className="mt-7 max-w-[11ch] text-[2.85rem] font-black leading-[1.05] tracking-tight text-white min-[390px]:text-[3.1rem] sm:max-w-none sm:text-6xl lg:mt-8 lg:text-[76px] lg:leading-[1.12] xl:text-[82px]">
                Encontre a barbearia e reserve seu <span className="text-[#D6B47A]">horario.</span>
              </h2>
              <p className="mt-6 max-w-[860px] text-lg leading-relaxed text-white/68 sm:text-xl lg:text-[22px] lg:leading-[1.45] lg:text-white/58">
                Cada barbearia tem seu proprio perfil, equipe, servicos e painel administrativo. Clientes entram pelo agendamento; proprietarios e funcionarios entram pelo acesso profissional.
              </p>
            </div>

            <div className="relative z-10 grid gap-3 lg:hidden">
              <InfoCard icon={ShieldCheck} title="Painel separado por estabelecimento">
                Proprietarios e funcionarios acessam somente a barbearia vinculada ao seu perfil.
              </InfoCard>
              <InfoCard icon={CalendarDays} title="Cliente escolhe e agenda">
                Depois de escolher a barbearia, o cliente segue para servicos, profissional, data e confirmacao.
              </InfoCard>
            </div>

            <label className="relative z-10 block max-w-[860px]">
              <Search className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-white/35 lg:h-5 lg:w-5" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Buscar barbearia, servico ou cidade..."
                className="h-16 w-full rounded-2xl border border-white/14 bg-white/[0.045] pl-14 pr-14 text-base font-bold text-white outline-none transition-all placeholder:text-white/30 focus:border-[#D6B47A]/60 sm:h-20 sm:pl-16 sm:pr-16 sm:text-xl lg:h-[70px] lg:pr-5 lg:text-lg"
              />
              <SlidersHorizontal className="absolute right-5 top-1/2 h-6 w-6 -translate-y-1/2 text-white/45 lg:hidden" />
            </label>

            <div className="relative z-10 grid max-w-[860px] gap-4">
              {filteredBarbearias.map(barbearia => (
                <Link
                  key={barbearia.id}
                  href={`/barbearia/${barbearia.id}`}
                  prefetch={false}
                  className="group grid grid-cols-[92px_minmax(0,1fr)] items-center gap-4 rounded-3xl border border-[#D6B47A]/35 bg-[#D6B47A]/[0.04] p-5 transition-all hover:border-[#D6B47A]/55 hover:bg-white/[0.065] sm:grid-cols-[104px_minmax(0,1fr)_auto] lg:p-6"
                >
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-[#D6B47A]/25 bg-[#D6B47A]/12 text-[#D6B47A] lg:h-[90px] lg:w-[90px]">
                    {barbearia.logo_url ? (
                      <img src={barbearia.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Scissors className="h-10 w-10 lg:h-12 lg:w-12" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                      <h3 className="min-w-0 max-w-full text-2xl font-black tracking-tight text-white sm:truncate sm:text-3xl lg:text-2xl">{barbearia.nome}</h3>
                      <span className="rounded-full border border-[#D6B47A]/20 bg-[#D6B47A]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#D6B47A]">
                        Disponivel
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-base text-white/55 sm:text-lg">
                      <MapPin className="h-4 w-4 shrink-0 sm:h-5 sm:w-5 lg:h-4 lg:w-4" />
                      {barbearia.cidade}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/70 sm:text-base">
                      <Star className="h-4 w-4 shrink-0 fill-yellow-300 text-yellow-300 sm:h-5 sm:w-5 lg:h-4 lg:w-4" />
                      <span className="font-black text-yellow-300">4,9</span>
                      <span>(128 avaliacoes)</span>
                      <span className="text-white/35">-</span>
                      <span className={barbearia.isOpen ? 'text-[#D6B47A]' : 'text-white/50'}>{barbearia.statusLabel}</span>
                    </p>
                    {barbearia.servicos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {barbearia.servicos.map(servico => (
                          <span
                            key={`${barbearia.id}-${servico.nome}`}
                            className="max-w-full truncate rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-white/62"
                          >
                            {servico.nome} - {formatMoney(servico.valor)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] px-7 text-lg font-black text-black transition-all group-hover:scale-[1.02] sm:col-span-1 sm:h-16 sm:text-xl">
                    Ver barbearia
                    <ChevronRight className="h-6 w-6 lg:h-5 lg:w-5" />
                  </div>
                </Link>
              ))}
            </div>

            <div className="hidden max-w-[860px] items-center gap-3 text-sm text-white/55 lg:flex">
              <ShieldCheck className="h-5 w-5 text-[#D6B47A]" />
              Seguro, rapido e facil de usar.
            </div>
          </div>

          <aside className="hidden overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] lg:block">
            <InfoCard icon={ShieldCheck} title="Painel separado por estabelecimento">
              Proprietarios e funcionarios acessam somente a barbearia vinculada ao seu perfil.
            </InfoCard>
            <div className="border-t border-white/8" />
            <InfoCard icon={CalendarDays} title="Cliente escolhe e agenda">
              Depois de escolher a barbearia, o cliente segue para servicos, profissional, data e confirmacao.
            </InfoCard>
            <div className="border-t border-white/8" />
            <div className="flex gap-5 p-8">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D6B47A]/15 bg-[#D6B47A]/8 text-[#D6B47A]">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Milhares de agendamentos</h3>
                <p className="mt-1 text-base leading-relaxed text-white/58">realizados todos os dias</p>
                <div className="mt-5 flex items-center">
                  {['A', 'D', 'G', 'W', 'R'].map((initial) => (
                    <span key={initial} className="-ml-2 flex h-10 w-10 first:ml-0 items-center justify-center rounded-full border-2 border-[#141414] bg-white/12 text-xs font-black text-white">
                      {initial}
                    </span>
                  ))}
                  <span className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full border border-[#D6B47A]/60 bg-[#D6B47A]/12 text-xs font-black text-[#D6B47A]">
                    +2k
                  </span>
                </div>
              </div>
            </div>
          </aside>

          <aside className="relative hidden lg:block">
            <div className="relative h-[650px] overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/30">
              <Image
                src="/agenda-mockup.png"
                alt=""
                width={1024}
                height={682}
                priority
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            </div>
          </aside>
        </section>

        <section className="mt-7 grid grid-cols-2 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] min-[430px]:grid-cols-4 lg:hidden">
          <MobileStat icon={CalendarDays} value="10K+" label="Agendamentos realizados" />
          <MobileStat icon={Users} value="2K+" label="Barbearias parceiras" />
          <MobileStat icon={Clock3} value="+50K" label="Clientes atendidos" />
          <MobileStat icon={ShieldCheck} value="100%" label="Seguro e confiavel" />
        </section>

        <section className="mt-12 lg:hidden">
          <h3 className="text-2xl font-black text-white">Como funciona</h3>
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <Step number="1" title="Escolha a barbearia" text="Encontre a barbearia ideal perto de voce." />
            <Step number="2" title="Selecione servico" text="Escolha o servico, profissional e horario." />
            <Step number="3" title="Confirme e pronto" text="Confirme seu agendamento e receba a confirmacao." />
          </div>
        </section>

        <section className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-5 lg:mt-16 lg:grid-cols-4 lg:p-6">
          <FooterFeature icon={CalendarDays} title="Agendamento 24h" text="Agende quando quiser, a qualquer hora do dia." />
          <FooterFeature icon={Clock3} title="Pratico e rapido" text="Selecione servicos e profissionais em poucos cliques." />
          <FooterFeature icon={ShieldCheck} title="Seguro" text="Seus dados protegidos com tecnologia de ponta." />
          <FooterFeature icon={Users} title="Suporte dedicado" text="Estamos prontos para te ajudar sempre que precisar." />
        </section>
      </main>
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-5 p-5 lg:p-8">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#D6B47A]/15 bg-[#D6B47A]/8 text-[#D6B47A]">
        <Icon className="h-8 w-8" />
      </div>
      <div>
        <h3 className="text-xl font-black text-white lg:text-lg">{title}</h3>
        <p className="mt-2 text-base leading-relaxed text-white/58 lg:text-sm">{children}</p>
      </div>
    </div>
  );
}

function MobileStat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="border-r border-b border-white/10 p-4 text-center even:border-r-0 min-[430px]:border-b-0 min-[430px]:even:border-r min-[430px]:last:border-r-0">
      <Icon className="mx-auto h-6 w-6 text-[#D6B47A] min-[430px]:h-7 min-[430px]:w-7" />
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm leading-snug text-white/55 min-[430px]:text-xs min-[460px]:text-sm">{label}</p>
    </div>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-2xl font-black text-[#D6B47A]">
        {number}
      </div>
      <p className="mt-5 text-lg font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{text}</p>
    </div>
  );
}

function FooterFeature({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex items-center gap-5 border-white/10 lg:border-r lg:last:border-r-0">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#D6B47A]/10 text-[#D6B47A]">
        <Icon className="h-8 w-8" />
      </div>
      <div>
        <p className="font-black text-white">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-white/55">{text}</p>
      </div>
    </div>
  );
}
