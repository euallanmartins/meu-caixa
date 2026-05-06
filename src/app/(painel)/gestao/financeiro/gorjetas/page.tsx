/* eslint-disable */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export default function GorjetasPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [tips, setTips] = useState<any[]>([]);
  const [valor, setValor] = useState('');
  const [metodo, setMetodo] = useState('dinheiro');
  const [barbeiroId, setBarbeiroId] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profileData } = await supabase.from('profiles').select('barbearia_id').eq('id', user.id).maybeSingle();
    setProfile(profileData);
    if (!profileData?.barbearia_id) {
      setLoading(false);
      return;
    }

    const [barbersRes, tipsRes] = await Promise.all([
      supabase.from('barbeiros').select('id, nome').eq('barbearia_id', profileData.barbearia_id).eq('ativo', true).order('nome'),
      supabase.from('caixinhas').select('id, valor, metodo, data, barbeiro_id, barbeiros(nome)').eq('barbearia_id', profileData.barbearia_id).order('data', { ascending: false }),
    ]);

    setBarbers(barbersRes.data || []);
    setTips(tipsRes.data || []);
    setBarbeiroId(prev => prev || barbersRes.data?.[0]?.id || '');
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const total = useMemo(() => tips.reduce((sum, item) => sum + Number(item.valor || 0), 0), [tips]);

  async function handleSubmit() {
    if (!profile?.barbearia_id || !barbeiroId || !Number(valor)) return;
    const { error } = await supabase.from('caixinhas').insert({
      barbearia_id: profile.barbearia_id,
      barbeiro_id: barbeiroId,
      valor: Number(valor),
      metodo,
      data: new Date().toISOString(),
    });
    if (error) {
      alert('Erro ao salvar gorjeta: ' + error.message);
      return;
    }
    setValor('');
    loadData();
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center text-white/50">Carregando...</div>;

  return (
    <div className="space-y-7 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/gestao/financeiro" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao financeiro
          </Link>
          <h2 className="text-3xl font-black uppercase text-white">Gorjetas</h2>
          <p className="mt-1 text-sm text-white/45">Registro real de caixinhas recebidas pela equipe.</p>
        </div>
        <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-5 text-yellow-300">
          <p className="text-[10px] font-black uppercase tracking-[0.18em]">Total registrado</p>
          <p className="mt-1 text-2xl font-black">{money(total)}</p>
        </div>
      </div>

      <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
        <label className="grid gap-2 text-sm font-bold text-white/65">
          Profissional
          <select value={barbeiroId} onChange={e => setBarbeiroId(e.target.value)} className="h-12 rounded-xl border border-white/10 bg-black px-4 text-white">
            {barbers.map(barber => <option key={barber.id} value={barber.id}>{barber.nome}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-white/65">
          Valor
          <input value={valor} onChange={e => setValor(e.target.value)} type="number" className="h-12 rounded-xl border border-white/10 bg-black px-4 text-white" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-white/65">
          Metodo
          <select value={metodo} onChange={e => setMetodo(e.target.value)} className="h-12 rounded-xl border border-white/10 bg-black px-4 text-white">
            <option value="dinheiro">Dinheiro</option>
            <option value="cartao">Cartao</option>
            <option value="pix">Pix</option>
          </select>
        </label>
        <button onClick={handleSubmit} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#00d875] px-5 font-black text-black">
          <Plus className="h-4 w-4" />
          Lancar
        </button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
        {tips.length === 0 ? (
          <div className="p-10 text-center text-white/40">Nenhuma gorjeta registrada.</div>
        ) : tips.map(tip => (
          <div key={tip.id} className="flex items-center justify-between border-b border-white/8 p-5 last:border-0">
            <div className="flex items-center gap-4">
              <Star className="h-5 w-5 text-yellow-300" />
              <div>
                <p className="font-black text-white">{tip.barbeiros?.nome || 'Profissional'}</p>
                <p className="text-sm capitalize text-white/45">{tip.metodo} - {new Date(tip.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
            </div>
            <p className="font-black text-yellow-300">{money(Number(tip.valor || 0))}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
