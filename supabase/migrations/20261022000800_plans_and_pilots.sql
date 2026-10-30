begin;
create table private.platform_admins(user_id uuid primary key references auth.users(id),is_active boolean not null default true,created_at timestamptz not null default now());
revoke all on private.platform_admins from public,anon,authenticated;
create function private.confirmed_actor() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous,false));
$$;
create function private.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private.confirmed_actor() and exists(select 1 from private.platform_admins where user_id=auth.uid() and is_active);
$$;
create function private.require_platform_admin() returns void language plpgsql security definer set search_path='' as $$
begin if not private.is_platform_admin() then raise exception 'Forbidden' using errcode='42501'; end if; end; $$;
revoke all on function private.confirmed_actor(),private.is_platform_admin(),private.require_platform_admin() from public,anon,authenticated;
grant execute on function private.confirmed_actor(),private.is_platform_admin() to authenticated;

create table public.subscription_plans(
 code text primary key check(code ~ '^[a-z][a-z0-9_-]{1,39}$'),name text not null check(char_length(btrim(name)) between 2 and 80),description text not null default '' check(char_length(description)<=1000),
 price_minor integer not null check(price_minor between 0 and 1000000000),currency text not null check(currency ~ '^[A-Z]{3}$'),max_professionals integer not null check(max_professionals between 1 and 1000),
 is_active boolean not null default true,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.module_catalog(code text primary key,name text not null,description text not null,is_available boolean not null default false);
create table public.plan_entitlements(plan_code text not null references public.subscription_plans(code),module_code text not null references public.module_catalog(code),primary key(plan_code,module_code));
create table public.platform_access_settings(singleton boolean primary key default true check(singleton),default_plan_code text not null references public.subscription_plans(code),trial_days integer not null check(trial_days between 1 and 180));
create table public.organization_subscriptions(
 organization_id uuid primary key references public.organizations(id),plan_code text not null references public.subscription_plans(code),
 status text not null check(status in ('pilot','trial','active','past_due','canceled','suspended')),
 starts_at timestamptz not null check(isfinite(starts_at)),ends_at timestamptz not null check(isfinite(ends_at)),check(ends_at>starts_at),
 quoted_price_minor integer not null check(quoted_price_minor between 0 and 1000000000),quoted_currency text not null check(quoted_currency ~ '^[A-Z]{3}$'),
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.organization_modules(
 organization_id uuid not null references public.organizations(id),module_code text not null references public.module_catalog(code),enabled boolean not null,
 starts_at timestamptz not null check(isfinite(starts_at)),ends_at timestamptz not null check(isfinite(ends_at)),check(ends_at>starts_at),reason text not null check(char_length(btrim(reason)) between 5 and 300),version integer not null default 1,primary key(organization_id,module_code)
);
create table public.pilot_feedback(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),created_by uuid not null references auth.users(id),
 problems text not null default '' check(char_length(problems)<=1500),difficulty smallint not null check(difficulty between 1 and 5),requests text not null default '' check(char_length(requests)<=1500),
 perceived_value smallint not null check(perceived_value between 1 and 5),willing_to_pay text not null check(willing_to_pay in ('unknown','yes','no')),suggestions text not null default '' check(char_length(suggestions)<=1500),created_at timestamptz not null default now()
);
create table private.pilot_notes(organization_id uuid primary key references public.organizations(id),notes text not null check(char_length(notes)<=2000),updated_at timestamptz not null default now());
revoke all on private.pilot_notes from public,anon,authenticated;
create table public.platform_audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users(id),organization_id uuid references public.organizations(id),event text not null check(event in ('admin.provisioned','plan.saved','subscription.saved','module.saved','organization.status_saved','trial_policy.saved')),detail jsonb not null default '{}',created_at timestamptz not null default now());
create index platform_audit_created_idx on public.platform_audit_logs(created_at desc,id);
create index pilot_feedback_org_idx on public.pilot_feedback(organization_id,created_at desc,id);
create trigger subscription_plans_touch before update on public.subscription_plans for each row execute function private.touch_updated_at();
create trigger organization_subscriptions_touch before update on public.organization_subscriptions for each row execute function private.touch_updated_at();

