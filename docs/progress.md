# Progreso

## 2026-10-30 · Limpieza, versionado y material de portfolio

El usuario autorizó limpieza, actualizaciones necesarias, commit y push al repositorio público Fede-Martorell/Microservice-Turnos; eligió una primera publicación de LinkedIn centrada en portfolio, aprendizajes y feedback. Esta autorización reemplaza la restricción previa de no versionar/subir. Publicar el código no equivale a desplegar la app ni autoriza cobros o emails.

Se retiraron dos componentes sin referencias: la navegación antigua por organización (sustituida por WorkspaceShell) y Card, ya sin uso. Actualizados límites de módulos, arquitectura, README y guía de despliegue. Se agregaron EditorConfig/Git attributes para formato estable entre Windows/Linux y `repo:check`, que revisa candidatos/tracked, archivos privados/generados, valores sensibles conocidos y patrones de credenciales sin imprimir secretos. Incluido en check y cubierto por tres pruebas. .env.local, SQL locales, credenciales, bases de prueba, reportes y entregables ZIP permanecen fuera de Git.

Parches aplicados: Next y eslint-config-next 16.4.2 → 16.4.3, PostCSS 8.5.31 → 8.5.32 y PGlite 0.5.11 → 0.5.13, con lockfile actualizado. Next incorpora correcciones de la rama estable según su release oficial. Audit informó cero vulnerabilidades. No se modificaron migraciones 001–012 ni datos reales.

Verificaciones locales: check con 242 tests en 47 archivos, lint/tipos/build/postbuild, artefactos públicos y revisión previa a Git. Pasaron 18 recorridos de navegador sin configuración y 15 con adaptador SQL/identidad sintéticos, en Chromium desktop/móvil y WebKit móvil. Pasaron nuevamente los 11 casos de concurrencia PostgreSQL 18.4 en una base temporal descartable, servidor detenido al terminar. El ensayo configurado sin sesión de la entrega anterior también pasó; no se repite por cambios documentales. Los logs/resultados públicos no contienen secretos conocidos.

Material de presentación en docs/showcase: cuatro láminas 1080×1350, cuatro capturas originales, textos alternativos, guía y borrador de LinkedIn. Aplicación real con datos sintéticos locales, recursos externos bloqueados, sin reservas reales/emails. Capturas de resumen, puesta en marcha, reserva pública y tarjeta móvil verificadas visualmente. Se corrigió el encuadre de onboarding/formulario para conservar información y botón final. Script reproducible showcase:capture; ZIP derivado en deliverables, ignorado. No se accedió a LinkedIn ni se publicó el borrador.

La revisión automática bloqueó borrar un directorio temporal de dependencias por política de seguridad; se conservó bajo node_modules, ignorado. No se intentó eludir el bloqueo. El código compila y esa carpeta no forma parte del commit. El directorio PostgreSQL local también se conserva.

El repositorio remoto se encontró vacío al comenzar. El commit/push inicial se realiza con la identidad Git ya configurada, seguido de verificación del HEAD remoto y CI en GitHub Actions. Consultar Git/Actions para el resultado vigente; no se declara CI remota aprobada por las comprobaciones locales. El despliegue Railway, backup/restauración real y aceptación del piloto siguen según pilot.md.

## 2026-10-30 · Fase 9, preparación del piloto cerrado

El usuario autorizó Fase 9 y eligió 1–3 negocios. Preparación técnica implementada; no se abrió el piloto comercial. Se aplicaron performance-engineer, modern-web-guidance y los criterios visuales existentes de pixel-perfect-ui; se consultaron las guías instaladas de Next 16 antes de editar.

Puesta en marcha para owner, con cuatro controles derivados de datos reales: profesional, servicio activo asignado, trabajo del negocio y horario coincidente suficiente para duración más preparación. SQL combina tramos adyacentes y resta pausas; comprueba tenant, membresía activa y cuenta confirmada, sin contactos ni IDs en la respuesta. No declara disponibilidad de una fecha ni marca pruebas manuales como hechas. Indicadores adicionales informan si hay reservas y si la página está habilitada en configuración, sin confundirlo con vigencia del módulo. Link desde Resumen y menú; histórico consultable sin habilitar operaciones al vencer plan.

Migración **20261030001200_pilot_onboarding.sql aplicada por el usuario: Success**. Comprobación remota de solo lectura: llamada anónima a get_business_onboarding denegada, HTTP 401 / SQL 42501. No repetir ni editar 001–012. Sobre el recorrido visual y contraste de métricas, el usuario respondió «debería estar ok»: conformidad general, sin evidencia explícita de contraste Calendario/Resumen. Ese contraste y el ensayo con varias cuentas reales siguen en la aceptación de staging.

Arranque estricto para hosting, validador sin imprimir valores, Dockerfile de dos etapas con usuario sin privilegios y contexto sin secretos; health GET/HEAD de proceso/configuración, sin consultar proveedores. El arranque no migra ni envía emails. Nuevo control de artefactos, prueba de arranque sintética y construcción Docker preparada en CI. CSP acota base/object/frame-ancestors sin bloquear inline de Next, Turnstile o imágenes configuradas. Error de página ofrece reintento, navegación y digest seguro; no muestra mensajes privados. No se agregó un sistema externo de monitoreo ni se declara una CSP completa contra XSS.

Optimización medida: gráfico diferido al acercarse al viewport, espacio reservado y tabla SSR. Una muestra local: JS inicial transferido del resumen de 269.106 a 169.911 bytes (aprox. 37% menos); costo total tras ver gráfico ligeramente mayor, no se atribuyen mejoras cloud. Método, muestra y límites en performance.md. Sin caché nueva de datos privados.

