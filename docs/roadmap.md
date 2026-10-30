# Roadmap

Estado: Fases 0–8 implementadas; contraste manual explícito de métricas de Fase 8 aún pendiente. Fase 9 autorizada y preparación técnica implementada para un piloto cerrado de 1–3 negocios. Migración 012 aplicada por el usuario, conformidad general del recorrido. Envíos automáticos desactivados. Publicación y condiciones externas pendientes según pilot.md; evidencia en progress.md. Validación ampliada de sesiones/roles en authentication.md.

| Fase                          | Alcance                                                           | Verificación de salida                                             |
| ----------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| 0 · Inicialización            | Next.js, estructura, UI inicial, tooling y documentación          | Formato, lint, tipos, unitarios, build y E2E iniciales             |
| 1 · Auth y organizaciones     | Supabase Auth, sesiones, negocio, owner/staff, RLS, panel privado | Pruebas de acceso sin sesión y entre organizaciones contra BD real |
| 2 · Servicios y profesionales | CRUD, relación servicio/profesional, disponibilidad y bloqueos    | Validaciones, permisos y relaciones sin referencias cruzadas       |
| 3 · Reservas                  | Disponibilidad, estados, historial, calendario y concurrencia     | Conflictos, simultaneidad, descansos, cambios de horario y DST     |
| 4 · Página pública            | Catálogo por slug, flujo de reserva, confirmaciones y tokens      | Abuso, privacidad, vencimiento de tokens y responsive              |
| 5 · Clientes y notificaciones | Historial, consentimiento, email, recordatorios y trabajos        | Duplicados, reintentos, errores y aislamiento                      |
| 6 · Suscripciones y pilotos   | Planes, módulos, pilotos e interfaz interna                       | Entitlements en servidor, límites y auditoría                      |
| 7 · Fidelización              | Visitas/puntos, configuración, recompensas, canjes y tarjeta      | Idempotencia, saldo, cambios de reglas y compensaciones            |
| 8 · Dashboard                 | Estadísticas reales, resumen y gráficos                           | Consultas por tenant, métricas correctas y sin ventas ficticias    |
| 9 · Piloto comercial          | Onboarding, seguridad, rendimiento y Railway                      | QA completa, costos, políticas y despliegue autorizado             |

El orden original se conserva. En Fase 3 podrán existir datos sintéticos de integración para probar el motor antes del CRUD de clientes de Fase 5; nunca presentarlos como funcionalidades finales. Cada fase debe terminar compilable y con `progress.md` actualizado.

Prioridad transversal: integridad y seguridad → comportamiento real → usabilidad mobile/desktop → optimización medida. Sin nuevas fases automáticas tras la entrega actual.
