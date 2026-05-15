const RELATIVE_URL_PATTERN = /^\/(?!\/)/;

type SafeUrlOptions = {
  allowBlob?: boolean;
  allowDataImage?: boolean;
  allowRelative?: boolean;
  fallback?: string;
};

function isSupabaseHost(hostname: string) {
  return hostname === 'supabase.co' || hostname.endsWith('.supabase.co');
}

export function safeImageUrl(value: string | null | undefined, options: SafeUrlOptions = {}) {
  const { allowBlob = true, allowDataImage = false, allowRelative = true, fallback = '' } = options;
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return fallback;

  if (allowRelative && RELATIVE_URL_PATTERN.test(raw)) return raw;

  try {
    const parsed = new URL(raw);

    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString();
    if (allowBlob && parsed.protocol === 'blob:') return parsed.toString();
    if (allowDataImage && parsed.protocol === 'data:' && /^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(raw)) {
      return raw;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function safeSupabaseImageUrl(value: string | null | undefined, fallback = '') {
  const raw = safeImageUrl(value, { allowBlob: false, allowDataImage: false, fallback });
  if (!raw || RELATIVE_URL_PATTERN.test(raw)) return raw || fallback;

  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' && isSupabaseHost(parsed.hostname) ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}

export function safeExternalHref(value: string | null | undefined) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}
