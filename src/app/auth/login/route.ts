import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const email = body.email?.toLowerCase().trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json({ error: 'Informe e-mail e senha.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      console.error('[auth/login] Credenciais recusadas pelo Supabase Auth:', {
        status: error?.status,
        code: error?.code,
        message: error?.message,
        name: error?.name,
      });
      return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, barbearia_id, barbeiro_id')
      .eq('id', data.user.id)
      .maybeSingle();

    const { data: clientAccount } = await supabase
      .from('cliente_accounts')
      .select('auth_user_id')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();

    return NextResponse.json({
      userId: data.user.id,
      profile: profile ?? null,
      hasClientAccount: Boolean(clientAccount),
    });
  } catch (error) {
    console.error('[auth/login] Falha no login server-side:', error);
    return NextResponse.json({ error: 'Nao foi possivel concluir o login agora.' }, { status: 500 });
  }
}
