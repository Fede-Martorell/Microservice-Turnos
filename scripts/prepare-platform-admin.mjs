import { mkdir, writeFile } from "node:fs/promises";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
// La elección de este destinatario fue autorizada por el usuario para su cuenta Supabase.
const email =
  process.env.PLATFORM_ADMIN_EMAIL || process.env.NOTIFICATION_TEST_RECIPIENT;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
  throw new Error(
    "Configurá PLATFORM_ADMIN_EMAIL o NOTIFICATION_TEST_RECIPIENT localmente.",
  );
const encoded = Buffer.from(email.trim().toLowerCase(), "utf8").toString("hex");
const dir = new URL("../supabase/.local/", import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(
  new URL("enable_platform_admin.sql", dir),
  `-- Ejecutar después de migraciones 008 y 009. Revisar la cuenta elegida antes de aplicar.
-- Acceso interno del SaaS; no concede acceso a reservas ni contactos de negocios.
begin;
do $$
declare target uuid; already_active boolean;
begin
 select id into target from auth.users where lower(btrim(email))=convert_from(decode('${encoded}','hex'),'UTF8') and email_confirmed_at is not null and not coalesce(is_anonymous,false);
 if target is null then raise exception 'La cuenta elegida debe existir y tener el email confirmado en Supabase Auth'; end if;
 select is_active into already_active from private.platform_admins where user_id=target;
 insert into private.platform_admins(user_id,is_active) values(target,true) on conflict(user_id) do update set is_active=true;
 if not coalesce(already_active,false) then insert into public.platform_audit_logs(actor_id,event,detail) values(target,'admin.provisioned',jsonb_build_object('method','reviewed SQL')); end if;
end; $$;
commit;
`,
);
console.log(
  "SQL preparado para la cuenta local seleccionada, sin mostrar el correo: supabase/.local/enable_platform_admin.sql",
);