Verificaciones: `npm run check` completo con 239 tests en 46 archivos, build/postbuild y control de 33 archivos JS; sin archivos privados en standalone ni coincidencias de secretos conocidos. 51 recorridos Playwright: 18 sin configuración, 18 con configuración sin sesión/escrituras remotas, 15 con SQL/identidad sintéticas. Chromium desktop y móvil, WebKit móvil, y control de ancho 320px en resumen; Puesta en marcha sin desbordes. Capturas desktop/móvil revisadas. 11 casos de concurrencia pasaron en PostgreSQL 18.4 local; su base temporal se eliminó por el propio script y el servidor se detuvo, sin borrar el directorio de datos. Audit de producción: 0 vulnerabilidades informadas.

Ensayo de recuperación PGlite: snapshot separado, datos/funciones/permisos recuperados y aislamiento conservado. No es pg_dump ni recuperación de Supabase/Auth real. Prueba de runtime: rechaza origen inseguro, arranca con valores sintéticos y sirve GET/HEAD sin depender de proveedores. Revisión local de configuración pasó; la de hosting detecta origen localhost y Turnstile faltante, pendientes esperables. NOTIFICATION_MODE conserva disabled.

Documentados Railway, variables, rollback, soporte, recuperación, criterios de apertura y costos oficiales consultados el 30/10. Escenario Pro+Pro con emails gratuitos: USD 45 de base, sujeto a uso y extras; no es una factura ni una contratación. Docker no disponible localmente: construir/arrancar imagen y ejecutar CI remota siguen pendientes. Antes de abrir: HTTPS/dominio, Auth/Turnstile, recuperación de cuenta, backups/restauración real separada, monitor, revisión de privacidad y prueba con personas reales. Guías en deployment.md y pilot.md.

Sin nuevos emails, cron, pagos, cuentas de proveedores, commit, push ni despliegue. Desarrollo continúa en localhost:3000. Las secciones anteriores conservan el estado histórico de cada entrega, no sustituyen este estado actual.

## 2026-10-30 · Rediseño visual con pixel-perfect-ui

El usuario pidió una presentación más cuidada y comprensible para él y para los negocios que adquieran el producto. Eligió la opción «Minimalista cálido». Se aplicaron pixel-perfect-ui y modern-web-guidance, leyendo primero sistema existente y documentación instalada de Next.js. Dirección, tokens y límites en design-system.md.

Nueva portada de presentación, acceso editorial responsive, fuentes locales DM Sans/Newsreader, colores marfil/verde bosque y componentes de formulario consistentes. Panel con navegación unificada según permisos/módulos, cambio de organización compacto y jerarquía del resumen. Página pública, tarjeta privada y cabecera administrativa comparten criterios visuales. Se conserva personalización pública del negocio. Mostrar/ocultar contraseña y Escape del menú móvil con foco restaurado. No se alteran consultas ni reglas de negocio.

Verificado: npm run check completo, 226 pruebas en 41 archivos; build/postbuild final correcto tras ajustes visuales. E2E: 18 sin configuración, 18 con Supabase configurado y 15 recorridos aislados de reservas/tarjeta/dashboard, en desktop Chromium y móvil Chromium/WebKit. Se comprobó también viewport de 320px en portada/resumen. Una aserción inmediata en WebKit capturaba el gráfico antes del reajuste de ResizeObserver; se espera la condición de ancho con expect.poll y pasan los tres recorridos de resumen, manteniendo la condición de ausencia de desborde. Se revisaron capturas de portada desktop/móvil, acceso con formulario real, resumen, catálogo público y tarjeta. Las sesiones autenticadas del dashboard en E2E siguen siendo sintéticas locales; no sustituyen GoTrue ni revisión manual. No se declara la validación manual pendiente de Fase 8 como confirmada por este cambio visual.

Auditoría de producción sin vulnerabilidades. Ningún secreto ni destinatario privado aparece en los 31 chunks JS del cliente; NOTIFICATION_MODE permanece disabled. Se solicitó abrir la portada en el panel de navegador de Codex; la app devolvió queued. Desarrollo responde en puerto 3000 para revisión del usuario.

Sin SQL adicional, cambios de datos reales, emails, cobros, Fase 9, commits, push ni deploy. Servidor de desarrollo disponible en puerto 3000.

## 2026-10-23 · Fase 8 implementada y verificada; validación manual pendiente

El usuario autorizó la siguiente etapa. Resumen del negocio como inicio para el propietario; personal dirigido a su agenda. Configuración movida a su ruta explícita. Métricas reales por período: reservas/estados, clientes atendidos y recurrentes, servicios más solicitados, gráfico y tabla diaria. Hoy, próximas cinco reservas y últimos diez eventos fuera del filtro estadístico. Sin cifras de ventas, métricas de ocupación ni habilitación del complemento de analítica avanzada. Guía y definiciones en dashboard.md.

Migración 011 validada localmente con ocho pruebas SQL: permisos, vacíos, estados, rango, zona/DST, servicios inactivos, lectura al vencer, más de mil reservas y tenant separado. El usuario confirmó Success al aplicarla. La RPC remota existe y anon recibe 42501. No repetir ni editar migraciones aplicadas. Pendiente comparar desde la sesión real del propietario; recorrido solicitado mediante consulta al usuario.

