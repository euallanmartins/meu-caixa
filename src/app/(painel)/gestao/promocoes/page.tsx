'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BadgePercent, CalendarDays, Loader2, Plus, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { hasPermission } from '@/lib/security/permissions';
import { ProfessionalMobileHeader } from '@/components/layout/ProfessionalMobileHeader';
import { FeatureGate } from '@/components/saas/FeatureGate';

type Promocao = {
  id: string;
  titulo: string;
  descricao: string | null;
  servico_id: string | null;
  barbeiro_id: string | null;
  data_inicio: string;
  data_fim: string;
  horario_inicio: string | null;
  horario_fim: string | null;
  status: string;
};

type Servico = { id: string; nome: string };
type Barbeiro = { id: string; nome: string };

export default function PromocoesPage() {
  const { role, barbeariaId, loading: roleLoading } = useUserRole();
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    servico_id: '',
    barbeiro_id: '',
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim: new Date().toISOString().slice(0, 10),
    horario_inicio: '',
    horario_fim: '',
  });

  const canManage = useMemo(() => hasPermission(role, 'promocoes.manage'), [role]);

  async function load() {
    if (!barbeariaId || !canManage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [promosRes, servicosRes, barbeirosRes] = await Promise.all([
        supabase.from('promocoes').select('*').eq('barbearia_id', barbeariaId).order('data_inicio', { ascending: false }),
        supabase.from('servicos').select('id, nome').eq('barbearia_id', barbeariaId).eq('ativo', true).order('nome'),
        supabase.from('barbeiros').select('id, nome').eq('barbearia_id', barbeariaId).eq('ativo', true).order('nome'),
      ]);

      if (promosRes.error) throw promosRes.error;
      if (servicosRes.error) throw servicosRes.error;
      if (barbeirosRes.error) throw barbeirosRes.error;

      setPromocoes((promosRes.data || []) as Promocao[]);
      setServicos((servicosRes.data || []) as Servico[]);
      setBarbeiros((barbeirosRes.data || []) as Barbeiro[]);
    } catch (err) {
      console.error('[Promocoes] Erro ao carregar:', err);
      setError('Nao foi possivel carregar promocoes agora.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!roleLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, barbeariaId, canManage]);

  async function createPromocao() {
    if (!barbeariaId || saving || !form.titulo.trim()) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('promocoes').insert({
        barbearia_id: barbeariaId,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        servico_id: form.servico_id || null,
        barbeiro_id: form.barbeiro_id || null,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        horario_inicio: form.horario_inicio || null,
        horario_fim: form.horario_fim || null,
        status: 'ativo',
      });
      if (insertError) throw insertError;
      setForm(prev => ({ ...prev, titulo: '', descricao: '', servico_id: '', barbeiro_id: '', horario_inicio: '', horario_fim: '' }));
      setMessage('Promocao criada.');
      await load();
    } catch (err) {
      console.error('[Promocoes] Erro ao criar:', err);
      setError('Nao foi possivel criar a promocao.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(promocao: Promocao) {
    if (!barbeariaId) return;
    const next = promocao.status === 'ativo' ? 'inativo' : 'ativo';
    const { error: updateError } = await supabase
      .from('promocoes')
      .update({ status: next })
      .eq('id', promocao.id)
      .eq('barbearia_id', barbeariaId);
    if (updateError) {
      setError('Nao foi possivel atualizar a promocao.');
      return;
    }
    await load();
  }

  async function sendPromo(promocao: Promocao) {
    if (!barbeariaId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/automations/n8n-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'promotion_created',
          barbearia_id: barbeariaId,
          permission: 'promocoes.manage',
          payload: promocao,
        }),
      });
      if (!response.ok) throw new Error('Falha no envio.');
      setMessage('Promocao enviada para automacao.');
    } catch (err) {
      console.error('[Promocoes] Erro ao enviar:', err);
      setError('Nao foi possivel enviar para automacao agora.');
    } finally {
      setSaving(false);
    }
  }

  if (roleLoading || loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-[#D6B47A]" /></div>;
  if (!barbeariaId || !canManage) return <Denied />;

  return (
    <FeatureGate
      barbeariaId={barbeariaId}
      featureKey="promotions"
      fallbackTitle="Promocoes premium"
      fallbackDescription="Ofertas para horarios vagos e automacoes promocionais estao no plano PRO."
      requiredPlan="PRO"
    >
    <div className="max-w-full space-y-8 overflow-hidden animate-in fade-in duration-500">
      <ProfessionalMobileHeader icon={BadgePercent} title="Promocoes" subtitle="Ofertas sem pagamento online" />
      <div className="hidden lg:block">
        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#D6B47A]">Horarios vagos</p>
        <h1 className="mt-2 text-4xl font-black text-white">Promocoes</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/50">Crie ofertas simples para aparecer no perfil publico e enviar para automacao.</p>
      </div>

      {(error || message) && <div className={`rounded-2xl border p-4 text-sm font-bold ${error ? 'border-[#ff4d4d]/25 bg-[#ff4d4d]/10 text-[#ff9a9a]' : 'border-[#D6B47A]/20 bg-[#D6B47A]/10 text-[#D6B47A]'}`}>{error || message}</div>}

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-2xl font-black text-white">Nova promocao</h2>
          <div className="mt-5 grid gap-4">
            <input value={form.titulo} onChange={e => setForm(prev => ({ ...prev, titulo: e.target.value }))} placeholder="Titulo" className="h-13 w-full min-w-0 rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none focus:border-[#D6B47A]/50" />
            <textarea value={form.descricao} onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))} rows={4} placeholder="Descricao" className="w-full min-w-0 resize-none rounded-2xl border border-white/12 bg-white/[0.04] p-4 font-bold text-white outline-none focus:border-[#D6B47A]/50" />
            <select value={form.servico_id} onChange={e => setForm(prev => ({ ...prev, servico_id: e.target.value }))} className="h-13 w-full min-w-0 rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none focus:border-[#D6B47A]/50">
              <option value="">Todos os servicos</option>
              {servicos.map(servico => <option key={servico.id} value={servico.id}>{servico.nome}</option>)}
            </select>
            <select value={form.barbeiro_id} onChange={e => setForm(prev => ({ ...prev, barbeiro_id: e.target.value }))} className="h-13 w-full min-w-0 rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none focus:border-[#D6B47A]/50">
              <option value="">Todos os profissionais</option>
              {barbeiros.map(barbeiro => <option key={barbeiro.id} value={barbeiro.id}>{barbeiro.nome}</option>)}
            </select>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <input type="date" value={form.data_inicio} onChange={e => setForm(prev => ({ ...prev, data_inicio: e.target.value }))} className="h-13 w-full min-w-0 rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none" />
              <input type="date" value={form.data_fim} onChange={e => setForm(prev => ({ ...prev, data_fim: e.target.value }))} className="h-13 w-full min-w-0 rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none" />
              <input type="time" value={form.horario_inicio} onChange={e => setForm(prev => ({ ...prev, horario_inicio: e.target.value }))} className="h-13 w-full min-w-0 rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none" />
              <input type="time" value={form.horario_fim} onChange={e => setForm(prev => ({ ...prev, horario_fim: e.target.value }))} className="h-13 w-full min-w-0 rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none" />
            </div>
            <button onClick={createPromocao} disabled={saving || !form.titulo.trim()} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] font-black text-black disabled:opacity-50">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              Criar promocao
            </button>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {promocoes.length === 0 ? (
            <Empty />
          ) : promocoes.map(promocao => (
            <article key={promocao.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${promocao.status === 'ativo' ? 'border-[#D6B47A]/25 bg-[#D6B47A]/10 text-[#D6B47A]' : 'border-white/10 bg-white/[0.04] text-white/45'}`}>{promocao.status}</span>
                  <h3 className="mt-3 break-words text-xl font-black text-white">{promocao.titulo}</h3>
                  <p className="mt-2 break-words text-sm text-white/55">{promocao.descricao || 'Sem descricao'}</p>
                  <p className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold text-white/40"><CalendarDays className="h-4 w-4 shrink-0" />{promocao.data_inicio} ate {promocao.data_fim}</p>
                </div>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <button onClick={() => sendPromo(promocao)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D6B47A]/30 bg-[#D6B47A]/10 px-4 text-sm font-black text-[#D6B47A]"><Send className="h-4 w-4" /> n8n</button>
                  <button onClick={() => toggleStatus(promocao)} className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white">{promocao.status === 'ativo' ? 'Inativar' : 'Ativar'}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
    </FeatureGate>
  );
}

function Denied() {
  return <div className="rounded-3xl border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 p-8 text-center text-[#ff9a9a]"><AlertCircle className="mx-auto h-10 w-10" /><p className="mt-4 font-black">Seu cargo nao tem permissao para promocoes.</p></div>;
}

function Empty() {
  return <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.025] p-6 text-center sm:p-10"><BadgePercent className="mx-auto h-10 w-10 text-white/25" /><h3 className="mt-4 text-xl font-black text-white">Nenhuma promocao</h3><p className="mt-2 text-sm text-white/45">Promocoes criadas aparecem aqui.</p></div>;
}
