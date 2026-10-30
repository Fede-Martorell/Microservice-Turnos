# Fase 8 · Resumen y estadísticas básicas

El inicio de cada organización, `/panel/[organizationId]`, muestra el resumen al propietario. El personal se dirige a su calendario autorizado. La información básica del negocio se edita ahora en `/panel/[organizationId]/configuracion`; conserva sus permisos y validaciones anteriores.

## Datos y definiciones

- Hoy: total de turnos y desglose de pendientes, confirmados, completados, cancelados y ausentes. Usa la fecha local del negocio.
- Estadísticas: rango de fechas inclusive, últimos 30 días por defecto, accesos de 7/30/90 días y rango personalizado de hasta 93 días. El filtro afecta solo las estadísticas.
- Reservas: todas las reservas cuyo inicio cae en el rango, incluido cada estado final. Completadas/canceladas son subconjuntos del total; las barras no se suman entre sí.
- Clientes atendidos: clientes únicos con al menos una reserva completada dentro del período. Recurrentes: al menos dos completadas dentro de ese mismo período; no es recurrencia histórica ni incluye pendientes/canceladas/ausencias.
- Servicios más solicitados: cinco primeros por cantidad de reservas de todos los estados; se informa también cuántas están completadas. Agrupa por ID, muestra nombre actual del catálogo y conserva servicios inactivos. Desempate estable por ID.
- Próximas reservas: cinco próximas pendientes o confirmadas desde ahora, hasta el final del sexto día posterior a hoy. Son siete días de agenda local, no una ventana de 168 horas. Orden por inicio/ID. No incluye servicios ya iniciados ni estados finales.
- Actividad reciente: diez últimos eventos de creación, reprogramación y cambio de estado de reservas del negocio, ordenados por instante/ID. Incluye cambios desde enlaces públicos; no es auditoría general de todos los módulos.

No hay métricas de ventas, facturación, ingresos, ocupación ni atribución a fidelización. No se deducen pagos del precio de los servicios. El complemento de analítica avanzada sigue futuro/no disponible; estas estadísticas básicas no requieren contratarlo y no lo habilitan.

Los filtros usan la fecha de inicio del turno y su estado actual, no la fecha en que se creó o canceló. Una reprogramación puede mover el turno de período. Un cambio posterior a completada modifica el conteo del día del turno. No hay snapshots diarios ni comparaciones automáticas contra períodos anteriores.

## Consulta y permisos

La migración `20261023001100_business_dashboard.sql` agrega solo una RPC de lectura y un índice de actividad reciente. No cambia reservas ni suscripciones. Ya aplicada por el usuario con Success: no repetir.

`get_business_dashboard(uuid,date,date)` exige propietario confirmado y membresía activa, también en llamadas directas a la API. Rechaza personal, anónimo, otros tenants, superadmin sin membresía y organizaciones suspendidas. Conserva consulta histórica del propietario al vencer la suscripción. `security definer` con search_path vacío y predicados de organización explícitos; grant solo a authenticated, sin service_role.

El agregado ocurre en PostgreSQL, sin traer páginas de turnos a JavaScript ni truncar a mil filas. Una función STABLE devuelve las secciones bajo un mismo snapshot de consulta y el instante de actualización. Fechas locales se convierten a límites UTC `[inicio, día siguiente al final)`; contempla días de 23/25 horas. Serie diaria completa con ceros, top cinco y listas acotadas. Rango validado en servidor y SQL, años 2000–2100. Índice existente por organización/inicio para el período y nuevo por organización/instante/ID para actividad.

Las pantallas no se cachean entre usuarios. No hay endpoint público de estadísticas ni datos de demostración en la app. El servidor valida el contrato Zod: errores de consulta/contrato generan un error de carga, nunca ceros que aparenten ausencia de reservas. Los nombres de clientes de las listas están limitados al propietario; no se retornan email, teléfono ni motivos privados.

## Interfaz y pruebas

Tarjetas responsive, estados vacíos reales, fechas inválidas con aviso y retorno al rango predeterminado, carga por skeleton y error/reintento existente. Gráfico Recharts 3.10.1 con dimensiones responsive, sin animación, leyenda, teclado y tabla diaria alternativa. Servicios representados también mediante medidores nativos. El formulario usa GET, por lo que el rango puede guardarse como enlace privado sin datos de clientes en la URL.

SQL cubre ceros, cada estado, clientes recurrentes, límites locales, DST, más de mil registros, servicios inactivos, vencimiento, acceso revocado y aislamiento. Pruebas de servidor verifican permiso antes de consultar y contrato inválido; unitarios verifican fechas reales, rangos y cambio de año/zona. Playwright ejercita el dashboard SSR con el adaptador HTTP de pruebas y SQL real en PGlite: identidad sintética acotada al adaptador de localhost, sin modificar código de autenticación de la app ni sustituir una prueba real de GoTrue. Comprueba filtros, gráfico, tabla, configuración, estado vacío y ausencia de desbordes/errores JS en desktop y móvil. Validación manual de la sesión real se registra aparte en progress.md.

Referencias de la biblioteca: [tamaño y responsive](https://recharts.github.io/en-US/guide/sizes/), [accesibilidad](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility). react-is fijado a la misma versión de React.

En Fase 9 el gráfico se descarga cuando se acerca al viewport; conserva altura, teclado y tabla SSR. Medición local y límites en performance.md. Pagos, emails, scheduler, commit, push y deploy siguen sin activarse en esta entrega.
