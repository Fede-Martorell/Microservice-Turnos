begin;

-- Estadísticas básicas del propietario; no habilita el complemento de analítica avanzada.
create index appointment_history_recent_idx on public.appointment_history(organization_id,created_at desc,id desc);

create function public.get_business_dashboard(p_organization_id uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare zone text; first_instant timestamptz; last_instant timestamptz; today date; result jsonb;
begin
 if private.organization_role(p_organization_id) is distinct from 'owner' then
  raise exception 'Forbidden' using errcode='42501';
 end if;
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to)
 or p_from<date '2000-01-01' or p_to>date '2100-12-31' or p_to<p_from or p_to-p_from>92 then
  raise exception 'Invalid reporting period' using errcode='22023';
 end if;
 select timezone into zone from public.organizations where id=p_organization_id;
 first_instant:=p_from::timestamp at time zone zone;
 last_instant:=(p_to+1)::timestamp at time zone zone;
 today:=(now() at time zone zone)::date;

 with period as materialized (
  select id,service_id,customer_id,status,starts_at from public.appointments
  where organization_id=p_organization_id and starts_at>=first_instant and starts_at<last_instant
 ), counts as (
  select count(*) total,count(*) filter(where status='pending') pending,
   count(*) filter(where status='confirmed') confirmed,count(*) filter(where status='completed') completed,
   count(*) filter(where status='canceled') canceled,count(*) filter(where status='no_show') no_show from period
 ), customers as (
  select customer_id,count(*) visits from period where status='completed' and customer_id is not null group by customer_id
 ), per_day as (
  select (starts_at at time zone zone)::date as day,count(*) total,
   count(*) filter(where status='completed') completed,count(*) filter(where status='canceled') canceled from period group by 1
 ), series as (
  select p_from+i as day,coalesce(d.total,0) total,coalesce(d.completed,0) completed,coalesce(d.canceled,0) canceled
  from generate_series(0,p_to-p_from) i left join per_day d on d.day=p_from+i
 ), popular as (
  select p.service_id,s.name,count(*) total,count(*) filter(where p.status='completed') completed
  from period p join public.services s on s.organization_id=p_organization_id and s.id=p.service_id
  group by p.service_id,s.name order by total desc,p.service_id limit 5
 ), today_counts as (
  select count(*) total,count(*) filter(where status='pending') pending,
   count(*) filter(where status='confirmed') confirmed,count(*) filter(where status='completed') completed,
   count(*) filter(where status='canceled') canceled,count(*) filter(where status='no_show') no_show
  from public.appointments where organization_id=p_organization_id
   and starts_at>=today::timestamp at time zone zone and starts_at<(today+1)::timestamp at time zone zone
 ), upcoming as (
  select id,customer_name,service_name,staff_name,starts_at,status from public.appointments
  where organization_id=p_organization_id and status in ('pending','confirmed')
   and starts_at>=now() and starts_at<(today+7)::timestamp at time zone zone
  order by starts_at,id limit 5
 ), recent as (
  select h.id,h.appointment_id,h.event,h.to_status,h.created_at,a.customer_name,a.service_name
  from public.appointment_history h join public.appointments a on a.organization_id=h.organization_id and a.id=h.appointment_id
  where h.organization_id=p_organization_id order by h.created_at desc,h.id desc limit 10
 )
 select jsonb_build_object(
  'as_of',now(),'timezone',zone,'today',today,'from',p_from,'to',p_to,
  'counts',(select to_jsonb(counts) from counts),
  'customers',jsonb_build_object('attended',(select count(*) from customers),'recurring',(select count(*) from customers where visits>=2)),
  'series',(select jsonb_agg(to_jsonb(series) order by day) from series),
  'services',coalesce((select jsonb_agg(to_jsonb(popular) order by total desc,service_id) from popular),'[]'::jsonb),
  'today_counts',(select to_jsonb(today_counts) from today_counts),
  'upcoming',coalesce((select jsonb_agg(to_jsonb(upcoming) order by starts_at,id) from upcoming),'[]'::jsonb),
  'activity',coalesce((select jsonb_agg(to_jsonb(recent) order by created_at desc,id desc) from recent),'[]'::jsonb)
 ) into result;
 return result;
end; $$;
revoke all on function public.get_business_dashboard(uuid,date,date) from public,anon;
grant execute on function public.get_business_dashboard(uuid,date,date) to authenticated;
commit;
