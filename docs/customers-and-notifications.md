# Clientes y notificaciones · Fase 5

## Base de clientes

Migración `20261021000600_customers_and_notifications.sql`, aplicada por el usuario junto al hash del worker; `20261021000700_customer_preference_access.sql` restringe columnas de preferencias a una RPC exclusiva de owner. No repetir ni editar migraciones aplicadas. Se vinculan reservas existentes por `(organization_id, lower(trim(email)))`, se crea una ficha por email y se conservan los snapshots de cada turno. No se generan emails históricos. Reservas nuevas del panel y públicas crean/vinculan la ficha mediante trigger en la misma transacción; no sobrescriben su nombre/teléfono con datos de un visitante.

En organización → Clientes hay búsqueda por nombre/email/teléfono, filtros activos/inactivos y recurrencia: sin visitas completadas, al menos una o dos y más. Páginas de 50 filas. Visitas y última visita solo cuentan reservas `completed`; no cuentan canceladas, ausentes o futuras. Historial con servicio, profesional, fecha/estado y enlace al detalle. No se muestran ingresos cobrados.

Owner crea, corrige y desactiva fichas, con versión optimista. Staff solo lee contacto de clientes vinculados a su agenda; preferencias/evidencia requieren una RPC de owner, con grants de columnas que también bloquean la consulta directa por staff. Tanto historial como conteos se calculan sobre sus filas autorizadas por RLS. No se comparte la identidad de clientes entre negocios; un email común no permite consultar otra organización. No hay fusión automática de personas: quienes comparten un email tendrán una ficha en ese negocio. No se aplican normalizaciones destructivas de puntos o alias de proveedores.

Editar la ficha no cambia los datos históricos de turnos. Los avisos de un turno usan el email capturado al reservar, por lo que corregir una ficha no redirige una entrega pendiente. Si un cliente reporta un email incorrecto, desactivar sus avisos, revisar los trabajos y corregir la reserva mediante un procedimiento autorizado antes de volver a notificar. No existe edición arbitraria de contacto de reservas desde la UI en esta fase. Desactivar una ficha solo la quita del filtro de activos; no cancela turnos ni revoca comunicaciones por sí mismo.

## Preferencias y privacidad

Las fichas permiten avisos transaccionales por defecto para gestionar turnos; marketing queda desactivado. El owner registra solicitudes/preferencias del cliente. Habilitar marketing exige evidencia descriptiva de al menos 10 caracteres; cambios registran actor, instante y evidencia en historial privado inmutable para la API, además de auditoría. No se envían campañas en esta fase, aunque exista consentimiento registrado. No incluir datos sensibles en la evidencia.

Antes de cada intento de email, el worker revisa preferencia transaccional actual, estado del negocio, configuración y vigencia de la reserva. Una preferencia revocada omite avisos pendientes/reintentos. Un envío ya aceptado por el proveedor no puede retirarse ni se presenta como revocable. El cliente puede solicitar cambios al contacto del negocio que figura en el email.

Procedimiento preparado para solicitudes de datos, sin declarar borrado automático:

1. Owner recibe la solicitud por el canal del negocio y verifica identidad sin revelar si otra organización conoce ese email.
2. Para acceso, reunir ficha, preferencias, historial de reservas y evidencia de consentimientos del tenant. La UI pagina historial; un operador autorizado puede preparar una exportación completa desde BD, con revisión y entrega por un canal privado. No exportar toda la tabla ni datos de otros clientes/profesionales.
3. Para corrección, registrar el cambio en ficha y revisar por separado los snapshots de reservas y trabajos ya preparados. Desactivar avisos hasta resolver un destinatario incorrecto.
4. Para eliminación, desactivar comunicaciones, revisar turnos futuros, trabajos en proceso, enlaces activos, obligaciones de conservación y política acordada con el negocio. Preparar una anonimización acotada de ficha, snapshots, payloads privados y evidencias, con autorización expresa y backup/retención resueltos; conservar relaciones/condiciones económicas cuando corresponda. No ejecutar DELETE en cascada ni borrar historial sin esa revisión.
5. Registrar resolución sin copiar datos personales a logs. Antes del piloto debe definirse y verificarse el plazo/política de retención, alcance de backups y datos retenidos por Resend. El botón de borrado permanente y la exportación automática no están implementados.

## Configuración de email

Variables solo de servidor, en `.env.local` para desarrollo:

