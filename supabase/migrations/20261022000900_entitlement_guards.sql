begin;
create function private.enforce_business_entitlements() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; maximum integer; brand_changed boolean;
begin
 if tg_table_name='organizations' then target:=new.id; else target:=new.organization_id; end if;
 perform 1 from public.organizations where id=target for update;
 if tg_table_name='organizations' then
  if new.status is distinct from old.status and private.is_platform_admin() and (to_jsonb(new)-array['status','updated_at'])=(to_jsonb(old)-array['status','updated_at']) then return new; end if;
  perform private.require_module(target,'bookings');return new;
 end if;
 if tg_table_name='organization_members' then
  if new.role='owner' or not new.is_active then return new; end if;
  perform private.require_module(target,'team_access');return new;
 end if;
 if tg_table_name='organization_invites' then
  if tg_op='UPDATE' and new.revoked_at is not null then return new; end if;
  perform private.require_module(target,'team_access');return new;
 end if;
 if tg_table_name='appointments' then
  -- Cancelar un turno existente sigue permitido al vencer o suspender el plan.
  if tg_op='UPDATE' and new.status='canceled' and old.status<>new.status and (to_jsonb(new)-array['status','version','updated_at'])=(to_jsonb(old)-array['status','version','updated_at']) then return new; end if;
  perform private.require_module(target,'bookings');
  if (tg_op='INSERT' and new.source='public') or (tg_op='UPDATE' and auth.uid() is null and new.starts_at<>old.starts_at) then perform private.require_module(target,'public_booking'); end if;
  return new;
 end if;
 if tg_table_name='public_booking_settings' then
  brand_changed:=case when tg_op='INSERT' then new.logo_url is not null or new.cover_url is not null or new.primary_color<>'#355741' or new.secondary_color<>'#eaf0e6' else (new.logo_url,new.cover_url,new.primary_color,new.secondary_color) is distinct from (old.logo_url,old.cover_url,old.primary_color,old.secondary_color) end;
  if brand_changed then perform private.require_module(target,'branding'); end if;
  if new.enabled then perform private.require_module(target,'public_booking'); end if;
  return new;
 end if;
 if tg_table_name='notification_settings' then
  if new.enabled then perform private.require_module(target,'notifications'); end if;
  return new;
 end if;
 if tg_table_name='customers' then
  if tg_op='INSERT' then perform private.require_module(target,'bookings');return new; end if;
  if not new.transactional_email and not new.marketing_consent and (to_jsonb(new)-array['transactional_email','marketing_consent','consent_evidence','consent_updated_at','version','updated_at'])=(to_jsonb(old)-array['transactional_email','marketing_consent','consent_evidence','consent_updated_at','version','updated_at']) then return new; end if;
  perform private.require_module(target,'customers');return new;
 end if;
 if tg_table_name='staff_profiles' then
  if tg_op='UPDATE' and not new.is_active and (to_jsonb(new)-array['is_active','updated_at'])=(to_jsonb(old)-array['is_active','updated_at']) then return new; end if;
  perform private.require_module(target,'bookings');
  if new.user_id is not null and (tg_op='INSERT' or new.user_id is distinct from old.user_id) and not exists(select 1 from public.organization_members where organization_id=target and user_id=new.user_id and role='owner' and is_active) then perform private.require_module(target,'team_access'); end if;
  if new.is_active and (tg_op='INSERT' or not old.is_active) then
   select p.max_professionals into maximum from public.organization_subscriptions s join public.subscription_plans p on p.code=s.plan_code where s.organization_id=target;
   if (select count(*) from public.staff_profiles where organization_id=target and is_active and id<>new.id)>=maximum then raise exception 'Professional capacity reached' using errcode='P1002'; end if;
  end if;
  return new;
 end if;
 perform private.require_module(target,'bookings');return new;
