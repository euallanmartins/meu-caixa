'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Loader2, Phone, Send, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { hasPermission } from '@/lib/security/permissions';
import { ProfessionalMobileHeader } from '@/components/layout/ProfessionalMobileHeader';
import { FeatureGate } from '@/components/saas/FeatureGate';

type WaitlistEntry = {
  id: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
  data_preferida: string | null;
  periodo_preferido: string;
  observacao: string | null;
  status: string;
  created_at: string;
  barbeiros?: { nome?: string | null } | null;
};

type PendingAppointment = {
  id: string;
  status: string;
  data_hora_inicio: string;
  clientes?: { nome?: string | null; telefone?: string | null; email?: string | null } | null;
  barbeiros?: { nome?: string | null } | null;
  servicos?: { nome?: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  aguardando: 'Aguardando',
  avisado: 'Avisado',
  convertido: 'Convertido',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
};

export default function ListaEsperaPage() {
  const { role, barbeariaId, loading: roleLoading } = useUserRole();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [pendingAppointments, setPendingAppointments] = useState<PendingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canManage = useMemo(() => hasPermission(role, 'agenda.manage') || hasPermission(role, 'clientes.manage'), [role]);

  async function load() {
    if (!barbeariaId || !canManage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [waitlistRes, pendingRes] = await Promise.all([
        supabase
          .from('waitlist_entries')
          .select('id, cliente_nome, cliente_telefone, cliente_email, data_preferida, periodo_preferido, observacao, status, created_at, barbeiros(nome)')
          .eq('barbearia_id', barbeariaId)
          .order('created_at', { ascending: false }),
        supabase
          .from('agendamentos')
          .select('id, status, data_hora_inicio, clientes(nome, telefone, email), barbeiros(nome), servicos(nome)')
          .eq('barbearia_id', barbeariaId)
          .eq('status', 'pendente')
          .order('data_hora_inicio', { ascending: true }),
      ]);

      if (waitlistRes.error) throw waitlistRes.error;
      if (pendingRes.error) throw pendingRes.error;
      setEntries((waitlistRes.data || []) as WaitlistEntry[]);
      setPendingAppointments((pendingRes.data || []) as PendingAppointment[]);
    } catch (err) {
      console.error('[ListaEspera] Erro ao carregar:', err);
      setError('Nao foi possivel carregar a lista de espera.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!roleLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, barbeariaId, canManage]);

  async function updateStatus(entry: WaitlistEntry, status: string) {
    setBusyId(entry.id);
    setError(null);
    setMessage(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('rpc_waitlist_update_status', {
        p_waitlist_id: entry.id,
        p_status: status,
      });

      if (rpcError) throw rpcError;
      const result = data as { success?: boolean; message?: string } | null;
      if (result?.success === false) {
        setError(result.message || 'Nao foi possivel atualizar.');
        return;
      }

      setMessage('Lista de espera atualizada.');
      await load();
    } catch (err) {
      console.error('[ListaEspera] Erro ao atualizar:', err);
      setError('Nao foi possivel atualizar agora.');
    } finally {
      setBusyId(null);
    }
  }

  async function notify(entry: WaitlistEntry) {
    if (!barbeariaId) return;
    setBusyId(entry.id);
    setError(null);
    setMessage(null);
    try {
      await fetch('/api/automations/n8n-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'waitlist_available_slot',
          barbearia_id: barbeariaId,
          permission: 'agenda.manage',
          payload: {
            waitlist_id: entry.id,
            cliente_nome: entry.cliente_nome,
            cliente_telefone: entry.cliente_telefone,
            cliente_email: entry.cliente_email,
            data_preferida: entry.data_preferida,
            periodo_preferido: entry.periodo_preferido,
          },
        }),
      });
      await updateStatus(entry, 'avisado');
    } catch (err) {
      console.error('[ListaEspera] Erro ao avisar:', err);
      setError('Nao foi possivel enviar para automacao.');
      setBusyId(null);
    }
  }

  if (roleLoading || loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-[#D6B47A]" /></div>;
  if (!barbeariaId || !canManage) return <Denied />;

  const waiting = entries.filter(entry => entry.status === 'aguardando');

  return (
    <FeatureGate
      barbeariaId={barbeariaId}
      featureKey="waitlist"
      fallbackTitle="Lista de espera premium"
      fallbackDescription="Controle de lista de espera e avisos de horario fazem parte do plano PRO."
      requiredPlan="PRO"
    >
    <div className="space-y-8 animate-in fade-in duration-500">
      <ProfessionalMobileHeader icon={CalendarClock} title="Lista de espera" subtitle="Clientes aguardando horario" />
      <div className="hidden lg:block">
        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#D6B47A]">Agenda</p>
        <h1 className="mt-2 text-4xl font-black text-white">Lista de espera</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/50">Acompanhe clientes que querem ser avisados quando abrir horario.</p>
      </div>

      {(error || message) && <div className={`rounded-2xl border p-4 text-sm font-bold ${error ? 'border-[#ff4d4d]/25 bg-[#ff4d4d]/10 text-[#ff9a9a]' : 'border-[#D6B47A]/20 bg-[#D6B47A]/10 text-[#D6B47A]'}`}>{error || message}</div>}

      <section className="grid gap-4 sm:grid-cols-3">
        <Summary label="Aguardando" value={waiting.length} />
        <Summary label="Avisados" value={entries.filter(e => e.status === 'avisado').length} />
        <Summary label="Convertidos" value={entries.filter(e => e.status === 'convertido').length} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black text-white">Clientes nao confirmados</h2>
          <p className="mt-1 text-sm text-white/45">Agendamentos pendentes que ainda precisam de aceite profissional.</p>
        </div>
        {pendingAppointments.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 text-sm text-white/45">
            Nenhum agendamento pendente no momento.
          </div>
        ) : (
          <div className="grid gap-3">
            {pendingAppointments.map(appointment => (
              <article key={appointment.id} className="rounded-3xl border border-[#D6B47A]/20 bg-[#D6B47A]/8 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <span className="rounded-full border border-[#D6B47A]/25 px-3 py-1 text-[10px] font-black uppercase text-[#D6B47A]">Pendente</span>
                    <h3 className="mt-3 text-xl font-black text-white">{appointment.clientes?.nome || 'Cliente nao informado'}</h3>
                    <p className="mt-1 text-sm text-white/55">{appointment.clientes?.telefone || appointment.clientes?.email || 'Contato nao informado'}</p>
                  </div>
                  <div className="text-sm text-white/55 lg:text-right">
                    <p className="font-black text-white">{appointment.servicos?.nome || 'Servico'}</p>
                    <p>{appointment.barbeiros?.nome || 'Profissional nao informado'}</p>
                    <p>{new Date(appointment.data_hora_inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.025] p-12 text-center">
          <CalendarClock className="mx-auto h-12 w-12 text-white/25" />
          <h3 className="mt-4 text-xl font-black text-white">Nenhum cliente na lista</h3>
          <p className="mt-2 text-sm text-white/45">Quando o cliente entrar na lista de espera pelo agendamento, ele aparece aqui.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {entries.map(entry => (
            <article key={entry.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#D6B47A]/25 bg-[#D6B47A]/10 px-3 py-1 text-[10px] font-black uppercase text-[#D6B47A]">{STATUS_LABELS[entry.status] || entry.status}</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase text-white/45">{entry.periodo_preferido}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-black text-white">{entry.cliente_nome}</h3>
                  <p className="mt-1 flex items-center gap-2 text-sm text-white/55"><Phone className="h-4 w-4" />{entry.cliente_telefone}</p>
                  <p className="mt-2 text-sm text-white/45">
                    {entry.data_preferida ? `Data preferida: ${entry.data_preferida}` : 'Sem data preferida'}
                    {entry.barbeiros?.nome ? ` | ${entry.barbeiros.nome}` : ''}
                  </p>
                  {entry.observacao && <p className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-white/55">{entry.observacao}</p>}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button onClick={() => notify(entry)} disabled={busyId === entry.id || entry.status !== 'aguardando'} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D6B47A]/30 bg-[#D6B47A]/10 px-4 text-sm font-black text-[#D6B47A] disabled:opacity-50"><Send className="h-4 w-4" />Avisar</button>
                  <button onClick={() => updateStatus(entry, 'convertido')} disabled={busyId === entry.id} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Converter</button>
                  <button onClick={() => updateStatus(entry, 'cancelado')} disabled={busyId === entry.id} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 px-4 text-sm font-black text-[#ff8a8a] disabled:opacity-50"><XCircle className="h-4 w-4" />Cancelar</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
    </FeatureGate>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><p className="text-3xl font-black text-white">{value}</p><p className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">{label}</p></div>;
}

function Denied() {
  return <div className="rounded-3xl border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 p-8 text-center text-[#ff9a9a]"><AlertCircle className="mx-auto h-10 w-10" /><p className="mt-4 font-black">Seu cargo nao tem permissao para lista de espera.</p></div>;
}