| Variable                    | Función                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| RESEND_API_KEY              | Clave con permiso Sending access, restringida al dominio cuando sea posible |
| NOTIFICATION_FROM_EMAIL     | Remitente, por ejemplo `Reservas <onboarding@resend.dev>` en prueba         |
| NOTIFICATION_TEST_RECIPIENT | Correo permitido en modo test, normalizado                                  |
| NOTIFICATION_MODE           | `disabled` por defecto, `test` o `live`                                     |
| NOTIFICATION_WORKER_SECRET  | Secreto hexadecimal de 32 bytes; BD guarda solo SHA256                      |
| CRON_SECRET                 | Bearer de ejecución del procesador, independiente del acceso a BD           |

`npm run prepare:notifications` conserva valores existentes válidos, genera secretos faltantes, agrega modo disabled si falta y escribe `supabase/.local/enable_notification_worker.sql` con el hash. Aplicarlo solo después de la migración 006. El usuario ya aplicó ambos archivos. No mostrar claves ni incluir archivos locales en Git. Sin service_role, conexión directa privilegiada ni proveedor en el navegador.

Para desarrollo, el remitente `onboarding@resend.dev` solo permite pruebas al correo de la propia cuenta. Para otros destinatarios, verificar dominio y usar un remitente suyo; ver [errores oficiales de Resend](https://resend.com/docs/api-reference/errors). La clave de Sending access no se verifica haciendo llamadas administrativas que requieren Full access. Comprobar formato no confirma autenticación ni entrega: se registra una prueba real por separado.

Modo test exige credenciales y destinatario válido. La selección SQL solo toma trabajos de ese email, con doble comprobación en servidor. **No se redirigen correos ajenos a la casilla de pruebas.** Modo live exige origen HTTPS no local y remitente distinto del dominio de pruebas; sigue siendo necesario comprobar DNS/dominio y credenciales reales con Resend. Un valor inválido de modo se interpreta como disabled.

Como owner, habilitar «Registrar avisos por email» en Notificaciones. Esto registra eventos nuevos y recordatorios futuros de reservas confirmadas; no reproduce confirmaciones históricas. Preferencias y configuración son independientes del interruptor de envío del servidor. La pantalla guarda ajustes y muestra estados, pero no envía emails.

## Outbox, recordatorios y reintentos

Cada alta/cambio de reserva genera sus trabajos en la misma transacción PostgreSQL. Un rollback no deja cliente, turno o aviso parcial. Clave única `(appointment_id, appointment_version, kind)` evita duplicación por reintento de una reserva. Los eventos iniciales son creada, confirmada, cancelada, reprogramada y recordatorio. Crear directamente un turno confirmado usa una única confirmación en el aviso de alta.

Recordatorios solo para turnos confirmados. Anticipación entre 60 minutos y 7 días, por defecto 1440 minutos. Se guarda un instante UTC programado; no hay timers permanentes en Next.js. Si al crear/confirmar ya pasó el instante del recordatorio, se omite ese recordatorio para evitar duplicar inmediatamente la confirmación. Reprogramar crea uno para la versión nueva y las versiones anteriores quedan inelegibles. Cancelar, completar, marcar ausencia, suspender negocio, revocar preferencia o vencer el turno impiden enviar recordatorios. Cambiar ajustes recalcula los pendientes no intentados; deshabilitar omite los pendientes/reintentos. No revierte un mensaje ya entregado al proveedor.

Tablas expuestas: notification_settings y notification_jobs, owner lee mediante RLS y solo modifica ajustes por RPC. Payloads con datos personales y cuerpo congelado están en esquema privado sin grants de API. Una credencial de worker independiente permite únicamente las RPC de cola, preparar y finalizar; ni anon común ni authenticated pueden invocarlas por su cuenta.

Cada ejecución procesa hasta cinco trabajos, secuencialmente y con un claim por vez. `FOR UPDATE SKIP LOCKED` y lease de tres minutos evitan que dos workers tomen el mismo trabajo; un token UUID nuevo impide que un worker atrasado sobrescriba al actual. Antes de enviar, la BD revalida elegibilidad, congela destinatario/remitente/asunto/texto/HTML e incrementa intentos. La llamada Resend tiene timeout de ocho segundos y clave estable `booking-notification/<job_id>`.

Resend mantiene idempotencia por 24 horas y requiere el mismo cuerpo para reutilizar la clave. Se guarda el cuerpo del primer intento para los siguientes; no se cambia por una edición de plantilla o remitente. Ver [documentación del proveedor](https://resend.com/changelog/idempotency-keys). Para evitar un envío duplicado después de expirar esa protección, el worker cierra reintentos a las 22 horas del primer intento. Máximo seis intentos, espera de 1, 5, 15, 60 y 180 minutos, también acotados por vencimiento del aviso. Errores temporales de red, 429, 5xx y conflicto concurrente se reintentan; errores permanentes/configuración fallan para revisión.

Si Resend aceptó y falla el guardado de resultado, el lease vence y un reintento reutiliza clave/cuerpo. Fuera de la ventana segura no hay reenvío automático ni botón de «reenviar todo». Revisar el proveedor y resolver expresamente un caso ambiguo. Un cambio de reserva que sucede después de iniciar una petición al proveedor puede llegar a enviarse: las transacciones locales no pueden cancelar una llamada externa ya iniciada. Eventos nuevos informan el cambio posterior.

Estados: queued, processing, retry, sent, failed, skipped. **sent significa aceptado por Resend, no entregado a la bandeja.** Se conservan ID de proveedor, intentos y códigos seguros, sin mensajes completos de error en logs. No se implementan webhooks de entregas/rebotes ni campañas; no presentar métricas de entrega confirmada. Plantillas en español, hora de 24 h/zona del turno, HTML escapado, sin recursos remotos ni imágenes de seguimiento.

Los emails públicos pueden incluir el enlace privado si se reconstruye su HMAC desde los datos privados y su hash coincide. No se guarda un token nuevo ni se revoca el anterior. Si rotó la clave del intermediario y no coincide, se omite el enlace y se indica contactar al negocio. Un link ya revocado no se reconstruye al reclamar. Mantener click/open tracking desactivado en Resend para evitar seguimiento de enlaces privados; el dominio y su configuración se revisan antes de hosting.

## Ejecución portable

Con la app en ejecución:

```powershell
npm run notifications:run
```

Por defecto es dry run: consulta conteo de trabajos vencidos para el filtro del modo, sin reclamar, consumir intentos ni llamar a Resend. Para enviar, después de revisar destinatario/configuración y autorizar la prueba:

```powershell
npm run notifications:run -- --send
```

El comando llama `POST /api/jobs/notifications` con Bearer CRON_SECRET, JSON acotado a 512 bytes y `{dryRun:false,limit:5}`. No admite destinatarios arbitrarios ni filtros por tenant desde la petición. Respuesta con contadores, sin datos privados. Endpoint solo POST, sin caché. Los secretos se cargan del entorno, no aparecen en argumentos ni salida.

Para Railway u otro hosting, ejecutar ese POST desde un scheduler externo cada minuto, con timeout suficiente para hasta cinco llamadas secuenciales y sin solapamiento innecesario. No se creó ningún cron ni automatización en esta entrega. Cada ejecución es acotada y recupera leases vencidos; no necesita disco persistente. Revisar cuota de Resend, volumen pendiente y fallos desde el registro antes de habilitar datos reales.

## Pruebas

SQL real en PGlite para migración/backfill, aislamiento, staff, preferencias, snapshots, rollback y cola. Adaptadores mock para configuración, acciones, plantillas, lease/cuerpo congelado, clasificación de errores, dry run, endpoint y destinatario permitido. PostgreSQL nativo con conexiones independientes añade el sexto escenario de dos workers que compiten por un trabajo. E2E pública verifica que las reservas siguen funcionando con la nueva migración y los envíos desactivados.

Las pruebas automáticas no envían emails reales. El 22/10 el usuario autorizó un único email técnico «Prueba de email · Reservas», aceptado por Resend y recibido por el destinatario configurado. Se persistió su idempotencia local para evitar repetirlo. Valida credenciales/remitente/conexión y recepción; no es una prueba de aviso real desde la cola ni de recordatorio programado. Los envíos automáticos permanecen disabled. La confirmación manual de fichas y avisos de una reserva remota sigue separada en [progreso](progress.md).

Fase 6 añade elegibilidad por suscripción/módulo a la cola y evita crear nuevos trabajos sin acceso; no deshace un envío ya iniciado. Antes de hosting siguen pendientes dominio verificado, entrega/rebote, retención, scheduler externo y supervisión operativa.