end; $$;
revoke all on function private.enforce_business_entitlements() from public,anon,authenticated;
create trigger organizations_license before update on public.organizations for each row execute function private.enforce_business_entitlements();
create trigger organization_settings_license before insert or update on public.organization_settings for each row execute function private.enforce_business_entitlements();
create trigger members_license before insert or update on public.organization_members for each row execute function private.enforce_business_entitlements();
create trigger invites_license before insert or update on public.organization_invites for each row execute function private.enforce_business_entitlements();
create trigger appointments_license before insert or update on public.appointments for each row execute function private.enforce_business_entitlements();
create trigger public_settings_license before insert or update on public.public_booking_settings for each row execute function private.enforce_business_entitlements();
create trigger notifications_settings_license before insert or update on public.notification_settings for each row execute function private.enforce_business_entitlements();
create trigger customers_license before insert or update on public.customers for each row execute function private.enforce_business_entitlements();
create trigger services_license before insert or update on public.services for each row execute function private.enforce_business_entitlements();
create trigger staff_license before insert or update on public.staff_profiles for each row execute function private.enforce_business_entitlements();
create trigger staff_services_license before insert or update on public.staff_services for each row execute function private.enforce_business_entitlements();
create trigger availability_license before insert or update on public.availability_rules for each row execute function private.enforce_business_entitlements();
create trigger exceptions_license before insert or update on public.availability_exceptions for each row execute function private.enforce_business_entitlements();
create trigger booking_settings_license before insert or update on public.booking_settings for each row execute function private.enforce_business_entitlements();

