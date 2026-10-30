begin;

-- Lectura derivada; no guarda casillas manuales ni modifica reservas/configuración.
create function public.get_business_onboarding(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if private.organization_role(p_organization_id) is distinct from 'owner' then
  raise exception 'Forbidden' using errcode='42501';
 end if;
 with working as (
  select staff_id,weekday,range_agg(int4range(start_minute,end_minute,'[)')) spans
  from public.availability_rules
  where organization_id=p_organization_id and kind='working' group by staff_id,weekday
 ), breaks as (
  select staff_id,weekday,range_agg(int4range(start_minute,end_minute,'[)')) spans
  from public.availability_rules
  where organization_id=p_organization_id and kind='break' group by staff_id,weekday
 ), free as (
  select w.staff_id,w.weekday,w.spans-coalesce(b.spans,'{}'::int4multirange) spans
  from working w left join breaks b on b.staff_id is not distinct from w.staff_id and b.weekday=w.weekday
 ), assignments as (
  select s.duration_minutes+s.preparation_minutes minutes,p.id staff_id
  from public.services s
  join public.staff_services a on a.organization_id=p_organization_id and a.service_id=s.id
  join public.staff_profiles p on p.organization_id=p_organization_id and p.id=a.staff_id and p.is_active
  where s.organization_id=p_organization_id and s.is_active
 ), matches as (
  select 1 from assignments a
  join free f on f.staff_id=a.staff_id
  join free b on b.staff_id is null and b.weekday=f.weekday
  cross join lateral unnest(f.spans*b.spans) segment
  where upper(segment)-lower(segment)>=a.minutes limit 1
 )
 select jsonb_build_object(
  'professional_ready',exists(select 1 from public.staff_profiles where organization_id=p_organization_id and is_active),
  'service_ready',exists(select 1 from assignments),
  'business_hours_ready',exists(select 1 from working where staff_id is null),
  'matching_hours_ready',exists(select 1 from matches),
  'booking_recorded',exists(select 1 from public.appointments where organization_id=p_organization_id),
  'public_enabled',exists(select 1 from public.public_booking_settings where organization_id=p_organization_id and enabled)
 ) into result;
 return result;
end; $$;
revoke all on function public.get_business_onboarding(uuid) from public,anon;
grant execute on function public.get_business_onboarding(uuid) to authenticated;
comment on function public.get_business_onboarding(uuid) is 'Owner-only weekly setup checks; actual slots still validate exceptions, dates, advance and subscription.';

commit;
