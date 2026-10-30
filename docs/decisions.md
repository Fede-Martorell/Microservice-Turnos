# Decisiones técnicas

## ADR 001 · Monolito modular

Una aplicación y una base compartida con RLS. Evita despliegues distribuidos y costos innecesarios; módulos en `features` permiten separar dominio de transporte/presentación. Sin implementación anticipada de módulos.

## ADR 002 · Inicialización manual y reproducible

El repositorio estaba vacío, sin Git ni instrucciones AGENTS.md en los ancestros inspeccionados. Se inicializa Next.js manualmente siguiendo documentación oficial; así se evita que un generador haga un commit automáticamente. npm con versiones exactas y lockfile. No se crea commit ni push.

## ADR 003 · Node 22 y stack estable

Entorno detectado: Node 22.14.0 y npm 11.14.1. Rama 22 LTS con mínimo 22.12, compatible con herramientas seleccionadas. `engines`, `.nvmrc` y CI usan esa rama. Next/React/Tailwind y herramientas se resuelven desde releases estables del registro. Consultar versiones instaladas en package.json; no depender de `latest` al reinstalar.

## ADR 004 · UI provisional y transparente

Tokens neutrales con acento verde sobrio, sin branding final. shadcn/ui local (button, card, skeleton) y Lucide. Shell responsive y estado vacío. Sin gráficos de muestra ni acciones falsas. Los textos principales permiten futura extracción a catálogos por idioma. La página de estado documenta exactamente lo disponible.

## ADR 005 · Sin integraciones activas ni SQL prematuro

Se instalan SDKs del stack, pero no se instancian clientes ni se solicitan credenciales para Fase 0. No escribir tablas/RLS antes de Fase 1. Toda autorización, aislamiento y persistencia sigue pendiente y está documentada como tal.

## ADR 006 · PWA conservadora

Manifest, iconos normales/maskable/Apple y standalone, sin service worker. Así no hay respuestas privadas cacheadas ni promesa de operación offline. Next versiona assets con hash. Revisar estrategia de caché e invalidación antes de incorporar datos autenticados; cambiar URL de iconos al actualizarlos.

## ADR 007 · Pruebas acordes al alcance

Vitest cubre configuración pública (sin filtración de secretos) y comportamiento del menú. Playwright verifica navegación, pantalla vacía real, ausencia de desbordes/errores JS, recursos PWA, 404 y cabeceras en desktop Chromium, móvil Chromium y móvil WebKit. No se inventan pruebas de dominio o RLS antes de implementarlos.

## ADR 008 · Compatibilidad de dependencias

El primer intento de instalación encontró conflicto en dependencias opcionales de `@hookform/resolvers@6` (Effect 3/4). Se omite el adaptador: no hay formularios en Fase 0 y Zod/RHF quedan instalados. No usar `--force` ni `--legacy-peer-deps`. Reevaluar el resolver compatible cuando se creen formularios reales. Recharts se difiere hasta Fase 8; Supabase/Resend no reciben red desde la app.

## ADR 009 · Hallazgos de auditoría de desarrollo

`npm audit` reporta cinco paquetes afectados por una misma cadena de dependencias de lint: eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces. El advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) no publica versión corregida de braces al momento de esta revisión. No aplicar el downgrade mayor sugerido por audit, que desalinearía Next y su configuración. No aceptar patrones glob de usuarios en tooling. El hallazgo sigue pendiente de actualización upstream; la auditoría de dependencias de producción se verifica por separado.

ESLint se fija en 9.39.5 por compatibilidad: eslint-plugin-react de la configuración oficial de Next declara peer compatible hasta ESLint 9. npm informa deprecación para esa versión; migrar a ESLint 10 cuando el conjunto oficial declare compatibilidad. No se forzaron peers. shadcn/ui fue generado por CLI oficial y se ajustó para importar solo Radix Slot y el helper local, evitando instalar todos los primitives por un único botón.

## ADR 010 · Arranque portable standalone

El primer smoke E2E pasó, pero Next.js advirtió que `next start` no es el comando soportado para `output: standalone`. `postbuild` copia recursos con las APIs portables de Node y `npm start` ejecuta el servidor generado. Playwright configura HOSTNAME/PORT en el entorno del proceso de prueba. Se verifica nuevamente build y E2E usando este paquete.

