'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Megaphone, Plus, Send, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { hasPermission } from '@/lib/security/permissions';
import { trackAnalyticsEvent } from '@/lib/analytics/trackEvent';
import { ProfessionalMobileHeader } from '@/components/layout/ProfessionalMobileHeader';
import { FeatureGate } from '@/components/saas/FeatureGate';

type Campaign = {
  id: string;
  titulo: string;
  mensagem: string;
  publico_tipo: string;
  status: string;
  sent_to_n8n_at: string | null;
  created_at: string;
};

const AUDIENCES = [
  { value: 'todos', label: 'Todos os clientes' },
  { value: 'sumidos', label: 'Clientes sumidos' },
  { value: 'vip', label: 'Clientes VIP' },
  { value: 'aniversariantes', label: 'Aniversariantes' },
  { value: 'servico_especifico', label: 'Serviço específico' },
];

export default function MarketingPage() {
  const { role, barbeariaId, loading: roleLoading } = useUserRole();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ titulo: '', mensagem: '', publico_tipo: 'todos' });

  const canManage = useMemo(() => hasPermission(role, 'marketing.manage'), [role]);

  async function loadCampaigns() {
    if (!barbeariaId || !canManage) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('marketing_campaigns')
        .select('id, titulo, mensagem, publico_tipo, status, sent_to_n8n_at, created_at')
        .eq('barbearia_id', barbeariaId)
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      setCampaigns((data || []) as Campaign[]);
    } catch (err) {
      console.error('[Marketing] Erro ao carregar campanhas:', err);
      setError('Nao foi possivel carregar campanhas agora.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!roleLoading) loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, barbeariaId, canManage]);

  async function createCampaign() {
    if (!barbeariaId || saving || !form.titulo.trim() || !form.mensagem.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('marketing_campaigns').insert({
        barbearia_id: barbeariaId,
        titulo: form.titulo.trim(),
        mensagem: form.mensagem.trim(),
        publico_tipo: form.publico_tipo,
        status: 'rascunho',
        created_by: userData.user?.id ?? null,
      });

      if (insertError) throw insertError;
      setForm({ titulo: '', mensagem: '', publico_tipo: 'todos' });
      setSuccess('Campanha criada como rascunho.');
      await loadCampaigns();
    } catch (err) {
      console.error('[Marketing] Erro ao criar campanha:', err);
      setError('Nao foi possivel criar a campanha.');
    } finally {
      setSaving(false);
    }
  }

  async function sendToAutomation(campaign: Campaign) {
    if (!barbeariaId || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/automations/n8n-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'marketing_campaign_created',
          barbearia_id: barbeariaId,
          permission: 'marketing.manage',
          payload: {
            campaign_id: campaign.id,
            titulo: campaign.titulo,
            mensagem: campaign.mensagem,
            publico_tipo: campaign.publico_tipo,
          },
        }),
      });

      if (!response.ok) throw new Error('Falha ao enviar para automacao.');

      const { error: updateError } = await supabase
        .from('marketing_campaigns')
        .update({ status: 'enviada_para_automacao', sent_to_n8n_at: new Date().toISOString() })
        .eq('id', campaign.id)
        .eq('barbearia_id', barbeariaId);

      if (updateError) throw updateError;
      void trackAnalyticsEvent({
        barbearia_id: barbeariaId,
        event_type: 'campaign_sent',
        event_source: 'marketing',
        metadata: { campaign_id: campaign.id, publico_tipo: campaign.publico_tipo },
      });
      setSuccess('Campanha enviada para automacao.');
      await loadCampaigns();
    } catch (err) {
      console.error('[Marketing] Erro ao enviar campanha:', err);
      setError('Nao foi possivel enviar para automacao agora.');
    } finally {
      setSaving(false);
    }
  }

  if (roleLoading || loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-[#D6B47A]" /></div>;
  }

  if (!barbeariaId || !canManage) {
    return <AccessDenied title="Marketing restrito" text="Seu cargo nao tem permissao para criar campanhas." />;
  }

  return (
    <FeatureGate
      barbeariaId={barbeariaId}
      featureKey="marketing_automation"
      fallbackTitle="Marketing por automacao"
      fallbackDescription="Campanhas e envio para n8n fazem parte do plano PRO."
      requiredPlan="PRO"
    >
    <div className="max-w-full space-y-8 overflow-hidden animate-in fade-in duration-500">
      <ProfessionalMobileHeader icon={Megaphone} title="Marketing" subtitle="Campanhas enviadas para automacao" />

      <div className="hidden lg:block">
        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#D6B47A]">Comunicacao</p>
        <h1 className="mt-2 text-4xl font-black text-white">Marketing</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/50">Crie campanhas simples e envie para o n8n executar WhatsApp ou e-mail fora do app.</p>
      </div>

      {(error || success) && (
        <div className={`rounded-2xl border p-4 text-sm font-bold ${error ? 'border-[#ff4d4d]/25 bg-[#ff4d4d]/10 text-[#ff9a9a]' : 'border-[#D6B47A]/20 bg-[#D6B47A]/10 text-[#D6B47A]'}`}>
          {error || success}
        </div>
      )}

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-2xl font-black text-white">Nova campanha</h2>
          <div className="mt-5 space-y-4">
            <input value={form.titulo} onChange={e => setForm(prev => ({ ...prev, titulo: e.target.value }))} placeholder="Titulo da campanha" className="h-13 w-full min-w-0 rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none focus:border-[#D6B47A]/50" />
            <select value={form.publico_tipo} onChange={e => setForm(prev => ({ ...prev, publico_tipo: e.target.value }))} className="h-13 w-full min-w-0 rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none focus:border-[#D6B47A]/50">
              {AUDIENCES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <textarea value={form.mensagem} onChange={e => setForm(prev => ({ ...prev, mensagem: e.target.value }))} rows={6} placeholder="Mensagem para clientes..." className="w-full min-w-0 resize-none rounded-2xl border border-white/12 bg-white/[0.04] p-4 font-bold text-white outline-none focus:border-[#D6B47A]/50" />
            <button onClick={createCampaign} disabled={saving || !form.titulo.trim() || !form.mensagem.trim()} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] font-black text-black disabled:opacity-50">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              Criar campanha
            </button>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {campaigns.length === 0 ? (
            <Empty icon={Megaphone} title="Nenhuma campanha" text="As campanhas criadas aparecem aqui." />
          ) : campaigns.map(campaign => (
            <article key={campaign.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#D6B47A]/25 bg-[#D6B47A]/10 px-3 py-1 text-[10px] font-black uppercase text-[#D6B47A]">{campaign.publico_tipo}</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase text-white/50">{campaign.status}</span>
                  </div>
                  <h3 className="mt-3 break-words text-xl font-black text-white">{campaign.titulo}</h3>
                  <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-white/55">{campaign.mensagem}</p>
                </div>
                <button onClick={() => sendToAutomation(campaign)} disabled={saving || campaign.status === 'enviada_para_automacao'} className="flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-2xl border border-[#D6B47A]/30 bg-[#D6B47A]/10 px-4 text-sm font-black text-[#D6B47A] disabled:opacity-50 sm:w-auto sm:min-w-44">
                  <Send className="h-4 w-4" />
                  Enviar para n8n
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
    </FeatureGate>
  );
}

function AccessDenied({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-[#ff8a8a]" />
      <h1 className="mt-4 text-2xl font-black text-white">{title}</h1>
      <p className="mt-2 text-white/55">{text}</p>
    </div>
  );
}

function Empty({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.025] p-6 text-center sm:p-10">
      <Icon className="mx-auto h-10 w-10 text-white/25" />
      <h3 className="mt-4 text-xl font-black text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/45">{text}</p>
    </div>
  );
}
