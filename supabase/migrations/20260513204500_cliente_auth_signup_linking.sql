-- Ensure public client Auth signups are always linked to a CRM client record.
-- Professional profiles/barbearias are still never created from public signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_barbearia_id uuid;
  v_cliente_id uuid;
  v_email text := lower(trim(coalesce(new.email, '')));
  v_nome text := nullif(trim(coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1)
  )), '');
  v_telefone text := trim(coalesce(new.raw_user_meta_data->>'telefone', ''));
begin
  if new.raw_user_meta_data->>'account_type' = 'cliente' then
    v_barbearia_id := nullif(new.raw_user_meta_data->>'barbearia_id', '')::uuid;
    v_cliente_id := nullif(new.raw_user_meta_data->>'cliente_id', '')::uuid;

    if v_barbearia_id is null then
      return new;
    end if;

    if v_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
      raise exception 'E-mail invalido para criar conta de cliente.';
    end if;

    if v_cliente_id is not null then
      if not exists (
        select 1
        from public.clientes c
        where c.id = v_cliente_id
          and c.barbearia_id = v_barbearia_id
          and lower(c.email) = v_email
      ) then
        raise exception 'Dados de cliente invalidos para criar conta.';
      end if;
    else
      select c.id
        into v_cliente_id
      from public.clientes c
      where c.barbearia_id = v_barbearia_id
        and lower(c.email) = v_email
      order by c.created_at desc nulls last, c.id
      limit 1;

      if v_cliente_id is null then
        insert into public.clientes (barbearia_id, nome, email, telefone)
        values (v_barbearia_id, coalesce(v_nome, split_part(v_email, '@', 1), 'Cliente'), v_email, v_telefone)
        returning id into v_cliente_id;
      else
        update public.clientes
        set nome = coalesce(nullif(v_nome, ''), nome),
            telefone = case when v_telefone <> '' then v_telefone else telefone end
        where id = v_cliente_id
          and barbearia_id = v_barbearia_id;
      end if;
    end if;

    insert into public.cliente_accounts (auth_user_id, cliente_id, barbearia_id)
    values (new.id, v_cliente_id, v_barbearia_id)
    on conflict (auth_user_id, barbearia_id) do update
    set cliente_id = excluded.cliente_id;

    return new;
  end if;

  -- Never create barbearias/professional profiles from public signup metadata.
  -- Owner/admin/barber/employee accounts must be provisioned by trusted invite/admin flows.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