-- Referencias editables del brief. Ninguna fila genera cargos o suscripciones con proveedor.
insert into public.subscription_plans(code,name,description,price_minor,currency,max_professionals) values
 ('starter','Starter','Funciones base para un profesional.',1200,'USD',1),('professional','Professional','Equipo y personalización.',2500,'USD',5),('business','Business','Gestión para equipos más grandes.',4500,'USD',15);
insert into public.module_catalog(code,name,description,is_available) values
 ('bookings','Agenda y reservas','Catálogo, profesionales, disponibilidad y agenda privada.',true),
 ('public_booking','Reservas online','Página pública y reservas sin cuenta.',true),('customers','Clientes','Fichas, historial y preferencias.',true),
 ('notifications','Emails de turnos','Avisos transaccionales y recordatorios; requiere configurar proveedor y procesador.',true),
 ('team_access','Acceso del equipo','Cuentas de personal vinculadas a profesionales.',true),('branding','Personalización','Logo, portada y colores de la página pública.',true),
 ('loyalty','Fidelización','Prevista en Fase 7.',false),('analytics','Analítica avanzada','Módulo futuro.',false),('payments','Pagos y señas','Módulo futuro; sin cobros reales.',false),('marketing','Marketing','Módulo futuro; no envía campañas.',false);
insert into public.plan_entitlements select p.code,m.code from public.subscription_plans p cross join public.module_catalog m where m.is_available and (p.code<>'starter' or m.code not in ('team_access','branding'));
insert into public.platform_access_settings values(true,'business',14);
-- Compatibilidad de los negocios de desarrollo existentes, sin eliminar recursos.
insert into public.organization_subscriptions(organization_id,plan_code,status,starts_at,ends_at,quoted_price_minor,quoted_currency) select id,'business','pilot',now(),now()+interval '30 days',4500,'USD' from public.organizations;

create function private.subscription_active(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_subscriptions s join public.organizations o on o.id=s.organization_id where s.organization_id=target and o.status='active' and s.status in ('pilot','trial','active') and s.starts_at<=now() and s.ends_at>now());
$$;
create function private.has_module(target uuid,module text) returns boolean language sql stable security definer set search_path='' as $$
 select private.subscription_active(target) and exists(select 1 from public.module_catalog where code=module and is_available)
 and coalesce((select enabled from public.organization_modules where organization_id=target and module_code=module and starts_at<=now() and ends_at>now()),exists(select 1 from public.organization_subscriptions s join public.plan_entitlements e on e.plan_code=s.plan_code where s.organization_id=target and e.module_code=module));
$$;
create function private.require_module(target uuid,module text) returns void language plpgsql security definer set search_path='' as $$
begin if not private.has_module(target,module) then raise exception 'Plan or module unavailable' using errcode='P1001'; end if; end; $$;
revoke all on function private.subscription_active(uuid),private.has_module(uuid,text),private.require_module(uuid,text) from public,anon,authenticated;
grant execute on function private.subscription_active(uuid),private.has_module(uuid,text) to authenticated;

create or replace function private.organization_role(target_organization uuid) returns text language sql stable security definer set search_path='' as $$
 select member.role from public.organization_members member join public.organizations organization on organization.id=member.organization_id
 where member.organization_id=target_organization and member.user_id=auth.uid() and member.is_active and organization.status='active' and private.confirmed_actor()
 and (member.role='owner' or private.has_module(target_organization,'team_access'));
$$;
create function private.initialize_subscription() returns trigger language plpgsql security definer set search_path='' as $$
declare policy public.platform_access_settings; plan public.subscription_plans;
begin
 select * into policy from public.platform_access_settings where singleton;
 select * into plan from public.subscription_plans where code=policy.default_plan_code;
 insert into public.organization_subscriptions(organization_id,plan_code,status,starts_at,ends_at,quoted_price_minor,quoted_currency) values(new.id,plan.code,'trial',now(),now()+policy.trial_days*interval '1 day',plan.price_minor,plan.currency);
 return new;
end; $$;
revoke all on function private.initialize_subscription() from public,anon,authenticated;
create trigger organizations_subscription after insert on public.organizations for each row execute function private.initialize_subscription();

