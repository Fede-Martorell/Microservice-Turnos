begin;
-- El rol API authenticated lo comparten owner y staff: RLS protege filas,
-- pero las columnas privadas requieren un contrato separado para owner.
revoke select on public.customers from authenticated;
grant select(id,organization_id,name,email,phone,is_active,version,created_at,updated_at) on public.customers to authenticated;
create function public.get_customer_preferences(p_organization_id uuid,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.organization_role(p_organization_id) is distinct from 'owner' then raise exception 'Forbidden' using errcode='42501'; end if;
 return (select jsonb_build_object('transactional_email',transactional_email,'marketing_consent',marketing_consent,'consent_evidence',consent_evidence,'consent_updated_at',consent_updated_at) from public.customers where organization_id=p_organization_id and id=p_id);
end; $$;
revoke all on function public.get_customer_preferences(uuid,uuid) from public,anon;
grant execute on function public.get_customer_preferences(uuid,uuid) to authenticated;
commit;
