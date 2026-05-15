const DEFAULT_PUBLIC_APP_URL = 'https://meu-caixa-indol.vercel.app';

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function isLocalOrigin(value: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(value);
}

export function getPublicAppUrl() {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (envUrl?.trim()) {
    return normalizeBaseUrl(envUrl);
  }

  if (typeof window !== 'undefined' && window.location.origin && !isLocalOrigin(window.location.origin)) {
    return normalizeBaseUrl(window.location.origin);
  }

  return DEFAULT_PUBLIC_APP_URL;
}

export function buildPublicUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getPublicAppUrl()}${normalizedPath}`;
}
