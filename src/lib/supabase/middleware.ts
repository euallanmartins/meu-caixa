import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_ONLY_ROUTES = [
  '/gestao/caixa',
  '/gestao/relatorios',
  '/gestao/equipe',
  '/gestao/financeiro',
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  async function getAccountRole(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.role) return profile.role;

    const { data: clientAccount } = await supabase
      .from('cliente_accounts')
      .select('auth_user_id')
      .eq('auth_user_id', userId)
      .maybeSingle();

    return clientAccount ? 'cliente' : null;
  }

  if (!user && pathname.startsWith('/gestao')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith('/gestao')) {
    const role = await getAccountRole(user.id);
    if (role === 'cliente' || !role) {
      const url = request.nextUrl.clone();
      url.pathname = '/cliente';
      return NextResponse.redirect(url);
    }
  }

  if (user && pathname === '/login') {
    const role = await getAccountRole(user.id);
    const url = request.nextUrl.clone();

    if (role === 'cliente') {
      url.pathname = '/cliente';
      return NextResponse.redirect(url);
    }

    url.pathname = role === 'admin' ? '/gestao/caixa' : '/gestao/agenda';
    return NextResponse.redirect(url);
  }

  if (user && ADMIN_ONLY_ROUTES.some(route => pathname.startsWith(route))) {
    const role = await getAccountRole(user.id) ?? 'barbeiro';

    if (role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/gestao/agenda';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
