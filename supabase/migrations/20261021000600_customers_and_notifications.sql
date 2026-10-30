begin;

alter table public.audit_logs drop constraint audit_logs_event_check;
alter table public.audit_logs add constraint audit_logs_event_check check(event in (
 'organization.created','organization.updated','organization.settings_updated','service.saved','professional.saved',
 'availability.saved','availability.removed','exception.saved','exception.removed','invitation.created','invitation.accepted',
 'invitation.revoked','staff_access.updated','booking_settings.saved','appointment.created','appointment.status_changed','appointment.rescheduled',
 'public_booking.settings_saved','public_booking.created','public_booking.canceled','public_booking.rescheduled','public_booking.link_revoked',
 'customer.saved','customer.preferences_saved','notification.settings_saved'
));
create table public.customers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null check(char_length(btrim(name)) between 2 and 100),
 email text not null check(char_length(email)<=254 and email=lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
 phone text not null default '' check(char_length(phone)<=30), is_active boolean not null default true,
 transactional_email boolean not null default true, marketing_consent boolean not null default false,
 consent_evidence text not null default '' check(char_length(consent_evidence)<=500),
 consent_updated_at timestamptz, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,id), unique(organization_id,email),
 check(not marketing_consent or char_length(btrim(consent_evidence))>=10)
);
create index customers_directory_idx on public.customers(organization_id,name,id);
alter table public.customers enable row level security;
revoke all on public.customers from anon,authenticated;
grant select on public.customers to authenticated;
create trigger customers_touch before update on public.customers for each row execute function private.touch_updated_at();
create table private.customer_consent_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,customer_id uuid not null,
 actor_id uuid not null references auth.users(id),transactional_email boolean not null,marketing_consent boolean not null,
 evidence text not null,created_at timestamptz not null default now(),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
revoke all on private.customer_consent_events from public,anon,authenticated;

-- Vinculación por email normalizado dentro del tenant; nunca sobrescribe una ficha
-- existente con datos enviados por un visitante que conoce ese email.
insert into public.customers(organization_id,name,email,phone,created_at)
select distinct on(organization_id,lower(btrim(customer_email))) organization_id,customer_name,lower(btrim(customer_email)),customer_phone,created_at
from public.appointments order by organization_id,lower(btrim(customer_email)),created_at,id;
alter table public.appointments add column customer_id uuid;
update public.appointments a set customer_id=c.id from public.customers c where c.organization_id=a.organization_id and c.email=lower(btrim(a.customer_email));
alter table public.appointments alter column customer_id set not null;
alter table public.appointments add foreign key(organization_id,customer_id) references public.customers(organization_id,id);
create index appointments_customer_idx on public.appointments(organization_id,customer_id,starts_at desc,id);
create policy customers_read on public.customers for select to authenticated using(
 private.organization_role(organization_id)='owner' or exists(select 1 from public.appointments a where a.organization_id=customers.organization_id and a.customer_id=customers.id)
);
create function private.link_appointment_customer() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.customers(organization_id,name,email,phone) values(new.organization_id,btrim(new.customer_name),lower(btrim(new.customer_email)),btrim(new.customer_phone)) on conflict(organization_id,email) do nothing;
 select id into new.customer_id from public.customers where organization_id=new.organization_id and email=lower(btrim(new.customer_email));
 return new;
end; $$;
revoke all on function private.link_appointment_customer() from public,anon,authenticated;
create trigger appointments_customer before insert on public.appointments for each row execute function private.link_appointment_customer();

create function public.save_customer(p_organization_id uuid,p_id uuid,p_version integer,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.require_owner(p_organization_id);
 if p_id is null then
  insert into public.customers(organization_id,name,email,phone,is_active) values(p_organization_id,btrim(p_data->>'name'),lower(btrim(p_data->>'email')),btrim(p_data->>'phone'),(p_data->>'is_active')::boolean) returning id into result;
 else
  perform 1 from public.customers where organization_id=p_organization_id and id=p_id for update;
  if not found then raise exception 'Not found' using errcode='P0002'; end if;
  update public.customers set name=btrim(p_data->>'name'),email=lower(btrim(p_data->>'email')),phone=btrim(p_data->>'phone'),is_active=(p_data->>'is_active')::boolean,version=version+1 where organization_id=p_organization_id and id=p_id and version=p_version returning id into result;
  if result is null then raise exception 'Stale version' using errcode='40001'; end if;
 end if;
 insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'customer.saved');
 return result;
