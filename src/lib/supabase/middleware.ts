import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_ONLY_ROUTES = [
  '/gestao/caixa',
  '/gestao/relatorios',
  '/gestao/equipe',
  '/gestao/financeiro',
];

const BARBER_ALLOWED_ROUTES = [
  '/gestao',
  '/gestao/agenda',
  '/gestao/meus-ganhos',
  '/gestao/meu-perfil',
];

const PLATFORM_ROLES = new Set(['platform_admin', 'super_admin']);
const PROFESSIONAL_ROLES = new Set(['owner', 'admin', 'proprietario', 'barbeiro', 'funcionario', 'gerente', ...PLATFORM_ROLES]);
const ADMIN_ROLES = new Set(['owner', 'admin', 'proprietario', 'gerente', ...PLATFORM_ROLES]);
const INVITE_REDIRECT_PREFIXES = ['/convite/equipe?token=', '/convite/proprietario?token='];

function isInviteRedirect(value: string | null): value is string {
  return Boolean(value && INVITE_REDIRECT_PREFIXES.some(prefix => value.startsWith(prefix)));
}

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
  const redirectTo = request.nextUrl.searchParams.get('redirectTo');

  async function getAccountAccess(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, barbearia_id, barbeiro_id')
      .eq('id', userId)
      .maybeSingle();

    const role = profile?.role ?? null;
    const barbeariaId = profile?.barbearia_id ?? null;
    const barbeiroId = profile?.barbeiro_id ?? null;
    if (role && PLATFORM_ROLES.has(role)) {
      return { kind: 'platform' as const, role, barbeariaId, barbeiroId };
    }

    if (role && PROFESSIONAL_ROLES.has(role) && barbeariaId) {
      let ownerAccessBlocked = false;
      if (['owner', 'proprietario'].includes(role)) {
        const { data: shop, error: shopError } = await supabase
          .from('barbearias')
          .select('acesso_proprietario_bloqueado')
          .eq('id', barbeariaId)
          .maybeSingle();

        ownerAccessBlocked = !shopError && Boolean(shop?.acesso_proprietario_bloqueado);
      }

      return { kind: 'professional' as const, role, barbeariaId, barbeiroId, ownerAccessBlocked };
    }

    const { data: clientAccount } = await supabase
      .from('cliente_accounts')
      .select('auth_user_id')
      .eq('auth_user_id', userId)
      .maybeSingle();

    return clientAccount ? { kind: 'cliente' as const, role: 'cliente', barbeariaId: null } : null;
  }

  if (!user && pathname.startsWith('/gestao')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (!user && pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith('/admin')) {
    const access = await getAccountAccess(user.id);
    if (access?.kind !== 'platform') {
      const url = request.nextUrl.clone();
      url.pathname = access?.kind === 'professional' ? '/gestao/agenda' : '/cliente';
      return NextResponse.redirect(url);
    }
  }

  if (user && pathname.startsWith('/gestao')) {
    const access = await getAccountAccess(user.id);
    const hasPlatformBarbearia = access?.kind === 'platform' && Boolean(access.barbeariaId);
    if (access?.kind === 'professional' && access.ownerAccessBlocked) {
      const url = request.nextUrl.clone();
      url.pathname = '/cliente';
      url.search = '';
      return NextResponse.redirect(url);
    }

    if (access?.kind !== 'professional' && !hasPlatformBarbearia) {
      const url = request.nextUrl.clone();
      url.pathname = access?.kind === 'platform' ? '/admin/plataforma' : '/cliente';
      return NextResponse.redirect(url);
    }

    if (access?.kind === 'professional' && access.role === 'barbeiro') {
      const url = request.nextUrl.clone();

      if (!access.barbeiroId) {
        url.pathname = '/cliente';
        url.search = '';
        return NextResponse.redirect(url);
      }

      const allowed = BARBER_ALLOWED_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
      if (!allowed) {
        url.pathname = '/gestao/agenda';
        url.search = '';
        return NextResponse.redirect(url);
      }
    }
  }

  if (user && pathname.startsWith('/cliente')) {
    const access = await getAccountAccess(user.id);
    if (access?.kind === 'platform') {
      const url = request.nextUrl.clone();
      url.pathname = access.barbeariaId ? '/gestao/agenda' : '/admin/plataforma';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  if (user && pathname === '/login') {
    if (isInviteRedirect(redirectTo)) {
      const inviteUrl = request.nextUrl.clone();
      inviteUrl.pathname = redirectTo.split('?')[0];
      inviteUrl.search = `?${redirectTo.split('?')[1] ?? ''}`;
      return NextResponse.redirect(inviteUrl);
    }

    const access = await getAccountAccess(user.id);
    const url = request.nextUrl.clone();

    if (access?.kind === 'platform') {
      url.pathname = access.barbeariaId ? '/gestao/agenda' : '/admin/plataforma';
      return NextResponse.redirect(url);
    }

    if (access?.kind === 'professional' && access.ownerAccessBlocked) {
      url.pathname = '/cliente';
      return NextResponse.redirect(url);
    }

    if (access?.kind !== 'professional') {
      url.pathname = '/cliente';
      return NextResponse.redirect(url);
    }

    url.pathname = ADMIN_ROLES.has(access.role) ? '/gestao/caixa' : '/gestao/agenda';
    return NextResponse.redirect(url);
  }

  if (user && ADMIN_ONLY_ROUTES.some(route => pathname.startsWith(route))) {
    const access = await getAccountAccess(user.id);

    const isAllowedPlatform = access?.kind === 'platform' && Boolean(access.barbeariaId);
    if (!isAllowedPlatform && (access?.kind !== 'professional' || access.ownerAccessBlocked || !ADMIN_ROLES.has(access.role))) {
      const url = request.nextUrl.clone();
      url.pathname = '/gestao/agenda';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
