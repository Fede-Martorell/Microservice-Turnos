begin;
set local search_path=public,extensions,pg_catalog;
create extension if not exists btree_gist;

alter table public.audit_logs drop constraint audit_logs_event_check;
alter table public.audit_logs add constraint audit_logs_event_check check(event in (
 'organization.created','organization.updated','organization.settings_updated',
 'service.saved','professional.saved','availability.saved','availability.removed','exception.saved','exception.removed',
 'invitation.created','invitation.accepted','invitation.revoked','staff_access.updated',
 'booking_settings.saved','appointment.created','appointment.status_changed','appointment.rescheduled'
));
create table public.booking_settings (
 organization_id uuid primary key references public.organizations(id),
 min_advance_minutes integer not null default 60 check(min_advance_minutes between 0 and 43200),
 max_advance_days integer not null default 90 check(max_advance_days between 1 and 365),
 check(min_advance_minutes <= max_advance_days*1440)
);
create table public.appointments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 staff_id uuid not null, service_id uuid not null,
 customer_name text not null check(char_length(btrim(customer_name)) between 2 and 100),
 customer_email text not null check(char_length(customer_email)<=254 and customer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
 customer_phone text not null default '' check(char_length(customer_phone)<=30),
 service_name text not null, staff_name text not null,
 duration_minutes integer not null check(duration_minutes between 5 and 480),
 preparation_minutes integer not null check(preparation_minutes between 0 and 120),
 price_minor integer not null check(price_minor between 0 and 1000000000), currency text not null check(currency ~ '^[A-Z]{3}$'),
 timezone text not null,
 starts_at timestamptz not null check(isfinite(starts_at)), ends_at timestamptz not null, occupied_until timestamptz not null,
 check(ends_at=starts_at+duration_minutes*interval '1 minute'),
 check(occupied_until=ends_at+preparation_minutes*interval '1 minute'),
 status text not null default 'pending' check(status in ('pending','confirmed','completed','canceled','no_show')),
 version integer not null default 1,
 request_key uuid not null, request_hash text not null,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,id), unique(organization_id,request_key),
 foreign key(organization_id,staff_id) references public.staff_profiles(organization_id,id),
 foreign key(organization_id,service_id) references public.services(organization_id,id),
 -- Historial completado/ausente también conserva el intervalo ocupado; cancelar lo libera.
 exclude using gist(organization_id with =,staff_id with =,tstzrange(starts_at,occupied_until,'[)') with &&) where(status<>'canceled')
);
create index appointments_calendar_idx on public.appointments(organization_id,starts_at,staff_id);
create table public.appointment_history (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, appointment_id uuid not null,
 actor_id uuid not null references auth.users(id), event text not null check(event in ('created','status_changed','rescheduled')),
 from_status text, to_status text not null, old_starts_at timestamptz, new_starts_at timestamptz not null,
 created_at timestamptz not null default now(),
 foreign key(organization_id,appointment_id) references public.appointments(organization_id,id)
);
create index appointment_history_lookup_idx on public.appointment_history(organization_id,appointment_id,created_at);
alter table public.booking_settings enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_history enable row level security;
revoke all on public.booking_settings,public.appointments,public.appointment_history from anon,authenticated;
grant select on public.booking_settings,public.appointments,public.appointment_history to authenticated;
create policy booking_settings_read on public.booking_settings for select to authenticated using(private.organization_role(organization_id) is not null);
create policy appointments_read on public.appointments for select to authenticated using(private.organization_role(organization_id)='owner' or private.owns_staff(organization_id,staff_id));
create policy appointment_history_read on public.appointment_history for select to authenticated using(exists(select 1 from public.appointments a where a.organization_id=appointment_history.organization_id and a.id=appointment_history.appointment_id));
create trigger appointments_touch before update on public.appointments for each row execute function private.touch_updated_at();

create function private.require_agenda(target_org uuid,target_staff uuid,lock_it boolean default false) returns void
language plpgsql security definer set search_path='' as $$
begin
 if lock_it then perform 1 from public.organizations where id=target_org for update; end if;
 if private.organization_role(target_org) is distinct from 'owner' and not private.owns_staff(target_org,target_staff) then raise exception 'Forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.staff_profiles where organization_id=target_org and id=target_staff and is_active) then raise exception 'Unavailable professional' using errcode='22023'; end if;
end; $$;
revoke all on function private.require_agenda(uuid,uuid,boolean) from public;

-- Única regla de disponibilidad, reutilizada al listar y al escribir dentro del lock.
-- No se ofrecen tramos que atraviesen un cambio de offset DST; los instantes repetidos
-- se distinguen por UTC. La UI siempre envía un instante explícito con offset.
create function private.slot_available(target_org uuid,target_staff uuid,instant timestamptz,total_minutes integer,excluding uuid default null)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare zone text; local_start timestamp; local_end timestamp; day date; day_of_week integer; first_minute integer; last_minute integer;
 min_advance integer; max_advance integer; work int4multirange; scope uuid;