Verificado: npm run check completo con 223 tests en 39 archivos y build/postbuild; después del ajuste responsive a dos columnas móviles, build/postbuild y formato/lint correctos. E2E finales: 18 sin configuración, 18 con Supabase configurado y 15 con adaptador/SQL aislados hasta 011 (reserva pública, tarjeta y dashboard SSR con identidad sintética local). Pasaron los 51 recorridos. Se corrigieron selectores ambiguos en las pruebas, sin cambiar autenticación de producción. Se revisaron capturas desktop/móvil y estados vacíos, tabla diaria, gráfico, filtros, listas y acceso a configuración. La prueba real de GoTrue sigue separada. Auditoría de producción: cero vulnerabilidades. Ningún secreto ni destinatario privado aparece en los 29 chunks JS del cliente. NOTIFICATION_MODE sigue disabled. Desarrollo iniciado y disponible en puerto 3000; no se levantó PostgreSQL nativo en esta fase de consultas.

No se comenzó Fase 9 ni se activaron emails, cobros, scheduler, commits, push o deploy.

## 2026-10-22 · Cierre de Fase 7

El usuario autorizó la siguiente etapa tras confirmar Fase 6. Fidelización opcional implementada: asistente de visitas/puntos por servicio, reglas versionadas, recompensas, acreditación única al completar reservas, saldo por lotes, canjes, ajustes y anulaciones compensatorias. Tarjeta privada de consulta con rotación/revocación. Propietario administra; staff no consulta saldos y superadmin no obtiene acceso a contactos. Referencias comerciales de complementos editables, sin cobros ni inclusión automática en planes. Guía: loyalty.md.

La migración 010 se aplica en una transacción. Tras un error de comunicación del dashboard api.supabase.com, se verificó en la API del proyecto que get_loyalty_card existe y devuelve 42501 sin gateway. El usuario informó después 42701 al repetirla porque reference_price_minor ya existe. No repetir ni modificar migraciones aplicadas. Confirmó habilitación de Fidelización y su aparición en el panel y en Suscripción. Luego respondió «funciona correctamente por lo que vi» al recorrido solicitado de configuración, recompensa, canje/anulación y tarjeta privada. Se registra su confirmación general; no especificó si obtuvo saldo completando una reserva o mediante el ajuste alternativo. La acreditación automática está cubierta por pruebas SQL y de concurrencia.

Verificado: npm run check completo, 208 tests en 36 archivos, formato/lint/tipos y build/postbuild correctos. Once escenarios de concurrencia en PostgreSQL nativo, incluidos doble canje, reintento, último límite global y doble completado. SQL prueba aislamiento, inmutabilidad, expiración, versiones, permisos y privacidad. E2E: 18 sin configuración, 18 con Supabase configurado y 12 públicos con SQL aislada hasta 010; todos aprobados. Tarjeta revisada visualmente en desktop y móvil; se repitieron sus tres flujos de consulta para regenerar capturas tras las suites generales. Ninguno de los secretos ni el destinatario privado aparece en los 28 chunks JS del cliente. Se aisló una limitación de WebKit Windows sobre SameSite en HTTP loopback con servidor mínimo externo; la app emite Strict, verificado por encabezado. Safari real/HTTPS requiere validación antes del hosting.

NOTIFICATION_MODE permanece disabled. Servidor PostgreSQL nativo de pruebas detenido; desarrollo responde en puerto 3000. No emails, cargos, scheduler, Fase 8, commits, push ni deploy.

## 2026-10-22 · Cierre de implementación de Fase 5 y entrega de Fase 6

El usuario autorizó cerrar Fase 5 y continuar con Fase 6. Autorizó un único email técnico al destinatario configurado, Resend lo aceptó y confirmó recepción. Se guardó idempotencia/resultado en un archivo local ignorado; no se repitió el envío. NOTIFICATION_MODE sigue disabled. Esto valida conexión y recepción de esa prueba, no una reserva real procesada por outbox ni un recordatorio programado. La prueba manual remota de fichas/cola sigue pendiente antes de habilitar envíos operativos.

Fase 6 implementada: catálogo de planes y módulos, cupos de profesionales activos, períodos finitos pilot/trial/active/past_due/canceled/suspended, política inicial configurable, excepciones temporales por módulo, suscripción del propietario y feedback. Panel `/admin` separado con búsqueda/indicadores, gestión de planes/accesos/observaciones/estados y auditoría. Los importes son referencias configurables sin cobros. Fidelización y demás módulos futuros no se pueden habilitar todavía.

Controles en PostgreSQL y formularios: nuevo uso bloqueado sin licencia, pública/horarios/cola sujetos a módulos, cupo bajo bloqueo de organización. Datos y consulta histórica del propietario conservados al vencer; cancelación/revocación/retirada de consentimientos permitidas. Staff requiere módulo de equipo. Administrador por UUID en lista privada de cuentas confirmadas, sin acceso indiscriminado a clientes/reservas. SQL local de concesión preparado sin service_role ni secretos públicos.

El usuario informó Success para 008/009. La primera concesión administrativa falló cerrada porque el correo de Resend no existía como usuario confirmado de la aplicación. Eligió su cuenta mediante PLATFORM_ADMIN_EMAIL; se regeneró el SQL local y confirmó Success al aplicarlo. Confirmó el recorrido de notas internas, feedback y auditoría desde su sesión real y envió captura de «Suscripción guardada» con motivo «Etapa 6 testing». Se corrigió una ambigüedad de Intl/es-AR observada en esa captura: mostraba 04:20 sin período del día para 16:20 UTC; ahora se exige formato h23 en auditoría, listado y feedback, con regresión automatizada. No repetir migraciones. Guía y conservación en subscriptions-and-pilots.md.

