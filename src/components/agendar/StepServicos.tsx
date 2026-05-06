'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, ShoppingBag, Sparkles } from 'lucide-react';
import type { Servico } from '@/hooks/useAgendamento';
import { getServiceDisplay, searchText } from '@/lib/serviceDisplay';
import { ServicoCard } from './ServicoCard';

interface Props {
  servicos: Servico[];
  loading: boolean;
  selecionados: Servico[];
  onToggle: (s: Servico) => void;
  duracaoFormatada: string;
  valorFormatado: string;
  onVoltar: () => void;
  onContinuar: () => void;
}

export function StepServicos({
  servicos,
  loading,
  selecionados,
  onToggle,
  duracaoFormatada,
  valorFormatado,
  onVoltar,
  onContinuar,
}: Props) {
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const temSelecionados = selecionados.length > 0;

  const servicosOrdenados = useMemo(() => {
    return [...servicos].sort((a, b) => {
      const da = getServiceDisplay(a);
      const db = getServiceDisplay(b);

      if (Number(db.popular) !== Number(da.popular)) return Number(db.popular) - Number(da.popular);
      if (da.categoria !== db.categoria) return da.categoria.localeCompare(db.categoria, 'pt-BR');
      if (da.ordem !== db.ordem) return da.ordem - db.ordem;
      return da.nome.localeCompare(db.nome, 'pt-BR');
    });
  }, [servicos]);

  const maisPedidos = useMemo(() => {
    const marcados = servicosOrdenados.filter(servico => getServiceDisplay(servico).popular);
    return (marcados.length > 0 ? marcados : servicosOrdenados).slice(0, 4);
  }, [servicosOrdenados]);

  const categorias = useMemo(() => {
    const map = new Map<string, string>();
    map.set('todos', 'Todos');
    map.set('mais-pedidos', 'Mais pedidos');

    servicosOrdenados.forEach(servico => {
      const categoria = getServiceDisplay(servico).categoria;
      map.set(categoria, categoria);
    });

    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [servicosOrdenados]);

  const termoBusca = useMemo(() => searchText(busca), [busca]);
  const maisPedidosIds = useMemo(() => new Set(maisPedidos.map(servico => servico.id)), [maisPedidos]);
  const selecionadosIds = useMemo(() => new Set(selecionados.map(servico => servico.id)), [selecionados]);
  const servicosFiltrados = useMemo(() => {
    const base = categoriaAtiva === 'mais-pedidos'
      ? maisPedidos
      : servicosOrdenados.filter(servico => {
        if (categoriaAtiva === 'todos') return true;
        return getServiceDisplay(servico).categoria === categoriaAtiva;
      });

    if (!termoBusca) return base;

    return base.filter(servico => getServiceDisplay(servico).searchable.includes(termoBusca));
  }, [categoriaAtiva, maisPedidos, servicosOrdenados, termoBusca]);

  const mostrarMaisPedidos = categoriaAtiva === 'todos' && !termoBusca && maisPedidos.length > 0;
  const listaPrincipal = mostrarMaisPedidos
    ? servicosFiltrados.filter(servico => !maisPedidosIds.has(servico.id))
    : servicosFiltrados;
  const totalEncontrado = mostrarMaisPedidos ? maisPedidos.length + listaPrincipal.length : listaPrincipal.length;

  return (
    <div className="animate-in slide-in-from-right-4 pb-32 duration-300 xl:pb-0">
      <div className="mb-6 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45 sm:text-[11px]">
          Etapa 2 de 5 - Escolha seus servicos
        </p>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Escolha seus servicos
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60 sm:text-base">
            Busque, filtre por categoria e selecione um ou mais servicos.
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <div className="min-w-0 space-y-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar servico..."
                className="h-14 w-full rounded-2xl border border-white/10 bg-[#090909] pl-12 pr-4 text-base font-bold text-white outline-none transition-all placeholder:text-white/35 focus:border-[#D6B47A]/55 focus:ring-4 focus:ring-[#D6B47A]/10"
              />
            </label>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 pr-6 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pr-0 [&::-webkit-scrollbar]:hidden">
              {categorias.map(categoria => (
                <button
                  key={categoria.key}
                  type="button"
                  onClick={() => setCategoriaAtiva(categoria.key)}
                  className={[
                    'h-11 shrink-0 whitespace-nowrap rounded-xl border px-4 text-xs font-black uppercase tracking-[0.14em] transition-all',
                    categoriaAtiva === categoria.key
                      ? 'border-[#D6B47A] bg-[#D6B47A] text-black shadow-lg shadow-[#D6B47A]/15'
                      : 'border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white',
                  ].join(' ')}
                >
                  {categoria.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-[86px] animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : servicos.length === 0 ? (
            <EmptyState text="Nenhum servico disponivel" subtext="Esta barbearia ainda nao cadastrou servicos ativos." />
          ) : totalEncontrado === 0 ? (
            <EmptyState text="Nenhum servico encontrado" subtext="Tente buscar por outro nome ou categoria." />
          ) : (
            <div className="space-y-6">
              {mostrarMaisPedidos && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#D6B47A]" />
                      <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
                        Mais pedidos
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCategoriaAtiva('mais-pedidos')}
                      className="text-xs font-black text-[#D6B47A]"
                    >
                      Ver todos
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {maisPedidos.map(servico => (
                      <ServicoCard
                        key={servico.id}
                        servico={servico}
                        popular
                        selecionado={selecionadosIds.has(servico.id)}
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                </section>
              )}

              {listaPrincipal.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
                      {categoriaAtiva === 'todos' ? 'Todos os servicos' : categorias.find(item => item.key === categoriaAtiva)?.label}
                    </h3>
                    <span className="text-xs font-bold text-white/35">{listaPrincipal.length} encontrados</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {listaPrincipal.map(servico => (
                      <ServicoCard
                        key={servico.id}
                        servico={servico}
                        popular={getServiceDisplay(servico).popular}
                        selecionado={selecionadosIds.has(servico.id)}
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

      </div>

      <div className="mt-8 hidden gap-3 border-t border-white/8 pt-5 xl:grid xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <button
          type="button"
          onClick={onVoltar}
          className="flex h-14 items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] font-black text-white transition-all hover:bg-white/[0.08]"
        >
          <ChevronLeft className="h-5 w-5 text-white/55" />
          Voltar
        </button>
        <button
          type="button"
          onClick={onContinuar}
          disabled={!temSelecionados || loading}
          className="flex h-14 items-center justify-center gap-3 rounded-xl bg-[#D6B47A] font-black text-black transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Escolher profissional'}
          {!loading && <ChevronRight className="h-5 w-5" strokeWidth={3} />}
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#050505]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.45)] backdrop-blur-2xl xl:hidden">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Resumo</p>
              <p className="mt-1 truncate text-sm font-black text-white">
                {selecionados.length} servico{selecionados.length === 1 ? '' : 's'} - {duracaoFormatada} - {valorFormatado}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[#D6B47A]/15 px-2.5 py-1 text-xs font-black text-[#D6B47A]">
              {selecionados.length}
            </span>
          </div>
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
            <button
              type="button"
              onClick={onVoltar}
              className="flex h-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] font-black text-white"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={onContinuar}
              disabled={!temSelecionados || loading}
              className="flex h-14 items-center justify-center gap-2 rounded-xl bg-[#D6B47A] font-black text-black transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continuar'}
              {!loading && <ChevronRight className="h-5 w-5" strokeWidth={3} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text, subtext }: { text: string; subtext: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-6 py-14 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/30">
        <Search className="h-8 w-8" />
      </div>
      <p className="mt-5 text-lg font-black text-white">{text}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/50">{subtext}</p>
      <ShoppingBag className="mx-auto mt-5 h-5 w-5 text-[#D6B47A]/60" />
    </div>
  );
}