## ADR 011 · Auth SSR solo servidor y aislamiento

Supabase SSR por petición, cookies HttpOnly/SameSite=Lax/Secure con HTTPS, proxy para renovación y redirección temprana. Las páginas y acciones verifican getUser, cuenta confirmada y membresía actual de BD. No se autoriza por getSession, metadata ni simple presencia de cookie. Rutas privadas sin caché compartido. La confirmación admite PKCE o TokenHash y destinos internos fijos.

## ADR 012 · RPC de creación y grants mínimos

Crear organización/owner/settings/auditoría en una transacción PostgreSQL. Evita estados parciales y permite denegar INSERT de tablas a la API. Helper privado de membresía evita recursión de RLS con search_path vacío; grants de columnas impiden cambiar tenant/status/autor/slug. Roles de miembros no se modifican desde navegador en esta fase. Un bloqueo transaccional por usuario permite aplicar un límite móvil de 3 creaciones en 24 horas.

## ADR 013 · Pruebas SQL sin Docker

La máquina no tiene Docker/PostgreSQL local. Se incorpora PGlite solo como dependencia de desarrollo para ejecutar el SQL real con roles en PostgreSQL WASM. El harness de auth.users/auth.uid sirve para políticas, no simula un producto operativo ni valida GoTrue/PostgREST. Guardas de sesión/acciones tienen pruebas de servidor aparte. La migración fue aplicada por el usuario a Supabase y las consultas anónimas remotas se comprobaron con clave pública.

## ADR 014 · Git y configuración local

El repositorio provisto estaba vacío. Se inicializa Git y se configura origin con su URL, sin commits/pushes. Las variables completadas por el usuario en la plantilla se trasladan a .env.local; el ejemplo queda vacío. También se excluye de Git el archivo local supabase-contra.txt, sin leer ni publicar su contenido.

## ADR 015 · Configuración de runtime y verificación E2E

El build de Next.js incorporaba valores NEXT_PUBLIC incluso tras usar un alias simple de process.env. Se adoptó una lectura dinámica explícita con Reflect.get para que el mismo paquete standalone pueda ejecutarse con otra configuración. Los E2E prueban el mismo build con variables vacías y con Supabase configurado, incluidos origen de callbacks, aviso sin conexión y formularios habilitados. El proxy redirige antes del streaming, sin reemplazar las guardas de servidor ni RLS.

## ADR 016 · Catálogo y acceso profesional independientes

Un recurso de reserva puede existir sin usuario. Las relaciones son compuestas por tenant. Catálogo/horarios se modifican mediante RPC owner con auditoría y lock de organización; staff consulta solo lo autorizado. No se borran servicios/profesionales desde la API. Invitaciones manuales de 48 horas almacenadas por hash, límite transaccional y aceptación ligada al correo confirmado. La app muestra el enlace una sola vez y no envía emails. Detalles en catalog.md.

## ADR 017 · Disponibilidad única y exclusión en PostgreSQL

El motor privado SQL se reutiliza al listar, crear y reprogramar. Evita validar con reglas distintas entre UI y escritura. Horarios locales IANA e instantes UTC, preparación posterior y cuadrícula de 15 minutos. No ofrecer tramos que atraviesen un cambio de offset DST; distinguir las horas repetidas por UTC/offset. Escrituras bloquean la organización en el mismo orden que el catálogo. GiST/btree_gist impide superposiciones incluso si una operación privilegiada omite la RPC. Snapshot histórico, transiciones explícitas, versión optimista y clave de solicitud idempotente. No hay borrado de reservas canceladas.

## ADR 018 · Concurrencia con conexiones independientes

PGlite mantiene pruebas rápidas del SQL pero una conexión no acredita simultaneidad. Se agrega pg solo en desarrollo y un script que acepta exclusivamente hosts locales, crea una BD temporal y la elimina al finalizar. Se observaron locks reales en PostgreSQL 18.4 para dos RPC simultáneas, dos INSERT sin RPC e idempotencia concurrente; los tres escenarios pasaron. Binarios temporales externos al runtime. CI preparada con servicio PostgreSQL 17, pendiente de ejecución remota. No se solicitan credenciales de producción para estas pruebas.

## ADR 019 · Fichas e historial separados