Verificaciones finales: `npm run check` correcto (formato, lint, tipos, tests y build/postbuild standalone); siete escenarios PostgreSQL nativo aprobados, incluida la carrera del último cupo. E2E: 18 sin configuración, 18 con Supabase configurado y 6 públicos con SQL aislada hasta 009, en Chromium desktop/mobile y WebKit mobile. La suite completa inicial tuvo 184 tests en 31 archivos; se añadieron dos regresiones de presentación tras la captura del usuario. La migración desde 007 conserva catálogo/turnos; se probaron planes/política/versiones, privilegios, feedback, cupos, branding y vencimiento con cancelación privada/pública. Supabase real: RPC administrativa existe y anon recibe 42501; usuario confirmó el recorrido interno. Auditoría de producción: 0 vulnerabilidades. Ninguno de los secretos ni el destinatario privado aparece en los 26 chunks JS del cliente. Archivos locales ignorados. La base nativa temporal se eliminó y el servidor nativo se detuvo; desarrollo sigue disponible en puerto 3000.

No se implementa Fase 7, no se activan envíos automáticos, no hay cobros, scheduler, commits, push ni deploy.

## 2026-10-21 · Fase 5 implementada; validación manual en curso

El usuario autorizó clientes y notificaciones. Aplicó migración 006 y hash del worker, y luego 007 con Success. Configuró Resend, remitente y destinatario de pruebas en `.env.local`; se comprobó presencia/formato sin mostrar credenciales. NOTIFICATION_MODE sigue disabled: no se envió ningún email real todavía. Fase 6 no comenzó.

### Trabajo completado

- Clientes por tenant con backfill de reservas existentes, email normalizado único, trigger transaccional para altas nuevas y sin sobrescribir fichas con entradas públicas. Snapshots de reservas conservados; sin mensajes históricos al migrar.
- Listado/búsqueda/filtros de actividad y recurrencia, fichas editables por owner con versión, visitas completadas/última visita e historial paginado. Staff ve solo contacto e historial/conteos de su agenda. Preferencias y evidencia de consentimiento protegidas también mediante grants de columnas y RPC owner (007).
- Preferencias transaccionales y consentimiento de marketing separado con evidencia/actor/instante auditados. Ningún envío de campañas. Procedimiento documentado para acceso, corrección y revisión de eliminación/anonimización, sin botón de borrado permanente ni exportación automática.
- Outbox para alta, confirmación, cancelación, reprogramación y recordatorio confirmado. Registro atómico por reserva/versión/evento; lease SKIP LOCKED/token, recuperación, cuerpo congelado, deduplicación Resend y ventana de reintentos menor a su retención de idempotencia.
- Plantillas españolas con hora de 24 h y zona del turno, HTML escapado, enlace privado si su hash se puede verificar, sin recursos remotos ni seguimiento incorporado. Ajuste de viewport móvil tras revisión visual. Aceptación del proveedor diferenciada de entrega real.
- Configuración/registro de avisos owner; procesador POST autenticado, comando manual dry run y envíos desactivados por defecto. Modo test solo procesa el destinatario permitido y nunca redirige avisos ajenos. Preparación local de credencial acotada/cron, sin service_role, scheduler ni deploy.

### Verificaciones

| Comprobación                    | Resultado                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| SQL de clientes/cola y permisos | 16 pruebas nuevas aprobadas; suite pública ampliada a 13 y migraciones hasta 007                                |
| Vitest completo                 | 164 tests aprobados en 28 archivos                                                                              |
| Formato/lint/tipos/build        | Correctos, incluida la compilación final tras ajuste de viewport del email                                      |
| PostgreSQL nativo 18.4          | 6 escenarios aprobados, incluido lease único ante dos workers simultáneos                                       |
| E2E sin configuración           | 18 aprobados en Chromium desktop/mobile y WebKit mobile                                                         |
| E2E Supabase configurado        | 18 aprobados con mismo build y envío desactivado                                                                |
| Revisión de email móvil         | 3 E2E adicionales tras ajuste de viewport; capturas desktop/WebKit revisadas                                    |
| E2E público                     | 6 aprobados con migraciones hasta 007 y envíos desactivados                                                     |
| Supabase remoto                 | Clientes, cola, ajustes y preferencias denegados a anon; worker sin secreto 401/42501, contador con secreto 200 |
| Dry run remoto                  | 200, modo disabled, sin reclamar ni enviar; conteo inicial 0                                                    |
| Auditoría de producción         | 0 vulnerabilidades                                                                                              |
| Secretos                        | Ausentes de los 24 chunks JS del cliente; entorno, hash local y temporales ignorados                            |

Los tests de fichas y procesador usan adaptadores aislados; SQL/RLS ejecuta migraciones reales con auth mínimo. No simulan una entrega real. La confirmación del usuario sobre edición de ficha, historial y registro de aviso de una reserva de prueba sigue pendiente. La prueba real de Resend requiere autorización explícita al destinatario permitido y comprobar recepción; no se sustituye por un conteo o mock exitoso.

La base de concurrencia temporal fue eliminada y el servidor local detenido. Se conservaron archivos temporales ignorados; no se repitió el borrado bloqueado de Fase 3. No se hicieron commits, pushes, deploys ni cron/automatizaciones. Persisten las cinco alertas dev transitivas documentadas. Antes de hosting: dominio de remitente, Turnstile real, scheduler externo, retención/backups y revisión ampliada de múltiples cuentas. Los recordatorios están implementados en cola, sin ejecución programada desplegada.

