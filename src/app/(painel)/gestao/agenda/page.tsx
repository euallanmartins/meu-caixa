import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AgendaClient } from './AgendaClient';

export const dynamic = 'force-dynamic';

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*, barbearias(nome)')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.barbearia_id) {
    redirect('/login?redirectTo=/admin/plataforma');
  }

  return <AgendaClient profile={profile} />;
}
