'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, HelpCircle, Loader2, MessageSquare, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { ProfessionalMobileHeader } from '@/components/layout/ProfessionalMobileHeader';

const FAQ = [
  ['Como configurar serviços?', 'Acesse Configurações > Catalogo de serviços e cadastre nome, preço, duração e descrição.'],
  ['Como adicionar equipe?', 'Acesse Equipe e use Convites pendentes para gerar um link seguro para o funcionário.'],
  ['Como copiar link de agendamento?', 'Acesse Configurações > Links e copie o link direto ou QR Code.'],
  ['Como aprovar avaliações?', 'Acesse Avaliações no painel e modere as avaliações recebidas.'],
  ['Como pausar agenda?', 'O platform admin pode pausar agendamentos no Painel da Plataforma.'],
];

type SupportTicket = {
  id: string;
  assunto: string;
  mensagem: string;
  status: string;
  created_at: string;
};

export default function SuportePage() {
  const { barbeariaId, loading: roleLoading } = useUserRole();
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadTickets() {
    if (!barbeariaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: dbError } = await supabase
      .from('support_tickets')
      .select('id, assunto, mensagem, status, created_at')
      .eq('barbearia_id', barbeariaId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (dbError) {
      console.error('[Suporte] Erro ao carregar tickets:', dbError);
      setError('Nao foi possivel carregar seus chamados.');
    } else {
      setTickets((data || []) as SupportTicket[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!roleLoading) loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, barbeariaId]);

  async function createTicket() {
    if (!barbeariaId || saving || !assunto.trim() || !mensagem.trim()) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('support_tickets').insert({
        barbearia_id: barbeariaId,
        user_id: userData.user?.id ?? null,
        assunto: assunto.trim(),
        mensagem: mensagem.trim(),
        status: 'aberto',
      });
      if (insertError) throw insertError;
      setAssunto('');
      setMensagem('');
      setFeedback('Chamado criado.');
      await loadTickets();
    } catch (err) {
      console.error('[Suporte] Erro ao criar ticket:', err);
      setError('Nao foi possivel criar o chamado agora.');
    } finally {
      setSaving(false);
    }
  }

  if (roleLoading || loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-[#D6B47A]" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ProfessionalMobileHeader icon={HelpCircle} title="Suporte" subtitle="Ajuda e chamados" />
      <div className="hidden lg:block">
        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#D6B47A]">Ajuda</p>
        <h1 className="mt-2 text-4xl font-black text-white">Central de suporte</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/50">Guias rapidos para operar a barbearia e abrir chamados internos.</p>
      </div>

      {(error || feedback) && <div className={`rounded-2xl border p-4 text-sm font-bold ${error ? 'border-[#ff4d4d]/25 bg-[#ff4d4d]/10 text-[#ff9a9a]' : 'border-[#D6B47A]/20 bg-[#D6B47A]/10 text-[#D6B47A]'}`}>{error || feedback}</div>}

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="grid gap-4">
          {FAQ.map(([title, text]) => (
            <article key={title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex gap-4">
                <BookOpen className="mt-1 h-5 w-5 shrink-0 text-[#D6B47A]" />
                <div>
                  <h3 className="font-black text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{text}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="flex items-center gap-2 text-xl font-black text-white"><MessageSquare className="h-5 w-5 text-[#D6B47A]" />Abrir chamado</h2>
            <div className="mt-5 grid gap-3">
              <input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Assunto" className="h-12 rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none" />
              <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={5} placeholder="Descreva sua dúvida ou problema" className="resize-none rounded-2xl border border-white/12 bg-white/[0.04] p-4 font-bold text-white outline-none" />
              <button onClick={createTicket} disabled={saving || !assunto.trim() || !mensagem.trim()} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] font-black text-black disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar chamado
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-xl font-black text-white">Chamados recentes</h2>
            <div className="mt-4 space-y-3">
              {tickets.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/12 p-5 text-center text-sm text-white/40">Nenhum chamado aberto.</p>
              ) : tickets.map(ticket => (
                <article key={ticket.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="font-black text-white">{ticket.assunto}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-white/50">{ticket.mensagem}</p>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#D6B47A]">{ticket.status}</p>
                </article>
              ))}
            </div>
          </div>

          {!barbeariaId && (
            <div className="rounded-2xl border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 p-4 text-sm text-[#ff9a9a]">
              <AlertCircle className="mb-2 h-5 w-5" />
              Para abrir chamados, seu usuário precisa estar vinculado a uma barbearia.
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