**Entrega limitada a Fase 5. Cerrar validación manual/email antes de declararla validada en Supabase/Resend; no avanzar automáticamente a Fase 6.**

## 2026-10-21 · Fase 4 implementada y validada con el usuario

El usuario autorizó continuar tras Fase 3. Aplicó `20261021000400_public_booking.sql`, el SQL local de hash del intermediario y `20261021000500_public_link_reschedule_expiry.sql`, todos con Success. Confirmó que puede reservar sin cuenta y gestionar el turno por su enlace privado. No se comenzó Fase 5.

### Trabajo completado

- Página `/b/[slug]`, catálogo activo/asignado, selección de profesional o cualquiera disponible, fechas/horarios y reserva sin cuenta. Diseño separado del panel, responsive, marca/contacto público y política configurables por owner, publicación opt-in.
- Formulario con validación de servidor, política aceptada, honeypot y Turnstile con verificación de hostname/acción/visitante fuera de localhost. Confirmación en pantalla pending/confirmed; ambos estados ocupan horario. No se promete envío de email.
- Cliente anon de servidor independiente de Auth del panel, con credencial limitada a RPC públicas. Hash en esquema privado; clave real solo en entorno ignorado. La clave pública sola no invoca esas operaciones ni lee tablas.
- Cuotas persistentes por visitante, negocio, email y enlace. Fallos controlados de alta conservan contadores, pero no escrituras parciales. Contratos con lista de datos públicos y comprobante mínimo. Sin IP, emails del personal, reservas ajenas ni razones privadas de bloqueos.
- Reutilización del motor SQL, snapshots de condiciones, revisión de versiones de precio/política, idempotencia vinculada a visitante y bloqueo/GiST. Origen public/panel y actor guest/member en historial, sin usuario ficticio para invitados.
- Enlace con token de 256 bits guardado como hash. Fragmento eliminado y canjeado por cookie HttpOnly/Strict. Expiración, revocación owner, control de versiones y margen de cancelación/reprogramación. La migración 005 actualiza vigencia también al reprogramar desde el panel.
- Comando local de preparación del secreto/hash, fixture SQL aislada para navegador, escenarios públicos de concurrencia y CI preparada. README, arquitectura, BD, producto, hoja de ruta y guía pública actualizados.

### Verificación final

| Comprobación                 | Resultado                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| Formato, lint, tipos         | Correctos, sin advertencias de lint                                                                 |
| Vitest                       | 111 tests aprobados en 20 archivos                                                                  |
| Build y postbuild            | Correctos, standalone portable                                                                      |
| PostgreSQL nativo 18.4       | 5 escenarios privados/públicos aprobados con conexiones independientes                              |
| E2E sin configuración        | 15 aprobados en Chromium desktop/mobile y WebKit mobile                                             |
| E2E con Supabase configurado | 15 aprobados con el mismo build                                                                     |
| E2E público con SQL aislada  | 6 aprobados: reserva y gestión completa, acceso inválido y origen cruzado en tres navegadores       |
| Revisión visual              | Formulario móvil y gestión desktop revisados, sin desbordes                                         |
| Supabase real                | Sin secreto, RPC pública 401/42501; con secreto, contrato acotado; tabla de ajustes denegada a anon |
| Seguridad local              | Secreto ausente de los 24 chunks JS del cliente; `.env.local`, SQL local y temporales ignorados     |
| Auditoría de producción      | `npm audit --omit=dev`: 0 vulnerabilidades                                                          |
| Recorrido manual remoto      | Usuario confirmó reserva pública y gestión por enlace                                               |

Durante la prueba manual inicialmente no aparecieron horarios. Se consultó la API real para el servicio/profesional indicado del 22 al 28 de octubre: respuestas correctas y cero slots. El usuario detectó que faltaba configurar el horario de Negocio, lo corrigió y confirmó el recorrido completo. Se reforzó la indicación y enlace a Disponibilidad en los ajustes de página pública. No se relajaron las reglas de disponibilidad.

Los cinco escenarios nativos verifican las tres carreras privadas previas y dos públicas: altas simultáneas en un horario y reintento concurrente de la misma solicitud, sin duplicados. La base temporal se eliminó y el servidor PostgreSQL local se detuvo. Los archivos temporales siguen ignorados; no se repitió la limpieza bloqueada documentada en Fase 3.

### Límites

PGlite y el adaptador HTTP E2E prueban SQL real y UI sin reproducir GoTrue/PostgREST. La prueba manual del usuario y los smoke RPC sí usan Supabase real; no se guardan contraseñas ni tokens de sesión. Turnstile se verifica con respuestas de prueba; falta probar claves reales y dominio HTTPS antes de hosting. Deben configurarse ambas claves y el APP_URL real; fuera de localhost el alta falla cerrada si falta CAPTCHA. Sin deploy ni prueba en dispositivos físicos o CI remota.

Persisten las cinco alertas dev transitivas de lint documentadas en ADR 009. Antes del piloto falta la revisión ampliada de múltiples cuentas, retención, restauración y operación. Emails transaccionales, CRM, pagos y demás fases pendientes. No se hicieron commits, pushes ni deploys. **Detener en Fase 4; Fase 5 requiere nueva indicación.**

## 2026-10-21 · Fase 3 implementada y probada para revisión

El usuario autorizó continuar con Fase 3 si había margen. Aplicó `20261021000300_appointments.sql` con resultado Success y confirmó que pudo crear una reserva, verla en el calendario y modificarla. No se comenzó Fase 4.

### Trabajo completado

