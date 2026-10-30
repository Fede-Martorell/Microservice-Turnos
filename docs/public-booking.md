# Reservas públicas · Fase 4

## Configuración

Las migraciones 004 y 005 y el SQL local del hash ya fueron aplicados por el usuario en Supabase con Success. No repetir ni editar migraciones aplicadas.

Para una instalación nueva: aplicar 001–005 en orden, ejecutar `npm run prepare:public-booking` y aplicar `supabase/.local/enable_public_booking_gateway.sql` en SQL Editor. El comando genera 32 bytes aleatorios en `PUBLIC_BOOKING_GATEWAY_SECRET` dentro de `.env.local`; conserva una clave existente válida y solo escribe su SHA256 en el SQL ignorado. Nunca incluir el secreto en NEXT_PUBLIC_, repositorio, logs ni navegador. No se necesita service_role.

Como owner, abrir organización → Página pública, completar política de cancelación y habilitar. Opcionalmente configurar confirmación automática, contacto público, dirección, logo/portada por HTTPS y dos colores hexadecimales. El color del texto de marca se calcula para mantener contraste. Las imágenes se solicitan directamente al proveedor desde el navegador sin referrer; no se descargan ni procesan en el servidor. Usar un proveedor adecuado para datos públicos.

Un servicio público debe estar activo y asignado a un profesional activo. Deben existir horarios de Trabajo coincidentes para Negocio y profesional en el día elegido. Se descuentan descansos, bloqueos, vacaciones, reservas y preparación; también se respeta anticipación mínima/máxima. Sin configuración de ambos ámbitos no se ofrecen turnos. Se reutiliza el mismo motor SQL de la agenda privada, con intervalos de 15 minutos, UTC y zona IANA.

## Recorrido

- `/b/[slug]`: nombre, descripción, catálogo, profesionales, contacto y política; no publica identificadores de usuarios, emails de personal, reservas ni bloqueos internos.
- `/b/[slug]/reservar`: servicio, profesional específico o cualquiera disponible, fecha y horario. Nombre/email requeridos y teléfono opcional; aceptación explícita de política, sin consentimiento de marketing implícito. No hace falta iniciar sesión.
- La escritura vuelve a comprobar horario, asignación, precio y versión de política. Si cambian mientras se completa el formulario, solicita actualizar. Bloqueo por organización, exclusión GiST e idempotencia evitan dobles reservas ante concurrencia/reintentos.
- Confirmación en pantalla: pendiente o confirmada según configuración. Ambas ocupan horario. Se muestra precio acordado, sin afirmar que hubo un pago ni envío de email.
- El cliente debe guardar su enlace privado. Fase 5 agrega emails y recordatorios cuando se habilitan avisos y se ejecuta el procesador.

## Enlace privado y política

Se genera un token HMAC de 256 bits ligado a negocio, clave UUID de la solicitud y visitante. Esto permite reconstruir el mismo enlace al reintentar la misma reserva desde ese visitante; en BD se guarda únicamente SHA256. La firma de solicitud también liga contenido/versiones para impedir reutilización con datos distintos.

El enlace es `/reserva#token=...`: el fragmento no viaja al servidor HTTP. JavaScript lo elimina de la barra de dirección y lo canjea mediante POST del mismo origen por una cookie HttpOnly, SameSite Strict, Path `/reserva` y Secure en HTTPS. La respuesta del canje solo contiene éxito, nunca el comprobante. No se usa localStorage. Se exige JSON acotado a 1024 bytes y token hexadecimal válido. Página/API con no-store, no-referrer y noindex. No incluir estos enlaces en logs, herramientas analíticas o mensajes públicos.

Quien posee el enlace puede consultar el comprobante mínimo, reprogramar con el mismo servicio/profesional/precio históricos o cancelar explícitamente. No se muestran email/teléfono del cliente ni IDs internos. Se exige versión vigente y estado futuro pending/confirmed. La política y anticipación de cancelación son snapshots: cambiar ajustes no modifica las condiciones aceptadas de reservas anteriores. El nuevo horario también debe superar ese margen.

El enlace vence siete días después del final ocupado, incluida preparación. La migración 005 sincroniza este vencimiento también si el equipo reprograma desde el panel. Una revocación no se revierte al mover el turno. Owner puede revocar el enlace desde el detalle privado. Deshabilitar la página evita nuevas reservas; los enlaces existentes siguen gestionables mientras el negocio esté activo y se respeten sus condiciones. Suspender el negocio bloquea catálogo y enlaces. Cancelar conserva historial y permite consultar el comprobante hasta vencer. No hay regeneración ni listado de tokens en claro.