-- Mantiene los contratos anteriores; los originales dejan de ser API invocable.
alter function public.get_public_booking_catalog(text,text) set schema private;
alter function private.get_public_booking_catalog(text,text) rename to original_public_booking_catalog;
revoke all on function private.original_public_booking_catalog(text,text) from public,anon,authenticated;
create function public.get_public_booking_catalog(p_slug text,p_visitor text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; result jsonb;
begin
 perform private.require_public_gateway();select id into target from public.organizations where slug=p_slug;
 if not private.has_module(target,'bookings') or not private.has_module(target,'public_booking') then return jsonb_build_object('ok',false,'code','not_found'); end if;
 result:=private.original_public_booking_catalog(p_slug,p_visitor);
 if result->>'ok'='true' and not private.has_module(target,'branding') then
  result:=jsonb_set(result,'{catalog,settings,logo_url}','null');result:=jsonb_set(result,'{catalog,settings,cover_url}','null');
  result:=jsonb_set(result,'{catalog,settings,primary_color}','"#355741"');result:=jsonb_set(result,'{catalog,settings,secondary_color}','"#eaf0e6"');
 end if;return result;
end; $$;
alter function private.public_slots(uuid,uuid,uuid,date,public.appointments) rename to original_public_slots;
create function private.public_slots(target_org uuid,target_service uuid,target_staff uuid,target_day date,original public.appointments default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_module(target_org,'bookings') or not private.has_module(target_org,'public_booking') then return '[]'::jsonb; end if;
 return private.original_public_slots(target_org,target_service,target_staff,target_day,original);
end; $$;
revoke all on function private.public_slots(uuid,uuid,uuid,date,public.appointments),private.original_public_slots(uuid,uuid,uuid,date,public.appointments) from public,anon,authenticated;
alter function public.create_public_booking(text,uuid,uuid,timestamptz,text,text,text,uuid,text,text,timestamptz,timestamptz) set schema private;
alter function private.create_public_booking(text,uuid,uuid,timestamptz,text,text,text,uuid,text,text,timestamptz,timestamptz) rename to original_create_public_booking;
revoke all on function private.original_create_public_booking(text,uuid,uuid,timestamptz,text,text,text,uuid,text,text,timestamptz,timestamptz) from public,anon,authenticated;
create function public.create_public_booking(p_slug text,p_service_id uuid,p_staff_id uuid,p_starts_at timestamptz,p_customer_name text,p_customer_email text,p_customer_phone text,p_request_key uuid,p_token_hash text,p_visitor text,p_service_version timestamptz,p_settings_version timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 perform private.require_public_gateway();select id into target from public.organizations where slug=p_slug;
 if not private.has_module(target,'bookings') or not private.has_module(target,'public_booking') then return jsonb_build_object('ok',false,'code','not_found'); end if;
 return private.original_create_public_booking(p_slug,p_service_id,p_staff_id,p_starts_at,p_customer_name,p_customer_email,p_customer_phone,p_request_key,p_token_hash,p_visitor,p_service_version,p_settings_version);
exception when sqlstate 'P1001' then return jsonb_build_object('ok',false,'code','unavailable');
end; $$;
revoke all on function public.get_public_booking_catalog(text,text),public.create_public_booking(text,uuid,uuid,timestamptz,text,text,text,uuid,text,text,timestamptz,timestamptz) from public,authenticated;
grant execute on function public.get_public_booking_catalog(text,text),public.create_public_booking(text,uuid,uuid,timestamptz,text,text,text,uuid,text,text,timestamptz,timestamptz) to anon;

alter function public.save_customer(uuid,uuid,integer,jsonb) set schema private;
alter function private.save_customer(uuid,uuid,integer,jsonb) rename to original_save_customer;
revoke all on function private.original_save_customer(uuid,uuid,integer,jsonb) from public,anon,authenticated;
create function public.save_customer(p_organization_id uuid,p_id uuid,p_version integer,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
begin perform private.require_owner(p_organization_id);perform private.require_module(p_organization_id,'customers');return private.original_save_customer(p_organization_id,p_id,p_version,p_data);end; $$;
revoke all on function public.save_customer(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.save_customer(uuid,uuid,integer,jsonb) to authenticated;

alter function private.notification_eligible(public.notification_jobs) rename to original_notification_eligible;
create function private.notification_eligible(job public.notification_jobs) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_module(job.organization_id,'bookings') and private.has_module(job.organization_id,'notifications') and private.original_notification_eligible(job);
$$;
revoke all on function private.notification_eligible(public.notification_jobs),private.original_notification_eligible(public.notification_jobs) from public,anon,authenticated;
create or replace function private.queue_appointment_notifications() returns trigger language plpgsql security definer set search_path='' as $$
declare settings public.notification_settings; event_kind text;
begin
 if not private.has_module(new.organization_id,'bookings') or not private.has_module(new.organization_id,'notifications') then return new; end if;
 if tg_op='UPDATE' and new.version=old.version then return new; end if;
 select * into settings from public.notification_settings where organization_id=new.organization_id and enabled;
 if settings.organization_id is null then return new; end if;
 if tg_op='INSERT' then event_kind:='created';
 elsif new.status='canceled' and old.status<>new.status then event_kind:='canceled';
 elsif new.starts_at<>old.starts_at then event_kind:='rescheduled';
 elsif new.status='confirmed' and old.status<>new.status then event_kind:='confirmed'; end if;
 if event_kind is not null and (event_kind='canceled' or new.starts_at>now()) then perform private.enqueue_notification(new,event_kind,now()); end if;
 if settings.reminders_enabled and new.status='confirmed' and new.starts_at-settings.reminder_minutes*interval '1 minute'>now() then perform private.enqueue_notification(new,'reminder',new.starts_at-settings.reminder_minutes*interval '1 minute'); end if;
 return new;
end; $$;
alter function public.get_available_slots(uuid,uuid,uuid,date,uuid) set schema private;
alter function private.get_available_slots(uuid,uuid,uuid,date,uuid) rename to original_available_slots;
revoke all on function private.original_available_slots(uuid,uuid,uuid,date,uuid) from public,anon,authenticated;
create function public.get_available_slots(p_organization_id uuid,p_service_id uuid,p_staff_id uuid,p_day date,p_appointment_id uuid default null)
returns table(starts_at timestamptz,ends_at timestamptz,occupied_until timestamptz) language plpgsql security definer set search_path='' as $$
begin
 perform private.require_agenda(p_organization_id,p_staff_id);
 if not private.has_module(p_organization_id,'bookings') then return; end if;
 return query select * from private.original_available_slots(p_organization_id,p_service_id,p_staff_id,p_day,p_appointment_id);
end; $$;
revoke all on function public.get_available_slots(uuid,uuid,uuid,date,uuid) from public,anon;
grant execute on function public.get_available_slots(uuid,uuid,uuid,date,uuid) to authenticated;
commit;
