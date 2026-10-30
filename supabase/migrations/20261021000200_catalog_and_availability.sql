begin;

alter table public.audit_logs drop constraint audit_logs_event_check;
alter table public.audit_logs add constraint audit_logs_event_check check (event in (
  'organization.created','organization.updated','organization.settings_updated',
  'service.saved','professional.saved','availability.saved','availability.removed',
  'exception.saved','exception.removed','invitation.created','invitation.accepted','invitation.revoked','staff_access.updated'
));

create table public.services (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  name text not null check (name=btrim(name) and char_length(name) between 2 and 100),
  description text not null default '' check (char_length(description)<=2000),
  category text not null default '' check (char_length(category)<=100),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  preparation_minutes integer not null default 0 check (preparation_minutes between 0 and 120),
  price_minor integer not null check (price_minor between 0 and 1000000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  image_url text check (image_url is null or (char_length(image_url)<=2048 and image_url ~ '^https://')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,id)
);
create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  user_id uuid, name text not null check (name=btrim(name) and char_length(name) between 2 and 100),
  description text not null default '' check (char_length(description)<=2000),
  photo_url text check (photo_url is null or (char_length(photo_url)<=2048 and photo_url ~ '^https://')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,id), unique (organization_id,user_id),
  foreign key (organization_id,user_id) references public.organization_members(organization_id,user_id)
);
create table public.staff_services (
  organization_id uuid not null, staff_id uuid not null, service_id uuid not null,
  primary key (organization_id,staff_id,service_id),
  foreign key (organization_id,staff_id) references public.staff_profiles(organization_id,id),
  foreign key (organization_id,service_id) references public.services(organization_id,id)
);
create index staff_services_by_service_idx on public.staff_services(organization_id,service_id,staff_id);
create index staff_profiles_by_user_idx on public.staff_profiles(user_id,organization_id) where user_id is not null;
create index services_catalog_idx on public.services(organization_id,is_active,name);
create index staff_profiles_catalog_idx on public.staff_profiles(organization_id,is_active,name);

-- Intervalos locales, sin cruzar medianoche. staff_id NULL aplica al negocio.
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), staff_id uuid,
  weekday integer not null check (weekday between 0 and 6),
  kind text not null check (kind in ('working','break')),
  start_minute integer not null check (start_minute between 0 and 1439),
  end_minute integer not null check (end_minute between 1 and 1440),
  check (start_minute<end_minute),
  foreign key (organization_id,staff_id) references public.staff_profiles(organization_id,id),
  created_at timestamptz not null default now()
);
create index availability_rules_scope_idx on public.availability_rules(organization_id,staff_id,weekday);
create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), staff_id uuid,
  starts_on date not null, ends_on date not null, check (ends_on>=starts_on and ends_on-starts_on<=366),
  start_minute integer, end_minute integer,
  check ((start_minute is null and end_minute is null) or (start_minute is not null and end_minute is not null and start_minute>=0 and end_minute<=1440 and start_minute<end_minute)),
  kind text not null check (kind in ('blocked','vacation','holiday')),
  reason text not null default '' check (char_length(reason)<=500),
  foreign key (organization_id,staff_id) references public.staff_profiles(organization_id,id),
  created_at timestamptz not null default now()
);
create index availability_exceptions_scope_idx on public.availability_exceptions(organization_id,staff_id,starts_on,ends_on);

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), staff_id uuid not null,
  email text not null check (email=lower(btrim(email)) and char_length(email)<=254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  token_hash text not null unique, invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null, accepted_at timestamptz, revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id,staff_id) references public.staff_profiles(organization_id,id)
);
create unique index organization_invites_pending_idx on public.organization_invites(organization_id,staff_id) where accepted_at is null and revoked_at is null;
create index organization_invites_limit_idx on public.organization_invites(organization_id,created_at);