end; $$;
create function public.save_customer_preferences(p_organization_id uuid,p_id uuid,p_version integer,p_transactional boolean,p_marketing boolean,p_evidence text) returns void language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.require_owner(p_organization_id);
 if p_transactional is null or p_marketing is null or p_evidence is null or char_length(p_evidence)>500 or (p_marketing and char_length(btrim(p_evidence))<10) then raise exception 'Invalid consent' using errcode='22023'; end if;
 update public.customers set transactional_email=p_transactional,marketing_consent=p_marketing,consent_evidence=btrim(p_evidence),consent_updated_at=now(),version=version+1 where organization_id=p_organization_id and id=p_id and version=p_version returning id into result;
 if result is null then raise exception 'Stale or missing customer' using errcode='40001'; end if;
 insert into private.customer_consent_events(organization_id,customer_id,actor_id,transactional_email,marketing_consent,evidence) values(p_organization_id,p_id,auth.uid(),p_transactional,p_marketing,btrim(p_evidence));
 insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'customer.preferences_saved');
end; $$;
create function public.get_customer_directory(p_organization_id uuid,p_search text default '',p_activity text default 'all',p_recurrence text default 'all',p_offset integer default 0)
returns table(id uuid,name text,email text,phone text,is_active boolean,created_at timestamptz,completed_visits bigint,last_visit timestamptz,total_reservations bigint)
language plpgsql security invoker set search_path='' as $$
begin
 if private.organization_role(p_organization_id) is null then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_search is null or char_length(p_search)>100 or p_activity not in ('all','active','inactive') or p_recurrence not in ('all','new','visited','recurrent') or p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Invalid filter' using errcode='22023'; end if;
 return query select c.id,c.name,c.email,c.phone,c.is_active,c.created_at,s.visits,s.last_visit,s.total
 from public.customers c cross join lateral(select count(*) filter(where a.status='completed') visits,max(a.ends_at) filter(where a.status='completed') last_visit,count(*) total from public.appointments a where a.organization_id=c.organization_id and a.customer_id=c.id) s
 where c.organization_id=p_organization_id and position(lower(btrim(p_search)) in lower(c.name||' '||c.email||' '||c.phone))>0
 and (p_activity='all' or c.is_active=(p_activity='active'))
 and (p_recurrence='all' or (p_recurrence='new' and s.visits=0) or (p_recurrence='visited' and s.visits>=1) or (p_recurrence='recurrent' and s.visits>=2)) order by c.name,c.id limit 50 offset p_offset;
end; $$;

create table public.notification_settings (
 organization_id uuid primary key references public.organizations(id),enabled boolean not null default false,
 reminders_enabled boolean not null default true,reminder_minutes integer not null default 1440 check(reminder_minutes between 60 and 10080),updated_at timestamptz not null default now()
);
create table public.notification_jobs (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,appointment_id uuid not null,
 appointment_version integer not null,kind text not null check(kind in ('created','confirmed','canceled','rescheduled','reminder')),
 status text not null default 'queued' check(status in ('queued','processing','retry','sent','failed','skipped')),
 scheduled_at timestamptz not null,expires_at timestamptz not null,attempts integer not null default 0,
 first_attempt_at timestamptz,lease_until timestamptz,claim_token uuid,provider_id text,last_error text,
 created_at timestamptz not null default now(),sent_at timestamptz,
 foreign key(organization_id,appointment_id) references public.appointments(organization_id,id),
 unique(appointment_id,appointment_version,kind)
);
create index notification_due_idx on public.notification_jobs(scheduled_at,id) where status in ('queued','retry','processing');
create index notification_org_idx on public.notification_jobs(organization_id,created_at desc,id);
alter table public.notification_settings enable row level security;
alter table public.notification_jobs enable row level security;
revoke all on public.notification_settings,public.notification_jobs from anon,authenticated;
grant select on public.notification_settings,public.notification_jobs to authenticated;
create policy notification_settings_read on public.notification_settings for select to authenticated using(private.organization_role(organization_id)='owner');
create policy notification_jobs_read on public.notification_jobs for select to authenticated using(private.organization_role(organization_id)='owner');
create trigger notification_settings_touch before update on public.notification_settings for each row execute function private.touch_updated_at();
create table private.notification_payloads(job_id uuid primary key references public.notification_jobs(id),snapshot jsonb not null,message jsonb);
create table private.notification_worker(singleton boolean primary key default true check(singleton),secret_hash text not null check(secret_hash ~ '^[0-9a-f]{64}$'));
revoke all on private.notification_payloads,private.notification_worker from public,anon,authenticated;

