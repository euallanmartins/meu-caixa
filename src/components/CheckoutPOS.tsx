/* eslint-disable */
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Bell,
  Bookmark,
  Briefcase,
  ChevronDown,
  CreditCard,
  MoreVertical,
  Package,
  Plus,
  QrCode,
  Search,
  Scissors,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  User,
  WalletCards,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Item {
  id: string;
  nome: string;
  valor: number;
  tipo: 'servico' | 'produto';
  categoria?: string;
  comissao_valor?: number;
  comissao_tipo?: 'percentual' | 'fixo';
}

interface CartItem extends Item {
  quantidade: number;
  uniqueKey: string;
}

export type PaymentMethod = 'dinheiro' | 'cartao' | 'pix';

export function CheckoutPOS({
  barbeariaId,
  onSaleCompleted,
  initialAppointment,
}: {
  barbeariaId: string;
  onSaleCompleted?: () => void;
  initialAppointment?: any;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'servico' | 'produto'>('all');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [drawerMoney, setDrawerMoney] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [mobileView, setMobileView] = useState<'catalog' | 'cart'>('catalog');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      if (!barbeariaId) return;
      setLoading(true);
      const today = new Date();
      const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const [servicosRes, produtosRes, barbeirosRes, sessaoRes, transacoesDiaRes] = await Promise.all([
        supabase.from('servicos').select('id, nome, valor, comissao_valor, comissao_tipo').eq('barbearia_id', barbeariaId).order('nome'),
        supabase.from('produtos').select('id, nome, valor_venda, estoque, comissao_valor, comissao_tipo').eq('barbearia_id', barbeariaId).order('nome'),
        supabase.from('barbeiros').select('id, nome').eq('barbearia_id', barbeariaId).eq('ativo', true).order('nome'),
        supabase.from('caixa_sessoes').select('id, saldo_inicial, status').eq('barbearia_id', barbeariaId).eq('status', 'aberto').maybeSingle(),
        supabase
          .from('transacoes')
          .select('id, data, transacao_pagamentos(metodo, valor)')
          .eq('barbearia_id', barbeariaId)
          .gte('data', dayStart)
          .lt('data', dayEnd),
      ]);

      const combined: Item[] = [
        ...(servicosRes.data?.map(s => ({ ...s, tipo: 'servico' as const })) || []),
        ...(produtosRes.data?.map(p => ({ ...p, valor: Number(p.valor_venda || 0), tipo: 'produto' as const })) || []),
      ];

      setItems(combined);
      setBarbers(barbeirosRes.data || []);
      setCurrentSession(sessaoRes.data || null);
      const cashIncomes = (transacoesDiaRes.data || []).reduce((acc: number, transaction: any) => {
        const payments = transaction.transacao_pagamentos || [];
        return acc + payments
          .filter((payment: any) => payment.metodo === 'dinheiro')
          .reduce((sum: number, payment: any) => sum + Number(payment.valor || 0), 0);
      }, 0);
      setDrawerMoney(Number(sessaoRes.data?.saldo_inicial || 0) + cashIncomes);
      setLoading(false);
    }

    loadInitialData();
  }, [barbeariaId]);

  useEffect(() => {
    if (!initialAppointment || items.length === 0 || cart.length > 0) return;
    const serviceItem = items.find(i => i.id === initialAppointment.servico_id);
    if (serviceItem) {
      setCart([{ ...serviceItem, quantidade: 1, uniqueKey: `${serviceItem.id}-${Date.now()}` }]);
    }
    if (initialAppointment.cliente_id) {
      setSelectedClientId(initialAppointment.cliente_id);
      setSelectedClientName(initialAppointment.clientes?.nome);
    }
  }, [initialAppointment, items, cart.length]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'all' || item.tipo === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, activeCategory]);

  const subtotal = cart.reduce((acc, item) => acc + Number(item.valor || 0) * item.quantidade, 0);
  const total = Math.max(0, subtotal - discount);

  function addToCart(item: Item) {
    setCart(prev => [...prev, { ...item, quantidade: 1, uniqueKey: `${item.id}-${Date.now()}` }]);
  }

  function updateQuantity(uniqueKey: string, delta: number) {
    setCart(prev => prev.map(item => item.uniqueKey === uniqueKey ? { ...item, quantidade: Math.max(1, item.quantidade + delta) } : item));
  }

  function removeFromCart(uniqueKey: string) {
    setCart(prev => prev.filter(item => item.uniqueKey !== uniqueKey));
  }

  function handleDiscount() {
    const value = window.prompt('Informe o desconto em R$', String(discount || ''));
    if (value === null) return;
    const parsed = Number(value.replace(',', '.'));
    setDiscount(Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, subtotal)) : 0);
  }

  async function processVenda() {
    if (!barbeariaId || cart.length === 0) return;

    const { data: sessao } = await supabase
      .from('caixa_sessoes')
      .select('id')
      .eq('barbearia_id', barbeariaId)
      .eq('status', 'aberto')
      .maybeSingle();

    if (!sessao) {
      alert('Abra o caixa antes de realizar vendas.');
      throw new Error('No open session');
    }

    const defaultBarberId = initialAppointment?.barbeiro_id || barbers[0]?.id || user?.id;
    if (!defaultBarberId) {
      alert('Cadastre um barbeiro ativo antes de vender.');
      throw new Error('No barber available');
    }

    const discountRatio = subtotal > 0 ? discount / subtotal : 0;

    for (const item of cart) {
      const grossAmount = Number(item.valor || 0) * item.quantidade;
      const amount = Math.max(0, grossAmount - (grossAmount * discountRatio));
      const { data: trans, error: transErr } = await supabase.from('transacoes').insert([{
        barbearia_id: barbeariaId,
        sessao_id: sessao.id,
        barbeiro_id: defaultBarberId,
        cliente_id: selectedClientId,
        servico_id: item.tipo === 'servico' ? item.id : '00000000-0000-0000-0000-000000000000',
        valor_total: amount,
        cliente_nome: selectedClientName || 'Venda POS',
      }]).select().single();

      if (transErr) throw transErr;

      await supabase.from('transacao_pagamentos').insert([{
        transacao_id: trans.id,
        metodo: paymentMethod,
        valor: amount,
      }]);

      if (item.tipo === 'produto') {
        const comissaoTotal = item.comissao_tipo === 'percentual'
          ? amount * (Number(item.comissao_valor || 0) / 100)
          : Number(item.comissao_valor || 0) * item.quantidade;

        await supabase.from('venda_produtos').insert([{
          barbearia_id: barbeariaId,
          transacao_id: trans.id,
          produto_id: item.id,
          barbeiro_id: defaultBarberId,
          quantidade: item.quantidade,
          valor_unitario: Number(item.valor || 0),
          valor_total: amount,
          comissao_total: comissaoTotal,
        }]);

        const { data: prod } = await supabase
          .from('produtos')
          .select('estoque')
          .eq('id', item.id)
          .eq('barbearia_id', barbeariaId)
          .single();
        if (prod) {
          await supabase
            .from('produtos')
            .update({ estoque: Math.max(0, Number(prod.estoque || 0) - item.quantidade) })
            .eq('id', item.id)
            .eq('barbearia_id', barbeariaId);
        }
      }
    }

    if (initialAppointment?.id) {
      await supabase
        .from('agendamentos')
        .update({ status: 'concluido' })
        .eq('id', initialAppointment.id)
        .eq('barbearia_id', barbeariaId);
    }
  }

  async function handleCheckout() {
    if (cart.length === 0 || processing) return;
    setProcessing(true);
    try {
      await processVenda();
      if (paymentMethod === 'dinheiro') {
        setDrawerMoney(prev => prev + total);
      }
      setCart([]);
      setDiscount(0);
      setPaymentOpen(false);
      onSaleCompleted?.();
      alert('Venda realizada com sucesso!');
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100dvh-150px)] pb-16">
      <div className="mb-6 flex items-center justify-between lg:hidden">
        <button
          type="button"
          onClick={() => setMobileView('catalog')}
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#D6B47A]"
          aria-label="Ver itens"
        >
          <ShoppingCart className="h-8 w-8" />
        </button>
        <div className="min-w-0 flex-1 px-4">
          <h2 className="text-2xl font-black uppercase leading-none text-white">
            {mobileView === 'cart' ? 'Carrinho' : 'Terminal PDV'}
          </h2>
          <p className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/45">
            {mobileView === 'cart' ? `${cart.length} itens selecionados` : 'Venda rapida e checkout profissional'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMobileView(mobileView === 'cart' ? 'catalog' : 'cart')}
          className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/65"
          aria-label={mobileView === 'cart' ? 'Voltar aos itens' : 'Abrir carrinho'}
        >
          {mobileView === 'cart' ? <MoreVertical className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {cart.length > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-[#D6B47A] px-1.5 py-0.5 text-[10px] font-black text-black">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      <div className={`${mobileView === 'catalog' ? 'block' : 'hidden'} mb-6 flex-col gap-4 xl:flex xl:flex-row xl:items-center xl:justify-between lg:flex`}>
        <div className="relative max-w-4xl flex-1">
          <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar servicos, produtos ou pacotes..."
            className="h-16 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-14 pr-14 text-sm font-bold text-white outline-none transition-all placeholder:text-white/35 focus:border-[#D6B47A]/40 lg:h-14 lg:pr-4"
          />
          <SlidersHorizontal className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45 lg:hidden" />
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          {(['all', 'servico', 'produto'] as const).map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`h-11 rounded-xl px-5 text-[11px] font-black uppercase tracking-[0.18em] transition-all ${
                activeCategory === cat ? 'bg-[#D6B47A] text-black' : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {cat === 'all' ? 'Todos' : cat === 'servico' ? 'Servicos' : 'Produtos'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className={`${mobileView === 'catalog' ? 'block' : 'hidden'} space-y-4 xl:block`}>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filteredItems.map(item => (
                <button
                  key={`${item.tipo}-${item.id}`}
                  type="button"
                  onClick={() => addToCart(item)}
                  className="group relative flex min-h-[162px] flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#D6B47A]/35 hover:bg-white/[0.055] lg:min-h-[156px]"
                >
                  <Bookmark className="absolute right-5 top-5 h-5 w-5 text-white/35 lg:hidden" />
                  <div>
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#D6B47A]/12 text-[#D6B47A] shadow-lg shadow-[#D6B47A]/10">
                      {item.tipo === 'servico' ? <Scissors className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                    </div>
                    <h3 className="line-clamp-2 text-lg font-black text-white">{item.nome}</h3>
                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.14em] text-white/45">
                      {item.tipo === 'servico' ? 'Servico profissional' : 'Produto'}
                    </p>
                  </div>
                  <p className="mt-5 text-lg font-black text-[#D6B47A]">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.valor || 0))}
                  </p>
                  <span className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#D6B47A]/10 text-[#D6B47A] lg:hidden">
                    <Plus className="h-6 w-6" />
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D6B47A]/10 text-[#D6B47A]">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black text-white">Pacotes e combos</p>
                <p className="text-sm text-white/55">Aumente o ticket medio com pacotes exclusivos.</p>
              </div>
            </div>
            <button type="button" onClick={() => { setActiveCategory('servico'); setSearchTerm('combo'); }} className="hidden rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white transition-all hover:bg-white/[0.06] sm:flex">
              Ver pacotes
              <ArrowRight className="ml-3 h-4 w-4" />
            </button>
          </div>
        </section>

        <aside className={`${mobileView === 'cart' ? 'block' : 'hidden'} overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] xl:sticky xl:top-6 xl:block`}>
          <div className="flex items-center justify-between border-b border-white/8 p-6">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-7 w-7 text-[#D6B47A]" />
              <h3 className="text-xl font-black uppercase text-white">Carrinho</h3>
              <span className="rounded-full bg-[#D6B47A]/12 px-2.5 py-1 text-xs font-black text-[#D6B47A]">{cart.length}</span>
            </div>
            <button type="button" onClick={() => { setCart([]); setDiscount(0); }} title="Limpar carrinho" className="rounded-xl p-2 text-white/55 hover:bg-white/10 hover:text-white">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-[320px] border-b border-white/8 p-6">
            {cart.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-white/15 text-white/30">
                  <ShoppingCart className="h-9 w-9" />
                </div>
                <p className="text-lg font-black text-white/55">Seu carrinho esta vazio</p>
                <p className="mt-3 max-w-xs text-white/45">Adicione servicos ou produtos para comecar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.uniqueKey} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-white">{item.nome}</p>
                        <p className="mt-1 text-sm font-bold text-[#D6B47A]">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.valor || 0))}
                        </p>
                      </div>
                      <button onClick={() => removeFromCart(item.uniqueKey)} className="rounded-lg p-2 text-white/35 hover:bg-[#ff4d4d]/12 hover:text-[#ff4d4d]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center rounded-xl border border-white/10 bg-black/20">
                        <button onClick={() => updateQuantity(item.uniqueKey, -1)} className="px-3 py-2 text-white/70">-</button>
                        <span className="px-3 text-sm font-black text-white">{item.quantidade}</span>
                        <button onClick={() => updateQuantity(item.uniqueKey, 1)} className="px-3 py-2 text-white/70">+</button>
                      </div>
                      <p className="font-black text-white">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.valor || 0) * item.quantidade)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5 p-6">
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setMobileView('catalog')}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 text-sm font-bold text-white/70 transition-all hover:border-[#D6B47A]/40 hover:text-[#D6B47A] xl:hidden"
              >
                <Plus className="h-5 w-5 text-[#D6B47A]" />
                Adicionar mais itens
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsSearchingClient(true)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left"
            >
              <span className="flex items-center gap-3">
                <User className="h-5 w-5 text-white/55" />
                <span className="font-bold text-white">{selectedClientName || 'Cliente nao informado'}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-white/45" />
            </button>

            <div className="space-y-3">
              <div className="flex justify-between text-lg text-white">
                <span>Subtotal</span>
                <span className="font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal)}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-5 text-sm text-[#D6B47A]">
                <span>Desconto</span>
                <button type="button" onClick={handleDiscount}>{discount > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discount) : 'Adicionar desconto'}</button>
              </div>
              <div className="flex items-end justify-between pt-3">
                <span className="text-lg font-black uppercase text-white">Total</span>
                <span className="text-4xl font-black text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              disabled={cart.length === 0}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#00d875] font-black uppercase tracking-[0.14em] text-black transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Avancar para pagamento
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </aside>
      </div>

      <div className={`${mobileView === 'cart' ? 'block' : 'hidden'} mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5 xl:hidden`}>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D6B47A]/10 text-[#D6B47A]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <p className="font-black text-white">Ambiente seguro</p>
            <p className="mt-1 text-sm text-white/50">Seus dados e transacoes sao protegidos com tecnologia de ponta.</p>
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-20 hidden border-t border-white/8 bg-[#080808]/90 px-6 py-3 backdrop-blur-xl lg:flex lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 text-sm font-black text-white">
          <span className="h-3 w-3 rounded-full bg-[#D6B47A]" />
          Conexao <span className="text-[#D6B47A]">Online</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-white/55">
          <WalletCards className="h-5 w-5 text-blue-400" />
          <span>Dinheiro na gaveta (atual)</span>
          <span className="font-black text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(drawerMoney)}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-white/55">
          <Briefcase className="h-5 w-5" />
          <span>Atalhos do teclado</span>
          <span className="rounded-md bg-white/10 px-2 py-1 text-white">F1</span>
        </div>
      </footer>

      {paymentOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-white">Pagamento</h3>
                <p className="text-sm text-white/55">Escolha a forma de pagamento para concluir.</p>
              </div>
              <button onClick={() => setPaymentOpen(false)} className="rounded-xl p-2 text-white/55 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                { id: 'cartao', label: 'Cartao', icon: CreditCard },
                { id: 'pix', label: 'Pix', icon: QrCode },
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                  className={`rounded-2xl border p-5 text-center transition-all ${
                    paymentMethod === method.id ? 'border-[#D6B47A] bg-[#D6B47A]/10 text-[#D6B47A]' : 'border-white/10 bg-white/[0.04] text-white/60'
                  }`}
                >
                  <method.icon className="mx-auto mb-3 h-7 w-7" />
                  <span className="text-sm font-black">{method.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-white/8 pt-6">
              <span className="font-black text-white">Total</span>
              <span className="text-3xl font-black text-[#D6B47A]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={processing}
              className="mt-6 h-14 w-full rounded-xl bg-[#00d875] font-black uppercase tracking-[0.16em] text-black transition-all hover:scale-[1.01] disabled:opacity-50"
            >
              {processing ? 'Finalizando...' : 'Confirmar pagamento'}
            </button>
          </div>
        </div>
      )}

      {isSearchingClient && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-black text-white">Buscar cliente</h3>
              <button onClick={() => setIsSearchingClient(false)} className="rounded-xl p-2 text-white/55 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                autoFocus
                value={clientSearch}
                onChange={async e => {
                  const val = e.target.value;
                  setClientSearch(val);
                  if (val.length > 2) {
                    const { data } = await supabase
                      .from('clientes')
                      .select('*')
                      .eq('barbearia_id', barbeariaId)
                      .or(`nome.ilike.%${val}%,telefone.ilike.%${val}%`)
                      .limit(8);
                    setClientResults(data || []);
                  } else {
                    setClientResults([]);
                  }
                }}
                placeholder="Nome ou telefone..."
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-white outline-none focus:border-[#D6B47A]/40"
              />
            </div>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {clientResults.map(client => (
                <button
                  key={client.id}
                  onClick={() => {
                    setSelectedClientId(client.id);
                    setSelectedClientName(client.nome);
                    setIsSearchingClient(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/[0.04] p-3 text-left hover:border-[#D6B47A]/30"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D6B47A]/12 font-black text-[#D6B47A]">
                    {client.nome?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-white">{client.nome}</p>
                    <p className="text-sm text-white/45">{client.telefone}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setSelectedClientId(null);
                setSelectedClientName(null);
                setIsSearchingClient(false);
              }}
              className="mt-5 w-full rounded-xl border border-dashed border-white/10 py-3 text-sm font-black uppercase text-white/45 hover:text-[#ff4d4d]"
            >
              Venda sem cliente informado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