create function private.require_owner(target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if private.organization_role(target) is distinct from 'owner' then raise exception 'Forbidden' using errcode='42501'; end if;
  perform 1 from public.organizations where id=target for update;
  if private.organization_role(target) is distinct from 'owner' then raise exception 'Forbidden' using errcode='42501'; end if;
end; $$;
revoke all on function private.require_owner(uuid) from public;

create function private.owns_staff(target_org uuid,target_staff uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.organization_role(target_org) is not null and exists(select 1 from public.staff_profiles where organization_id=target_org and id=target_staff and user_id=(select auth.uid()) and is_active);
$$;
revoke all on function private.owns_staff(uuid,uuid) from public;
grant execute on function private.owns_staff(uuid,uuid) to authenticated;

alter table public.services enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_services enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.organization_invites enable row level security;
revoke all on public.services,public.staff_profiles,public.staff_services,public.availability_rules,public.availability_exceptions,public.organization_invites from anon,authenticated;
grant select on public.services,public.staff_profiles,public.staff_services,public.availability_rules,public.availability_exceptions to authenticated;
grant select(id,organization_id,staff_id,email,invited_by,expires_at,accepted_at,revoked_at,created_at) on public.organization_invites to authenticated;
create policy services_read on public.services for select to authenticated using(private.organization_role(organization_id) is not null);
create policy staff_read on public.staff_profiles for select to authenticated using(private.organization_role(organization_id)='owner' or private.owns_staff(organization_id,id));
create policy staff_services_read on public.staff_services for select to authenticated using(private.organization_role(organization_id)='owner' or private.owns_staff(organization_id,staff_id));
create policy availability_read on public.availability_rules for select to authenticated using(private.organization_role(organization_id)='owner' or (private.organization_role(organization_id) is not null and (staff_id is null or private.owns_staff(organization_id,staff_id))));
create policy exceptions_read on public.availability_exceptions for select to authenticated using(private.organization_role(organization_id)='owner' or (private.organization_role(organization_id) is not null and (staff_id is null or private.owns_staff(organization_id,staff_id))));
create policy invites_read on public.organization_invites for select to authenticated using(private.organization_role(organization_id)='owner');
create trigger services_touch before update on public.services for each row execute function private.touch_updated_at();
create trigger staff_touch before update on public.staff_profiles for each row execute function private.touch_updated_at();

create function public.save_service(p_organization_id uuid,p_id uuid,p_data jsonb,p_staff_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; target uuid;
begin
  perform private.require_owner(p_organization_id);
  if p_data is null or p_staff_ids is null or cardinality(p_staff_ids)>200 then raise exception 'Invalid input' using errcode='22023'; end if;
  foreach target in array p_staff_ids loop
    if not exists(select 1 from public.staff_profiles where organization_id=p_organization_id and id=target) then raise exception 'Invalid professional' using errcode='23503'; end if;
  end loop;
  if p_id is null then
    insert into public.services(organization_id,name,description,category,duration_minutes,preparation_minutes,price_minor,currency,image_url,is_active)
    values(p_organization_id,btrim(p_data->>'name'),p_data->>'description',p_data->>'category',(p_data->>'duration_minutes')::integer,(p_data->>'preparation_minutes')::integer,(p_data->>'price_minor')::integer,p_data->>'currency',nullif(p_data->>'image_url',''),(p_data->>'is_active')::boolean) returning id into result;
  else
    update public.services set name=btrim(p_data->>'name'),description=p_data->>'description',category=p_data->>'category',duration_minutes=(p_data->>'duration_minutes')::integer,preparation_minutes=(p_data->>'preparation_minutes')::integer,price_minor=(p_data->>'price_minor')::integer,currency=p_data->>'currency',image_url=nullif(p_data->>'image_url',''),is_active=(p_data->>'is_active')::boolean where organization_id=p_organization_id and id=p_id returning id into result;
    if result is null then raise exception 'Not found' using errcode='P0002'; end if;
  end if;
  delete from public.staff_services where organization_id=p_organization_id and service_id=result;
  insert into public.staff_services(organization_id,staff_id,service_id) select p_organization_id,value,result from (select distinct unnest(p_staff_ids) value) ids;
  insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'service.saved');
  return result;
end; $$;

create function public.save_professional(p_organization_id uuid,p_id uuid,p_data jsonb,p_service_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; target uuid; account uuid := nullif(p_data->>'user_id','')::uuid;
begin
  perform private.require_owner(p_organization_id);
  if p_data is null or p_service_ids is null or cardinality(p_service_ids)>200 then raise exception 'Invalid input' using errcode='22023'; end if;
  if account is not null and not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=account and (is_active or exists(select 1 from public.staff_profiles where organization_id=p_organization_id and id=p_id and user_id=account))) then raise exception 'Invalid membership' using errcode='23503'; end if;
  foreach target in array p_service_ids loop
    if not exists(select 1 from public.services where organization_id=p_organization_id and id=target) then raise exception 'Invalid service' using errcode='23503'; end if;
  end loop;
  if p_id is null then
    insert into public.staff_profiles(organization_id,user_id,name,description,photo_url,is_active) values(p_organization_id,account,btrim(p_data->>'name'),p_data->>'description',nullif(p_data->>'photo_url',''),(p_data->>'is_active')::boolean) returning id into result;
  else
    update public.staff_profiles set user_id=account,name=btrim(p_data->>'name'),description=p_data->>'description',photo_url=nullif(p_data->>'photo_url',''),is_active=(p_data->>'is_active')::boolean where organization_id=p_organization_id and id=p_id returning id into result;
    if result is null then raise exception 'Not found' using errcode='P0002'; end if;
  end if;
  delete from public.staff_services where organization_id=p_organization_id and staff_id=result;
  insert into public.staff_services(organization_id,staff_id,service_id) select p_organization_id,result,value from(select distinct unnest(p_service_ids) value) ids;
  insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'professional.saved');
  return result;
end; $$;

create function public.save_availability_rule(p_organization_id uuid,p_id uuid,p_staff_id uuid,p_weekday integer,p_kind text,p_start_minute integer,p_end_minute integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform private.require_owner(p_organization_id);
  if exists(select 1 from public.availability_rules where organization_id=p_organization_id and staff_id is not distinct from p_staff_id and weekday=p_weekday and kind=p_kind and (p_id is null or id<>p_id) and start_minute<p_end_minute and end_minute>p_start_minute) then raise exception 'Overlapping rule' using errcode='23P01'; end if;
  if p_id is null then
    insert into public.availability_rules(organization_id,staff_id,weekday,kind,start_minute,end_minute) values(p_organization_id,p_staff_id,p_weekday,p_kind,p_start_minute,p_end_minute) returning id into result;
  else
    update public.availability_rules set weekday=p_weekday,kind=p_kind,start_minute=p_start_minute,end_minute=p_end_minute where organization_id=p_organization_id and id=p_id and staff_id is not distinct from p_staff_id returning id into result;
    if result is null then raise exception 'Not found' using errcode='P0002'; end if;
  end if;
  insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'availability.saved');
  return result;
end; $$;

create function public.save_availability_exception(p_organization_id uuid,p_id uuid,p_staff_id uuid,p_starts_on date,p_ends_on date,p_start_minute integer,p_end_minute integer,p_kind text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform private.require_owner(p_organization_id);
  if p_id is null then
    insert into public.availability_exceptions(organization_id,staff_id,starts_on,ends_on,start_minute,end_minute,kind,reason) values(p_organization_id,p_staff_id,p_starts_on,p_ends_on,p_start_minute,p_end_minute,p_kind,p_reason) returning id into result;
  else
    update public.availability_exceptions set starts_on=p_starts_on,ends_on=p_ends_on,start_minute=p_start_minute,end_minute=p_end_minute,kind=p_kind,reason=p_reason where organization_id=p_organization_id and id=p_id and staff_id is not distinct from p_staff_id returning id into result;
    if result is null then raise exception 'Not found' using errcode='P0002'; end if;
  end if;
  insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'exception.saved');
  return result;
end; $$;

create function public.remove_availability_entry(p_organization_id uuid,p_id uuid,p_kind text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_owner(p_organization_id);
  if p_kind='rule' then delete from public.availability_rules where organization_id=p_organization_id and id=p_id;
  elsif p_kind='exception' then delete from public.availability_exceptions where organization_id=p_organization_id and id=p_id;
  else raise exception 'Invalid kind' using errcode='22023'; end if;
  if not found then raise exception 'Not found' using errcode='P0002'; end if;
  insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),case when p_kind='rule' then 'availability.removed' else 'exception.removed' end);