create function private.enqueue_notification(item public.appointments,event_kind text,due timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare result uuid; org public.organizations; contact public.public_booking_settings;
begin
 select * into org from public.organizations where id=item.organization_id;
 select * into contact from public.public_booking_settings where organization_id=item.organization_id;
 insert into public.notification_jobs(organization_id,appointment_id,appointment_version,kind,scheduled_at,expires_at)
 values(item.organization_id,item.id,item.version,event_kind,due,case when event_kind='canceled' then now()+interval '24 hours' else item.starts_at end)
 on conflict(appointment_id,appointment_version,kind) do nothing returning id into result;
 if result is not null then
  insert into private.notification_payloads(job_id,snapshot) values(result,jsonb_build_object('organization_name',org.name,'slug',org.slug,'customer_name',item.customer_name,'customer_email',item.customer_email,'service_name',item.service_name,'staff_name',item.staff_name,'starts_at',item.starts_at,'ends_at',item.ends_at,'timezone',item.timezone,'status',item.status,'price_minor',item.price_minor,'currency',item.currency,'contact_email',coalesce(contact.contact_email,''),'contact_phone',coalesce(contact.contact_phone,'')));
 end if;
end; $$;
create function private.queue_appointment_notifications() returns trigger language plpgsql security definer set search_path='' as $$
declare settings public.notification_settings; event_kind text;
begin
 if tg_op='UPDATE' and new.version=old.version then return new; end if;
 select * into settings from public.notification_settings where organization_id=new.organization_id and enabled;
 if settings.organization_id is null then return new; end if;
 if tg_op='INSERT' then event_kind:='created';
 elsif new.status='canceled' and old.status<>new.status then event_kind:='canceled';
 elsif new.starts_at<>old.starts_at then event_kind:='rescheduled';
 elsif new.status='confirmed' and old.status<>new.status then event_kind:='confirmed';
 end if;
 if event_kind is not null and (event_kind='canceled' or new.starts_at>now()) then perform private.enqueue_notification(new,event_kind,now()); end if;
 if settings.reminders_enabled and new.status='confirmed' and new.starts_at-settings.reminder_minutes*interval '1 minute'>now() then perform private.enqueue_notification(new,'reminder',new.starts_at-settings.reminder_minutes*interval '1 minute'); end if;
 return new;
end; $$;
create trigger appointments_notifications after insert or update on public.appointments for each row execute function private.queue_appointment_notifications();
create function public.save_notification_settings(p_organization_id uuid,p_enabled boolean,p_reminders boolean,p_minutes integer) returns void language plpgsql security definer set search_path='' as $$
declare item public.appointments;
begin
 perform private.require_owner(p_organization_id);
 insert into public.notification_settings(organization_id,enabled,reminders_enabled,reminder_minutes) values(p_organization_id,p_enabled,p_reminders,p_minutes)
 on conflict(organization_id) do update set enabled=excluded.enabled,reminders_enabled=excluded.reminders_enabled,reminder_minutes=excluded.reminder_minutes;
 if not p_enabled then update public.notification_jobs set status='skipped',last_error='notifications_disabled' where organization_id=p_organization_id and status in ('queued','retry'); end if;
 -- Cambiar ajustes no reactiva avisos omitidos ni reproduce eventos antiguos.
 update public.notification_jobs set status='skipped',last_error='settings_changed' where organization_id=p_organization_id and kind='reminder' and status in ('queued','retry') and first_attempt_at is null;
 if p_enabled and p_reminders then
  for item in select * from public.appointments where organization_id=p_organization_id and status='confirmed' and starts_at>now()+p_minutes*interval '1 minute' loop
   perform private.enqueue_notification(item,'reminder',item.starts_at-p_minutes*interval '1 minute');
   update public.notification_jobs set scheduled_at=item.starts_at-p_minutes*interval '1 minute',status='queued',last_error=null where appointment_id=item.id and appointment_version=item.version and kind='reminder' and first_attempt_at is null;
  end loop;
 end if;
 insert into public.audit_logs(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'notification.settings_saved');
end; $$;
create function private.require_notification_worker() returns void language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 secret:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-notification-worker-secret';
 if secret is null or secret !~ '^[0-9a-f]{64}$' or not exists(select 1 from private.notification_worker where secret_hash=encode(sha256(convert_to(secret,'UTF8')),'hex')) then raise exception 'Forbidden' using errcode='42501'; end if;
end; $$;
create function private.notification_eligible(job public.notification_jobs) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.appointments a join public.organizations o on o.id=a.organization_id join public.customers c on c.organization_id=a.organization_id and c.id=a.customer_id join public.notification_settings s on s.organization_id=a.organization_id
 where a.id=job.appointment_id and a.version=job.appointment_version and o.status='active' and c.transactional_email and s.enabled
 and job.expires_at>now() and (job.kind<>'reminder' or (s.reminders_enabled and a.status='confirmed'))
 and (job.kind='canceled' or (a.status in ('pending','confirmed') and a.starts_at>now())));
