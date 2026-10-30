begin;
-- Complemento disponible, sin incluirlo automáticamente en planes ni generar cargos.
alter table public.module_catalog add column reference_price_minor integer not null default 0 check(reference_price_minor between 0 and 1000000000), add column reference_currency text not null default 'USD' check(reference_currency ~ '^[A-Z]{3}$');
update public.module_catalog set is_available=true,description='Visitas o puntos por servicio, recompensas, canjes y tarjeta privada.',reference_price_minor=900 where code='loyalty';
update public.module_catalog set reference_price_minor=case code when 'analytics' then 800 when 'payments' then 700 when 'marketing' then 1200 end where code in ('analytics','payments','marketing');
create function public.admin_save_module_price(p_module text,p_price_minor integer,p_currency text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform_admin();
 update public.module_catalog set reference_price_minor=p_price_minor,reference_currency=p_currency where code=p_module;
 if not found then raise exception 'Not found' using errcode='P0002'; end if;
 insert into public.platform_audit_logs(actor_id,event,detail) values(auth.uid(),'module.saved',jsonb_build_object('kind','reference_price','module',p_module,'price_minor',p_price_minor,'currency',p_currency));
end; $$;
revoke all on function public.admin_save_module_price(text,integer,text) from public,anon;
grant execute on function public.admin_save_module_price(text,integer,text) to authenticated;

create table public.loyalty_programs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null unique references public.organizations(id),name text not null check(char_length(btrim(name)) between 2 and 100),
 mode text not null check(mode in ('visits','points')),is_active boolean not null default false,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id)
);
create table public.loyalty_rules(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,program_id uuid not null,version integer not null,
 starts_at timestamptz not null check(isfinite(starts_at)),ends_at timestamptz not null check(isfinite(ends_at)),check(ends_at>starts_at),
 conditions text not null check(char_length(btrim(conditions)) between 5 and 2000),expire_days integer check(expire_days between 1 and 3650),reset_mode text not null check(reset_mode in ('subtract','reset')),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),foreign key(organization_id,program_id) references public.loyalty_programs(organization_id,id),unique(organization_id,id),unique(program_id,version)
);
create table public.loyalty_rule_services(
 organization_id uuid not null,rule_id uuid not null,service_id uuid not null,points integer not null check(points between 1 and 10000),primary key(rule_id,service_id),
 foreign key(organization_id,rule_id) references public.loyalty_rules(organization_id,id),foreign key(organization_id,service_id) references public.services(organization_id,id)
);
create table public.loyalty_accounts(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,program_id uuid not null,customer_id uuid not null,created_at timestamptz not null default now(),
 foreign key(organization_id,program_id) references public.loyalty_programs(organization_id,id),foreign key(organization_id,customer_id) references public.customers(organization_id,id),unique(program_id,customer_id),unique(organization_id,id)
);
create table public.loyalty_transactions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,account_id uuid not null,kind text not null check(kind in ('earned','adjustment','redeemed','refund')),
 amount integer not null check(amount<>0 and amount between -1000000000 and 1000000000),expires_at timestamptz check(expires_at is null or isfinite(expires_at)),
 appointment_id uuid,rule_id uuid,related_transaction_id uuid,reason text not null default '' check(char_length(reason)<=300),service_name text not null default '' check(char_length(service_name)<=100),
 created_by uuid references auth.users(id),created_at timestamptz not null default now(),
 check((kind='earned' and amount>0 and appointment_id is not null and rule_id is not null) or (kind='redeemed' and amount<0) or (kind='refund' and amount>0 and related_transaction_id is not null) or kind='adjustment'),
 check(amount>0 or expires_at is null),foreign key(organization_id,account_id) references public.loyalty_accounts(organization_id,id),foreign key(organization_id,appointment_id) references public.appointments(organization_id,id),
 foreign key(organization_id,rule_id) references public.loyalty_rules(organization_id,id),unique(organization_id,account_id,id),foreign key(organization_id,account_id,related_transaction_id) references public.loyalty_transactions(organization_id,account_id,id)
);
create unique index loyalty_appointment_once on public.loyalty_transactions(appointment_id) where kind='earned';
create index loyalty_history_idx on public.loyalty_transactions(account_id,created_at desc,id);
create index loyalty_credit_idx on public.loyalty_transactions(account_id,expires_at,id) where amount>0;
create table private.loyalty_allocations(
 organization_id uuid not null,account_id uuid not null,debit_id uuid not null,credit_id uuid not null,amount integer not null check(amount>0),primary key(debit_id,credit_id),check(debit_id<>credit_id),
 foreign key(organization_id,account_id,debit_id) references public.loyalty_transactions(organization_id,account_id,id),foreign key(organization_id,account_id,credit_id) references public.loyalty_transactions(organization_id,account_id,id)
);
create index loyalty_allocations_credit_idx on private.loyalty_allocations(credit_id);
create table public.loyalty_rewards(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,program_id uuid not null,name text not null check(char_length(btrim(name)) between 2 and 100),benefit text not null check(char_length(btrim(benefit)) between 5 and 2000),
 cost integer not null check(cost between 1 and 1000000),conditions text not null check(char_length(conditions)<=2000),starts_at timestamptz not null check(isfinite(starts_at)),ends_at timestamptz not null check(isfinite(ends_at)),check(ends_at>starts_at),
 per_customer_limit integer check(per_customer_limit between 1 and 10000),total_limit integer check(total_limit between 1 and 1000000),is_active boolean not null default true,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(organization_id,program_id) references public.loyalty_programs(organization_id,id),unique(organization_id,id)
);
create table public.loyalty_redemptions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,account_id uuid not null,reward_id uuid not null,transaction_id uuid not null unique,
 reward_snapshot jsonb not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(organization_id,account_id) references public.loyalty_accounts(organization_id,id),foreign key(organization_id,reward_id) references public.loyalty_rewards(organization_id,id),foreign key(organization_id,account_id,transaction_id) references public.loyalty_transactions(organization_id,account_id,id),unique(organization_id,id)
);
create index loyalty_reward_usage_idx on public.loyalty_redemptions(reward_id,account_id);
create table public.loyalty_redemption_voids(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,redemption_id uuid not null unique,reason text not null check(char_length(btrim(reason)) between 5 and 300),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(organization_id,redemption_id) references public.loyalty_redemptions(organization_id,id)
);
create table private.loyalty_commands(organization_id uuid not null references public.organizations(id),request_key uuid not null,signature text not null,result_id uuid not null,created_at timestamptz not null default now(),primary key(organization_id,request_key));
create table private.loyalty_card_access(organization_id uuid not null,account_id uuid primary key,token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),expires_at timestamptz not null check(isfinite(expires_at)),revoked_at timestamptz,foreign key(organization_id,account_id) references public.loyalty_accounts(organization_id,id));
create table public.loyalty_events(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),actor_id uuid not null references auth.users(id),event text not null check(event in ('program.saved','reward.saved','card.issued','card.revoked')),created_at timestamptz not null default now());
revoke all on private.loyalty_allocations,private.loyalty_commands,private.loyalty_card_access from public,anon,authenticated;