end; $$;

create function public.create_staff_invitation(p_organization_id uuid,p_staff_id uuid,p_email text)
returns text language plpgsql security definer set search_path='' as $$
declare token text := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
begin
  perform private.require_owner(p_organization_id);
  if not exists(select 1 from public.staff_profiles where organization_id=p_organization_id and id=p_staff_id and is_active and user_id is null) then raise exception 'Invalid professional' using errcode='22023'; end if;
  if (select count(*) from public.organization_invites where organization_id=p_organization_id and created_at>now()-interval '1 hour')>=20 then raise exception 'Invitation limit' using errcode='P0001'; end if;
  update public.organization_invites set revoked_at=now() where organization_id=p_organization_id and staff_id=p_staff_id and accepted_at is null and revoked_at is null;
  insert into public.organization_invites(organization_id,staff_id,email,token_hash,invited_by,expires_at) values(p_organization_id,p_staff_id,lower(btrim(p_email)),encode(sha256(convert_to(token,'UTF8')),'hex'),auth.uid(),now()+interval '48 hours');
  insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'invitation.created');
  return token;
end; $$;

create function public.inspect_staff_invitation(p_token text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('organization_name',o.name,'staff_name',s.name,'expires_at',i.expires_at)
  from public.organization_invites i join public.organizations o on o.id=i.organization_id
  join public.staff_profiles s on s.id=i.staff_id and s.organization_id=i.organization_id
  join auth.users u on u.id=auth.uid() and lower(u.email)=i.email and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
  where char_length(p_token)=64 and i.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and i.revoked_at is null and i.accepted_at is null and i.expires_at>now() and o.status='active' and s.is_active and s.user_id is null;
$$;

create function public.accept_staff_invitation(p_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invite public.organization_invites; target_org uuid;
begin
  if char_length(p_token) is distinct from 64 then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  select organization_id into target_org from public.organization_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  -- Igual orden de locks que las operaciones de propietario.
  perform 1 from public.organizations where id=target_org for update;
  select * into invite from public.organization_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
  if invite.id is null or public.inspect_staff_invitation(p_token) is null then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  insert into public.organization_members(organization_id,user_id,role) values(invite.organization_id,auth.uid(),'staff') on conflict(organization_id,user_id) do update set is_active=true;
  update public.staff_profiles set user_id=auth.uid() where organization_id=invite.organization_id and id=invite.staff_id;
  update public.organization_invites set accepted_at=now() where id=invite.id;
  insert into public.audit_logs(organization_id,actor_id,event) values(invite.organization_id,auth.uid(),'invitation.accepted');
  return invite.organization_id;
end; $$;

create function public.set_staff_access(p_organization_id uuid,p_staff_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
declare account uuid;
begin
  perform private.require_owner(p_organization_id);
  select user_id into account from public.staff_profiles where organization_id=p_organization_id and id=p_staff_id;
  if account is null then raise exception 'No linked account' using errcode='22023'; end if;
  update public.organization_members set is_active=p_enabled where organization_id=p_organization_id and user_id=account and role='staff';
  if not found then raise exception 'Owner access is protected' using errcode='42501'; end if;
  insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'staff_access.updated');
end; $$;
revoke all on function public.set_staff_access(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_staff_access(uuid,uuid,boolean) to authenticated;

create function public.revoke_staff_invitation(p_organization_id uuid,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_owner(p_organization_id);
  update public.organization_invites set revoked_at=now() where organization_id=p_organization_id and id=p_id and accepted_at is null and revoked_at is null;
  if not found then raise exception 'Not found' using errcode='P0002'; end if;
  insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'invitation.revoked');
end; $$;

revoke all on function public.save_service(uuid,uuid,jsonb,uuid[]),public.save_professional(uuid,uuid,jsonb,uuid[]),public.save_availability_rule(uuid,uuid,uuid,integer,text,integer,integer),public.save_availability_exception(uuid,uuid,uuid,date,date,integer,integer,text,text),public.remove_availability_entry(uuid,uuid,text),public.create_staff_invitation(uuid,uuid,text),public.inspect_staff_invitation(text),public.accept_staff_invitation(text),public.revoke_staff_invitation(uuid,uuid) from public,anon;
grant execute on function public.save_service(uuid,uuid,jsonb,uuid[]),public.save_professional(uuid,uuid,jsonb,uuid[]),public.save_availability_rule(uuid,uuid,uuid,integer,text,integer,integer),public.save_availability_exception(uuid,uuid,uuid,date,date,integer,integer,text,text),public.remove_availability_entry(uuid,uuid,text),public.create_staff_invitation(uuid,uuid,text),public.inspect_staff_invitation(text),public.accept_staff_invitation(text),public.revoke_staff_invitation(uuid,uuid) to authenticated;
commit;
