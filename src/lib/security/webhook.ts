import 'server-only';

export function getN8nAuthorizationHeaders() {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) throw new Error('N8N_WEBHOOK_SECRET nao configurado.');
  return { Authorization: `Bearer ${secret}` };
}

export function assertWebhookBearer(request: Request) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) throw new Error('N8N_WEBHOOK_SECRET nao configurado.');

  const authorization = request.headers.get('authorization') || '';
  if (authorization !== `Bearer ${secret}`) {
    throw new Error('Webhook nao autorizado.');
  }
}

type AppointmentWebhookPayload = {
  agendamento_id: string;
  barbearia_id: string;
  cliente_id?: string | null;
  telefone?: string | null;
  servico?: string | null;
  profissional?: string | null;
  data_hora?: string | null;
  status?: string | null;
};

export async function notifyN8nEvent(eventName: string, payload: Record<string, unknown>) {
  const url = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;

  if (!url || !secret) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('n8n webhook skipped: envs ausentes', { eventName });
    }
    return { skipped: true, ok: true };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        event: eventName,
        payload,
      }),
    });

    if (!response.ok) {
      console.warn('n8n webhook failed', { eventName, status: response.status });
      return { skipped: false, ok: false, status: response.status };
    }

    return { skipped: false, ok: true, status: response.status };
  } catch {
    console.warn('n8n webhook request failed', { eventName });
    return { skipped: false, ok: false };
  }
}

export async function notifyN8nAppointment(payload: AppointmentWebhookPayload) {
  return notifyN8nEvent('appointment_created', payload);
}
