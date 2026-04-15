'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Package, Plus, Edit3, Trash2, AlertCircle, Check, X } from 'lucide-react';

interface Product {
  id: string;
  nome: string;
  valor_venda: number;
  comissao_valor: number;
  comissao_tipo: 'percentual' | 'fixo';
  estoque: number;
}

interface ProductsViewProps {
  barbeariaId: string | null;
}

export function ProductsView({ barbeariaId }: ProductsViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form State (create)
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [commission, setCommission] = useState('');
  const [type, setType] = useState<'percentual' | 'fixo'>('fixo');
  const [stock, setStock] = useState('');

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCommission, setEditCommission] = useState('');
  const [editType, setEditType] = useState<'percentual' | 'fixo'>('fixo');
  const [editStock, setEditStock] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  async function fetchProducts() {
    if (!barbeariaId) return;
    setLoading(true);
    const { data } = await supabase.from('produtos').select('*').eq('barbearia_id', barbeariaId).order('nome');
    setProducts(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchProducts();
  }, [barbeariaId]);

  async function handleAddProduct() {
    if (!barbeariaId || !name || !price) return;

    await supabase.from('produtos').insert({
      barbearia_id: barbeariaId,
      nome: name,
      valor_venda: parseFloat(price),
      comissao_valor: parseFloat(commission || '0'),
      comissao_tipo: type,
      estoque: parseInt(stock || '0')
    });

    setName('');
    setPrice('');
    setCommission('');
    setStock('');
    setShowForm(false);
    fetchProducts();
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditName(p.nome);
    setEditPrice(p.valor_venda.toString());
    setEditCommission(p.comissao_valor.toString());
    setEditType(p.comissao_tipo);
    setEditStock(p.estoque.toString());
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSaveEdit(productId: string) {
    if (!editName || !editPrice || editLoading) return;
    setEditLoading(true);
    try {
      const { error } = await supabase.from('produtos')
        .update({
          nome: editName,
          valor_venda: parseFloat(editPrice),
          comissao_valor: parseFloat(editCommission || '0'),
          comissao_tipo: editType,
          estoque: parseInt(editStock || '0'),
        })
        .eq('id', productId);

      if (error) throw error;
      setEditingId(null);
      fetchProducts();
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(productId: string) {
    if (deletingId) return;
    setDeletingId(productId);
    try {
      const { error } = await supabase.from('produtos').delete().eq('id', productId);
      if (error) throw error;
      setConfirmDeleteId(null);
      fetchProducts();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Produtos</h2>
          <p className="text-sm text-muted">Estoque e comissões de itens</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent p-3 sm:p-2.5 px-5 font-bold text-black border-border hover:scale-[1.02] active:scale-95 transition-all w-full sm:w-auto"
        >
          {showForm ? <><X className="h-4 w-4" /> Fechar</> : <><Plus className="h-4 w-4" /> Novo Produto</>}
        </button>
      </div>

      {showForm && (
        <div className="glass rounded-2xl border border-accent/30 p-6 space-y-4 animate-in fade-in zoom-in duration-200">
          <h3 className="text-lg font-bold text-white">Cadastrar Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Nome do Produto</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none"
                placeholder="Ex: Pomada Efeito Seco"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted ml-1">Preço Venda</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none"
                  placeholder="R$ 0,00"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted ml-1">Estoque</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none"
                  placeholder="Qtd"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Tipo de Comissão</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setType('percentual')}
                  className={`flex-1 p-2.5 rounded-xl border text-xs font-bold transition-all ${type === 'percentual' ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card/30 text-muted'}`}
                >
                  Percentual (%)
                </button>
                <button
                  onClick={() => setType('fixo')}
                  className={`flex-1 p-2.5 rounded-xl border text-xs font-bold transition-all ${type === 'fixo' ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card/30 text-muted'}`}
                >
                  Valor Fixo (R$)
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Comissão</label>
              <input
                type="number"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className="w-full rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none"
                placeholder={type === 'percentual' ? '%' : 'R$'}
              />
            </div>
          </div>
          <button
            onClick={handleAddProduct}
            className="w-full rounded-xl bg-accent p-4 font-bold text-black hover:scale-[1.01] active:scale-95 transition-all"
          >
            Salvar no Catálogo
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-dashed border-border opacity-60">
            <Package className="h-12 w-12 text-muted mx-auto mb-4" />
            <p className="text-muted font-medium">Nenhum produto cadastrado no catálogo.</p>
          </div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="glass rounded-2xl border border-border/50 overflow-hidden hover:border-accent/30 transition-all">
              {editingId === p.id ? (
                /* Modo Edição Inline */
                <div className="p-5 space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-accent uppercase tracking-widest">Editando Produto</h4>
                    <button onClick={cancelEdit} className="p-1.5 hover:bg-white/5 rounded-lg text-muted hover:text-white transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-1">
                      <label className="text-[9px] uppercase font-bold text-muted ml-1">Nome</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl border border-border bg-white/5 p-2.5 text-sm text-white focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-muted ml-1">Preço (R$)</label>
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full rounded-xl border border-border bg-white/5 p-2.5 text-sm text-white focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-muted ml-1">Estoque</label>
                      <input
                        type="number"
                        value={editStock}
                        onChange={(e) => setEditStock(e.target.value)}
                        className="w-full rounded-xl border border-border bg-white/5 p-2.5 text-sm text-white focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditType('percentual')}
                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${editType === 'percentual' ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-white/5 text-muted'}`}
                      >
                        %
                      </button>
                      <button
                        onClick={() => setEditType('fixo')}
                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${editType === 'fixo' ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-white/5 text-muted'}`}
                      >
                        R$
                      </button>
                    </div>
                    <input
                      type="number"
                      value={editCommission}
                      onChange={(e) => setEditCommission(e.target.value)}
                      placeholder="Comissão"
                      className="w-28 rounded-xl border border-border bg-white/5 p-2.5 text-sm text-white focus:border-accent focus:outline-none"
                    />
                    <div className="flex-1" />
                    <button
                      onClick={() => handleSaveEdit(p.id)}
                      disabled={editLoading || !editName || !editPrice}
                      className="flex items-center gap-2 px-5 py-2.5 bg-accent rounded-xl font-bold text-black text-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                      {editLoading ? <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Check className="h-4 w-4" />}
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                /* Modo Visualização */
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{p.nome}</h4>
                      <p className="text-[10px] text-muted uppercase tracking-widest font-bold">
                        Venda: {formatCurrency(p.valor_venda)} &bull; Comissão: {p.comissao_valor}{p.comissao_tipo === 'percentual' ? '%' : ' R$'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-6">
                    <div className="hidden sm:block">
                      <p className="text-[10px] uppercase font-bold text-muted">Estoque</p>
                      <p className={`text-sm font-bold ${p.estoque <= 2 ? 'text-danger' : 'text-white'}`}>
                        {p.estoque} unid.
                        {p.estoque <= 2 && <AlertCircle className="inline h-3 w-3 ml-1" />}
                      </p>
                    </div>

                    {confirmDeleteId === p.id ? (
                      <div className="flex items-center gap-2 animate-in fade-in duration-200">
                        <span className="text-[10px] text-danger uppercase font-bold">Confirmar?</span>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingId === p.id}
                          className="p-2 rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition-colors"
                        >
                          {deletingId === p.id ? <div className="h-4 w-4 border-2 border-danger border-t-transparent rounded-full animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-2 rounded-lg bg-white/5 text-muted hover:text-white transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(p)}
                          className="p-2 rounded-lg bg-white/5 text-muted hover:text-white transition-colors"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
