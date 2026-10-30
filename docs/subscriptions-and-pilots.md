# Fase 6 · Suscripciones y pilotos

Planes, derechos de acceso y cupos almacenados en PostgreSQL. No hay cobros ni pasarela de pagos. Los importes del brief son hipótesis editables: Starter USD 12/mes y 1 profesional activo, Professional USD 25 y 5, Business USD 45 y 15. React los consulta, sin constantes de precios. Cada asignación/renovación registra una referencia de precio y moneda; editar el catálogo no altera ese registro histórico ni los precios de reservas existentes.

## Instalación y cuenta administrativa

En una instalación nueva aplicar todas las migraciones en orden. En este proyecto 001–007 ya estaban aplicadas; el usuario informó Success para 008/009 el 22/10. No repetirlas:

1. `supabase/migrations/20261022000800_plans_and_pilots.sql`.
2. `supabase/migrations/20261022000900_entitlement_guards.sql`.
3. El SQL local de cuenta administrativa, después de las migraciones.

008 conserva los negocios existentes y les asigna un piloto Business de 30 días. Los nuevos reciben una prueba Business de 14 días. Administración → Planes y pruebas permite cambiar el plan y días iniciales para altas posteriores. No se pide tarjeta.

`npm run prepare:platform-admin` genera `supabase/.local/enable_platform_admin.sql`, ignorado por Git. Usa PLATFORM_ADMIN_EMAIL si existe; en otro caso NOTIFICATION_TEST_RECIPIENT, solo si esa cuenta fue elegida expresamente. No muestra el correo, no crea usuarios y no usa service_role. El SQL exige una cuenta confirmada y no anónima en **Authentication → Users del proyecto**, habilita su UUID en `private.platform_admins` y audita la concesión. El correo del dashboard de Supabase y el de Resend son independientes de las cuentas de la aplicación. En este proyecto se configuró PLATFORM_ADMIN_EMAIL y el usuario confirmó Success. Entrar con esa misma cuenta a `/admin`.

No se concede acceso por metadatos, orden de registro ni propiedad de un negocio. Sin sesión `/admin` redirige a ingresar; una cuenta común recibe 404. Cada consulta/acción verifica usuario confirmado y permiso; las RPC vuelven a comprobarlo en BD. El proxy impide caché. No existe interfaz para autoasignarse superadmin. Un operador de SQL Editor puede revocarlo poniendo `private.platform_admins.is_active=false` para el UUID correspondiente.

## Administración interna

- **Negocios**: búsqueda por nombre/slug, páginas de 50, estado, plan, período y cantidad de profesionales. Indicadores agregados de negocios, accesos vigentes, pilotos y períodos vencidos. No se consultan contactos, reservas ni supuestos ingresos.
- **Planes y pruebas**: crear/editar nombre, descripción, referencia mensual/moneda, cupo, módulos y disponibilidad para nuevas asignaciones. Código inmutable. Desactivar un plan no interrumpe accesos ya asignados; antes de desactivar el plan inicial, elegir otro en la política de pruebas.
- **Detalle**: activar/extender pilotos, cambiar a estado activo manualmente, pausar/cancelar suscripción y registrar motivo/notas internas. Activo registra el acceso acordado, sin efectuar cobros.
- **Excepciones**: habilitar o bloquear un módulo disponible durante un período. Al terminar vuelve a regir el plan. No extienden una suscripción vencida ni generan cargos.
- **Estado del negocio**: suspender/archivar oculta todo el negocio a miembros y visitantes; reactivar conserva datos. Para mantener lectura histórica del propietario, pausar la suscripción sin suspender la organización.
- **Feedback y auditoría**: últimas 20 respuestas del negocio, notas internas separadas, últimos 30 cambios del negocio y últimos 50 globales. Actor, instante, motivo y datos del cambio. Sin permisos de edición/borrado de auditoría desde la API.