alter table public.subscription_plans enable row level security;
alter table public.module_catalog enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.platform_access_settings enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.organization_modules enable row level security;
alter table public.pilot_feedback enable row level security;
alter table public.platform_audit_logs enable row level security;
revoke all on public.subscription_plans,public.module_catalog,public.plan_entitlements,public.platform_access_settings,public.organization_subscriptions,public.organization_modules,public.pilot_feedback,public.platform_audit_logs from anon,authenticated;
grant select on public.subscription_plans,public.module_catalog,public.plan_entitlements,public.platform_access_settings,public.organization_subscriptions,public.organization_modules,public.pilot_feedback,public.platform_audit_logs to authenticated;
create policy plans_read on public.subscription_plans for select to authenticated using(private.confirmed_actor());
create policy modules_read on public.module_catalog for select to authenticated using(private.confirmed_actor());
create policy entitlements_read on public.plan_entitlements for select to authenticated using(private.confirmed_actor());
create policy trial_policy_read on public.platform_access_settings for select to authenticated using(private.is_platform_admin());
create policy subscription_read on public.organization_subscriptions for select to authenticated using(private.organization_role(organization_id) is not null or private.is_platform_admin());
create policy org_modules_read on public.organization_modules for select to authenticated using(private.organization_role(organization_id) is not null or private.is_platform_admin());
create policy pilot_feedback_read on public.pilot_feedback for select to authenticated using(private.organization_role(organization_id)='owner' or private.is_platform_admin());
create policy platform_audit_read on public.platform_audit_logs for select to authenticated using(private.is_platform_admin());