create function private.loyalty_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Append only' using errcode='55000'; end;$$;
revoke all on function private.loyalty_immutable() from public,anon,authenticated;
create trigger loyalty_rules_immutable before update or delete on public.loyalty_rules for each row execute function private.loyalty_immutable();
create trigger loyalty_services_immutable before update or delete on public.loyalty_rule_services for each row execute function private.loyalty_immutable();
create trigger loyalty_transactions_immutable before update or delete on public.loyalty_transactions for each row execute function private.loyalty_immutable();
create trigger loyalty_allocations_immutable before update or delete on private.loyalty_allocations for each row execute function private.loyalty_immutable();
create trigger loyalty_redemptions_immutable before update or delete on public.loyalty_redemptions for each row execute function private.loyalty_immutable();
create trigger loyalty_voids_immutable before update or delete on public.loyalty_redemption_voids for each row execute function private.loyalty_immutable();
create trigger loyalty_events_immutable before update or delete on public.loyalty_events for each row execute function private.loyalty_immutable();
create trigger loyalty_program_touch before update on public.loyalty_programs for each row execute function private.touch_updated_at();
create trigger loyalty_reward_touch before update on public.loyalty_rewards for each row execute function private.touch_updated_at();

do $$declare name text;begin
 foreach name in array array['loyalty_programs','loyalty_rules','loyalty_rule_services','loyalty_accounts','loyalty_transactions','loyalty_rewards','loyalty_redemptions','loyalty_redemption_voids','loyalty_events'] loop
 execute format('alter table public.%I enable row level security',name);
 execute format('revoke all on public.%I from anon,authenticated',name);
 execute format('grant select on public.%I to authenticated',name);
 execute format('create policy owner_read on public.%I for select to authenticated using(private.organization_role(organization_id)=''owner'')',name);
 end loop;
end;$$;

create function private.loyalty_balance(target uuid) returns bigint language sql stable security definer set search_path='' as $$
 select coalesce(sum(t.amount-coalesce((select sum(a.amount) from private.loyalty_allocations a where a.credit_id=t.id),0)),0)::bigint from public.loyalty_transactions t where t.account_id=target and t.amount>0 and (t.expires_at is null or t.expires_at>now());