## Protección contra abuso

El cliente público de servidor es anon y no envía cookies de Auth del panel. Todas las RPC públicas exigen además `x-booking-gateway-secret`, comprobado contra el hash privado. La clave pública de Supabase sola no permite invocarlas ni leer tablas. Las funciones privadas no tienen grants de API. La credencial acotada no otorga acceso a datos del panel.

Cookie de visitante firmada, HttpOnly/Lax, siete días; la BD recibe un HMAC seudónimo, sin IP. No se confía en X-Forwarded-For enviado por el cliente. Las cuotas usan ventanas fijas en PostgreSQL y claves con hash:

| Operación                              | Límite                                                               |
| -------------------------------------- | -------------------------------------------------------------------- |
| Todas las RPC públicas                 | 1000/minuto global y 120/minuto por visitante                        |
| Consulta de horarios nuevos            | 600/hora por negocio y 120/hora por visitante                        |
| Intentos de alta                       | 60/hora por negocio, 6/hora por visitante y 3/hora por email/negocio |
| Consulta de horarios de reprogramación | 120/hora por enlace                                                  |
| Intentos de modificar/cancelar         | 20/hora por enlace                                                   |

Son límites iniciales, no protección ilimitada frente a ataques distribuidos. Los contadores sobreviven conflictos/entradas rechazadas porque las escrituras de reservas usan un subbloque con manejo de excepciones y respuestas de negocio; la llamada externa termina con éxito transaccional. Un error SQL no manejado sí revierte toda la transacción, conforme al [modelo transaccional de PostgREST](https://postgrest.org/en/stable/references/transactions.html). Limpieza oportunista acotada de ventanas vencidas, sin cron ni barrido completo por petición. El honeypot rechaza formularios automáticos básicos.

Antes de alojar la app, configurar `NEXT_PUBLIC_APP_URL` con el origen HTTPS real, `PUBLIC_BOOKING_TURNSTILE_SITE_KEY` y `PUBLIC_BOOKING_TURNSTILE_SECRET_KEY`. Registrar ese dominio en Turnstile. La clave del widget es visible por diseño; el secreto solo existe en servidor. Se verifica Siteverify, hostname, acción `booking` y cdata del visitante, con timeout y fallo cerrado. No se almacenan resultados válidos para reutilizarlos; los tokens son de un uso, conforme a la [documentación oficial de Cloudflare](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Solo se omite Turnstile en desarrollo cuando el origen configurado es localhost/loopback y no hay claves CAPTCHA. Fuera de ese origen, sin ambas claves no se habilita el alta. No desplegar conservando APP_URL local. Probar con claves reales y dominio autorizado antes del piloto; los tests usan respuestas simuladas y no certifican una integración Turnstile alojada.

Rotación: cambiar la credencial de servidor en el entorno y volver a ejecutar el comando para generar/aplicar el nuevo hash, coordinando el cambio para evitar fallos durante la transición. Invalida cookies firmadas de visitante y reconstrucción de reintentos antiguos. Los enlaces ya entregados se verifican por hash y conservan vigencia/revocación; rotar la credencial del intermediario no los revoca automáticamente.

## Verificación y límites

`npm test`: aislamiento, permisos, catálogo permitido, opt-in, citas sin cuenta, idempotencia, precio/política desactualizados, rollback, cuotas, vencimiento, revocación, cancelación/reprogramación y sincronización desde panel. Pruebas de cookies, Turnstile y canje de acceso. `npm run test:concurrency`: cinco carreras privadas/públicas con conexiones reales a PostgreSQL descartable.

`npm run test:e2e:public` levanta un adaptador HTTP aislado en 54324 con migraciones reales en PGlite y standalone en 3100. Usa datos sintéticos y cubre reserva → enlace → reprogramación → cancelación en Chromium desktop/mobile y WebKit mobile. No es GoTrue/PostgREST ni escribe en el proyecto Supabase. Ver resultados finales y revisión manual remota en [progreso](progress.md).

Pendientes antes de piloto: Turnstile real alojado, pruebas con varios usuarios/cuentas, dispositivos físicos, CI remota, retención de datos y respaldo/restauración. La implementación de Fase 4 no incluía email/CRM; ya están en [Fase 5](customers-and-notifications.md). Sin pagos ni despliegue.
