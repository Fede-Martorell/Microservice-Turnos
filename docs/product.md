# Producto y alcance

Plataforma para negocios de citas individuales, independiente del rubro. Terminología: organización, negocio, profesional, servicio, cliente, reserva y disponibilidad. No se construye marketplace ni aplicaciones móviles nativas en el MVP.

## Disponible hasta Fase 8

Registro, confirmación de email, ingreso y cierre de sesión con Supabase Auth. Organizaciones, roles owner/staff y RLS. Catálogo, profesionales sin cuenta o vinculados a usuarios, invitaciones, horarios, descansos, bloqueos y vacaciones. Reservas privadas atómicas, calendario diario/7 días, estados, reprogramación e historial. Precios históricos en unidades menores; no hay cobros ni métricas simuladas. UI responsive, estados vacíos/carga/error/404, manifest e iconos sin caché offline. Detalles y límites de validación en progress.md.

Página pública por slug habilitada por owner, catálogo de recursos activos, elección de profesional o cualquiera disponible, reserva sin cuenta y comprobante en pantalla. Enlaces privados para reprogramar/cancelar con vigencia, política aceptada y revocación por owner. Contacto público, logo/portada por HTTPS y colores configurables. Protección del servidor, cuotas y Turnstile antes de aceptar altas desde hosting. Los emails transaccionales se incorporaron en Fase 5.

Fichas de clientes por negocio, búsqueda, filtros de actividad/recurrencia, visitas completadas, última visita e historial. Staff solo su agenda; owner edita y registra preferencias/evidencia de consentimientos. Avisos transaccionales y recordatorios con Resend, cola persistente, leases, idempotencia y reintentos. Envíos habilitados explícitamente con modo test/live y ejecución del procesador; no hay cron desplegado ni campañas de marketing. Detalles en customers-and-notifications.md.

Planes, cupos y módulos comprobados en PostgreSQL; pilotos/pruebas con fechas finitas sin tarjeta ni cobros. Vista de suscripción, feedback y panel `/admin` separado para planes, excepciones, estados y observaciones. Vencimiento conserva historial/cancelación; sin acceso indiscriminado del administrador a contactos/reservas. Ver subscriptions-and-pilots.md.

Fidelización opcional por visitas o puntos, reglas versionadas, acreditación de reservas completadas, recompensas, canjes, ajustes y anulaciones auditables. Tarjeta privada de consulta con saldo, condiciones y progreso. Se habilita expresamente; no se agrega a planes automáticamente. Ver loyalty.md.

Resumen del negocio para el propietario con turnos de hoy, próximas reservas, actividad reciente y estadísticas básicas por período: estados, clientes atendidos/recurrentes, servicios solicitados y gráfico con tabla. Agregados reales por tenant, sin ventas ficticias. Analítica avanzada permanece futura. Ver dashboard.md.

## Reglas transversales y fases futuras

- Auth de Supabase: owner y staff por organización; superadmin separado con privilegios mínimos y auditoría. Clientes pueden reservar sin crear cuenta.
- Profesionales pueden existir sin cuenta de acceso. Desactivar servicios conserva historial.
- Disponibilidad combina horario del negocio/profesional, descansos, vacaciones, bloqueos, duración, preparación y ventanas de anticipación. Reservar y reprogramar deben ser atómicos ante concurrencia.
- Estados de reserva: pending, confirmed, completed, canceled, no_show. Transiciones explícitas, permisos e historial implementados en Fase 3 y documentados en reservations.md; cancelación no borra la reserva.
- Página pública `/b/[slug]`: solo datos públicos; administración por enlaces seguros con expiración. Validación y rate limiting en servidor.
- Suscripciones: pilot, trial, active, past_due, canceled, suspended. Pilotos sin tarjeta. Catálogo y precios configurables; límites y módulos comprobados en servidor.
- Fidelización opcional: visitas o puntos por servicio, recompensas descriptivas definidas por el negocio. Acreditar solo reservas completadas, impedir duplicados, transacciones auditables y canjes sin saldo negativo. Reglas nuevas no alteran créditos históricos.
- Notificaciones transaccionales mediante Resend, outbox/reintentos y deduplicación. Marketing solo con consentimiento. WhatsApp no incluido ni implementado en el MVP inicial.
- No confundir valor de reservas con ingresos cobrados. No mostrar ventas sin registro confiable de pagos.
- Preparar acceso, corrección y eliminación de datos personales con retención e historial acordados antes del piloto.

## Límites comerciales

No hay cargos reales ni integración de pagos en el MVP. Analítica avanzada, pagos/señas y marketing son módulos futuros documentados. Los precios del brief son hipótesis, no contratos ni constantes UI. Identidad visual minimalista cálida elegida por el usuario el 30/10/2026; criterios en design-system.md.

La infraestructura para pilotos comerciales requiere revisión y autorización. Vercel Hobby se reserva según el brief para desarrollo y demostración personal no comercial; usar hosting con condiciones comerciales apropiadas antes de pilotos reales.

## Criterio de avance

El usuario confirmó Fases 2–4, el email técnico de Fase 5, el recorrido de Fase 6 y el funcionamiento general de Fase 7. Fase 8 implementada con contraste manual de métricas pendiente. Autorizó Fase 9 y eligió piloto cerrado de 1–3 negocios; preparación en pilot.md y deployment.md, migración 012 confirmada. La revisión ampliada con usuarios reales sigue en authentication.md. La publicación comercial no se declara operativa por las pruebas locales.
