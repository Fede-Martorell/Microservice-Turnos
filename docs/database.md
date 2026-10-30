# Base de datos

## Estado actual

Las migraciones 001–012 fueron aplicadas por el usuario en Supabase, junto a los hashes del intermediario público y worker. Success de 012 confirmado el 30/10/2026. No repetirlas ni editarlas; agregar migraciones posteriores. Tablas expuestas con RLS y grants explícitos; privadas sin grants de API. Auth/panel usan clave pública; RPC públicas y worker exigen credenciales de servidor independientes, sin service_role.

012 agrega get_business_onboarding: STABLE, SECURITY DEFINER, search_path vacío y ejecución solo authenticated con rol owner activo/confirmado. Devuelve seis booleanos de configuración, sin contactos ni IDs. Combina tramos semanales adyacentes, resta descansos y exige intersección suficiente para duración más preparación. Histórico legible con plan vencido, sin habilitar operaciones. No garantiza slots para una fecha ni prueba aceptación manual de reservas.

Fase 2 agrega services, staff_profiles, staff_services, availability_rules, availability_exceptions y organization_invites. FK compuestas impiden relaciones cruzadas. Cambios solo por RPC owner; staff lee catálogo y configuración propia/global. Acceso al panel y estado del recurso son independientes. Invitaciones por hash, email confirmado coincidente, uso único, revocación y vencimiento. Ver catalog.md.

Fase 3 agrega booking_settings, appointments y appointment_history. Creación/reprogramación atómicas, snapshots económicos y temporales, historial inmutable, claves de solicitud y versión. Exclusion GiST sobre tenant/profesional/rango ocupado para todos los estados salvo canceled. Staff solo su agenda; owner toda la organización. Calendario invoker sujeto a RLS. Ver reservations.md para transiciones, zona IANA y pruebas de simultaneidad.

Fase 4 agrega public_booking_settings (owner lee, modifica mediante RPC) y tablas privadas public_booking_gateway, public_booking_limits y public_booking_access. Contratos públicos por slug o token sin lectura directa de tablas. appointments.source distingue panel/public; created_by puede ser null solo para origen público. Historial con actor_kind member/guest y actor_id nullable solo para invitado. FK compuestas conservan el tenant. Políticas de cancelación y anticipación guardadas con la reserva, tokens SHA256 con vencimiento/revocación y cuotas atómicas persistentes. La migración 005 sincroniza vencimiento al reprogramar desde cualquier ruta. Ver public-booking.md.

Fase 5 implementa customers, notification_settings y notification_jobs. appointments.customer_id obligatorio y FK compuesta del tenant; backfill por email normalizado y trigger sin sobrescribir fichas. RLS de staff basada en agenda autorizada, conteos invoker y edición owner con versión. Consentimientos y payloads en private.customer_consent_events y private.notification_payloads; private.notification_worker almacena el hash de la credencial. Unicidad por reserva/versión/evento, leases con token, snapshots/cuerpo de entrega y ventanas de reintento. Ver [guía](customers-and-notifications.md).

La migración 007 restringe lectura de preferencias/evidencia a la RPC get_customer_preferences exclusiva de owner. El contacto sigue protegido por RLS y grants de columnas; se prueba que staff no puede leer consentimiento ni invocar la RPC.

## Fundamentos de Fase 1

Migración `20261021000100_organizations_and_access.sql` creada, probada en PostgreSQL embebido y aplicada por el usuario al proyecto Supabase de desarrollo mediante SQL Editor. Se confirmó que la API no permite lectura de las cuatro tablas ni ejecución de la RPC a usuarios anónimos. No hay seeds ni tablas de fases futuras.

Tablas actuales: organizations (slug único, autor, moneda, zona, estado y timestamps), organization_members (PK compuesta organización/usuario, role owner/staff e is_active), organization_settings (locale por negocio) y audit_logs (actor, evento e instante, sin valores privados). FK a auth.users y a la organización, sin borrado en cascada del historial.

RLS habilitado en las cuatro tablas. Helper privado SECURITY DEFINER con search_path vacío consulta membresía activa y negocio activo, evitando recursión. Grants explícitos: authenticated puede leer solo filas autorizadas y owner puede modificar únicamente name/description/timezone/currency o locale. Anon no tiene grants; no hay inserción, modificación de miembros, cambio de tenant/status/creador/slug ni borrado directo para authenticated.

create_organization usa auth.uid, exige cuenta confirmada no anónima, bloquea por usuario para limitar 3 creaciones en 24 horas y guarda negocio, owner, settings y auditoría en una transacción. Triggers actualizan timestamps y auditan cambios permitidos. Auditoría solo legible por owner e inmutable para la API.

Índices: slug único, PK de membresías, búsqueda de membresías activas por usuario, creador/fecha para límites, organización/fecha de auditoría. Las pruebas están en tests/integration/organizations-rls.test.ts; ver supabase/tests/README.md para el alcance del harness.

Los tipos de src/types/database.ts reflejan manualmente este contrato y deben regenerarse con CLI al disponer del flujo completo de Supabase. La aplicación solo usa la clave pública; no requiere service_role. La migración inicial no es idempotente: no volver a ejecutarla sobre el esquema ya creado. Cambios siguientes mediante nuevas migraciones, nunca editando el archivo ya aplicado.

