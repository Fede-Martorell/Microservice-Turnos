# Límites de módulos

Los módulos de Fases 1–9 contienen validación, consultas autorizadas y acciones reales cuando corresponde. El motor atómico de disponibilidad/reservas vive en funciones privadas de PostgreSQL, compartidas por consulta y escritura. El módulo público usa contratos acotados y un intermediario de servidor separado de Auth. Dashboard y onboarding son lecturas derivadas; no presentan datos de demostración en producción.

| Módulo         | Responsabilidad                                          | Primera fase |
| -------------- | -------------------------------------------------------- | ------------ |
| organizations  | Organización, preferencias y membresías                  | 1            |
| staff          | Profesionales y disponibilidad                           | 2            |
| services       | Catálogo y profesionales habilitados                     | 2            |
| appointments   | Disponibilidad, reservas, transiciones e historial       | 3            |
| public-booking | Catálogo público, reservas sin cuenta y enlaces privados | 4            |
| customers      | Clientes por tenant, historial y consentimientos         | 5            |
| notifications  | Plantillas, outbox, adaptadores y reintentos             | 5            |
| subscriptions  | Catálogos, entitlements, pilotos y módulos               | 6            |
| loyalty        | Reglas, ledger, recompensas y canjes                     | 7            |
| dashboard      | Resumen y estadísticas básicas de actividad real         | 8            |
| onboarding     | Estado derivado de la configuración inicial              | 9            |

Crear servicios de dominio puros cuando haya reglas reales, validadores de entradas, adaptadores de persistencia de servidor y una interfaz pública por módulo. Evitar depender de componentes React desde el dominio. Las acciones de servidor comprueban identidad, tenant y permisos antes de llamar casos de uso; RLS es una segunda barrera obligatoria. No implementar módulos antes de su fase.