create function public.get_platform_admin_context() returns boolean language sql stable security definer set search_path='' as $$select private.is_platform_admin();$$;
create function public.get_organization_access(p_organization_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare subscription public.organization_subscriptions; plan public.subscription_plans;
begin
 if private.organization_role(p_organization_id) is null then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into subscription from public.organization_subscriptions where organization_id=p_organization_id;
 select * into plan from public.subscription_plans where code=subscription.plan_code;
 return jsonb_build_object('subscription',to_jsonb(subscription),'plan',to_jsonb(plan),'can_write',private.subscription_active(p_organization_id),
 'modules',coalesce((select jsonb_agg(code order by code) from public.module_catalog where private.has_module(p_organization_id,code)),'[]'::jsonb),
 'active_professionals',(select count(*) from public.staff_profiles where organization_id=p_organization_id and is_active));
end; $$;
create function public.admin_save_plan(p_code text,p_version integer,p_data jsonb,p_modules text[]) returns void language plpgsql security definer set search_path='' as $$
declare module text;
begin
 perform private.require_platform_admin();
 if p_code is null or p_data is null or p_modules is null or cardinality(p_modules)>20 or not ('bookings'=any(p_modules)) then raise exception 'Invalid plan' using errcode='22023'; end if;
 foreach module in array p_modules loop if not exists(select 1 from public.module_catalog where code=module and is_available) then raise exception 'Unavailable module' using errcode='22023'; end if; end loop;
 if p_version is null then
  insert into public.subscription_plans(code,name,description,price_minor,currency,max_professionals,is_active) values(p_code,btrim(p_data->>'name'),p_data->>'description',(p_data->>'price_minor')::integer,p_data->>'currency',(p_data->>'max_professionals')::integer,(p_data->>'is_active')::boolean);
 else
  update public.subscription_plans set name=btrim(p_data->>'name'),description=p_data->>'description',price_minor=(p_data->>'price_minor')::integer,currency=p_data->>'currency',max_professionals=(p_data->>'max_professionals')::integer,is_active=(p_data->>'is_active')::boolean,version=version+1 where code=p_code and version=p_version;
  if not found then raise exception 'Stale plan' using errcode='40001'; end if;
 end if;
 delete from public.plan_entitlements where plan_code=p_code;
 insert into public.plan_entitlements select p_code,value from(select distinct unnest(p_modules) value) codes;
 insert into public.platform_audit_logs(actor_id,event,detail) values(auth.uid(),'plan.saved',jsonb_build_object('plan_code',p_code));
end; $$;
create function public.admin_save_subscription(p_organization_id uuid,p_version integer,p_plan text,p_status text,p_starts_on date,p_ends_on date,p_reason text,p_notes text) returns void language plpgsql security definer set search_path='' as $$
declare zone text; first_instant timestamptz; last_instant timestamptz; plan public.subscription_plans; previous public.organization_subscriptions;
begin
 perform private.require_platform_admin();
 select timezone into zone from public.organizations where id=p_organization_id for update;
 if zone is null then raise exception 'Not found' using errcode='P0002'; end if;
 select * into plan from public.subscription_plans where code=p_plan and is_active;
 if plan.code is null or p_status is null or p_starts_on is null or p_ends_on is null or not isfinite(p_starts_on) or not isfinite(p_ends_on) or p_ends_on<p_starts_on or p_ends_on-p_starts_on>366 or p_reason is null or char_length(btrim(p_reason)) not between 5 and 300 or p_notes is null or char_length(p_notes)>2000 then raise exception 'Invalid access period' using errcode='22023'; end if;
 if (select count(*) from public.staff_profiles where organization_id=p_organization_id and is_active)>plan.max_professionals then raise exception 'Deactivate excess professionals first' using errcode='P1002'; end if;
 first_instant:=p_starts_on::timestamp at time zone zone;last_instant:=(p_ends_on+1)::timestamp at time zone zone;
 select * into previous from public.organization_subscriptions where organization_id=p_organization_id;
 update public.organization_subscriptions set plan_code=p_plan,status=p_status,starts_at=first_instant,ends_at=last_instant,quoted_price_minor=plan.price_minor,quoted_currency=plan.currency,version=version+1 where organization_id=p_organization_id and version=p_version;
 if not found then raise exception 'Stale subscription' using errcode='40001'; end if;
 insert into private.pilot_notes(organization_id,notes) values(p_organization_id,p_notes) on conflict(organization_id) do update set notes=excluded.notes,updated_at=now();
 insert into public.platform_audit_logs(actor_id,organization_id,event,detail) values(auth.uid(),p_organization_id,'subscription.saved',jsonb_build_object('before',to_jsonb(previous),'plan_code',p_plan,'status',p_status,'starts_at',first_instant,'ends_at',last_instant,'reason',p_reason));
end; $$;
create function public.admin_save_module(p_organization_id uuid,p_module text,p_version integer,p_enabled boolean,p_starts_on date,p_ends_on date,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare zone text;
begin
 perform private.require_platform_admin();select timezone into zone from public.organizations where id=p_organization_id for update;
 if zone is null or not exists(select 1 from public.module_catalog where code=p_module and is_available) or p_enabled is null or p_starts_on is null or p_ends_on is null or not isfinite(p_starts_on) or not isfinite(p_ends_on) or p_ends_on<p_starts_on or p_ends_on-p_starts_on>366 or p_reason is null or char_length(btrim(p_reason)) not between 5 and 300 then raise exception 'Invalid override' using errcode='22023'; end if;
 if p_version is null then
  insert into public.organization_modules(organization_id,module_code,enabled,starts_at,ends_at,reason) values(p_organization_id,p_module,p_enabled,p_starts_on::timestamp at time zone zone,(p_ends_on+1)::timestamp at time zone zone,p_reason);
 else
  update public.organization_modules set enabled=p_enabled,starts_at=p_starts_on::timestamp at time zone zone,ends_at=(p_ends_on+1)::timestamp at time zone zone,reason=p_reason,version=version+1 where organization_id=p_organization_id and module_code=p_module and version=p_version;
  if not found then raise exception 'Stale override' using errcode='40001'; end if;
 end if;
 insert into public.platform_audit_logs(actor_id,organization_id,event,detail) values(auth.uid(),p_organization_id,'module.saved',jsonb_build_object('module',p_module,'enabled',p_enabled,'reason',p_reason));
end; $$;
create function public.admin_set_organization_status(p_organization_id uuid,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare previous text;
begin
 perform private.require_platform_admin();
 if p_status is null or p_status not in ('active','suspended','archived') or p_reason is null or char_length(btrim(p_reason)) not between 5 and 300 then raise exception 'Invalid status' using errcode='22023'; end if;
 select status into previous from public.organizations where id=p_organization_id for update;
 if previous is null then raise exception 'Not found' using errcode='P0002'; end if;
 update public.organizations set status=p_status where id=p_organization_id;
 insert into public.platform_audit_logs(actor_id,organization_id,event,detail) values(auth.uid(),p_organization_id,'organization.status_saved',jsonb_build_object('before',previous,'status',p_status,'reason',p_reason));
end; $$;
create function public.admin_save_trial_policy(p_plan text,p_days integer) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform_admin();
 if not exists(select 1 from public.subscription_plans where code=p_plan and is_active) then raise exception 'Invalid plan' using errcode='22023'; end if;
 update public.platform_access_settings set default_plan_code=p_plan,trial_days=p_days where singleton;
 insert into public.platform_audit_logs(actor_id,event,detail) values(auth.uid(),'trial_policy.saved',jsonb_build_object('plan_code',p_plan,'days',p_days));
end; $$;
create function public.save_pilot_feedback(p_organization_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if private.organization_role(p_organization_id) is distinct from 'owner' then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_organization_id for update;
 if not exists(select 1 from public.organization_subscriptions where organization_id=p_organization_id and status in ('pilot','trial')) then raise exception 'Pilot feedback only' using errcode='22023'; end if;
 if (select count(*) from public.pilot_feedback where organization_id=p_organization_id and created_at>now()-interval '24 hours')>=5 then raise exception 'Feedback limit' using errcode='P1002'; end if;
 insert into public.pilot_feedback(organization_id,created_by,problems,difficulty,requests,perceived_value,willing_to_pay,suggestions) values(p_organization_id,auth.uid(),p_data->>'problems',(p_data->>'difficulty')::smallint,p_data->>'requests',(p_data->>'perceived_value')::smallint,p_data->>'willing_to_pay',p_data->>'suggestions') returning id into result;
 return result;
end; $$;
create function public.admin_list_organizations(p_search text default '',p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform_admin();
 if p_search is null or char_length(p_search)>100 or p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Invalid filter' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(row) from(select o.id,o.name,o.slug,o.status,s.plan_code,s.status subscription_status,s.starts_at,s.ends_at,(select count(*) from public.staff_profiles where organization_id=o.id and is_active) active_professionals from public.organizations o join public.organization_subscriptions s on s.organization_id=o.id where position(lower(btrim(p_search)) in lower(o.name||' '||o.slug))>0 order by o.created_at desc,o.id limit 50 offset p_offset) row),'[]'::jsonb);
end; $$;
create function public.admin_get_organization(p_organization_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform_admin();
 return (select jsonb_build_object('organization',jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'status',o.status,'timezone',o.timezone),'subscription',to_jsonb(s),
 'active_professionals',(select count(*) from public.staff_profiles where organization_id=o.id and is_active),
 'overrides',coalesce((select jsonb_agg(m order by module_code) from public.organization_modules m where organization_id=o.id),'[]'::jsonb),
 'notes',coalesce((select notes from private.pilot_notes where organization_id=o.id),'')) from public.organizations o join public.organization_subscriptions s on s.organization_id=o.id where o.id=p_organization_id);
end; $$;
create function public.admin_overview() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform_admin();
 return jsonb_build_object('organizations',(select count(*) from public.organizations),'active_access',(select count(*) from public.organization_subscriptions where private.subscription_active(organization_id)),
 'pilots',(select count(*) from public.organization_subscriptions where status='pilot' and private.subscription_active(organization_id)),
 'expired',(select count(*) from public.organization_subscriptions where ends_at<=now()));
end; $$;

revoke all on function public.get_platform_admin_context(),public.get_organization_access(uuid),public.admin_save_plan(text,integer,jsonb,text[]),public.admin_save_subscription(uuid,integer,text,text,date,date,text,text),public.admin_save_module(uuid,text,integer,boolean,date,date,text),public.admin_set_organization_status(uuid,text,text),public.admin_save_trial_policy(text,integer),public.save_pilot_feedback(uuid,jsonb),public.admin_list_organizations(text,integer),public.admin_get_organization(uuid),public.admin_overview() from public,anon;
grant execute on function public.get_platform_admin_context(),public.get_organization_access(uuid),public.admin_save_plan(text,integer,jsonb,text[]),public.admin_save_subscription(uuid,integer,text,text,date,date,text,text),public.admin_save_module(uuid,text,integer,boolean,date,date,text),public.admin_set_organization_status(uuid,text,text),public.admin_save_trial_policy(text,integer),public.save_pilot_feedback(uuid,jsonb),public.admin_list_organizations(text,integer),public.admin_get_organization(uuid),public.admin_overview() to authenticated;
commit;
