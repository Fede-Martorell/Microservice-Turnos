begin;
-- También prolonga la vigencia cuando el equipo reprograma desde el panel privado.
create function private.sync_public_booking_expiry() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.source='public' and new.occupied_until is distinct from old.occupied_until then
  update private.public_booking_access set expires_at=new.occupied_until+interval '7 days' where appointment_id=new.id;
 end if;
 return new;
end; $$;
revoke all on function private.sync_public_booking_expiry() from public,anon,authenticated;
create trigger appointments_public_expiry after update of occupied_until on public.appointments for each row execute function private.sync_public_booking_expiry();
commit;
