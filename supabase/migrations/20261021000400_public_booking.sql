begin;

alter table public.audit_logs drop constraint audit_logs_event_check;
alter table public.audit_logs add constraint audit_logs_event_check check(event in (
 'organization.created','organization.updated','organization.settings_updated','service.saved','professional.saved',
 'availability.saved','availability.removed','exception.saved','exception.removed','invitation.created','invitation.accepted',
 'invitation.revoked','staff_access.updated','booking_settings.saved','appointment.created','appointment.status_changed','appointment.rescheduled',
 'public_booking.settings_saved','public_booking.created','public_booking.canceled','public_booking.rescheduled','public_booking.link_revoked'
));
alter table public.appointments alter column created_by drop not null;
alter table public.appointments add column source text not null default 'panel' check(source in ('panel','public'));
alter table public.appointments add constraint appointments_actor_source check((source='panel' and created_by is not null) or (source='public' and created_by is null));
alter table public.appointment_history alter column actor_id drop not null;
alter table public.appointment_history add column actor_kind text not null default 'member' check(actor_kind in ('member','guest'));
alter table public.appointment_history add constraint appointment_history_actor check((actor_kind='member' and actor_id is not null) or (actor_kind='guest' and actor_id is null));

create table public.public_booking_settings (
 organization_id uuid primary key references public.organizations(id), enabled boolean not null default false,
 auto_confirm boolean not null default false,
 contact_email text not null default '' check(contact_email='' or (char_length(contact_email)<=254 and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
 contact_phone text not null default '' check(char_length(contact_phone)<=40), address text not null default '' check(char_length(address)<=300),
 cancellation_policy text not null check(char_length(btrim(cancellation_policy)) between 10 and 1500),
 cancellation_notice_minutes integer not null default 1440 check(cancellation_notice_minutes between 0 and 43200),
 logo_url text, cover_url text,
 check(logo_url is null or (char_length(logo_url)<=2048 and logo_url ~ '^https://')),
 check(cover_url is null or (char_length(cover_url)<=2048 and cover_url ~ '^https://')),
 primary_color text not null default '#355741' check(primary_color ~ '^#[0-9a-fA-F]{6}$'),
 secondary_color text not null default '#eaf0e6' check(secondary_color ~ '^#[0-9a-fA-F]{6}$'),
 updated_at timestamptz not null default now()
);
alter table public.public_booking_settings enable row level security;
revoke all on public.public_booking_settings from anon,authenticated;
grant select on public.public_booking_settings to authenticated;
create policy public_booking_settings_read on public.public_booking_settings for select to authenticated using(private.organization_role(organization_id)='owner');
create trigger public_booking_settings_touch before update on public.public_booking_settings for each row execute function private.touch_updated_at();

-- La clave del intermediario SOLO permite estas RPC. No es service_role ni accede a tablas.
-- Se provisiona el hash con un archivo local separado; sin hash, todo acceso público falla cerrado.
create table private.public_booking_gateway(singleton boolean primary key default true check(singleton),secret_hash text not null check(secret_hash ~ '^[0-9a-f]{64}$'));
create table private.public_booking_limits(bucket text not null,key_hash text not null,window_start timestamptz not null,attempts integer not null,expires_at timestamptz not null,primary key(bucket,key_hash,window_start));
create index public_booking_limits_expiry_idx on private.public_booking_limits(expires_at);
create table private.public_booking_access (
 organization_id uuid not null,appointment_id uuid primary key,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),visitor_hash text not null,
 cancellation_policy text not null,cancellation_notice_minutes integer not null,
 expires_at timestamptz not null,revoked_at timestamptz,created_at timestamptz not null default now(),
 foreign key(organization_id,appointment_id) references public.appointments(organization_id,id)
);
revoke all on private.public_booking_gateway,private.public_booking_limits,private.public_booking_access from public,anon,authenticated;

create function private.require_public_gateway() returns void language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 secret:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-booking-gateway-secret';
 if secret is null or secret !~ '^[0-9a-f]{64}$' or not exists(select 1 from private.public_booking_gateway where secret_hash=encode(sha256(convert_to(secret,'UTF8')),'hex')) then raise exception 'Forbidden' using errcode='42501'; end if;
end; $$;
create function private.public_limit(bucket_name text,key_value text,max_attempts integer,window_minutes integer) returns boolean language plpgsql security definer set search_path='' as $$
declare boundary timestamptz; count_now integer;
begin
 boundary:=to_timestamp(floor(extract(epoch from clock_timestamp())/(window_minutes*60))*(window_minutes*60));
 insert into private.public_booking_limits(bucket,key_hash,window_start,attempts,expires_at)
 values(bucket_name,encode(sha256(convert_to(key_value,'UTF8')),'hex'),boundary,1,boundary+window_minutes*interval '1 minute')
 on conflict(bucket,key_hash,window_start) do update set attempts=least(private.public_booking_limits.attempts+1,1000000) returning attempts into count_now;
 return count_now<=max_attempts;
end; $$;
create function private.public_request_guard(visitor text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.require_public_gateway();
 if visitor is null or visitor !~ '^[0-9a-f]{64}$' then raise exception 'Invalid visitor' using errcode='22023'; end if;
 with expired as(select ctid from private.public_booking_limits where expires_at<now() order by expires_at limit 50 for update skip locked)
 delete from private.public_booking_limits using expired where public_booking_limits.ctid=expired.ctid;
 return private.public_limit('all','global',1000,1) and private.public_limit('visitor',visitor,120,1);
end; $$;

create function public.save_public_booking_settings(p_organization_id uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_owner(p_organization_id);
 insert into public.public_booking_settings(organization_id,enabled,auto_confirm,contact_email,contact_phone,address,cancellation_policy,cancellation_notice_minutes,logo_url,cover_url,primary_color,secondary_color)
 values(p_organization_id,(p_data->>'enabled')::boolean,(p_data->>'auto_confirm')::boolean,lower(btrim(p_data->>'contact_email')),btrim(p_data->>'contact_phone'),btrim(p_data->>'address'),btrim(p_data->>'cancellation_policy'),(p_data->>'cancellation_notice_minutes')::integer,nullif(p_data->>'logo_url',''),nullif(p_data->>'cover_url',''),p_data->>'primary_color',p_data->>'secondary_color')
 on conflict(organization_id) do update set enabled=excluded.enabled,auto_confirm=excluded.auto_confirm,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,address=excluded.address,cancellation_policy=excluded.cancellation_policy,cancellation_notice_minutes=excluded.cancellation_notice_minutes,logo_url=excluded.logo_url,cover_url=excluded.cover_url,primary_color=excluded.primary_color,secondary_color=excluded.secondary_color;
 insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'public_booking.settings_saved');
end; $$;

create function public.get_public_booking_catalog(p_slug text,p_visitor text) returns jsonb language plpgsql security definer set search_path='' as $$
declare org public.organizations; settings public.public_booking_settings; result jsonb;
begin
 if not private.public_request_guard(p_visitor) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
 select o.* into org from public.organizations o join public.public_booking_settings s on s.organization_id=o.id and s.enabled where o.slug=p_slug and o.status='active';
 if org.id is null then return jsonb_build_object('ok',false,'code','not_found'); end if;
 select * into settings from public.public_booking_settings where organization_id=org.id;
 result:=jsonb_build_object('organization',jsonb_build_object('name',org.name,'slug',org.slug,'description',org.description,'timezone',org.timezone),
 'settings',jsonb_build_object('contact_email',settings.contact_email,'contact_phone',settings.contact_phone,'address',settings.address,'cancellation_policy',settings.cancellation_policy,'cancellation_notice_minutes',settings.cancellation_notice_minutes,'logo_url',settings.logo_url,'cover_url',settings.cover_url,'primary_color',settings.primary_color,'secondary_color',settings.secondary_color,'auto_confirm',settings.auto_confirm,'updated_at',settings.updated_at),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'category',s.category,'duration_minutes',s.duration_minutes,'preparation_minutes',s.preparation_minutes,'price_minor',s.price_minor,'currency',s.currency,'image_url',s.image_url,'updated_at',s.updated_at) order by s.name,s.id) from public.services s where s.organization_id=org.id and s.is_active and exists(select 1 from public.staff_services ss join public.staff_profiles sp on sp.organization_id=ss.organization_id and sp.id=ss.staff_id and sp.is_active where ss.organization_id=org.id and ss.service_id=s.id)),'[]'::jsonb),
 'professionals',coalesce((select jsonb_agg(jsonb_build_object('id',sp.id,'name',sp.name,'description',sp.description,'photo_url',sp.photo_url,'service_ids',(select jsonb_agg(ss.service_id order by ss.service_id) from public.staff_services ss join public.services s on s.organization_id=ss.organization_id and s.id=ss.service_id and s.is_active where ss.organization_id=org.id and ss.staff_id=sp.id)) order by sp.name,sp.id) from public.staff_profiles sp where sp.organization_id=org.id and sp.is_active and exists(select 1 from public.staff_services ss join public.services s on s.organization_id=ss.organization_id and s.id=ss.service_id and s.is_active where ss.organization_id=org.id and ss.staff_id=sp.id)),'[]'::jsonb),
 'min_advance_minutes',coalesce((select min_advance_minutes from public.booking_settings where organization_id=org.id),60),
 'max_advance_days',coalesce((select max_advance_days from public.booking_settings where organization_id=org.id),90));
 return jsonb_build_object('ok',true,'catalog',result);
