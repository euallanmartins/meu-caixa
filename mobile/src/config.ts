import Constants from 'expo-constants';

const DEFAULT_WEB_URL = 'https://meu-caixa-indol.vercel.app';

function normalizeUrl(value?: string | null) {
  const trimmed = value?.trim().replace(/\/$/, '');
  return trimmed || DEFAULT_WEB_URL;
}

export const WEB_URL = normalizeUrl(
  process.env.EXPO_PUBLIC_WEB_URL ||
  (Constants.expoConfig?.extra?.webUrl as string | undefined),
);

export const ALLOWED_HOST =
  (Constants.expoConfig?.extra?.allowedHost as string | undefined) ||
  new URL(WEB_URL).host;

export const APP_USER_AGENT = 'MeuCaixaMobile/1.0';