begin
 select timezone into zone from public.organizations where id=target_org and status='active';
 if zone is null or instant is null or not isfinite(instant) or total_minutes not between 5 and 600 then return false; end if;
 select coalesce(s.min_advance_minutes,60),coalesce(s.max_advance_days,90) into min_advance,max_advance
 from public.organizations o left join public.booking_settings s on s.organization_id=o.id where o.id=target_org;
 if instant<now()+min_advance*interval '1 minute' or instant>now()+max_advance*interval '24 hours' then return false; end if;
 local_start:=instant at time zone zone; local_end:=(instant+total_minutes*interval '1 minute') at time zone zone;
 if extract(second from local_start)<>0 or extract(minute from local_start)::integer%15<>0 then return false; end if;
 day:=local_start::date; day_of_week:=extract(dow from day)::integer;
 first_minute:=extract(hour from local_start)::integer*60+extract(minute from local_start)::integer;
 last_minute:=first_minute+total_minutes;
 if last_minute>1440 or local_end<>local_start+total_minutes*interval '1 minute' then return false; end if;
 -- range_agg fusiona turnos contiguos sin aceptar huecos.
 foreach scope in array array[null::uuid,target_staff] loop
  select range_agg(int4range(start_minute,end_minute,'[)')) into work from public.availability_rules
   where organization_id=target_org and staff_id is not distinct from scope and weekday=day_of_week and kind='working';
  if work is null or not(work @> int4range(first_minute,last_minute,'[)')) then return false; end if;
 end loop;
 if exists(select 1 from public.availability_rules where organization_id=target_org and (staff_id is null or staff_id=target_staff) and weekday=day_of_week and kind='break' and start_minute<last_minute and end_minute>first_minute) then return false; end if;
 if exists(select 1 from public.availability_exceptions where organization_id=target_org and (staff_id is null or staff_id=target_staff) and day between starts_on and ends_on and (start_minute is null or (start_minute<last_minute and end_minute>first_minute))) then return false; end if;
 return not exists(select 1 from public.appointments where organization_id=target_org and staff_id=target_staff and status<>'canceled' and (excluding is null or id<>excluding) and starts_at<instant+total_minutes*interval '1 minute' and occupied_until>instant);
end; $$;
revoke all on function private.slot_available(uuid,uuid,timestamptz,integer,uuid) from public;

create function public.save_booking_settings(p_organization_id uuid,p_min_advance_minutes integer,p_max_advance_days integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_owner(p_organization_id);
 insert into public.booking_settings values(p_organization_id,p_min_advance_minutes,p_max_advance_days)
 on conflict(organization_id) do update set min_advance_minutes=excluded.min_advance_minutes,max_advance_days=excluded.max_advance_days;
 insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'booking_settings.saved');
end; $$;

create function public.get_available_slots(p_organization_id uuid,p_service_id uuid,p_staff_id uuid,p_day date,p_appointment_id uuid default null)
returns table(starts_at timestamptz,ends_at timestamptz,occupied_until timestamptz)
language plpgsql security definer set search_path='' as $$
declare zone text; duration integer; preparation integer; candidate timestamptz; original public.appointments;
begin
 perform private.require_agenda(p_organization_id,p_staff_id);
 select timezone into zone from public.organizations where id=p_organization_id;
 if p_day is null or p_day<(now() at time zone zone)::date or p_day>(now() at time zone zone)::date+366 then raise exception 'Invalid day' using errcode='22023'; end if;
 if p_appointment_id is null then
  select s.duration_minutes,s.preparation_minutes into duration,preparation from public.services s join public.staff_services ss on ss.organization_id=s.organization_id and ss.service_id=s.id and ss.staff_id=p_staff_id where s.organization_id=p_organization_id and s.id=p_service_id and s.is_active;
 else
  select * into original from public.appointments where organization_id=p_organization_id and id=p_appointment_id and staff_id=p_staff_id and service_id=p_service_id and status in ('pending','confirmed');
  duration:=original.duration_minutes; preparation:=original.preparation_minutes;
 end if;
 if duration is null then raise exception 'Unavailable service' using errcode='22023'; end if;
 for candidate in select generate_series(p_day::timestamp at time zone zone,((p_day+1)::timestamp at time zone zone)-interval '1 minute',interval '15 minutes') loop
  if private.slot_available(p_organization_id,p_staff_id,candidate,duration+preparation,p_appointment_id) then
   starts_at:=candidate; ends_at:=candidate+duration*interval '1 minute'; occupied_until:=ends_at+preparation*interval '1 minute'; return next;
  end if;
 end loop;
end; $$;

