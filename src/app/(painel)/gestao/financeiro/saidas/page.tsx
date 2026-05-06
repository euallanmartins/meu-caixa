/* eslint-disable */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, TrendingDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export default function SaidasPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
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

    const { data } = await supabase
      .from('despesas')
      .select('id, descricao, valor, data')
      .eq('barbearia_id', profileData.barbearia_id)
      .order('data', { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const total = useMemo(() => expenses.reduce((sum, item) => sum + Number(item.valor || 0), 0), [expenses]);

  async function handleSubmit() {
    if (!profile?.barbearia_id || !descricao.trim() || !Number(valor)) return;
    const { error } = await supabase.from('despesas').insert({
      barbearia_id: profile.barbearia_id,
      descricao,
      valor: Number(valor),
      data: new Date().toISOString(),
    });
    if (error) {
      alert('Erro ao salvar saida: ' + error.message);
      return;
    }
    setDescricao('');
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
          <h2 className="text-3xl font-black uppercase text-white">Saidas</h2>
          <p className="mt-1 text-sm text-white/45">Sangrias e despesas reais registradas no caixa.</p>
        </div>
        <div className="rounded-2xl border border-[#ff4d4d]/20 bg-[#ff4d4d]/10 p-5 text-[#ff4d4d]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em]">Total de saidas</p>
          <p className="mt-1 text-2xl font-black">{money(total)}</p>
        </div>
      </div>

      <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:grid-cols-[1fr_180px_auto] md:items-end">
        <label className="grid gap-2 text-sm font-bold text-white/65">
          Descricao
          <input value={descricao} onChange={e => setDescricao(e.target.value)} className="h-12 rounded-xl border border-white/10 bg-black px-4 text-white" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-white/65">
          Valor
          <input value={valor} onChange={e => setValor(e.target.value)} type="number" className="h-12 rounded-xl border border-white/10 bg-black px-4 text-white" />
        </label>
        <button onClick={handleSubmit} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#ff4d4d] px-5 font-black text-white">
          <Plus className="h-4 w-4" />
          Lancar
        </button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
        {expenses.length === 0 ? (
          <div className="p-10 text-center text-white/40">Nenhuma saida registrada.</div>
        ) : expenses.map(expense => (
          <div key={expense.id} className="flex items-center justify-between border-b border-white/8 p-5 last:border-0">
            <div className="flex items-center gap-4">
              <TrendingDown className="h-5 w-5 text-[#ff4d4d]" />
              <div>
                <p className="font-black text-white">{expense.descricao}</p>
                <p className="text-sm text-white/45">{new Date(expense.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
            </div>
            <p className="font-black text-[#ff4d4d]">{money(Number(expense.valor || 0))}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
