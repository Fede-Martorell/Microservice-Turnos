begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_valid_timezone(value text)
returns boolean language sql stable set search_path = ''
as $$ select exists (select 1 from pg_catalog.pg_timezone_names where name = value); $$;
revoke all on function private.is_valid_timezone(text) from public;
grant execute on function private.is_valid_timezone(text) to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 2 and 100),
  slug text not null unique check (
    char_length(slug) between 3 and 63 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and slug not in ('admin','api','auth','b','ingresar','panel','proyecto','registro','www')
  ),
  description text not null default '' check (char_length(description) <= 2000),
  logo_url text,
  primary_color text not null default '#34553e' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text not null default '#eaf0e6' check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  timezone text not null default 'America/Argentina/Buenos_Aires' check (private.is_valid_timezone(timezone)),
  currency text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_access_idx on public.organization_members(user_id, organization_id) where is_active;
create index organizations_creator_created_idx on public.organizations(created_by, created_at);

create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id),
  locale text not null default 'es-AR' check (locale in ('es-AR','es','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid references auth.users(id),
  event text not null check (event in ('organization.created','organization.updated','organization.settings_updated')),
  created_at timestamptz not null default now()
);
create index audit_logs_organization_created_idx on public.audit_logs(organization_id, created_at desc);

-- Evita recursión RLS en membresías. No confía en user_metadata ni en claims de rol.
create function private.organization_role(target_organization uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select member.role from public.organization_members member
  join public.organizations organization on organization.id = member.organization_id
  where member.organization_id = target_organization
    and member.user_id = (select auth.uid()) and member.is_active and organization.status = 'active';
$$;
revoke all on function private.organization_role(uuid) from public;
grant execute on function private.organization_role(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_settings enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.organizations, public.organization_members, public.organization_settings, public.audit_logs from anon, authenticated;
grant select on public.organizations, public.organization_members, public.organization_settings, public.audit_logs to authenticated;
grant update (name, description, timezone, currency) on public.organizations to authenticated;
grant update (locale) on public.organization_settings to authenticated;

create policy organizations_read on public.organizations for select to authenticated
  using (private.organization_role(id) is not null);
create policy organizations_update on public.organizations for update to authenticated
  using (private.organization_role(id) = 'owner') with check (private.organization_role(id) = 'owner');
create policy members_read on public.organization_members for select to authenticated
  using (private.organization_role(organization_id) = 'owner' or (user_id = (select auth.uid()) and is_active and private.organization_role(organization_id) is not null));
create policy settings_read on public.organization_settings for select to authenticated
  using (private.organization_role(organization_id) is not null);
create policy settings_update on public.organization_settings for update to authenticated
  using (private.organization_role(organization_id) = 'owner') with check (private.organization_role(organization_id) = 'owner');
create policy audit_read on public.audit_logs for select to authenticated
  using (private.organization_role(organization_id) = 'owner');

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function private.touch_updated_at() from public;
create trigger organizations_touch before update on public.organizations for each row execute function private.touch_updated_at();
create trigger settings_touch before update on public.organization_settings for each row execute function private.touch_updated_at();

create function private.audit_organization_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if tg_table_name = 'organizations' then target := new.id; else target := new.organization_id; end if;
  insert into public.audit_logs(organization_id, actor_id, event)
  values (target,
    auth.uid(), case when tg_table_name = 'organizations' then 'organization.updated' else 'organization.settings_updated' end);
  return new;
end;
$$;
revoke all on function private.audit_organization_update() from public;
create trigger organizations_audit after update on public.organizations for each row execute function private.audit_organization_update();
create trigger settings_audit after update on public.organization_settings for each row execute function private.audit_organization_update();

-- Único punto de creación: organización + propietario + settings + auditoría en la misma transacción.
create function public.create_organization(p_name text, p_slug text, p_description text, p_timezone text, p_currency text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  organization_id uuid;
begin
  if actor is null or not exists (select 1 from auth.users where id = actor and email_confirmed_at is not null and not coalesce(is_anonymous, false)) then
    raise exception 'A confirmed account is required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text, 0));
  if (select count(*) from public.organizations where created_by = actor and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Organization creation limit reached' using errcode = 'P0001';
  end if;
  insert into public.organizations(name, slug, description, timezone, currency, created_by)
  values (btrim(p_name), p_slug, btrim(p_description), p_timezone, p_currency, actor)
  returning id into organization_id;
  insert into public.organization_members(organization_id, user_id, role) values (organization_id, actor, 'owner');
  insert into public.organization_settings(organization_id) values (organization_id);
  insert into public.audit_logs(organization_id, actor_id, event) values (organization_id, actor, 'organization.created');
  return organization_id;
end;
$$;
revoke all on function public.create_organization(text,text,text,text,text) from public, anon;
grant execute on function public.create_organization(text,text,text,text,text) to authenticated;

commit;
