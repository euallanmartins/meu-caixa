import 'server-only';

type CaptchaProvider = 'turnstile' | 'recaptcha' | 'disabled';

type CaptchaResult = {
  ok: boolean;
  provider: CaptchaProvider;
  reason?: string;
};

export async function verifyBotToken(token: string | null | undefined, remoteIp?: string): Promise<CaptchaResult> {
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;

  if (!turnstileSecret && !recaptchaSecret) {
    return { ok: true, provider: 'disabled', reason: 'captcha_not_configured' };
  }

  if (!token) return { ok: false, provider: turnstileSecret ? 'turnstile' : 'recaptcha', reason: 'missing_token' };

  if (turnstileSecret) {
    const form = new FormData();
    form.set('secret', turnstileSecret);
    form.set('response', token);
    if (remoteIp) form.set('remoteip', remoteIp);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const result = await response.json() as { success?: boolean; 'error-codes'?: string[] };
    return {
      ok: Boolean(result.success),
      provider: 'turnstile',
      reason: result.success ? undefined : result['error-codes']?.join(',') || 'verification_failed',
    };
  }

  const form = new URLSearchParams();
  form.set('secret', recaptchaSecret as string);
  form.set('response', token);
  if (remoteIp) form.set('remoteip', remoteIp);

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body: form,
  });
  const result = await response.json() as { success?: boolean; score?: number; 'error-codes'?: string[] };
  const ok = Boolean(result.success) && (typeof result.score !== 'number' || result.score >= 0.5);

  return {
    ok,
    provider: 'recaptcha',
    reason: ok ? undefined : result['error-codes']?.join(',') || 'low_score_or_failed',
  };
}