## Modelo incremental (resto propuesto)

| Fase        | Tablas previstas                                                                                                      | Relaciones y restricciones                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1           | organizations, organization_settings, organization_members                                                            | Slug único; membresía única por usuario/organización; usuario de Supabase Auth; estado y zona IANA          |
| 2           | staff_profiles, services, staff_services, availability_rules, availability_exceptions, organization_invites           | Implementadas; profesionales con cuenta opcional y relaciones del mismo tenant                              |
| 3           | booking_settings, appointments, appointment_history                                                                   | Implementadas; snapshots de cliente/servicio/precio/duración, historial inmutable y exclusión por intervalo |
| 4           | public_booking_settings; private.public_booking_gateway, public_booking_limits, public_booking_access                 | Implementadas; configuración opt-in, credencial acotada, cuotas y enlaces privados                          |
| 5           | customers, notification_settings, notification_jobs; tablas privadas de consentimiento, payload y worker              | Implementadas; fichas por tenant, preferencias, outbox y entregas idempotentes                              |
| 6           | subscription_plans, module_catalog, plan_entitlements, organization_subscriptions, organization_modules, pilot_access | Catálogo configurable, períodos de acceso y entitlements validados en servidor                              |
| 7           | loyalty_programs, loyalty_rules, loyalty_accounts, loyalty_transactions, loyalty_rewards, loyalty_redemptions         | Reglas versionadas, ledger inmutable, movimientos compensatorios y canjes transaccionales                   |
| Transversal | audit_logs                                                                                                            | Eventos sensibles, acceso mínimo, datos redactados y política de retención                                  |

`organizations` conserva identidad, slug, descripción, zona y moneda; logo, portada y colores públicos viven en public_booking_settings. Entidades hijas usan `organization_id NOT NULL`. Evitar borrado en cascada de datos históricos. La identidad global de Auth no implica compartir clientes entre negocios.

## Aislamiento e integridad previstos

- Habilitar RLS para cada tabla expuesta, con políticas explícitas por operación y denegación por defecto.
- Resolver acceso por membresía autenticada, no por filtros del cliente. Prevenir recursión en políticas de membresías y limitar funciones `security definer` con `search_path` seguro.
- Usar claves/foreign keys compuestas `(organization_id, id)` donde eviten referencias entre tenants. Probar también inserts y updates maliciosos.
- Índices por `organization_id` y accesos reales: membresía, profesional/fecha, cliente, estado. No crear índices sin consulta que los justifique.
- Implementado en Fase 3: exclusión GiST con btree_gist sobre profesional/tenant e intervalo ocupado `[inicio, fin con preparación)`, salvo canceladas. Probada con transacciones independientes en PostgreSQL nativo.
- Guardar precio, moneda, duración y condiciones históricas al reservar; cambios del catálogo no modifican reservas completadas.
- Índice único para acreditación de fidelización por reserva; canjes con bloqueo de organización y saldo suficiente dentro de una transacción. Nunca corregir sobrescribiendo ledger.

## Fase 6

008 añade planes, módulos, bundles, suscripciones, excepciones temporales, feedback y auditoría de plataforma. Los pilotos usan organization_subscriptions; no se agrega pilot_access redundante. Cuentas administrativas y notas internas en esquema privado sin grants de API. Tablas expuestas con RLS y solo SELECT; escrituras mediante RPC autorizadas. 009 aplica controles a caminos anteriores, cierra sus funciones originales y conserva cancelación histórica. No hay borrado al vencer ni proveedor de cobros. Detalles en subscriptions-and-pilots.md.

## Fase 7

010 añade programas, reglas y servicios versionados, cuentas, movimientos inmutables, recompensas, canjes, anulaciones y eventos. Asignaciones de consumo, idempotencia y hashes de tarjetas permanecen privadas. RLS owner para lectura; escrituras solo mediante RPC. Un trigger de completar reserva acredita una sola vez. Saldo por lotes vigentes menos consumos, devolución con vencimientos originales y límites de uso bajo bloqueo de organización. Contrato de tarjeta anónimo acotado por gateway, token y cuotas. Agrega referencias comerciales de complementos sin facturación. Ver loyalty.md.

## Fase 8

011 añade get_business_dashboard de lectura para el propietario confirmado y un índice de actividad reciente por organización/instante/ID. Agregados sin truncado, rango inclusive de hasta 93 días convertido a instantes según la zona del negocio, estados actuales y clientes únicos/recurrentes por completados. Lectura conservada al vencer la suscripción; no cambia reservas ni habilita analytics. Detalles en dashboard.md.

## Migraciones y pruebas futuras

Nombres `YYYYMMDDHHMMSS_descripcion.sql`, SQL versionado, revisión antes de ejecución. Probar reset y migración desde la versión anterior en entorno aislado. Seeds exclusivamente sintéticos de desarrollo, separados de producción y sin credenciales.

La Fase 1 incluye pruebas SQL con dos organizaciones, owner/staff, usuario sin membresía y anónimo, ejecutadas en PostgreSQL WASM. Verifican lectura/escritura entre tenants, cambios de membresía y referencias cruzadas. No sustituyen validar el stack completo de Supabase (Auth/gateway/PostgREST) y sesiones con usuarios reales antes del piloto.