- Motor SQL privado reutilizado en consulta, alta y reprogramación: horarios negocio/profesional, descansos, bloqueos, vacaciones, duración, preparación, anticipación mínima/máxima y zona IANA. Slots cada 15 minutos, no cruzan medianoche ni cambios de offset DST; las horas repetidas se distinguen por UTC/offset.
- Reservas pending/confirmed, confirmación, cancelación, finalización y ausencia con transiciones explícitas y validación temporal. Reprogramación futura atómica, historial inmutable, RLS por organización/agenda y sin borrado de canceladas.
- Snapshots de precio/moneda/duración/preparación y nombres; cambios del catálogo no alteran condiciones históricas. Datos del cliente guardados en cada reserva; base independiente de clientes corresponde a Fase 5.
- Bloqueo de organización compartido con catálogo y restricción GiST/btree_gist para intervalos ocupados. Clave UUID y hash de solicitud para reintentos sin duplicados, más versión para detectar ediciones desactualizadas.
- Calendario privado diario y de 7 días, filtros por estado/profesional, alta, detalle e historial. Staff solo su agenda, owner todo el negocio. Lecturas paginadas de API para agenda/catálogo.
- Comando de concurrencia con pg solo de desarrollo y CI preparada para un servicio PostgreSQL 17. Sin dependencias nuevas de runtime. Documentación de catálogo/reservas y roadmap actualizados.

### Verificaciones

| Comprobación                   | Resultado final                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Formato, lint y typecheck      | Correctos, sin advertencias de lint                                                       |
| Vitest                         | 87 tests aprobados en 16 archivos                                                         |
| Build y postbuild              | Correctos; rutas privadas dinámicas y standalone                                          |
| Concurrencia PostgreSQL nativo | 3 escenarios aprobados con conexiones independientes                                      |
| E2E sin configuración          | 15 aprobados, Chromium desktop/mobile y WebKit mobile                                     |
| E2E con Supabase configurado   | 15 aprobados con el mismo build                                                           |
| Revisión visual                | Capturas públicas desktop/mobile revisadas, sin desbordes                                 |
| Supabase remoto                | Tablas y RPC privadas denegadas a anon; recorridos principales confirmados por el usuario |
| Auditoría de producción        | npm audit --omit=dev: 0 vulnerabilidades                                                  |
| Dependencias y Git             | npm ls correcto; secretos y carpeta temporal excluidos                                    |

Los tests de pantallas usan adaptadores aislados y datos sintéticos solo dentro de tests; no sustituyen un login real. Se corrigió una expectativa de prueba que asumía que Intl admitía una unidad monetaria fuera de su lista; no se amplió la política de monedas de la aplicación. La suite final completa pasó.

Concurrencia ejecutada en PostgreSQL **nativo 18.4**, con conexiones independientes y bloqueo observado en pg_stat_activity antes del commit:

1. Dos altas RPC sobre el mismo horario: una reserva, un historial y conflicto SQLSTATE 23P01.
2. Dos INSERT privilegiados que omiten la RPC: GiST rechaza la superposición.
3. Dos envíos de la misma clave: mismo ID y una única reserva.

Los tres escenarios pasaron. La base temporal fue eliminada por el script y el servidor local fue detenido. El intento de borrar recursivamente los binarios/datos temporales recibió rechazo automático «blocked by policy»; `.local-postgres/` permanece ignorada por Git, Prettier y ESLint. No se intentó eludir ese bloqueo.

En Supabase, las tres tablas nuevas y la RPC de calendario devolvieron HTTP 401 / SQLSTATE 42501 sin datos ante consultas anónimas. El usuario confirmó el recorrido principal contra su cuenta real. No se guardaron contraseñas ni tokens de sesión para automatizar el login.

### Límites y revisión restante

PGlite valida SQL/RLS con auth mínimo; PostgreSQL nativo valida MVCC y exclusión. Los E2E de navegador verifican páginas públicas, auth sin sesión, protección de rutas, formularios, cabeceras y responsive; no son un flujo autenticado de CRUD. Confirmación manual del usuario sí cubre los recorridos principales. Falta antes del piloto validar invitaciones y aislamiento con varias cuentas reales, renovación en Supabase, dispositivos físicos, CI remota y revisión operativa/comercial. Sin página pública, pagos, emails transaccionales ni base de clientes de Fase 5.

No se hicieron commits, pushes ni deploys. Cinco alertas dev transitivas de lint documentadas en ADR 009; auditoría de producción limpia al cierre. **Detener en Fase 3 para revisión; Fase 4 requiere nueva indicación.**

## 2026-10-21 · Fase 2 completada para revisión

Migración `20261021000200_catalog_and_availability.sql` aplicada por el usuario con Success. Confirmó creación de profesional, servicio/asignación y horario desde el panel contra Supabase.

- CRUD mediante alta, lectura, edición y desactivación de servicios/profesionales; sin borrar IDs históricos. Precio exacto en unidades menores, duración/preparación, categoría, URL HTTPS opcional y relaciones del mismo tenant.
- Profesionales sin cuenta o vinculados a miembros existentes. Invitación manual con enlace de un uso, hash no legible desde API, correo confirmado coincidente, 48 h y revocación. Suspensión de acceso independiente del recurso; owner protegido.
- Trabajo semanal de negocio/profesional, varios tramos, descansos, fechas bloqueadas, vacaciones y feriados completos/parciales. Horas locales, fechas inclusivas y validación de superposiciones.
- RLS de seis tablas nuevas, FKs compuestas, autorización repetida en servidor/RPC y auditoría transaccional. Owner escribe; staff solo catálogo y configuración propia/global.
- Formularios RHF/Zod, navegación real desktop/mobile, búsquedas y estados vacíos. No se envían emails ni se suben archivos.

