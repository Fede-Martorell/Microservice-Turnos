# Piloto cerrado · 1–3 negocios

Preparación técnica de Fase 9, 30/10/2026. **No equivale a publicación ni a certificación comercial completa.** No se contrataron proveedores ni se activaron cobros, emails o cron. Falta probar la operación en hosting con varias personas reales.

## Recorrido de cada negocio

El propietario confirma su cuenta y crea la organización. El administrador otorga desde `/admin` el plan, período y módulos acordados, con motivo auditable; Fidelización sigue siendo opcional. Sin pago automático. **Puesta en marcha** revisa profesional activo, servicio activo asignado, horario del negocio y coincidencia con el profesional para duración más preparación. Deriva el estado de SQL; no guarda casillas manuales. La semana habitual no garantiza disponibilidad de una fecha: excepciones, anticipación y conflictos se comprueban al reservar.

Crear una reserva de prueba, reprogramarla y cancelarla. Si se usa página pública, revisar política/contacto, habilitarla y repetir en incógnito con su enlace privado. Sin módulo, mantener agenda interna. Emails opcionales, desactivados hasta prueba autorizada. Registrar qué funciones probó cada negocio; crear una reserva no demuestra el recorrido completo.

Propuesta: empezar con un negocio y sumar otros dos después de revisar incidencias. Cada uno define responsable y horario de contacto. Registrar fecha, impacto y referencia del error sin contraseñas, tokens ni datos completos de clientes. Canal de soporte y apertura aún los define el usuario; no se enviaron invitaciones.

## Condiciones para abrir

| Área                    | Evidencia requerida antes de cuentas reales                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Hosting                 | Contenedor construido/arrancado, HTTPS, health y enlaces correctos                           |
| Identidad               | Confirmación/logout, dos propietarios + staff, aislamiento y recuperación de cuenta ensayada |
| Reservas                | Agenda, concurrencia, página pública si aplica y gestión privada en hosting                  |
| Métricas                | Calendario/Resumen para igual período y zona; revisión manual pendiente de Fase 8            |
| Avisos, si se habilitan | Prueba autorizada, remitente, cuotas, reintentos y scheduler controlado                      |
| Recuperación            | Copia real y restauración separada, responsables y tiempos registrados                       |
| Soporte/privacidad      | Canal, responsables, aviso/condiciones revisados y retención acordada                        |
| Presupuesto             | Planes elegidos, alertas de gasto y publicación autorizada                                   |

Las pruebas locales no marcan estas condiciones externas como cumplidas. Aplicar 012 y verificar Puesta en marcha; revisar el resto con la configuración concreta del deploy.

## Recuperación y copias

Objetivos propuestos: RPO 24 h y RTO 4 h. **No se prometen:** medir y aceptar en una restauración real. [Supabase documenta backups diarios pagos, siete días en Pro, exportaciones externas para Free y exclusión de objetos de Storage del backup de base](https://supabase.com/docs/guides/platform/backups). Elegir plan/política antes de datos reales.

1. Identificar proyecto, PostgreSQL, última migración, fecha y alcance de copia. Usar herramientas compatibles y procedimiento oficial, incluyendo esquemas, roles/permisos, Auth y private según el método; un dump solo de public no recupera todo el servicio.
2. Cifrar y guardar fuera del servidor/repositorio, acceso restringido y retención aprobada. Variables, secretos, configuración Auth/Turnstile y objetos Storage requieren inventario/copia separados. No subir copias a chats o artifacts de CI; ignorar Git no cifra archivos.
3. Restaurar primero en un proyecto separado y expresamente elegido. Emails y página pública desactivados allí; evitar procesar la cola restaurada hacia destinatarios reales. No superponer una copia a producción para probar.
4. Verificar conteos por tenant, muestras de filas, migraciones/RLS, owner/staff, reservas/historial, saldos/canjes y autenticación. Reprovisionar hashes/secretos según inventario. Registrar tiempos, pérdida posible y resultado sin datos privados en reportes públicos.
5. En incidente real, detener escrituras/jobs y preservar evidencia. Obtener autorización antes de reemplazar datos. Reconciliar reservas posteriores a la copia antes de reabrir; comunicar por el canal acordado.

La suite ensaya **solo PGlite local**, con datos sintéticos: snapshot, instancia separada, funciones y permisos restaurados. No es pg_dump ni contiene Auth completo de Supabase; no certifica recuperación del proveedor. No se accedió a backups remotos ni se restauró la base del usuario.

## Incidencias y privacidad

El healthcheck mide proceso/configuración. Monitor externo y destino de alertas pendientes. Revisar también una lectura autenticada, acceso público, logs `event/reference/code`, cola fallida y consumo. La UI permite reintentar/volver al panel y muestra el digest Next si existe; los logs propios omiten mensajes privados del proveedor. No hay plataforma externa de errores conectada.

Ante fallos de envío, mantener disabled y revisar destinatarios/reintentos antes de habilitar; no reprocesar masivamente. Ante acceso indebido, cerrar el módulo/suspender acceso, preservar auditoría y revisar alcance; no conceder admin como solución. Sin horarios, revisar Negocio + profesional, pausas, preparación y fecha. Ante caída del proveedor, no comunicar confirmación hasta persistir reserva. La app requiere conexión; no hay agenda offline.

Definir con el negocio datos necesarios, responsables, retención y solicitudes de corrección/exportación/eliminación. No cargar datos sensibles innecesarios ni prometer borrado automático: no hay eliminación integral de clientes que resuelva todas las dependencias históricas. El responsable debe revisar aviso de privacidad y condiciones antes de publicar; esta guía no los sustituye.

## Presupuesto estimado

USD mensuales consultados el 30/10/2026; no son factura ni compromiso. Un proyecto multi-tenant para los tres negocios, no una base por organización. No se contrataron planes.

| Concepto            | Precio publicado                                                    |
| ------------------- | ------------------------------------------------------------------- |
| Railway Hobby / Pro | Mínimo USD 5 / 20, incluye ese importe de consumo; exceso adicional |
| Supabase Pro        | Desde USD 25, primer proyecto incluido; adicionales desde USD 10    |
| Resend Free / Pro   | USD 0 por 3.000 emails/mes, 100/día / USD 20 por 50.000/mes         |

Fuentes: [Railway](https://railway.com/pricing), [Supabase](https://supabase.com/pricing), [Resend transaccional](https://resend.com/pricing). Revisar condiciones antes de contratar. Supabase Free pausa proyectos inactivos; no se presupuestó como base operativa del piloto.

Railway Pro + Supabase Pro + Resend Free: **USD 45/mes de base**, o **USD 65 con Resend Pro**. Hobby + Supabase Pro partiría de USD 30, sujeto a elección y uso. Excluye dominio, impuestos/cambio, monitoreo, copias externas, staging adicional y excesos. No se fijó precio de venta con estos números.

Cálculo ilustrativo: 30 días a 0,5 GB medios y 0,05 vCPU medias son unos USD 6 en recursos Railway más egreso; aplicar mínimo del plan, sin sumar de nuevo créditos incluidos. **Es consumo supuesto, no medido en cloud.** Reemplazar por consumo/factura del primer período y configurar alertas de gasto.

Tres negocios × 10 turnos/día × 22 días × supuesto de 3 avisos = 1.980 emails/mes, 90 en un día habitual. Cambios, picos y reintentos pueden superar la cuota diaria aunque sobre mensual; Auth puede usar otro proveedor. Revisar antes de ampliar el piloto.