Fase 5 vincula clientes por email normalizado dentro de cada tenant, sin sobrescribir su ficha con entradas públicas. Cada reserva conserva snapshots. Conteos e historial usan RLS de agenda para staff; owner administra fichas y preferencias con versión. La migración 007 separa lectura de consentimiento mediante grants de columnas y RPC owner: ocultar campos en la UI no basta. No se fusionan clientes entre negocios ni se presupone fidelización activa.

## ADR 020 · Outbox y ventana de idempotencia

Triggers transaccionales registran avisos y recordatorios por reserva/versión/evento. Procesador acotado, credencial propia sin service_role, SKIP LOCKED y lease con token. Se congela el cuerpo antes de Resend y se reutiliza la clave por trabajo, incluso ante respuesta de red ambigua. La retención de idempotencia del proveedor es 24 h; los reintentos cierran a las 22 h y seis intentos. Más allá no se reenvía automáticamente. El estado sent significa aceptación, no entrega. Modo disabled por defecto y test limitado a un destinatario sin redirigir datos ajenos. Comando dry run y POST autenticado, scheduler externo pendiente.

## ADR 021 · Accesos finitos y administración de plataforma independiente

Planes/módulos/cupos en PostgreSQL con períodos comprobados al operar, sin cron para vencer. El propietario conserva lectura histórica al vencer; nuevos usos requieren acceso vigente. Cuotas de profesionales bajo el mismo bloqueo de organización que las reservas. Desactivar un plan evita nuevas asignaciones sin eliminar históricos. Precios configurables y referencia guardada por asignación, sin proveedor de cobros.

Superadmin mediante lista privada de UUID confirmados y SQL local revisado por el operador. No por metadatos o ser owner, ni con service_role en la aplicación. Consultas administrativas de metadatos/conteos; RLS de contactos/agendas permanece por membresía. Notas internas privadas, feedback por owner y auditoría sin edición de API. Los pilotos se representan como estado de la suscripción para evitar una segunda fuente de vigencia. Ver subscriptions-and-pilots.md.

## ADR 022 · Fidelización por movimientos y lotes inmutables

Visitas/puntos se conservan como unidades sin valor monetario. La reserva completada acredita una sola vez en su misma transacción; reglas nuevas no reescriben el historial. Canjes y ajustes consumen lotes por vencimiento bajo bloqueo de organización e idempotencia de solicitud. Anular agrega compensaciones con vencimientos originales, sin resucitar créditos vencidos. Las recompensas guardan snapshots y sus límites se conservan al editar. Tarjeta pública de consulta por token aleatorio con hash privado, separada de la sesión del panel; sin contactos ni motivos internos. No requiere cron de vencimiento ni envíos de email. Ver loyalty.md.

## ADR 023 · Estadísticas básicas agregadas por período local

Dashboard incluido para el propietario, separado del complemento futuro de analítica avanzada. Una RPC de lectura STABLE agrega reservas en PostgreSQL con fechas locales y límites UTC, sin paginar filas hacia JavaScript. Rango máximo de 93 días, ceros explícitos, top cinco y listas acotadas. Los filtros se refieren al inicio del turno y estado actual; no se mantienen snapshots históricos de métricas. Recurrente significa al menos dos completadas del mismo cliente en el período. No se calculan ventas desde precios de reservas. Recharts queda en un componente cliente con tabla alternativa; no hay credenciales ni consultas de BD en el navegador. Ver dashboard.md.

## Referencias adicionales

- [Rangos y exclusión PostgreSQL](https://www.postgresql.org/docs/current/rangetypes.html)
- [Fechas, horas y zonas PostgreSQL](https://www.postgresql.org/docs/current/functions-datetime.html)
- [Binarios temporales de PostgreSQL usados para la prueba local](https://github.com/leinelissen/embedded-postgres)

## Referencias oficiales de inicialización

- [Next.js: instalación App Router](https://nextjs.org/docs/app/getting-started/installation)
- [Tailwind CSS: Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [shadcn/ui: instalación Next.js](https://ui.shadcn.com/docs/installation/next)
- [Vitest: guía](https://vitest.dev/guide/)
- [Playwright: instalación](https://playwright.dev/docs/intro)
- [Zod](https://zod.dev/)
- [Supabase: clientes SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Resend: Next.js](https://resend.com/docs/send-with-nextjs)
- [React Hook Form: repositorio oficial](https://github.com/react-hook-form/react-hook-form) (la página de inicio de la documentación devolvió 403).
