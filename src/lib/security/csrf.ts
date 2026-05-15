import 'server-only';

export function assertTrustedOrigin(request: Request) {
  const expected = process.env.NEXT_PUBLIC_APP_URL;
  const requestOrigin = new URL(request.url).origin;
  const allowedOrigins = new Set([requestOrigin]);

  if (expected) {
    try {
      allowedOrigins.add(new URL(expected).origin);
    } catch {
      throw new Error('NEXT_PUBLIC_APP_URL invalida.');
    }
  }

  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) {
    throw new Error('Origem da requisicao nao autorizada.');
  }

  const referer = request.headers.get('referer');
  if (!origin && referer) {
    const refererOrigin = new URL(referer).origin;
    if (!allowedOrigins.has(refererOrigin)) {
      throw new Error('Referer da requisicao nao autorizado.');
    }
  }
}
