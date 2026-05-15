export type RegisterPushTokenInput = {
  expoPushToken: string;
  deviceId?: string | null;
  platform?: string | null;
  barbeariaId?: string | null;
  barbeiroId?: string | null;
  clienteId?: string | null;
};

export async function registerPushToken({
  expoPushToken,
  deviceId = null,
  platform = null,
  barbeariaId = null,
  barbeiroId = null,
  clienteId = null,
}: RegisterPushTokenInput) {
  const response = await fetch('/api/push/register-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      expo_push_token: expoPushToken,
      device_id: deviceId,
      platform,
      barbearia_id: barbeariaId,
      barbeiro_id: barbeiroId,
      cliente_id: clienteId,
    }),
  });

  const payload = await response.json().catch(() => null) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error || 'Nao foi possivel ativar notificacoes.');
  }

  return payload;
}

export async function removePushToken(input: { expoPushToken?: string; deviceId?: string | null }) {
  const response = await fetch('/api/push/register-token', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      expo_push_token: input.expoPushToken,
      device_id: input.deviceId || null,
    }),
  });

  const payload = await response.json().catch(() => null) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error || 'Nao foi possivel desativar notificacoes.');
  }

  return payload;
}
