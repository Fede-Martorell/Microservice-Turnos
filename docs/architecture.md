# Arquitectura

## Estado actual

Monolito modular: Next.js App Router y PostgreSQL en Supabase. Fases 1–9 incorporan Auth SSR, organizaciones, catálogo, equipo, disponibilidad, agenda, reservas públicas, clientes, notificaciones, planes, fidelización, dashboard y puesta en marcha. Permisos owner/staff, RLS y auditoría. No hay microservicios ni datos de ejemplo presentados como reales. La preparación del piloto no implica un despliegue comercial activo.

## Límites y dependencias

`app` compone rutas, Server Components y estados de error/carga. `components/ui` contiene componentes shadcn/ui locales. `components/layout` alberga navegación; es Client Component por el menú compacto. El resto de la pantalla se genera en servidor. `features` contiene casos de uso, consultas, validación y Server Actions por módulo; las reglas atómicas permanecen desacopladas de React en PostgreSQL.

Los módulos operativos son organizaciones, profesionales, servicios, reservas, clientes, página pública, notificaciones, suscripciones, fidelización y estadísticas básicas del propietario. El complemento de analítica avanzada sigue pendiente. Supabase y Resend viven en servidor. No crear repositorios, interfaces vacías o abstracciones genéricas antes de necesitarlas.

El dashboard agrega datos en una RPC STABLE por tenant y período acotado, con autorización de propietario en servidor y SQL. No descarga reservas completas para calcular estadísticas ni confunde precios con cobros. Solo la serie agregada llega al componente cliente Recharts; listas recientes y próximas se renderizan en servidor. Sin caché compartida ni jobs de actualización. Ver dashboard.md.

Fidelización usa un ledger inmutable y lotes con vencimiento; el saldo se deriva al consultar. Créditos automáticos dentro de la transacción de completar reservas; canjes, ajustes y anulaciones serializados por organización con idempotencia. El propietario administra y emite tarjetas de consulta mediante token aleatorio cuyo hash se guarda en BD. El gateway público permite solo un contrato acotado sin contactos ni motivos internos. Ver loyalty.md.

Dirección de dependencias: rutas → autorización/acciones del módulo → validadores/permisos → adaptador SSR → Supabase/RLS. Los invariantes transaccionales de creación, disponibilidad y reservas están en funciones SQL, sin secuencias de escrituras del navegador. La UI no decide permisos ni usa recursos privilegiados. Adaptadores y consultas llevan `server-only`; no existe cliente de navegador. Otros módulos se incorporarán según su fase. Ver catalog.md y reservations.md.

## Flujo de una operación

1. Server Action/Route Handler recibe y valida entrada con Zod.
2. Verifica sesión mediante Supabase Auth, organización, rol y permisos.
3. Comprueba estado activo del negocio. PostgreSQL valida período, módulos y cupos en cada operación pertinente; el propietario conserva lectura histórica al vencer. `/admin` usa una lista privada de cuentas confirmadas, independiente de membresías y sin lectura de contactos/reservas.
4. Ejecuta caso de uso con contexto de organización obtenido del servidor.
5. PostgreSQL aplica RLS y restricciones; operaciones críticas son transaccionales.
6. Responde con datos mínimos o error seguro; registra eventos y auditoría sin secretos.

Ni un `organization_id` recibido del navegador ni un elemento oculto constituyen autorización. Las rutas públicas usan un cliente anon independiente de la sesión del panel, con credencial de servidor limitada a RPC públicas. La BD comprueba su hash y devuelve contratos acotados sin tablas privadas. La disponibilidad comparte el motor SQL del panel. Cookies firmadas para visitantes, cuotas persistentes, honeypot y Turnstile fuera de localhost. Tokens de gestión almacenados mediante hash y con vencimiento, transportados en fragmento y canjeados por cookie HttpOnly. Ver [reservas públicas](public-booking.md).

## Tiempo, moneda e internacionalización

Reservas: instantes en `timestamptz`/UTC, zonas IANA por organización y reglas semanales en hora local. Pruebas de DST y cambios de día. Importes en unidad mínima entera con código ISO de moneda, convertidos desde texto decimal sin redondeo implícito. `Intl` para presentación. No hay precios comerciales de planes en componentes.

Idioma HTML `es`; textos principales centralizados en `lib/i18n/es.ts`, contenido de roadmap en configuración. Los textos secundarios aún están en componentes: se extraerán al agregar un segundo idioma. No se instala infraestructura de traducción hasta necesitarla.

## Responsive y accesibilidad

Identidad minimalista cálida elegida por el usuario: tokens centrales, marca reutilizable, DM Sans/Newsreader locales mediante next/font/local y navegación unificada en WorkspaceShell. Portada pública separada del panel de trabajo. Contraste, movimiento reducido, formularios y verificación visual en design-system.md.

Sidebar desktop; menú compacto en mobile. Calendario diario/7 días y flujo público adaptado a teléfono. Enlaces reales, navegación por teclado, foco visible, salto al contenido, encabezados semánticos y respeto por movimiento reducido. Los módulos futuros se muestran como texto informativo, sin links falsos.

## Portabilidad

Runtime Node.js, `output: standalone`, sin dependencia de servicios propietarios de Vercel. No hay fuentes remotas durante build. Los avisos de Fase 5 usan outbox transaccional, leases SKIP LOCKED, cuerpo congelado e idempotencia de proveedor, con reintentos persistentes acotados a menos de 24 horas. Comando manual dry run por defecto y endpoint POST autenticado. Scheduler externo todavía no configurado; sin temporizadores permanentes. Ver [clientes y notificaciones](customers-and-notifications.md) y `deployment.md`.