create function public.create_appointment(p_organization_id uuid,p_service_id uuid,p_staff_id uuid,p_starts_at timestamptz,p_customer_name text,p_customer_email text,p_customer_phone text,p_status text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare service public.services; professional public.staff_profiles; result uuid; signature text; previous public.appointments; zone text;
begin
 perform private.require_agenda(p_organization_id,p_staff_id,true);
 if p_request_key is null or p_status is null or p_status not in ('pending','confirmed') then raise exception 'Invalid input' using errcode='22023'; end if;
 signature:=encode(sha256(convert_to(jsonb_build_array(p_service_id,p_staff_id,extract(epoch from p_starts_at),btrim(p_customer_name),lower(btrim(p_customer_email)),btrim(p_customer_phone),p_status)::text,'UTF8')),'hex');
 select * into previous from public.appointments where organization_id=p_organization_id and request_key=p_request_key;
 if previous.id is not null then
  if previous.created_by<>auth.uid() or previous.request_hash<>signature then raise exception 'Reused request key' using errcode='22023'; end if;
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

create function public.change_appointment_status(p_organization_id uuid,p_id uuid,p_version integer,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare item public.appointments; staff uuid;
begin
 select staff_id into staff from public.appointments where organization_id=p_organization_id and id=p_id;
 -- Owner puede conservar acceso histórico incluso si el recurso fue desactivado.
 perform 1 from public.organizations where id=p_organization_id for update;
 if private.organization_role(p_organization_id) is distinct from 'owner' and not private.owns_staff(p_organization_id,staff) then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into item from public.appointments where organization_id=p_organization_id and id=p_id for update;
 if item.id is null then raise exception 'Not found' using errcode='P0002'; end if;
 if item.version is distinct from p_version then raise exception 'Stale version' using errcode='40001'; end if;
 if p_status is null or not((item.status='pending' and p_status in ('confirmed','canceled')) or (item.status='confirmed' and p_status in ('completed','canceled','no_show'))) then raise exception 'Invalid transition' using errcode='22023'; end if;
 if (p_status='completed' and item.ends_at>now()) or (p_status='no_show' and item.starts_at>now()) then raise exception 'Too early' using errcode='22023'; end if;
 update public.appointments set status=p_status,version=version+1 where id=item.id;
 insert into public.appointment_history(organization_id,appointment_id,actor_id,event,from_status,to_status,old_starts_at,new_starts_at) values(p_organization_id,item.id,auth.uid(),'status_changed',item.status,p_status,item.starts_at,item.starts_at);
 insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'appointment.status_changed');
end; $$;

create function public.reschedule_appointment(p_organization_id uuid,p_id uuid,p_version integer,p_starts_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare item public.appointments; staff uuid; zone text;
begin
 select staff_id into staff from public.appointments where organization_id=p_organization_id and id=p_id;
 perform private.require_agenda(p_organization_id,staff,true);
 select * into item from public.appointments where organization_id=p_organization_id and id=p_id for update;
 if item.id is null then raise exception 'Not found' using errcode='P0002'; end if;
 if item.version is distinct from p_version then raise exception 'Stale version' using errcode='40001'; end if;
 if item.status not in ('pending','confirmed') or item.starts_at<=now() then raise exception 'Invalid state' using errcode='22023'; end if;
 if not private.slot_available(p_organization_id,item.staff_id,p_starts_at,item.duration_minutes+item.preparation_minutes,item.id) then raise exception 'Slot unavailable' using errcode='23P01'; end if;
 select timezone into zone from public.organizations where id=p_organization_id;
 update public.appointments set starts_at=p_starts_at,ends_at=p_starts_at+item.duration_minutes*interval '1 minute',occupied_until=p_starts_at+(item.duration_minutes+item.preparation_minutes)*interval '1 minute',timezone=zone,version=version+1 where id=item.id;
 insert into public.appointment_history(organization_id,appointment_id,actor_id,event,from_status,to_status,old_starts_at,new_starts_at) values(p_organization_id,item.id,auth.uid(),'rescheduled',item.status,item.status,item.starts_at,p_starts_at);
 insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'appointment.rescheduled');
end; $$;

create function public.get_appointment_calendar(p_organization_id uuid,p_day date,p_days integer)
returns setof public.appointments language plpgsql security invoker set search_path='' as $$
declare zone text;
begin
 if private.organization_role(p_organization_id) is null then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_day is null or p_days is null or p_days not in (1,7) then raise exception 'Invalid range' using errcode='22023'; end if;
 select timezone into zone from public.organizations where id=p_organization_id;
 return query select * from public.appointments where organization_id=p_organization_id and starts_at>=(p_day::timestamp at time zone zone) and starts_at<((p_day+p_days)::timestamp at time zone zone) order by starts_at,id;
end; $$;

revoke all on function public.save_booking_settings(uuid,integer,integer),public.get_available_slots(uuid,uuid,uuid,date,uuid),public.create_appointment(uuid,uuid,uuid,timestamptz,text,text,text,text,uuid),public.change_appointment_status(uuid,uuid,integer,text),public.reschedule_appointment(uuid,uuid,integer,timestamptz),public.get_appointment_calendar(uuid,date,integer) from public,anon;
grant execute on function public.save_booking_settings(uuid,integer,integer),public.get_available_slots(uuid,uuid,uuid,date,uuid),public.create_appointment(uuid,uuid,uuid,timestamptz,text,text,text,text,uuid),public.change_appointment_status(uuid,uuid,integer,text),public.reschedule_appointment(uuid,uuid,integer,timestamptz),public.get_appointment_calendar(uuid,date,integer) to authenticated;
commit;