end; $$;

create function private.public_slots(target_org uuid,target_service uuid,target_staff uuid,target_day date,original public.appointments default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare service public.services; zone text; candidate timestamptz; duration integer; preparation integer; slots jsonb:='[]'::jsonb;
begin
 select timezone into zone from public.organizations where id=target_org and status='active';
 if zone is null or target_day is null or not isfinite(target_day) or target_day<(now() at time zone zone)::date or target_day>(now() at time zone zone)::date+366 then return slots; end if;
 if original.id is not null then duration:=original.duration_minutes; preparation:=original.preparation_minutes;
 else
  select * into service from public.services where organization_id=target_org and id=target_service and is_active;
  if service.id is null then return slots; end if;
  duration:=service.duration_minutes; preparation:=service.preparation_minutes;
 end if;
 for candidate in select generate_series(target_day::timestamp at time zone zone,((target_day+1)::timestamp at time zone zone)-interval '1 minute',interval '15 minutes') loop
  if exists(select 1 from public.staff_profiles sp where sp.organization_id=target_org and sp.is_active and (target_staff is null or sp.id=target_staff) and (original.id is not null or exists(select 1 from public.staff_services ss where ss.organization_id=target_org and ss.staff_id=sp.id and ss.service_id=target_service)) and private.slot_available(target_org,sp.id,candidate,duration+preparation,original.id)) then
   slots:=slots||jsonb_build_array(jsonb_build_object('starts_at',candidate,'ends_at',candidate+duration*interval '1 minute','occupied_until',candidate+(duration+preparation)*interval '1 minute'));
  end if;
 end loop;
 return slots;
end; $$;
create function public.get_public_booking_slots(p_slug text,p_service_id uuid,p_staff_id uuid,p_day date,p_visitor text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target_org uuid;
begin
 if not private.public_request_guard(p_visitor) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
 select o.id into target_org from public.organizations o join public.public_booking_settings s on s.organization_id=o.id and s.enabled where o.slug=p_slug and o.status='active';
 if target_org is null then return jsonb_build_object('ok',false,'code','not_found'); end if;
 if not private.public_limit('slots_org',target_org::text,600,60) or not private.public_limit('slots_visitor',p_visitor,120,60) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
 return jsonb_build_object('ok',true,'slots',private.public_slots(target_org,p_service_id,p_staff_id,p_day));
end; $$;

create function private.find_public_access(token text) returns private.public_booking_access language sql stable security definer set search_path='' as $$
 select t.* from private.public_booking_access t join public.organizations o on o.id=t.organization_id and o.status='active'
 where char_length(token)=64 and t.token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and t.revoked_at is null and t.expires_at>now();
$$;
create function private.public_receipt(target uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('organization_name',o.name,'slug',o.slug,'timezone',o.timezone,'contact_email',coalesce(s.contact_email,''),'contact_phone',coalesce(s.contact_phone,''),
 'customer_name',a.customer_name,'service_name',a.service_name,'staff_name',a.staff_name,'starts_at',a.starts_at,'ends_at',a.ends_at,'occupied_until',a.occupied_until,
 'duration_minutes',a.duration_minutes,'preparation_minutes',a.preparation_minutes,'price_minor',a.price_minor,'currency',a.currency,'status',a.status,'version',a.version,
 'cancellation_policy',t.cancellation_policy,'cancellation_notice_minutes',t.cancellation_notice_minutes,'expires_at',t.expires_at,
 'can_manage',a.status in ('pending','confirmed') and a.starts_at>now()+t.cancellation_notice_minutes*interval '1 minute')
 from public.appointments a join public.organizations o on o.id=a.organization_id join private.public_booking_access t on t.appointment_id=a.id left join public.public_booking_settings s on s.organization_id=o.id where a.id=target;
$$;

create function public.create_public_booking(p_slug text,p_service_id uuid,p_staff_id uuid,p_starts_at timestamptz,p_customer_name text,p_customer_email text,p_customer_phone text,p_request_key uuid,p_token_hash text,p_visitor text,p_service_version timestamptz,p_settings_version timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org public.organizations; settings public.public_booking_settings; service public.services; professional public.staff_profiles; previous public.appointments; access private.public_booking_access; result uuid; signature text; initial_status text;
begin
 if not private.public_request_guard(p_visitor) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
 select * into org from public.organizations where slug=p_slug and status='active';
 if org.id is null then return jsonb_build_object('ok',false,'code','not_found'); end if;
 -- Límites fuera del subbloque: conflictos/entradas inválidas NO revierten contadores.
 if not private.public_limit('booking_org',org.id::text,60,60) or not private.public_limit('booking_visitor',p_visitor,6,60) or not private.public_limit('booking_email',org.id::text||':'||lower(btrim(coalesce(p_customer_email,''))),3,60) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
 begin
  perform 1 from public.organizations where id=org.id for update;
  if not exists(select 1 from public.organizations where id=org.id and status='active') then return jsonb_build_object('ok',false,'code','not_found'); end if;
  select * into settings from public.public_booking_settings where organization_id=org.id and enabled;
  if settings.organization_id is null then return jsonb_build_object('ok',false,'code','not_found'); end if;
  if p_request_key is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'code','invalid'); end if;
  signature:=encode(sha256(convert_to(jsonb_build_array(p_service_id,p_staff_id,extract(epoch from p_starts_at),btrim(p_customer_name),lower(btrim(p_customer_email)),btrim(p_customer_phone),p_service_version,p_settings_version)::text,'UTF8')),'hex');
  select * into previous from public.appointments where organization_id=org.id and request_key=p_request_key;
  if previous.id is not null then
   select * into access from private.public_booking_access where appointment_id=previous.id;
   if previous.source<>'public' or previous.request_hash is distinct from signature or access.visitor_hash is distinct from p_visitor or access.token_hash is distinct from p_token_hash or access.revoked_at is not null or access.expires_at<=now() then return jsonb_build_object('ok',false,'code','invalid'); end if;
   return jsonb_build_object('ok',true,'receipt',private.public_receipt(previous.id));
  end if;
  select * into service from public.services where organization_id=org.id and id=p_service_id and is_active;
  if service.id is null then return jsonb_build_object('ok',false,'code','unavailable'); end if;
  if service.updated_at is distinct from p_service_version or settings.updated_at is distinct from p_settings_version then return jsonb_build_object('ok',false,'code','stale'); end if;
  select sp.* into professional from public.staff_profiles sp join public.staff_services ss on ss.organization_id=sp.organization_id and ss.staff_id=sp.id and ss.service_id=service.id
  where sp.organization_id=org.id and sp.is_active and (p_staff_id is null or sp.id=p_staff_id) and private.slot_available(org.id,sp.id,p_starts_at,service.duration_minutes+service.preparation_minutes) order by sp.name,sp.id limit 1;
  if professional.id is null then return jsonb_build_object('ok',false,'code','unavailable'); end if;
  initial_status:=case when settings.auto_confirm then 'confirmed' else 'pending' end;
  insert into public.appointments(organization_id,staff_id,service_id,customer_name,customer_email,customer_phone,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at,ends_at,occupied_until,status,request_key,request_hash,created_by,source)
  values(org.id,professional.id,service.id,btrim(p_customer_name),lower(btrim(p_customer_email)),btrim(p_customer_phone),service.name,professional.name,service.duration_minutes,service.preparation_minutes,service.price_minor,service.currency,org.timezone,p_starts_at,p_starts_at+service.duration_minutes*interval '1 minute',p_starts_at+(service.duration_minutes+service.preparation_minutes)*interval '1 minute',initial_status,p_request_key,signature,null,'public') returning id into result;
  insert into private.public_booking_access(organization_id,appointment_id,token_hash,visitor_hash,cancellation_policy,cancellation_notice_minutes,expires_at)
  values(org.id,result,p_token_hash,p_visitor,settings.cancellation_policy,settings.cancellation_notice_minutes,p_starts_at+(service.duration_minutes+service.preparation_minutes)*interval '1 minute'+interval '7 days');
  insert into public.appointment_history(organization_id,appointment_id,actor_id,actor_kind,event,to_status,new_starts_at) values(org.id,result,null,'guest','created',initial_status,p_starts_at);
  insert into public.audit_logs(organization_id,actor_id,event) values(org.id,null,'public_booking.created');
  return jsonb_build_object('ok',true,'receipt',private.public_receipt(result));
 exception when exclusion_violation or unique_violation then return jsonb_build_object('ok',false,'code','unavailable');
 when check_violation or not_null_violation or foreign_key_violation then return jsonb_build_object('ok',false,'code','invalid');
 end;
end; $$;

create function public.inspect_public_booking(p_token text,p_visitor text) returns jsonb language plpgsql security definer set search_path='' as $$
declare access private.public_booking_access;
begin
 if not private.public_request_guard(p_visitor) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
 access:=private.find_public_access(p_token);
 if access.appointment_id is null then return jsonb_build_object('ok',false,'code','not_found'); end if;
 return jsonb_build_object('ok',true,'receipt',private.public_receipt(access.appointment_id));
end; $$;
create function public.get_public_reschedule_slots(p_token text,p_day date,p_visitor text) returns jsonb language plpgsql security definer set search_path='' as $$
declare access private.public_booking_access; item public.appointments; result jsonb;
begin
 if not private.public_request_guard(p_visitor) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
 access:=private.find_public_access(p_token);
 if access.appointment_id is null then return jsonb_build_object('ok',false,'code','not_found'); end if;
 if not private.public_limit('manage_slots',access.appointment_id::text,120,60) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
 select * into item from public.appointments where id=access.appointment_id;
 if item.status not in ('pending','confirmed') or item.starts_at<=now()+access.cancellation_notice_minutes*interval '1 minute' then return jsonb_build_object('ok',false,'code','policy'); end if;
 select coalesce(jsonb_agg(value),'[]'::jsonb) into result from jsonb_array_elements(private.public_slots(item.organization_id,item.service_id,item.staff_id,p_day,item)) where (value->>'starts_at')::timestamptz>now()+access.cancellation_notice_minutes*interval '1 minute';
 return jsonb_build_object('ok',true,'slots',result);
end; $$;
create function public.manage_public_booking(p_token text,p_visitor text,p_version integer,p_action text,p_starts_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare access private.public_booking_access; item public.appointments; zone text;
begin
 if not private.public_request_guard(p_visitor) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
 access:=private.find_public_access(p_token);
 if access.appointment_id is null then return jsonb_build_object('ok',false,'code','not_found'); end if;
 if not private.public_limit('manage',access.appointment_id::text,20,60) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
 begin
  perform 1 from public.organizations where id=access.organization_id for update;
  access:=private.find_public_access(p_token);
  if access.appointment_id is null then return jsonb_build_object('ok',false,'code','not_found'); end if;
  select * into item from public.appointments where id=access.appointment_id for update;
  if item.version is distinct from p_version then return jsonb_build_object('ok',false,'code','stale'); end if;
  if item.status not in ('pending','confirmed') or item.starts_at<=now()+access.cancellation_notice_minutes*interval '1 minute' then return jsonb_build_object('ok',false,'code','policy'); end if;
  if p_action='cancel' then
   update public.appointments set status='canceled',version=version+1 where id=item.id;
   insert into public.appointment_history(organization_id,appointment_id,actor_id,actor_kind,event,from_status,to_status,old_starts_at,new_starts_at) values(item.organization_id,item.id,null,'guest','status_changed',item.status,'canceled',item.starts_at,item.starts_at);
   insert into public.audit_logs(organization_id,actor_id,event) values(item.organization_id,null,'public_booking.canceled');
  elsif p_action='reschedule' then
   if not exists(select 1 from public.staff_profiles where organization_id=item.organization_id and id=item.staff_id and is_active) or not private.slot_available(item.organization_id,item.staff_id,p_starts_at,item.duration_minutes+item.preparation_minutes,item.id) or p_starts_at<=now()+access.cancellation_notice_minutes*interval '1 minute' then return jsonb_build_object('ok',false,'code','unavailable'); end if;
   select timezone into zone from public.organizations where id=item.organization_id;
   update public.appointments set starts_at=p_starts_at,ends_at=p_starts_at+item.duration_minutes*interval '1 minute',occupied_until=p_starts_at+(item.duration_minutes+item.preparation_minutes)*interval '1 minute',timezone=zone,version=version+1 where id=item.id;
   update private.public_booking_access set expires_at=p_starts_at+(item.duration_minutes+item.preparation_minutes)*interval '1 minute'+interval '7 days' where appointment_id=item.id;
   insert into public.appointment_history(organization_id,appointment_id,actor_id,actor_kind,event,from_status,to_status,old_starts_at,new_starts_at) values(item.organization_id,item.id,null,'guest','rescheduled',item.status,item.status,item.starts_at,p_starts_at);
   insert into public.audit_logs(organization_id,actor_id,event) values(item.organization_id,null,'public_booking.rescheduled');
  else return jsonb_build_object('ok',false,'code','invalid'); end if;
  return jsonb_build_object('ok',true,'receipt',private.public_receipt(item.id));
 exception when exclusion_violation then return jsonb_build_object('ok',false,'code','unavailable'); end;
end; $$;

create function public.revoke_public_booking_link(p_organization_id uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_owner(p_organization_id);
 update private.public_booking_access set revoked_at=now() where organization_id=p_organization_id and appointment_id=p_id;
 if not found then raise exception 'Not found' using errcode='P0002'; end if;
 insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'public_booking.link_revoked');
end; $$;

-- Las funciones privadas no forman una API invocable por anon/authenticated.
revoke all on function private.require_public_gateway(),private.public_limit(text,text,integer,integer),private.public_request_guard(text),private.public_slots(uuid,uuid,uuid,date,public.appointments),private.find_public_access(text),private.public_receipt(uuid) from public,anon,authenticated;
revoke all on function public.save_public_booking_settings(uuid,jsonb),public.revoke_public_booking_link(uuid,uuid) from public,anon;
grant execute on function public.save_public_booking_settings(uuid,jsonb),public.revoke_public_booking_link(uuid,uuid) to authenticated;
revoke all on function public.get_public_booking_catalog(text,text),public.get_public_booking_slots(text,uuid,uuid,date,text),public.create_public_booking(text,uuid,uuid,timestamptz,text,text,text,uuid,text,text,timestamptz,timestamptz),public.inspect_public_booking(text,text),public.get_public_reschedule_slots(text,date,text),public.manage_public_booking(text,text,integer,text,timestamptz) from public,authenticated;
grant execute on function public.get_public_booking_catalog(text,text),public.get_public_booking_slots(text,uuid,uuid,date,text),public.create_public_booking(text,uuid,uuid,timestamptz,text,text,text,uuid,text,text,timestamptz,timestamptz),public.inspect_public_booking(text,text),public.get_public_reschedule_slots(text,date,text),public.manage_public_booking(text,text,integer,text,timestamptz) to anon;

-- Identidad nullable: reintentos privados verifican el actor explícitamente.
create or replace function public.create_appointment(p_organization_id uuid,p_service_id uuid,p_staff_id uuid,p_starts_at timestamptz,p_customer_name text,p_customer_email text,p_customer_phone text,p_status text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare service public.services; professional public.staff_profiles; result uuid; signature text; previous public.appointments; zone text;
begin
 perform private.require_agenda(p_organization_id,p_staff_id,true);
 if p_request_key is null or p_status is null or p_status not in ('pending','confirmed') then raise exception 'Invalid input' using errcode='22023'; end if;
 signature:=encode(sha256(convert_to(jsonb_build_array(p_service_id,p_staff_id,extract(epoch from p_starts_at),btrim(p_customer_name),lower(btrim(p_customer_email)),btrim(p_customer_phone),p_status)::text,'UTF8')),'hex');
 select * into previous from public.appointments where organization_id=p_organization_id and request_key=p_request_key;
 if previous.id is not null then
  if previous.created_by is distinct from auth.uid() or previous.request_hash<>signature then raise exception 'Reused request key' using errcode='22023'; end if;
  return previous.id;
 end if;
 select s.* into service from public.services s join public.staff_services ss on ss.organization_id=s.organization_id and ss.service_id=s.id and ss.staff_id=p_staff_id where s.organization_id=p_organization_id and s.id=p_service_id and s.is_active;
 if service.id is null then raise exception 'Unavailable service' using errcode='22023'; end if;
 if not private.slot_available(p_organization_id,p_staff_id,p_starts_at,service.duration_minutes+service.preparation_minutes) then raise exception 'Slot unavailable' using errcode='23P01'; end if;
 select * into professional from public.staff_profiles where organization_id=p_organization_id and id=p_staff_id;
 select timezone into zone from public.organizations where id=p_organization_id;
 insert into public.appointments(organization_id,staff_id,service_id,customer_name,customer_email,customer_phone,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at,ends_at,occupied_until,status,request_key,request_hash,created_by)
 values(p_organization_id,p_staff_id,p_service_id,btrim(p_customer_name),lower(btrim(p_customer_email)),btrim(p_customer_phone),service.name,professional.name,service.duration_minutes,service.preparation_minutes,service.price_minor,service.currency,zone,p_starts_at,p_starts_at+service.duration_minutes*interval '1 minute',p_starts_at+(service.duration_minutes+service.preparation_minutes)*interval '1 minute',p_status,p_request_key,signature,auth.uid()) returning id into result;
 insert into public.appointment_history(organization_id,appointment_id,actor_id,event,to_status,new_starts_at) values(p_organization_id,result,auth.uid(),'created',p_status,p_starts_at);
 insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'appointment.created');
 return result;
end; $$;
commit;
