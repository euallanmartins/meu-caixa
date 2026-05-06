/* eslint-disable */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Clock, Download, UserCheck, UserRoundX, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDashboardData } from '@/hooks/useDashboardData';

const ScheduleView = dynamic(
  () => import('@/components/ScheduleView').then(m => ({ default: m.ScheduleView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#D6B47A] border-t-transparent" />
      </div>
    ),
  }
);

const AIAssistant = dynamic(
  () => import('@/components/AIAssistant').then(m => ({ default: m.AIAssistant })),
  { ssr: false, loading: () => null }
);

export default function AgendaPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const { barbers, stats, refreshData } = useDashboardData(profile?.barbearia_id || null);

  useEffect(() => {
    async function checkUser() {
      try {
        setAuthError(null);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*, barbearias(nome)')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        setProfile(profileData);
      } catch (error) {
        console.error('[AgendaPage] Falha ao validar acesso:', error);
        setAuthError('Nao foi possivel validar seu acesso profissional agora.');
      } finally {
        setLoading(false);
      }
    }

    checkUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#D6B47A] border-t-transparent" />
      </div>
    );
  }

  if (authError) return <ProtectedRouteError message={authError} />;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="hidden items-center justify-between md:flex">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-white">Agenda</h2>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/40">
            Gestao de horarios e profissionais
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-12 xl:items-start">
        <div className="min-w-0 xl:col-span-9">
          <div className="mb-5 xl:hidden">
            <AIAssistant profile={profile} onProcessed={refreshData} />
          </div>

          <ScheduleView
            barbeariaId={profile?.barbearia_id}
            barbers={barbers}
            refreshData={refreshData}
          />
        </div>

        <aside className="hidden flex-col gap-6 xl:col-span-3 xl:flex">
          <AIAssistant profile={profile} onProcessed={refreshData} />

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <h4 className="mb-5 text-[12px] font-black uppercase tracking-[0.22em] text-white/45">
              Resumo equipe
            </h4>
            <div className="divide-y divide-white/8">
              <SideStat icon={Users} label="Online" value={barbers.length} color="text-[#D6B47A]" />
              <SideStat icon={UserCheck} label="Em atendimento" value={stats.inService} color="text-blue-400" />
              <SideStat icon={Clock} label="Pausados" value={0} color="text-yellow-300" />
              <SideStat icon={UserRoundX} label="Ausentes" value={stats.absent} color="text-[#ff4d4d]" />
              <div className="flex items-center justify-between py-4 text-sm">
                <span className="text-white/60">Total de profissionais</span>
                <span className="font-black text-white">{barbers.length}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h4 className="text-[12px] font-black uppercase tracking-[0.22em] text-white/45">Proximos agendamentos</h4>
              <Link href="/gestao/relatorios/lista-agendamentos" className="text-xs font-black text-[#D6B47A] hover:underline">
                Ver todos
              </Link>
            </div>
            <div className="space-y-4">
              {stats.upcomingAppointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/35">
                  Nenhum agendamento restante para hoje.
                </div>
              ) : (
                stats.upcomingAppointments.map((appointment) => {
                  const date = new Date(appointment.data_hora_inicio);
                  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const barber = appointment.barbeiros?.nome || 'Sem profissional';
                  const service = appointment.servicos?.nome || 'Servico';
                  const isPending = appointment.status === 'pendente';

                  return (
                    <div key={appointment.id} className="flex gap-3 border-b border-white/8 pb-4 last:border-0 last:pb-0">
                      <span className={`mt-2 h-2.5 w-2.5 rounded-full ${isPending ? 'bg-yellow-300' : 'bg-[#D6B47A]'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/70">{time} - {barber}</p>
                        <p className="mt-1 truncate font-black text-white">{service}</p>
                        {appointment.clientes?.nome && (
                          <p className="mt-1 truncate text-xs text-white/45">{appointment.clientes.nome}</p>
                        )}
                      </div>
                      <span className={`self-start rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${isPending ? 'bg-yellow-300/12 text-yellow-300' : 'bg-[#D6B47A]/12 text-[#D6B47A]'}`}>
                        {appointment.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Link href="/gestao/relatorios/lista-agendamentos" className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-left transition-all hover:bg-white/[0.07]">
            <Download className="h-6 w-6 text-white/55" />
            <span>
              <span className="block font-black text-white">Exportar agenda</span>
              <span className="text-sm text-white/55">Exportar para PDF ou Excel</span>
            </span>
          </Link>
        </aside>
      </div>
    </div>
  );
}

function ProtectedRouteError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-2">
      <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <h2 className="text-2xl font-black text-white">Acesso indisponivel</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/55">{message}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 h-12 rounded-2xl bg-[#D6B47A] px-6 font-black text-black">
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

function SideStat({ icon: Icon, label, value, color }: any) {
  return (
    <div className="flex items-center justify-between py-4">
      <span className="flex items-center gap-3 text-white/65">
        <Icon className={`h-5 w-5 ${color}`} />
        {label}
      </span>
      <span className={`font-black ${color}`}>{value}</span>
    </div>
  );
}