$$;
create function private.loyalty_account(target_org uuid,target_customer uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;program uuid;
begin
 if not exists(select 1 from public.customers where organization_id=target_org and id=target_customer and is_active) then raise exception 'Unavailable customer' using errcode='22023';end if;
 select id into program from public.loyalty_programs where organization_id=target_org;
 if program is null then raise exception 'Configure program first' using errcode='22023';end if;
 insert into public.loyalty_accounts(organization_id,program_id,customer_id) values(target_org,program,target_customer) on conflict(program_id,customer_id) do nothing;
 select id into result from public.loyalty_accounts where program_id=program and customer_id=target_customer;return result;
end;$$;
create function private.loyalty_command(target_org uuid,key uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare previous private.loyalty_commands;
begin
 if key is null then raise exception 'Request key required' using errcode='22023';end if;
 select * into previous from private.loyalty_commands where organization_id=target_org and request_key=key;
 if previous.result_id is not null and previous.signature<>encode(sha256(convert_to(payload::text,'UTF8')),'hex') then raise exception 'Reused key' using errcode='22023';end if;
 return previous.result_id;
end;$$;
create function private.loyalty_record_command(target_org uuid,key uuid,payload jsonb,result uuid) returns void language sql security definer set search_path='' as $$insert into private.loyalty_commands(organization_id,request_key,signature,result_id) values(target_org,key,encode(sha256(convert_to(payload::text,'UTF8')),'hex'),result);$$;
create function private.loyalty_consume(target_org uuid,target_account uuid,debit uuid,units integer) returns void language plpgsql security definer set search_path='' as $$
declare lot record;remaining integer:=units;take integer;lots integer:=0;
begin
 if units<=0 or private.loyalty_balance(target_account)<units then raise exception 'Insufficient balance' using errcode='P2001';end if;
 for lot in select t.id,t.amount-coalesce((select sum(a.amount) from private.loyalty_allocations a where a.credit_id=t.id),0) available from public.loyalty_transactions t where t.account_id=target_account and t.amount>0 and (t.expires_at is null or t.expires_at>now()) order by t.expires_at asc nulls last,t.created_at,t.id loop
  if lot.available<=0 then continue;end if;
  lots:=lots+1;if lots>1000 then raise exception 'Debit too fragmented' using errcode='P2002';end if;
  take:=least(remaining,lot.available);insert into private.loyalty_allocations values(target_org,target_account,debit,lot.id,take);remaining:=remaining-take;exit when remaining=0;
 end loop;
 if remaining<>0 then raise exception 'Insufficient balance' using errcode='P2001';end if;
end;$$;
revoke all on function private.loyalty_balance(uuid),private.loyalty_account(uuid,uuid),private.loyalty_command(uuid,uuid,jsonb),private.loyalty_record_command(uuid,uuid,jsonb,uuid),private.loyalty_consume(uuid,uuid,uuid,integer) from public,anon,authenticated;

create function public.save_loyalty_program(p_organization_id uuid,p_version integer,p_data jsonb,p_services jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare previous public.loyalty_programs;result uuid;rule uuid;zone text;first_day date;last_day date;item record;selected_mode text;
begin
 perform private.require_owner(p_organization_id);perform private.require_module(p_organization_id,'loyalty');
 select * into previous from public.loyalty_programs where organization_id=p_organization_id;
 if previous.id is not null and previous.version is distinct from p_version then raise exception 'Stale program' using errcode='40001';end if;
 if previous.id is null and p_version is not null then raise exception 'Stale program' using errcode='40001';end if;
 selected_mode:=p_data->>'mode';first_day:=(p_data->>'starts_on')::date;last_day:=(p_data->>'ends_on')::date;
 if selected_mode is null or selected_mode not in ('visits','points') or first_day is null or last_day is null or not isfinite(first_day) or not isfinite(last_day) or last_day<first_day or last_day-first_day>3650 or p_services is null or jsonb_typeof(p_services)<>'object' or (select count(*) from jsonb_object_keys(p_services)) not between 1 and 200 or (selected_mode='points' and p_data->>'reset_mode' is distinct from 'subtract') then raise exception 'Invalid rules' using errcode='22023';end if;
 if previous.id is not null and previous.mode<>selected_mode and exists(select 1 from public.loyalty_accounts a join public.loyalty_transactions t on t.account_id=a.id where a.program_id=previous.id) then raise exception 'Mode has history' using errcode='P2003';end if;
 select timezone into zone from public.organizations where id=p_organization_id;
 if previous.id is null then insert into public.loyalty_programs(organization_id,name,mode,is_active) values(p_organization_id,btrim(p_data->>'name'),selected_mode,(p_data->>'is_active')::boolean) returning id into result;
 else update public.loyalty_programs set name=btrim(p_data->>'name'),mode=selected_mode,is_active=(p_data->>'is_active')::boolean,version=version+1 where id=previous.id returning id into result;end if;
 insert into public.loyalty_rules(organization_id,program_id,version,starts_at,ends_at,conditions,expire_days,reset_mode,created_by) values(p_organization_id,result,coalesce(previous.version+1,1),first_day::timestamp at time zone zone,(last_day+1)::timestamp at time zone zone,btrim(p_data->>'conditions'),nullif(p_data->>'expire_days','')::integer,p_data->>'reset_mode',auth.uid()) returning id into rule;
 for item in select * from jsonb_each_text(p_services) loop
  if not exists(select 1 from public.services where organization_id=p_organization_id and id=item.key::uuid and is_active) or item.value::integer not between 1 and 10000 or (selected_mode='visits' and item.value::integer<>1) then raise exception 'Invalid participating service' using errcode='22023';end if;
  insert into public.loyalty_rule_services values(p_organization_id,rule,item.key::uuid,item.value::integer);
 end loop;
 insert into public.loyalty_events(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'program.saved');return result;
end;$$;
create function public.set_loyalty_program_active(p_organization_id uuid,p_version integer,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare program public.loyalty_programs;original public.loyalty_rules;rule uuid;
begin
 perform private.require_owner(p_organization_id);if p_active then perform private.require_module(p_organization_id,'loyalty');end if;
 if p_active is null then raise exception 'Invalid status' using errcode='22023';end if;
 select * into program from public.loyalty_programs where organization_id=p_organization_id;
 if program.id is null or program.version is distinct from p_version then raise exception 'Stale program' using errcode='40001';end if;
 select * into original from public.loyalty_rules where program_id=program.id and version=program.version;
 update public.loyalty_programs set is_active=p_active,version=version+1 where id=program.id;
 insert into public.loyalty_rules(organization_id,program_id,version,starts_at,ends_at,conditions,expire_days,reset_mode,created_by) values(p_organization_id,program.id,program.version+1,original.starts_at,original.ends_at,original.conditions,original.expire_days,original.reset_mode,auth.uid()) returning id into rule;
 insert into public.loyalty_rule_services select organization_id,rule,service_id,points from public.loyalty_rule_services where rule_id=original.id;
 insert into public.loyalty_events(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'program.saved');
end;$$;
create function public.save_loyalty_reward(p_organization_id uuid,p_id uuid,p_version integer,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare program uuid;result uuid;zone text;first_day date;last_day date;
begin
 perform private.require_owner(p_organization_id);perform private.require_module(p_organization_id,'loyalty');
 select id into program from public.loyalty_programs where organization_id=p_organization_id;select timezone into zone from public.organizations where id=p_organization_id;
 first_day:=(p_data->>'starts_on')::date;last_day:=(p_data->>'ends_on')::date;
 if program is null or first_day is null or last_day is null or not isfinite(first_day) or not isfinite(last_day) or last_day<first_day or last_day-first_day>3650 then raise exception 'Invalid reward period' using errcode='22023';end if;
 if p_id is null then
  if (select count(*) from public.loyalty_rewards where organization_id=p_organization_id)>=100 then raise exception 'Reward limit' using errcode='P2002';end if;
  insert into public.loyalty_rewards(organization_id,program_id,name,benefit,cost,conditions,starts_at,ends_at,per_customer_limit,total_limit,is_active) values(p_organization_id,program,btrim(p_data->>'name'),btrim(p_data->>'benefit'),(p_data->>'cost')::integer,btrim(p_data->>'conditions'),first_day::timestamp at time zone zone,(last_day+1)::timestamp at time zone zone,nullif(p_data->>'per_customer_limit','')::integer,nullif(p_data->>'total_limit','')::integer,(p_data->>'is_active')::boolean) returning id into result;
 else
  update public.loyalty_rewards set name=btrim(p_data->>'name'),benefit=btrim(p_data->>'benefit'),cost=(p_data->>'cost')::integer,conditions=btrim(p_data->>'conditions'),starts_at=first_day::timestamp at time zone zone,ends_at=(last_day+1)::timestamp at time zone zone,per_customer_limit=nullif(p_data->>'per_customer_limit','')::integer,total_limit=nullif(p_data->>'total_limit','')::integer,is_active=(p_data->>'is_active')::boolean,version=version+1 where organization_id=p_organization_id and id=p_id and version=p_version returning id into result;
  if result is null then raise exception 'Stale reward' using errcode='40001';end if;
 end if;
 insert into public.loyalty_events(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'reward.saved');return result;
end;$$;

create function private.credit_completed_loyalty() returns trigger language plpgsql security definer set search_path='' as $$
declare program public.loyalty_programs;rule public.loyalty_rules;units integer;account uuid;
begin
 if new.status<>'completed' or old.status=new.status or not private.has_module(new.organization_id,'loyalty') then return new;end if;
 perform 1 from public.organizations where id=new.organization_id for update;
 select * into program from public.loyalty_programs where organization_id=new.organization_id and is_active;
 if program.id is null then return new;end if;
 select * into rule from public.loyalty_rules where program_id=program.id and version=program.version and starts_at<=now() and ends_at>now() and starts_at<=new.ends_at and ends_at>new.ends_at;
 if rule.id is null or exists(select 1 from public.loyalty_transactions where appointment_id=new.id and kind='earned') then return new;end if;
 select points into units from public.loyalty_rule_services where rule_id=rule.id and service_id=new.service_id;
 if units is null then return new;end if;
 -- Un cliente archivado conserva historial pero no recibe beneficios nuevos.
 if not exists(select 1 from public.customers where id=new.customer_id and organization_id=new.organization_id and is_active) then return new;end if;
 account:=private.loyalty_account(new.organization_id,new.customer_id);
 if private.loyalty_balance(account)+units>1000000000 then raise exception 'Balance limit' using errcode='P2002';end if;
 insert into public.loyalty_transactions(organization_id,account_id,kind,amount,expires_at,appointment_id,rule_id,service_name,created_by) values(new.organization_id,account,'earned',units,case when rule.expire_days is null then null else now()+rule.expire_days*interval '1 day' end,new.id,rule.id,new.service_name,auth.uid());return new;
end;$$;
revoke all on function private.credit_completed_loyalty() from public,anon,authenticated;
create trigger appointments_loyalty after update on public.appointments for each row execute function private.credit_completed_loyalty();

create function public.adjust_loyalty_balance(p_organization_id uuid,p_customer_id uuid,p_amount integer,p_reason text,p_reference uuid,p_request_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare account uuid;result uuid;payload jsonb;days integer;
begin
 perform private.require_owner(p_organization_id);perform private.require_module(p_organization_id,'loyalty');
 if p_amount is null or p_amount=0 or abs(p_amount::bigint)>1000000 or p_reason is null or char_length(btrim(p_reason)) not between 5 and 300 then raise exception 'Invalid adjustment' using errcode='22023';end if;
 payload:=jsonb_build_array('adjust',p_customer_id,p_amount,btrim(p_reason),p_reference);result:=private.loyalty_command(p_organization_id,p_request_key,payload);if result is not null then return result;end if;
 account:=private.loyalty_account(p_organization_id,p_customer_id);
 if p_reference is not null and not exists(select 1 from public.loyalty_transactions where account_id=account and id=p_reference) then raise exception 'Invalid reference' using errcode='22023';end if;
 if p_amount>0 and private.loyalty_balance(account)+p_amount>1000000000 then raise exception 'Balance limit' using errcode='P2002';end if;
 select r.expire_days into days from public.loyalty_programs p join public.loyalty_rules r on r.program_id=p.id and r.version=p.version where p.organization_id=p_organization_id;
 insert into public.loyalty_transactions(organization_id,account_id,kind,amount,expires_at,related_transaction_id,reason,created_by) values(p_organization_id,account,'adjustment',p_amount,case when p_amount>0 and days is not null then now()+days*interval '1 day' else null end,p_reference,btrim(p_reason),auth.uid()) returning id into result;
 if p_amount<0 then perform private.loyalty_consume(p_organization_id,account,result,-p_amount);end if;
 perform private.loyalty_record_command(p_organization_id,p_request_key,payload,result);return result;
end;$$;
create function public.redeem_loyalty_reward(p_organization_id uuid,p_customer_id uuid,p_reward_id uuid,p_reward_version integer,p_request_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare account uuid;program public.loyalty_programs;rule public.loyalty_rules;reward public.loyalty_rewards;payload jsonb;result uuid;debit uuid;units integer;
begin
 perform private.require_owner(p_organization_id);perform private.require_module(p_organization_id,'loyalty');
 payload:=jsonb_build_array('redeem',p_customer_id,p_reward_id,p_reward_version);result:=private.loyalty_command(p_organization_id,p_request_key,payload);if result is not null then return result;end if;
 account:=private.loyalty_account(p_organization_id,p_customer_id);
 select * into program from public.loyalty_programs where organization_id=p_organization_id and is_active;
 select * into rule from public.loyalty_rules where program_id=program.id and version=program.version and starts_at<=now() and ends_at>now();
 select * into reward from public.loyalty_rewards where organization_id=p_organization_id and id=p_reward_id;
 if reward.version is distinct from p_reward_version then raise exception 'Stale reward' using errcode='40001';end if;
 if rule.id is null or reward.id is null or not reward.is_active or reward.starts_at>now() or reward.ends_at<=now() then raise exception 'Reward unavailable' using errcode='22023';end if;
 if (reward.per_customer_limit is not null and (select count(*) from public.loyalty_redemptions r where r.reward_id=reward.id and r.account_id=account and not exists(select 1 from public.loyalty_redemption_voids v where v.redemption_id=r.id))>=reward.per_customer_limit) or (reward.total_limit is not null and (select count(*) from public.loyalty_redemptions r where r.reward_id=reward.id and not exists(select 1 from public.loyalty_redemption_voids v where v.redemption_id=r.id))>=reward.total_limit) then raise exception 'Reward usage limit' using errcode='P2002';end if;
 if private.loyalty_balance(account)<reward.cost then raise exception 'Insufficient balance' using errcode='P2001';end if;
 units:=case when program.mode='visits' and rule.reset_mode='reset' then private.loyalty_balance(account)::integer else reward.cost end;
 insert into public.loyalty_transactions(organization_id,account_id,kind,amount,reason,created_by) values(p_organization_id,account,'redeemed',-units,reward.name,auth.uid()) returning id into debit;
 perform private.loyalty_consume(p_organization_id,account,debit,units);
 insert into public.loyalty_redemptions(organization_id,account_id,reward_id,transaction_id,reward_snapshot,created_by) values(p_organization_id,account,reward.id,debit,jsonb_build_object('name',reward.name,'benefit',reward.benefit,'cost',reward.cost,'conditions',reward.conditions,'version',reward.version,'mode',program.mode,'reset_mode',rule.reset_mode,'consumed',units),auth.uid()) returning id into result;
 perform private.loyalty_record_command(p_organization_id,p_request_key,payload,result);return result;
end;$$;
create function public.void_loyalty_redemption(p_organization_id uuid,p_redemption_id uuid,p_reason text,p_request_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare item public.loyalty_redemptions;result uuid;payload jsonb;lot record;restored bigint;
begin
 perform private.require_owner(p_organization_id);perform private.require_module(p_organization_id,'loyalty');
 if p_reason is null or char_length(btrim(p_reason)) not between 5 and 300 then raise exception 'Reason required' using errcode='22023';end if;
 payload:=jsonb_build_array('void',p_redemption_id,btrim(p_reason));result:=private.loyalty_command(p_organization_id,p_request_key,payload);if result is not null then return result;end if;
 select * into item from public.loyalty_redemptions where organization_id=p_organization_id and id=p_redemption_id;
 if item.id is null or exists(select 1 from public.loyalty_redemption_voids where redemption_id=item.id) then raise exception 'Already void or unavailable' using errcode='22023';end if;
 select coalesce(sum(a.amount) filter(where t.expires_at is null or t.expires_at>now()),0) into restored from private.loyalty_allocations a join public.loyalty_transactions t on t.id=a.credit_id where a.debit_id=item.transaction_id;
 if private.loyalty_balance(item.account_id)+restored>1000000000 then raise exception 'Balance limit' using errcode='P2002';end if;
 insert into public.loyalty_redemption_voids(organization_id,redemption_id,reason,created_by) values(p_organization_id,item.id,btrim(p_reason),auth.uid()) returning id into result;
 for lot in select a.amount,t.expires_at from private.loyalty_allocations a join public.loyalty_transactions t on t.id=a.credit_id where a.debit_id=item.transaction_id loop
  insert into public.loyalty_transactions(organization_id,account_id,kind,amount,expires_at,related_transaction_id,reason,created_by) values(p_organization_id,item.account_id,'refund',lot.amount,lot.expires_at,item.transaction_id,btrim(p_reason),auth.uid());
 end loop;
 perform private.loyalty_record_command(p_organization_id,p_request_key,payload,result);return result;
end;$$;

create function public.issue_loyalty_card(p_organization_id uuid,p_customer_id uuid,p_token_hash text) returns void language plpgsql security definer set search_path='' as $$
declare account uuid;
begin
 perform private.require_owner(p_organization_id);perform private.require_module(p_organization_id,'loyalty');account:=private.loyalty_account(p_organization_id,p_customer_id);
 insert into private.loyalty_card_access(organization_id,account_id,token_hash,expires_at) values(p_organization_id,account,p_token_hash,now()+interval '90 days') on conflict(account_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,revoked_at=null;
 insert into public.loyalty_events(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'card.issued');
end;$$;
create function public.revoke_loyalty_card(p_organization_id uuid,p_customer_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_owner(p_organization_id);
 update private.loyalty_card_access set revoked_at=now() where organization_id=p_organization_id and account_id in(select id from public.loyalty_accounts where organization_id=p_organization_id and customer_id=p_customer_id);
 insert into public.loyalty_events(organization_id,actor_id,event) values(p_organization_id,auth.uid(),'card.revoked');
end;$$;
create function private.loyalty_reward_available(reward public.loyalty_rewards,target_account uuid) returns boolean language sql stable security definer set search_path='' as $$
 select reward.is_active and reward.starts_at<=now() and reward.ends_at>now() and (reward.per_customer_limit is null or (select count(*) from public.loyalty_redemptions r where r.reward_id=reward.id and r.account_id=target_account and not exists(select 1 from public.loyalty_redemption_voids v where v.redemption_id=r.id))<reward.per_customer_limit) and (reward.total_limit is null or (select count(*) from public.loyalty_redemptions r where r.reward_id=reward.id and not exists(select 1 from public.loyalty_redemption_voids v where v.redemption_id=r.id))<reward.total_limit);
$$;
create function private.loyalty_expiry(target uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('next_expiry',min(expires_at) filter(where expires_at>now()),'expired_balance',coalesce(sum(remaining) filter(where expires_at<=now()),0)) from(select t.expires_at,t.amount-coalesce((select sum(a.amount) from private.loyalty_allocations a where a.credit_id=t.id),0) remaining from public.loyalty_transactions t where t.account_id=target and t.amount>0) lots where remaining>0;
$$;
revoke all on function private.loyalty_expiry(uuid) from public,anon,authenticated;
create function public.get_loyalty_accounts(p_organization_id uuid,p_search text default '',p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.organization_role(p_organization_id) is distinct from 'owner' then raise exception 'Forbidden' using errcode='42501';end if;
 if p_search is null or char_length(p_search)>100 or p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Invalid filter' using errcode='22023';end if;
 return coalesce((select jsonb_agg(row) from(select a.customer_id,c.name,c.is_active,private.loyalty_balance(a.id) balance from public.loyalty_accounts a join public.customers c on c.organization_id=a.organization_id and c.id=a.customer_id where a.organization_id=p_organization_id and position(lower(btrim(p_search)) in lower(c.name||' '||c.email))>0 order by c.name,a.id limit 50 offset p_offset) row),'[]'::jsonb);
end;$$;
create function public.get_loyalty_config(p_organization_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare program public.loyalty_programs;rule public.loyalty_rules;
begin
 if private.organization_role(p_organization_id) is distinct from 'owner' then raise exception 'Forbidden' using errcode='42501';end if;
 select * into program from public.loyalty_programs where organization_id=p_organization_id;select * into rule from public.loyalty_rules where program_id=program.id and version=program.version;
 return jsonb_build_object('program',case when program.id is null then null else to_jsonb(program) end,'rule',case when rule.id is null then null else to_jsonb(rule) end,
 'services',coalesce((select jsonb_agg(s) from public.loyalty_rule_services s where rule_id=rule.id),'[]'::jsonb),
 'rewards',coalesce((select jsonb_agg(r order by r.cost,r.name) from public.loyalty_rewards r where program_id=program.id),'[]'::jsonb),
 'mode_locked',exists(select 1 from public.loyalty_accounts a join public.loyalty_transactions t on t.account_id=a.id where a.program_id=program.id));
end;$$;
create function public.get_loyalty_customer(p_organization_id uuid,p_customer_id uuid,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare account public.loyalty_accounts;program public.loyalty_programs;
begin
 if private.organization_role(p_organization_id) is distinct from 'owner' then raise exception 'Forbidden' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Invalid page' using errcode='22023';end if;
 if not exists(select 1 from public.customers where organization_id=p_organization_id and id=p_customer_id) then raise exception 'Not found' using errcode='P0002';end if;
 select * into program from public.loyalty_programs where organization_id=p_organization_id;
 select * into account from public.loyalty_accounts where program_id=program.id and customer_id=p_customer_id;
 return jsonb_build_object('account_id',account.id,'balance',private.loyalty_balance(account.id),'expiry',private.loyalty_expiry(account.id),
 'can_redeem',private.has_module(p_organization_id,'loyalty') and coalesce(program.is_active,false) and exists(select 1 from public.loyalty_rules where program_id=program.id and version=program.version and starts_at<=now() and ends_at>now()) and exists(select 1 from public.customers where id=p_customer_id and organization_id=p_organization_id and is_active),
 'available_rewards',coalesce((select jsonb_agg(r.id) from public.loyalty_rewards r where r.program_id=program.id and private.loyalty_reward_available(r,account.id)),'[]'::jsonb),
 'card', (select jsonb_build_object('expires_at',expires_at,'revoked',revoked_at is not null) from private.loyalty_card_access where account_id=account.id),
 'transactions',coalesce((select jsonb_agg(row) from(select t.*,r.version rule_version from public.loyalty_transactions t left join public.loyalty_rules r on r.id=t.rule_id where t.account_id=account.id order by t.created_at desc,t.id limit 50 offset p_offset) row),'[]'::jsonb),
 'redemptions',coalesce((select jsonb_agg(row) from(select r.*,exists(select 1 from public.loyalty_redemption_voids v where v.redemption_id=r.id) voided from public.loyalty_redemptions r where r.account_id=account.id order by r.created_at desc,r.id limit 20) row),'[]'::jsonb));
end;$$;
create function public.get_loyalty_card(p_token text,p_visitor text) returns jsonb language plpgsql security definer set search_path='' as $$
declare account public.loyalty_accounts;program public.loyalty_programs;rule public.loyalty_rules;access private.loyalty_card_access;balance bigint;operational boolean;
begin
 if not private.public_request_guard(p_visitor) then return jsonb_build_object('ok',false,'code','rate_limited');end if;
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'code','not_found');end if;
 select * into access from private.loyalty_card_access where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null and expires_at>now();
 select a.* into account from public.loyalty_accounts a join public.organizations o on o.id=a.organization_id and o.status='active' join public.customers c on c.organization_id=a.organization_id and c.id=a.customer_id and c.is_active where a.id=access.account_id;
 if account.id is null then return jsonb_build_object('ok',false,'code','not_found');end if;
 select * into program from public.loyalty_programs where id=account.program_id;select * into rule from public.loyalty_rules where program_id=program.id and version=program.version;
 balance:=private.loyalty_balance(account.id);operational:=private.has_module(account.organization_id,'loyalty') and program.is_active and rule.starts_at<=now() and rule.ends_at>now();
 return jsonb_build_object('ok',true,'card',jsonb_build_object('organization_name',(select name from public.organizations where id=account.organization_id),'timezone',(select timezone from public.organizations where id=account.organization_id),'program_name',program.name,'mode',program.mode,'balance',balance,'expiry',private.loyalty_expiry(account.id),'operational',operational,'conditions',rule.conditions,'reset_mode',rule.reset_mode,'expire_days',rule.expire_days,'expires_at',access.expires_at,
 'rewards',coalesce((select jsonb_agg(jsonb_build_object('name',r.name,'benefit',r.benefit,'cost',r.cost,'conditions',r.conditions,'starts_at',r.starts_at,'ends_at',r.ends_at,'available',operational and balance>=r.cost and private.loyalty_reward_available(r,account.id)) order by r.cost,r.name) from public.loyalty_rewards r where r.program_id=program.id and r.is_active),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(row) from(select kind,amount,expires_at,created_at,case when kind='earned' then service_name else '' end service_name from public.loyalty_transactions where account_id=account.id order by created_at desc,id limit 20) row),'[]'::jsonb)));
end;$$;
revoke all on function private.loyalty_reward_available(public.loyalty_rewards,uuid) from public,anon,authenticated;
revoke all on function public.save_loyalty_program(uuid,integer,jsonb,jsonb),public.set_loyalty_program_active(uuid,integer,boolean),public.save_loyalty_reward(uuid,uuid,integer,jsonb),public.adjust_loyalty_balance(uuid,uuid,integer,text,uuid,uuid),public.redeem_loyalty_reward(uuid,uuid,uuid,integer,uuid),public.void_loyalty_redemption(uuid,uuid,text,uuid),public.issue_loyalty_card(uuid,uuid,text),public.revoke_loyalty_card(uuid,uuid),public.get_loyalty_customer(uuid,uuid,integer),public.get_loyalty_accounts(uuid,text,integer),public.get_loyalty_config(uuid) from public,anon;
grant execute on function public.save_loyalty_program(uuid,integer,jsonb,jsonb),public.set_loyalty_program_active(uuid,integer,boolean),public.save_loyalty_reward(uuid,uuid,integer,jsonb),public.adjust_loyalty_balance(uuid,uuid,integer,text,uuid,uuid),public.redeem_loyalty_reward(uuid,uuid,uuid,integer,uuid),public.void_loyalty_redemption(uuid,uuid,text,uuid),public.issue_loyalty_card(uuid,uuid,text),public.revoke_loyalty_card(uuid,uuid),public.get_loyalty_customer(uuid,uuid,integer),public.get_loyalty_accounts(uuid,text,integer),public.get_loyalty_config(uuid) to authenticated;
revoke all on function public.get_loyalty_card(text,text) from public,authenticated;
grant execute on function public.get_loyalty_card(text,text) to anon;
commit;