$$;
create function public.notification_queue_status(p_recipient text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_notification_worker();
 return jsonb_build_object('due',(select count(*) from public.notification_jobs j join private.notification_payloads p on p.job_id=j.id where j.status in ('queued','retry','processing') and j.scheduled_at<=now() and (p_recipient is null or p.snapshot->>'customer_email'=lower(btrim(p_recipient)))));
end; $$;
create function public.claim_notification_jobs(p_limit integer default 5,p_recipient text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.notification_jobs; result jsonb:='[]'::jsonb; access private.public_booking_access; payload private.notification_payloads;
begin
 perform private.require_notification_worker();
 if p_limit is null or p_limit<1 or p_limit>10 or (p_recipient is not null and char_length(p_recipient)>254) then raise exception 'Invalid batch' using errcode='22023'; end if;
 for job in select j.* from public.notification_jobs j join private.notification_payloads p on p.job_id=j.id
 where ((j.status in ('queued','retry') and j.scheduled_at<=now()) or (j.status='processing' and j.lease_until<now()))
 and (p_recipient is null or p.snapshot->>'customer_email'=lower(btrim(p_recipient))) order by j.scheduled_at,j.id limit p_limit for update of j skip locked loop
  if not private.notification_eligible(job) then update public.notification_jobs set status='skipped',last_error='no_longer_eligible',lease_until=null,claim_token=null where id=job.id; continue; end if;
  if job.attempts>=6 or job.first_attempt_at<now()-interval '22 hours' then update public.notification_jobs set status='failed',last_error='retry_window_closed',lease_until=null,claim_token=null where id=job.id; continue; end if;
  update public.notification_jobs set status='processing',lease_until=now()+interval '3 minutes',claim_token=gen_random_uuid() where id=job.id returning * into job;
  select * into payload from private.notification_payloads where job_id=job.id;
  select * into access from private.public_booking_access where appointment_id=job.appointment_id and revoked_at is null and expires_at>now();
  result:=result||jsonb_build_array(jsonb_build_object('id',job.id,'claim_token',job.claim_token,'kind',job.kind,'snapshot',payload.snapshot,'message',payload.message,
   'access',case when access.appointment_id is null then null else jsonb_build_object('request_key',(select request_key from public.appointments where id=job.appointment_id),'visitor',access.visitor_hash,'token_hash',access.token_hash) end));
 end loop;
 return result;
end; $$;
-- Congela cuerpo/remitente/destinatario antes de llamar al proveedor. Si hay una
-- respuesta ambigua, todos los reintentos usan la misma clave y el mismo cuerpo.
create function public.prepare_notification_delivery(p_id uuid,p_claim uuid,p_message jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.notification_jobs; result jsonb;
begin
 perform private.require_notification_worker();
 select * into job from public.notification_jobs where id=p_id and status='processing' and claim_token=p_claim and lease_until>now() for update;
 if job.id is null then return null; end if;
 if not private.notification_eligible(job) or job.attempts>=6 or job.first_attempt_at<now()-interval '22 hours' then update public.notification_jobs set status='skipped',last_error='no_longer_eligible',claim_token=null,lease_until=null where id=job.id; return null; end if;
 if p_message is null or jsonb_typeof(p_message)<>'object' or pg_column_size(p_message)>32000 or not (p_message ?& array['from','to','subject','text','html']) or p_message->>'to' is distinct from (select snapshot->>'customer_email' from private.notification_payloads where job_id=job.id) then raise exception 'Invalid message' using errcode='22023'; end if;
 update private.notification_payloads set message=coalesce(message,p_message) where job_id=job.id returning message into result;
 update public.notification_jobs set attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()) where id=job.id;
 return result;
end; $$;
create function public.finish_notification_job(p_id uuid,p_claim uuid,p_outcome text,p_provider_id text default null,p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare job public.notification_jobs; delay_minutes integer;
begin
 perform private.require_notification_worker();
 if p_outcome is null or p_outcome not in ('sent','retry','failed') or (p_provider_id is not null and (char_length(p_provider_id)>100 or p_provider_id !~ '^[a-zA-Z0-9_-]+$')) or (p_error is not null and (char_length(p_error)>60 or p_error !~ '^[a-zA-Z0-9_]+$')) then raise exception 'Invalid outcome' using errcode='22023'; end if;
 select * into job from public.notification_jobs where id=p_id and status='processing' and claim_token=p_claim for update;
 if job.id is null then return false; end if;
 delay_minutes:=case job.attempts when 1 then 1 when 2 then 5 when 3 then 15 when 4 then 60 else 180 end;
 update public.notification_jobs set status=case when p_outcome='retry' and (attempts>=6 or first_attempt_at<now()-interval '22 hours' or now()+delay_minutes*interval '1 minute'>expires_at) then 'failed' else p_outcome end,
 scheduled_at=case when p_outcome='retry' then now()+delay_minutes*interval '1 minute' else scheduled_at end,
 sent_at=case when p_outcome='sent' then now() else null end,provider_id=p_provider_id,last_error=p_error,claim_token=null,lease_until=null where id=job.id;
 return true;
end; $$;

revoke all on function private.enqueue_notification(public.appointments,text,timestamptz),private.queue_appointment_notifications(),private.require_notification_worker(),private.notification_eligible(public.notification_jobs) from public,anon,authenticated;
revoke all on function public.save_customer(uuid,uuid,integer,jsonb),public.save_customer_preferences(uuid,uuid,integer,boolean,boolean,text),public.get_customer_directory(uuid,text,text,text,integer),public.save_notification_settings(uuid,boolean,boolean,integer) from public,anon;
grant execute on function public.save_customer(uuid,uuid,integer,jsonb),public.save_customer_preferences(uuid,uuid,integer,boolean,boolean,text),public.get_customer_directory(uuid,text,text,text,integer),public.save_notification_settings(uuid,boolean,boolean,integer) to authenticated;
revoke all on function public.notification_queue_status(text),public.claim_notification_jobs(integer,text),public.prepare_notification_delivery(uuid,uuid,jsonb),public.finish_notification_job(uuid,uuid,text,text,text) from public,authenticated;
grant execute on function public.notification_queue_status(text),public.claim_notification_jobs(integer,text),public.prepare_notification_delivery(uuid,uuid,jsonb),public.finish_notification_job(uuid,uuid,text,text,text) to anon;
commit;
