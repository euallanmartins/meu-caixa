/* eslint-disable */
'use client';

import { useState, useEffect } from 'react';
import { Scissors, Plus, Edit3, Trash2, Check, X, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ServicesViewProps {
  barbeariaId: string | null;
}

export function ServicesView({ barbeariaId }: ServicesViewProps) {
  const [servicos, setServicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Create form
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [duracao, setDuracao] = useState('30');
  const [descricao, setDescricao] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editValor, setEditValor] = useState('');
  const [editDuracao, setEditDuracao] = useState('30');
  const [editDescricao, setEditDescricao] = useState('');
  const [editAtivo, setEditAtivo] = useState(true);
  const [editLoading, setEditLoading] = useState(false);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchServicos() {
    if (!barbeariaId) return;
    setLoading(true);
    const { data } = await supabase.from('servicos').select('*').eq('barbearia_id', barbeariaId).order('nome');
    setServicos(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchServicos(); }, [barbeariaId]);

  async function handleAdd() {
    if (!barbeariaId || !nome || !valor) return;
    await supabase.from('servicos').insert({
      barbearia_id: barbeariaId,
      nome,
      descricao: descricao.trim() || null,
      valor: parseFloat(valor),
      duracao_minutos: parseInt(duracao || '30'),
      ativo: true,
    });
    setNome(''); setValor(''); setDuracao('30'); setDescricao(''); setShowForm(false);
    fetchServicos();
  }

  function startEdit(s: any) {
    setEditingId(s.id);
    setEditNome(s.nome);
    setEditValor(s.valor.toString());
    setEditDuracao((s.duracao_minutos || 30).toString());
    setEditDescricao(s.descricao || '');
    setEditAtivo(s.ativo !== false);
  }

  async function handleSaveEdit(id: string) {
    if (!editNome || !editValor || editLoading) return;
    setEditLoading(true);
    try {
      const { error } = await supabase.from('servicos').update({
        nome: editNome,
        descricao: editDescricao.trim() || null,
        valor: parseFloat(editValor),
        duracao_minutos: parseInt(editDuracao || '30'),
        ativo: editAtivo,
      }).eq('id', id).eq('barbearia_id', barbeariaId);
      if (error) throw error;
      setEditingId(null);
      fetchServicos();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally { setEditLoading(false); }
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('servicos').delete().eq('id', id).eq('barbearia_id', barbeariaId);
      if (error) throw error;
      setConfirmDeleteId(null);
      fetchServicos();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally { setDeletingId(null); }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Serviços</h2>
          <p className="text-sm text-muted">Catálogo de serviços disponíveis para agendamento</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent p-3 sm:p-2.5 px-5 font-bold text-black hover:scale-[1.02] active:scale-95 transition-all w-full sm:w-auto"
        >
          {showForm ? <><X className="h-4 w-4" /> Fechar</> : <><Plus className="h-4 w-4" /> Novo Serviço</>}
        </button>
      </div>

      {showForm && (
        <div className="glass rounded-2xl border border-accent/30 p-4 sm:p-6 space-y-4 animate-in fade-in zoom-in duration-200">
          <h3 className="text-lg font-bold text-white">Cadastrar Serviço</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Nome</label>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none"
                placeholder="Ex: Corte + Barba" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Valor (R$)</label>
              <input type="number" value={valor} onChange={(e) => setValor(e.target.value)}
                className="w-full rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none"
                placeholder="45.00" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Duração (min)</label>
              <input type="number" value={duracao} onChange={(e) => setDuracao(e.target.value)}
                className="w-full rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none"
                placeholder="30" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-muted ml-1">Descricao publica</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none"
              placeholder="Explique o que esta incluso neste servico." />
          </div>
          <button onClick={handleAdd}
            className="w-full rounded-xl bg-accent p-4 font-bold text-black hover:scale-[1.01] active:scale-95 transition-all">
            Salvar Serviço
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : servicos.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-dashed border-border opacity-60">
            <Scissors className="h-12 w-12 text-muted mx-auto mb-4" />
            <p className="text-muted font-medium">Nenhum serviço cadastrado.</p>
          </div>
        ) : (
          servicos.map((s) => (
            <div key={s.id} className="glass rounded-2xl border border-border/50 overflow-hidden hover:border-accent/30 transition-all">
              {editingId === s.id ? (
                <div className="p-4 sm:p-5 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-accent uppercase tracking-widest">Editando</h4>
                    <button onClick={() => setEditingId(null)} className="p-1.5 hover:bg-white/5 rounded-lg text-muted hover:text-white"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-muted ml-1">Nome</label>
                      <input type="text" value={editNome} onChange={(e) => setEditNome(e.target.value)}
                        className="w-full rounded-xl border border-border bg-white/5 p-2.5 text-sm text-white focus:border-accent focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-muted ml-1">Valor (R$)</label>
                      <input type="number" value={editValor} onChange={(e) => setEditValor(e.target.value)}
                        className="w-full rounded-xl border border-border bg-white/5 p-2.5 text-sm text-white focus:border-accent focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-muted ml-1">Duração (min)</label>
                      <input type="number" value={editDuracao} onChange={(e) => setEditDuracao(e.target.value)}
                        className="w-full rounded-xl border border-border bg-white/5 p-2.5 text-sm text-white focus:border-accent focus:outline-none" />
                    </div>
                  </div>
                  <textarea value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-white/5 p-2.5 text-sm text-white focus:border-accent focus:outline-none"
                    placeholder="Descricao publica do servico" />
                  <label className="flex items-center gap-3 rounded-xl border border-border bg-white/5 p-3 text-sm font-bold text-white">
                    <input type="checkbox" checked={editAtivo} onChange={(e) => setEditAtivo(e.target.checked)} className="h-4 w-4 accent-accent" />
                    Servico ativo no perfil publico e no agendamento
                  </label>
                  <button onClick={() => handleSaveEdit(s.id)} disabled={editLoading || !editNome || !editValor}
                    className="flex items-center gap-2 px-5 py-2.5 bg-accent rounded-xl font-bold text-black text-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                    {editLoading ? <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Check className="h-4 w-4" />}
                    Salvar
                  </button>
                </div>
              ) : (
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                      <Scissors className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{s.nome}</h4>
                      {s.ativo === false && (
                        <span className="mt-1 inline-flex rounded-full bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white/40">
                          Inativo
                        </span>
                      )}
                      <p className="text-[10px] text-muted uppercase tracking-widest font-bold">
                        {formatCurrency(s.valor)} • <Clock className="h-2.5 w-2.5 inline" /> {s.duracao_minutos || 30}min
                      </p>
                      {s.descricao && <p className="mt-1 line-clamp-1 text-xs text-white/45">{s.descricao}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {confirmDeleteId === s.id ? (
                      <div className="flex items-center gap-2 animate-in fade-in duration-200">
                        <span className="text-[10px] text-danger uppercase font-bold">Confirmar?</span>
                        <button onClick={() => handleDelete(s.id)} disabled={deletingId === s.id}
                          className="p-2 rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition-colors">
                          {deletingId === s.id ? <div className="h-4 w-4 border-2 border-danger border-t-transparent rounded-full animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="p-2 rounded-lg bg-white/5 text-muted hover:text-white transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => startEdit(s)} className="p-2 rounded-lg bg-white/5 text-muted hover:text-white transition-colors"><Edit3 className="h-4 w-4" /></button>
                        <button onClick={() => setConfirmDeleteId(s.id)} className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"><Trash2 className="h-4 w-4" /></button>
                      </>
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
