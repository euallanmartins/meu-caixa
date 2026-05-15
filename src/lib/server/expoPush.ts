import 'server-only';

import { canUseFeature } from '@/lib/features/canUseFeature';
import { createServiceClient } from '@/lib/supabase/server';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const INVALID_TOKEN_ERRORS = new Set(['DeviceNotRegistered']);

type PushData = Record<string, string | number | boolean | null | undefined>;

export type ExpoPushPayload = {
  title: string;
  body: string;
  data?: PushData;
};

type PushTokenTarget = {
  id?: string;
  expo_push_token: string;
};

type SendExpoPushNotificationParams = ExpoPushPayload & {
  tokens: Array<string | PushTokenTarget>;
};

type ExpoTicket = {
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

type ExpoPushResponse = {
  data?: ExpoTicket[];
  errors?: unknown[];
};

function isExpoPushToken(token: string) {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token);
}

function normalizeTargets(tokens: Array<string | PushTokenTarget>) {
  const seen = new Set<string>();
  return tokens
    .map((target) => (typeof target === 'string' ? { expo_push_token: target } : target))
    .filter((target) => {
      const token = target.expo_push_token;
      if (!token || seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}

function normalizeData(data?: PushData) {
  if (!data) return {};
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );
}

async function deactivateInvalidTokens(targets: PushTokenTarget[], invalidIndexes: number[]) {
  if (invalidIndexes.length === 0) return;

  const ids = invalidIndexes
    .map((index) => targets[index]?.id)
    .filter((id): id is string => Boolean(id));

  const tokenValues = invalidIndexes
    .map((index) => targets[index]?.expo_push_token)
    .filter(Boolean);

  const supabase = createServiceClient();
  if (!supabase) return;

  try {
    if (ids.length > 0) {
      await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .in('id', ids);
      return;
    }

    if (tokenValues.length > 0) {
      await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .in('expo_push_token', tokenValues);
    }
  } catch (error) {
    console.warn('Expo push invalid token cleanup failed', {
      token_count: tokenValues.length,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function sendExpoPushNotification({
  tokens,
  title,
  body,
  data,
}: SendExpoPushNotificationParams) {
  const targets = normalizeTargets(tokens);
  const invalidLocalIndexes: number[] = [];
  const validTargets = targets.filter((target, index) => {
    const isValid = isExpoPushToken(target.expo_push_token);
    if (!isValid) invalidLocalIndexes.push(index);
    return isValid;
  });

  await deactivateInvalidTokens(targets, invalidLocalIndexes);

  if (validTargets.length === 0) {
    return { ok: true, sent: 0, skipped: true };
  }

  try {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validTargets.map((target) => ({
        to: target.expo_push_token,
        title,
        body,
        data: normalizeData(data),
        sound: 'default',
      }))),
    });

    if (!response.ok) {
      console.warn('Expo push request failed', { status: response.status });
      return { ok: false, sent: 0, status: response.status };
    }

    const payload = await response.json() as ExpoPushResponse;
    const tickets = Array.isArray(payload.data) ? payload.data : [];
    const invalidRemoteIndexes = tickets
      .map((ticket, index) => (
        ticket.status === 'error' && INVALID_TOKEN_ERRORS.has(ticket.details?.error || '')
          ? index
          : -1
      ))
      .filter((index) => index >= 0);

    await deactivateInvalidTokens(validTargets, invalidRemoteIndexes);

    const sent = tickets.filter((ticket) => ticket.status === 'ok').length;
    const failed = tickets.filter((ticket) => ticket.status === 'error').length;

    if (failed > 0) {
      console.warn('Expo push returned errors', { failed, sent });
    }

    return { ok: failed === 0, sent, failed };
  } catch (error) {
    console.warn('Expo push request error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return { ok: false, sent: 0 };
  }
}

export async function sendExpoPushToUser(userId: string, payload: ExpoPushPayload) {
  const supabase = createServiceClient();
  if (!supabase) return { ok: true, skipped: true };

  const { data, error } = await supabase
    .from('push_tokens')
    .select('id, expo_push_token')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.warn('Expo push user token lookup failed', { user_id: userId, code: error.code });
    return { ok: false, sent: 0 };
  }

  return sendExpoPushNotification({ ...payload, tokens: data || [] });
}

export async function sendExpoPushToBarbeiro(
  barbeariaId: string,
  barbeiroId: string,
  payload: ExpoPushPayload,
) {
  if (!(await canUseFeature(barbeariaId, 'push_notifications'))) {
    return { ok: true, sent: 0, skipped: true, reason: 'feature_locked' };
  }

  const supabase = createServiceClient();
  if (!supabase) return { ok: true, skipped: true };

  const { data: scopedTokens, error: scopedError } = await supabase
    .from('push_tokens')
    .select('id, expo_push_token')
    .eq('barbearia_id', barbeariaId)
    .eq('barbeiro_id', barbeiroId)
    .eq('is_active', true);

  if (scopedError) {
    console.warn('Expo push barber token lookup failed', {
      barbearia_id: barbeariaId,
      barbeiro_id: barbeiroId,
      code: scopedError.code,
    });
    return { ok: false, sent: 0 };
  }

  if ((scopedTokens || []).length > 0) {
    return sendExpoPushNotification({ ...payload, tokens: scopedTokens || [] });
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('barbearia_id', barbeariaId)
    .eq('barbeiro_id', barbeiroId)
    .eq('role', 'barbeiro');

  if (profileError || !profiles?.length) {
    if (profileError) {
      console.warn('Expo push barber profile lookup failed', {
        barbearia_id: barbeariaId,
        barbeiro_id: barbeiroId,
        code: profileError.code,
      });
    }
    return { ok: true, sent: 0, skipped: true };
  }

  const userIds = profiles.map((profile) => profile.id);
  const { data: userTokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('id, expo_push_token')
    .in('user_id', userIds)
    .eq('is_active', true);

  if (tokenError) {
    console.warn('Expo push fallback token lookup failed', {
      barbearia_id: barbeariaId,
      barbeiro_id: barbeiroId,
      code: tokenError.code,
    });
    return { ok: false, sent: 0 };
  }

  return sendExpoPushNotification({ ...payload, tokens: userTokens || [] });
}

export async function sendExpoPushToCliente(
  params: { clienteId?: string | null; userId?: string | null; barbeariaId?: string | null },
  payload: ExpoPushPayload,
) {
  const supabase = createServiceClient();
  if (!supabase) return { ok: true, skipped: true };

  if (params.userId) {
    return sendExpoPushToUser(params.userId, payload);
  }

  if (!params.clienteId) {
    return { ok: true, sent: 0, skipped: true };
  }

  if (params.barbeariaId && !(await canUseFeature(params.barbeariaId, 'push_notifications'))) {
    return { ok: true, sent: 0, skipped: true, reason: 'feature_locked' };
  }

  let query = supabase
    .from('cliente_accounts')
    .select('auth_user_id')
    .eq('cliente_id', params.clienteId);

  if (params.barbeariaId) {
    query = query.eq('barbearia_id', params.barbeariaId);
  }

  const { data: accounts, error: accountError } = await query;

  if (accountError || !accounts?.length) {
    if (accountError) {
      console.warn('Expo push client account lookup failed', {
        cliente_id: params.clienteId,
        barbearia_id: params.barbeariaId,
        code: accountError.code,
      });
    }
    return { ok: true, sent: 0, skipped: true };
  }

  const userIds = accounts.map((account) => account.auth_user_id);
  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('id, expo_push_token')
    .in('user_id', userIds)
    .eq('is_active', true);

  if (tokenError) {
    console.warn('Expo push client token lookup failed', {
      cliente_id: params.clienteId,
      barbearia_id: params.barbeariaId,
      code: tokenError.code,
    });
    return { ok: false, sent: 0 };
  }

  return sendExpoPushNotification({ ...payload, tokens: tokens || [] });
}