Planes, suscripciones y excepciones usan versión para detectar ediciones simultáneas; actualizar la pantalla ante un conflicto. Las notas se guardan con la misma versión de suscripción. Fechas en zona del negocio, último día inclusive; en BD `[inicio, fin)` UTC y fin a medianoche del día siguiente. Máximo 367 días por período, renovable mediante otra operación auditada.

## Módulos, cupos y vencimiento

Hay acceso operativo si el negocio está activo, la suscripción tiene estado pilot/trial/active y el instante actual está dentro de su período. Inicio futuro, vencimiento, past_due/canceled/suspended bloquean operaciones nuevas sin necesitar cron.

Módulos originales: agenda/reservas, reserva pública, clientes, emails, acceso del equipo y personalización. Starter excluye cuentas staff y personalización; Professional/Business incluyen los seis. Desde Fase 7, Fidelización es un complemento disponible mediante habilitación expresa, con referencia comercial editable. Analítica avanzada, pagos/señas y marketing siguen futuros y no pueden habilitarse todavía. Ver loyalty.md.

SQL controla escrituras de catálogo, horarios, reservas, membresías/invitaciones, clientes y ajustes; también horarios/altas públicas y elegibilidad de la cola. Las funciones originales envueltas dejan de ser API invocable. El cupo de profesionales se comprueba bajo bloqueo de organización, incluso con altas simultáneas. Reducir el límite del catálogo conserva perfiles existentes y bloquea nuevas altas/reactivaciones sin cupo. Una asignación individual a un plan menor se rechaza si sobran profesionales activos. Desactivarlos con acceso vigente o reactivar temporalmente el plan actual antes de reducirlo.

Al vencer, el propietario conserva lectura de catálogo, contactos e historial; puede cancelar reservas existentes, revocar enlaces/invitaciones y retirar consentimientos. No puede reprogramar, crear turnos ni completar servicios fuera del acceso. Staff pierde acceso al retirar team_access. El cliente conserva cancelación por enlace existente, sujeta a vigencia/política/estado del turno; no obtiene nuevas fechas. La página pública deja de ofrecer reservas. Los formularios habituales se desactivan y la navegación conserva los enlaces históricos pertinentes.

Retirar personalización oculta logo/portada/colores públicos conservando sus valores guardados. Retirar emails evita trabajos nuevos y hace inelegibles los pendientes al reclamarlos/prepararlos. No revierte una llamada ya iniciada al proveedor; ver customers-and-notifications.md.

El vencimiento **no borra datos**. El administrador no obtiene lectura indiscriminada de contactos/reservas. Antes del piloto comercial hay que acordar retención, respaldo/restauración y solicitudes de privacidad. No hay exportación masiva ni borrado automático.

## Vista del negocio y prueba manual

Negocio → Suscripción muestra plan, estado, fechas, cupo, referencia mensual actual/registrada y módulos efectivos. En piloto/prueba, incluso vencidos, el propietario puede enviar problemas, dificultad 1–5, funciones solicitadas, valor 1–5, disposición a pagar y sugerencias. Hasta cinco respuestas por negocio en 24 horas, textos de hasta 1500 caracteres. Evitar datos personales de clientes. Notas administrativas internas de hasta 2000 caracteres, invisibles al negocio.

El usuario confirmó el recorrido manual con su cuenta: guardar notas/motivo, enviar feedback y comprobarlo junto al cambio de suscripción en Auditoría. Adjuntó captura del registro. No se cambiaron cupos globales ni se activaron emails para esa validación. Detalles en progress.md.

Las pruebas automatizadas cubren SQL/RLS, migración desde 007, privilegios, catálogo/política, versiones, cupos, módulos, vencimiento, cancelación e historial. PostgreSQL nativo verifica la carrera del último cupo. E2E comprueba fronteras sin sesión y reserva/gestión pública con SQL aislada. No reproduce sesiones GoTrue del panel interno; la prueba manual real sigue separada.

Sin deploy, pagos ni cron de emails. La entrega posterior de Fase 7 se documenta en loyalty.md.