Al terminar Fase 2 pasaron formato/lint/tipos/build, **64 tests en 11 archivos** y **15 E2E** en Chromium desktop/mobile y WebKit mobile. API remota: seis tablas denegadas a anon con HTTP 401/42501. Las pruebas SQL cubren asignaciones cruzadas, cambios/desactivación, restricciones, horas/bloqueos, aceptación/reuso, correo incorrecto, vencimiento, revocación y suspensión de acceso. Aceptación con segunda cuenta real pendiente antes del piloto. Detalles en catalog.md.

## 2026-10-21 · Fase 1 implementada y probada para revisión

### Resultado y alcance

El usuario autorizó únicamente Fase 1, proporcionó GitHub y Supabase, aplicó la migración y confirmó que pudo ingresar con su correo y crear una organización de prueba. No se comenzó Fase 2.

### Trabajo completado

- Registro, confirmación PKCE/TokenHash, ingreso y cierre de sesión con Supabase Auth. Clientes SSR por petición, sin cliente de navegador ni service_role.
- Cookies HttpOnly/SameSite=Lax/Secure con HTTPS. Proxy renueva cookies, las conserva al redirigir y evita streaming privado sin sesión. Auth/panel usan no-store.
- Guardas de identidad mediante getUser y cuenta confirmada/no anónima; membresía y rol de BD por organización en páginas, consultas y acciones. No se autoriza por metadata ni visibilidad de UI.
- Panel de organizaciones, creación y edición básica para owner, lectura para staff. Formularios React Hook Form y validación Zod en servidor.
- Migración versionada con organizations, organization_members, organization_settings y audit_logs: RLS, grants de columnas mínimos y helper privado para evitar recursión. No se pueden alterar roles, tenant, slug, autor, estado ni auditoría desde navegador.
- RPC atómica: organización, owner, settings y auditoría. Slug único y máximo de 3 creaciones por usuario en 24 horas, con bloqueo transaccional. Ediciones auditadas sin guardar valores privados.
- PGlite 0.5.11 agregado solo como dependencia de desarrollo para ejecutar PostgreSQL WASM. Inicio, roadmap y documentación actualizados. Capturas de Auth revisadas en desktop/mobile.
- Git local inicializado con origin en Fede-Martorell/Microservice-Turnos. Sin commits/pushes. Variables trasladadas desde .env.example a .env.local y archivo local de credenciales excluido de Git.

### Conexión y migración

El usuario aplicó `20261021000100_organizations_and_access.sql` mediante SQL Editor y reportó éxito. La API posteriormente devolvió HTTP 401 / SQLSTATE 42501 para consultas anónimas a las cuatro tablas y la RPC; sin filas privadas ni creación de datos. Auth settings respondió HTTP 200 con email habilitado y confirmación requerida.

La migración inicial ya fue aplicada y no es idempotente: no repetirla. Cambios siguientes deben ir en nuevas migraciones. La aplicación no ejecuta SQL administrativo al iniciar.

### Verificaciones ejecutadas

| Comprobación                 | Resultado                                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| Formato, lint y typecheck    | Correctos; sin advertencias de lint                              |
| Vitest                       | 7 archivos, 40 tests aprobados                                   |
| Build y postbuild            | Correctos; rutas privadas dinámicas y paquete standalone         |
| E2E sin configuración        | 12 aprobados, Chromium desktop/mobile y WebKit mobile            |
| E2E con Supabase configurado | 12 aprobados; sin crear cuentas ni enviar emails automáticamente |
| Revisión visual de Auth      | Capturas desktop/mobile sin desbordes                            |
| Supabase remoto              | Auth disponible; API/RPC anónimas denegadas                      |
| Prueba manual del usuario    | Ingreso con correo y creación de organización confirmados        |
| npm audit --omit=dev         | 0 vulnerabilidades                                               |
| npm ls --depth=0             | Dependencias resueltas                                           |
| Exclusión Git                | .env.local y supabase-contra.txt ignorados                       |

Los tests incluyen 12 de SQL/RLS: dos tenants, owner/staff, usuario ajeno, anónimo, cuenta sin confirmar, membresía revocada, negocio suspendido, escrituras cruzadas, elevación de rol, columnas protegidas, slugs, auditoría, atomicidad y límite. También guardas de sesión/acciones, cookies/caché del proxy, validadores y navegación móvil.

Se corrigieron problemas iniciales de lint, redirección diferida por streaming y fijación de variables NEXT_PUBLIC durante build. La lectura dinámica permite ejecutar el mismo paquete con distinta configuración; ambos modos E2E lo verifican. La advertencia NO_COLOR/FORCE_COLOR corresponde al ejecutor, sin fallo de aplicación.

### Límites y próximos pasos

PGlite usa un harness mínimo de auth.users/auth.uid; no sustituye validar gateway, PostgREST y renovación con varios usuarios reales. El usuario confirmó ingreso/creación contra Supabase; edición y logout no fueron reportados como prueba manual. Configuración de URLs/plantillas y revisión de CAPTCHA/SMTP previa al piloto en authentication.md.

Gestión/invitación de miembros se diseñará con profesionales en Fase 2. No hay reservas, fidelización, planes ni pagos. Persisten las cinco alertas transitivas de lint y compatibilidad ESLint 9 documentadas en ADR 009. Sin deploy ni CI remota ejecutada, commits o pushes.

