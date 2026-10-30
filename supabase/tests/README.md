# Pruebas de políticas

Las migraciones de `../migrations/` se ejecutan sin modificaciones desde los tests de organizaciones, catálogo, reservas, clientes y notificaciones en `tests/integration/`. Cada suite aplica hasta su versión correspondiente; la pública y clientes/cola incluyen 007. Clientes/cola prepara historial con 005 y prueba el backfill de 006 antes del ajuste de columnas de 007.

```powershell
npm run test:integration
```

PGlite corre PostgreSQL WASM en memoria. El harness crea roles anon/authenticated y la interfaz mínima de auth.users/auth.uid, luego aplica la migración. Las consultas cambian de rol y sujeto; nunca se evalúan permisos bajo el superusuario. El test verifica dos tenants, owner/staff, usuario ajeno, anon, cuenta sin confirmar, membresía inactiva, organización suspendida, escrituras cruzadas, elevación de rol, columnas protegidas, auditoría, creación atómica, slugs y límites.

No usar este harness como migración ni copiar sus fixtures a Supabase. No reproduce GoTrue, el gateway JWT, PostgREST, SMTP ni concurrencia entre conexiones. `npm run test:concurrency` añade seis escenarios privados/públicos y de workers con conexiones independientes a PostgreSQL nativo y bloqueo observado; instrucciones en docs/reservations.md. `test:e2e:public` expone solo RPC permitidas mediante un adaptador HTTP de tests conectado a PGlite; no es PostgREST. La API remota también se comprobó para rechazar llamadas sin credencial de servidor. El usuario confirmó los recorridos principales de Fases 1–3; todavía corresponde probar varios usuarios reales y aceptación de invitaciones antes del piloto.
