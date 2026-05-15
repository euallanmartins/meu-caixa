import { NextResponse } from 'next/server';
import { assertTrustedOrigin } from '@/lib/security/csrf';
import { sendExpoPushToBarbeiro } from '@/lib/server/expoPush';
import { createServiceClient } from '@/lib/supabase/server';

type AppointmentCreatedRequest = {
  agendamento_ids?: string[];
  barbearia_id?: string;
  idempotency_key?: string;
};

type RelationName = { nome?: string | null } | Array<{ nome?: string | null }> | null;

type AppointmentRow = {
  id: string;
  barbearia_id: string;
  barbeiro_id: string | null;
  cliente_id: string | null;
  data_hora_inicio: string;
  status: string | null;
  idempotency_key: string | null;
  clientes?: RelationName;
  servicos?: RelationName;
};

export const dynamic = 'force-dynamic';

function firstName(relation?: RelationName) {
  if (Array.isArray(relation)) return relation[0]?.nome || null;
  return relation?.nome || null;
}

function formatAppointmentDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
  } catch {
    return NextResponse.json({ error: 'Origem nao autorizada.' }, { status: 403 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let body: AppointmentCreatedRequest;
  try {
    body = await request.json() as AppointmentCreatedRequest;
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  const appointmentIds = Array.isArray(body.agendamento_ids)
    ? body.agendamento_ids.filter(Boolean).slice(0, 10)
    : [];

  if (!body.barbearia_id || !body.idempotency_key || appointmentIds.length === 0) {
    return NextResponse.json({ error: 'Dados do agendamento ausentes.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('agendamentos')
    .select('id, barbearia_id, barbeiro_id, cliente_id, data_hora_inicio, status, idempotency_key, clientes(nome), servicos(nome)')
    .in('id', appointmentIds)
    .eq('barbearia_id', body.barbearia_id)
    .eq('idempotency_key', body.idempotency_key);

  if (error) {
    console.error('Erro ao preparar push de novo agendamento', { barbearia_id: body.barbearia_id, code: error.code });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const appointments = (data || []) as AppointmentRow[];
  const pending = appointments.filter((appointment) => appointment.status === 'pendente' && appointment.barbeiro_id);

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const grouped = new Map<string, AppointmentRow[]>();
  pending.forEach((appointment) => {
    const key = `${appointment.barbeiro_id}:${appointment.data_hora_inicio}:${appointment.cliente_id || ''}`;
    grouped.set(key, [...(grouped.get(key) || []), appointment]);
  });

  const results = await Promise.all(Array.from(grouped.values()).map(async (items) => {
    const first = items[0];
    if (!first.barbeiro_id) return { ok: true, skipped: true };

    const servicos = items
      .map((appointment) => firstName(appointment.servicos))
      .filter(Boolean)
      .join(' + ');

    const clienteNome = firstName(first.clientes) || 'Cliente';

    return sendExpoPushToBarbeiro(first.barbearia_id, first.barbeiro_id, {
      title: 'Novo agendamento aguardando confirmacao',
      body: `${clienteNome} quer agendar ${servicos || 'servico'} para ${formatAppointmentDate(first.data_hora_inicio)}.`,
      data: {
        type: 'novo_agendamento_pendente',
        agendamento_id: first.id,
        barbearia_id: first.barbearia_id,
        barbeiro_id: first.barbeiro_id,
        target_url: '/gestao/agenda',
      },
    });
  }));

  return NextResponse.json({ ok: true, results });
}