**Detener para revisión.** Próxima fase, solo tras nueva indicación: servicios, profesionales, horarios, descansos y bloqueos.

## 2026-10-21 · Fase 0 completada para revisión

### Inspección

La carpeta de trabajo estaba vacía, sin repositorio Git ni instrucciones AGENTS.md en los ancestros inspeccionados. Entorno Windows con Node 22.14.0, npm 11.14.1 y Git disponible. No se sobrescribió código existente.

Al iniciar el servidor de desarrollo, Next.js generó automáticamente `AGENTS.md` con instrucciones para futuras ediciones; se leyó y conserva ese archivo. El servidor local quedó disponible en `http://localhost:3000` mediante `npm run dev`.

### Trabajo completado

- Next.js 16.4.2 App Router, React 19.3.1, TypeScript 6.0.3 estricto y Tailwind 4.3.3.
- shadcn/ui generado por CLI (button/card/skeleton), Lucide, Zod y React Hook Form. Solo Radix Slot requerido por botón; helper local reutilizable.
- SDKs Supabase y Resend instalados, sin instanciar clientes ni conectar cuentas.
- Estructura modular en `src/app`, `components`, `features`, `lib`, `hooks`, `types` y `styles`. Carpetas de migraciones y pruebas de BD reservadas sin SQL prematuro.
- Inicio en español, estado vacío real, navegación desktop/mobile, hoja de ruta, carga, error y 404. Sin datos comerciales ficticios ni botones que aparenten operaciones no implementadas.
- Tokens visuales provisionales, semántica accesible, salto al contenido, foco visible y menú táctil. Sidebar con scroll en pantallas bajas.
- Manifest, iconos PNG y maskable, Apple icon y standalone. Sin service worker, cachés offline ni datos personales.
- ESLint, Prettier, Vitest, React Testing Library y Playwright. Workflow de CI preparado, no ejecutado remotamente.
- Build standalone portable; postbuild empaqueta recursos públicos/estáticos. Ejecución verificada contra servidor de producción generado.
- README, arquitectura, BD propuesta, producto, roadmap, decisiones, deploy y `.env.example`.

### Funciones operativas

`/` y `/proyecto`, navegación, menú compacto, 404, metadatos y recursos PWA. No hay autenticación, RLS, organizaciones persistidas, servicios, agenda, reservas, notificaciones, suscripciones ni fidelización. No se declara completo el MVP.

### Verificaciones ejecutadas

| Comprobación                  | Resultado                                                |
| ----------------------------- | -------------------------------------------------------- |
| `npm run format:check`        | Correcto                                                 |
| `npm run lint`                | Correcto, sin advertencias de lint                       |
| `npm run typecheck`           | Correcto, incluidos tipos de rutas                       |
| `npm test`                    | 2 archivos, 5 tests aprobados                            |
| `npm run build` y `postbuild` | Correcto; páginas y recursos generados                   |
| `npm run test:e2e`            | 6 tests aprobados contra standalone                      |
| `npm ls --depth=0`            | Dependencias resueltas sin peers inválidos               |
| `npm audit --omit=dev`        | 0 vulnerabilidades reportadas                            |
| `npm audit`                   | 5 alertas altas en cadena transitiva de lint; pendientes |

Unitarios: configuración sin servicios externos, credenciales públicas incompletas, protocolos no HTTP, exclusión de secretos y menú compacto. E2E: desktop Chromium, móvil Chromium y móvil WebKit, navegación entre páginas, textos de alcance, ausencia de desbordes horizontales y errores JS, manifest/iconos, cabeceras y 404. Capturas generadas en `test-results/` y revisadas visualmente en desktop y mobile. Son pruebas con emulación, no certificación en dispositivos físicos.

Se corrigieron advertencias iniciales de lint, carga CommonJS de Vitest y arranque `next start` incompatible con standalone. Las últimas ejecuciones de tests/build fueron exitosas. El ejecutor imprime una advertencia de variables de color de su entorno (`NO_COLOR`/`FORCE_COLOR`), sin fallas de aplicación.

No se ejecutaron tests contra PostgreSQL/Supabase, RLS o email: no hay conexión ni implementación de esos módulos. La CI de GitHub, instalación PWA en dispositivos reales y despliegues Vercel/Railway no se han ejecutado.

### Problemas y decisiones pendientes

1. Cinco alertas dev derivadas de `braces` sin parche publicado, vía herramientas oficiales de lint. Auditoría de producción limpia. Ver ADR 009 y advisory enlazado en `decisions.md`.
2. ESLint 9.39.5 permanece por peer de eslint-plugin-react; npm lo marca deprecado. No forzar ESLint 10 hasta compatibilidad del conjunto oficial.
3. Se omitió `@hookform/resolvers@6` por conflicto de peers opcionales; reevaluar al implementar formularios. RHF y Zod están instalados. Recharts se difiere hasta necesitar gráficos.
4. No hay credenciales externas. La fase actual no las requiere; completar las variables documentadas cuando se autorice cada integración.
5. Identidad visual provisional, pendiente de referencias. Las pruebas multi-tenant y requisitos críticos de seguridad siguen como criterios de las fases siguientes.

### Próximo paso

**Detener aquí para revisión.** No se comenzó Fase 1. Próxima fase: registro/login, sesiones, organizaciones, roles y RLS, con autorización y credenciales de Supabase, más pruebas reales de aislamiento entre organizaciones.

No se hicieron commits, pushes, pagos, envíos de email ni despliegues. La conexión futura de GitHub/Vercel y preparación de Railway están documentadas en `deployment.md`.
