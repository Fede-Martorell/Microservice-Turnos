# Fase 7 · Fidelización

Un programa por negocio, configurable como visitas o puntos por servicio. El propietario define reglas, recompensas y condiciones. No se impone un beneficio ni se interpretan unidades como dinero. La modalidad queda fija al existir movimientos para conservar el significado del historial; las reglas futuras y recompensas siguen siendo editables con versión.

## Habilitación y configuración

1. Aplicar solo `supabase/migrations/20261022001000_loyalty.sql` después de 009. No repetir migraciones aplicadas.
2. Desde `/admin` → negocio → Excepciones de módulos, habilitar Fidelización durante el piloto, o incluirlo expresamente en un plan. No se agrega automáticamente a Starter, Professional ni Business.
3. Como propietario abrir Negocio → Fidelización → Configurar programa. El asistente explica modalidades, acreditación, vigencia, cancelaciones, canjes, costo comercial y pausa. Ofrece ejemplos editables de servicios/puntos.
4. Elegir servicios, fechas en zona del negocio, condiciones y vencimiento opcional por crédito. Marcar Activar para empezar. Visitas otorga una unidad por reserva completada; puntos permite valores distintos por servicio, y cero significa que no participa. Los servicios desactivados se excluyen de reglas nuevas conservando créditos anteriores.
5. Crear recompensas: nombre, beneficio descriptivo, costo en visitas/puntos, vigencia, condiciones y límites. El costo define el objetivo de visitas. Puede ofrecerse servicio, descuento u otro beneficio; registrar un canje no altera cobros ni reservas.

Fidelización es un complemento disponible; analítica avanzada, pagos/señas y marketing siguen futuros. La referencia inicial de USD 9/mes vive en BD y se edita desde Administración → Planes y pruebas. Cambiar referencias comerciales no habilita módulos ni genera cargos. No hay suma automática de complementos, facturación ni proveedor de cobros.

## Acreditación e historial

Al cambiar una reserva confirmada a completada, PostgreSQL verifica módulo/suscripción, programa, cliente activo, servicio y fechas. Tanto el instante de completar como el fin del servicio deben estar cubiertos por la regla actual. Se guarda cantidad, versión y vencimiento. Una restricción única por reserva evita duplicados incluso ante solicitudes simultáneas.

Pendiente, cancelada y ausente no acreditan. Completar exige que el servicio haya terminado. Guardar reglas o activar no recorre reservas ya completadas para dar créditos retroactivos. Un turno antiguo marcado completado ahora puede participar si su fin está cubierto por las fechas y el programa sigue vigente al completar.

Cada edición crea reglas inmutables. Pausar/reactivar copia una versión para detectar formularios desactualizados; no modifica lo ya ganado. Los estados finales de reservas se conservan. Los errores de unidades se corrigen mediante ajustes compensatorios con motivo, sin borrar movimientos.

## Saldo, canjes y vencimiento

Saldo derivado de lotes positivos vigentes menos consumos inmutables. Los lotes vencidos dejan de estar disponibles por comparación temporal, sin cron ni borrados. Cada fecha original queda registrada; las pantallas muestran próximo vencimiento y unidades vencidas sin usar.

Canjear bloquea la organización y valida saldo, vigencia, versión y límites. Consume primero los créditos que vencen antes, después los que no vencen. El canje conserva nombre, beneficio, costo, condiciones, modalidad y cantidad consumida. No puede generar saldo negativo.

En visitas, el propietario elige restar el costo y conservar el excedente, o reiniciar a cero consumiendo también las visitas que superan el objetivo. En puntos siempre se resta el costo. Los límites son acumulados por cliente y globalmente entre los clientes; excluyen canjes anulados y no se reinician al editar la recompensa.

Cada ajuste/canje/anulación usa UUID de solicitud y hash del contenido. La misma solicitud devuelve su resultado sin duplicar; reutilizarla con otros datos falla. Ante un error de red, revisar el historial antes de iniciar una solicitud nueva.

### Correcciones

Solo el propietario ajusta saldo positivo/negativo con motivo y referencia opcional a un movimiento del mismo cliente. El ajuste positivo toma el vencimiento actual; el negativo consume créditos vigentes y falla sin saldo suficiente. No se modifica el ledger anterior.

Anular un canje agrega créditos con los vencimientos originales de los lotes consumidos: los ya vencidos no recuperan disponibilidad. El canje se conserva y su anulación se registra aparte, una sola vez. Libera el límite de uso de la recompensa. Ajustes y anulaciones pueden corregir un programa pausado si el módulo está vigente.

Pausar/vencer no borra ni detiene el transcurso de vencimientos. Pausado no acredita ni permite canjes nuevos. El propietario conserva lectura y puede pausar/revocar tarjetas aunque su suscripción no habilite otras escrituras. Staff genera crédito al completar su agenda, pero no configura, ajusta, canjea ni lee saldos. Ser superadmin permite habilitar el módulo/editar referencias, sin acceso indiscriminado a cuentas o movimientos.

## Tarjeta privada

Desde Clientes → ficha → Ver tarjeta e historial, el propietario consulta saldo, reglas aplicadas y movimientos, registra operaciones y emite un enlace. Fidelización permite buscar tarjetas por nombre/email, con páginas de 50. Historial de 50 movimientos por página y últimos 20 canjes; los anteriores siguen en movimientos.

`/tarjeta#token=...` contiene 256 bits aleatorios, hash en BD, vigencia de 90 días y rotación/revocación. Emitir otro invalida el anterior. Solo se muestra en la respuesta para compartir manualmente con el cliente. No se envían emails. Un cliente inactivo u organización suspendida no expone su tarjeta.

El navegador elimina el fragmento y lo intercambia mediante POST del mismo origen por cookie HttpOnly/Secure/Strict, limitada a `/tarjeta`. No-referrer, no-store y noindex; sin token en query ni IDs predecibles. HTTP solo en localhost; hosting requiere HTTPS. Reutiliza la credencial de servidor PUBLIC_BOOKING_GATEWAY_SECRET para RPC acotada, sin enviarla al cliente ni usar la sesión del panel. Cuotas persistentes de consultas anónimas.

El contrato público contiene negocio/programa, saldo/progreso, recompensas/condiciones y últimos 20 movimientos básicos. Excluye contactos, IDs de cliente/cuenta/reserva, actores y motivos internos. La tarjeta solo consulta; el propietario registra canjes. Conserva lectura histórica al perder acceso, con aviso de operaciones inactivas. Salir borra su cookie sin cerrar la sesión del panel.

## Límites y verificación

Hasta 200 servicios por versión, 100 recompensas, 1–10000 puntos por servicio, 1–1000000 unidades de costo/ajuste, saldo disponible máximo 1000000000. Vigencia hasta 3651 días inclusive, vencimiento por crédito opcional hasta 3650 días. Cada consumo admite 1000 lotes para acotar trabajo; más fragmentación falla sin escritura parcial y requiere revisión del propietario.

SQL/RLS prueba reglas, versiones, estados, saldo, consumo por vencimiento, referencias por tenant, inmutabilidad, ajustes, límites, devoluciones y tarjeta/gateway. PostgreSQL nativo prueba dobles canjes, reintentos, último cupo y doble completado. E2E con SQL aislada prueba tarjeta y reservas públicas en desktop/móvil, sin emails ni cambios en Supabase. No reproduce GoTrue; la prueba remota del propietario se registra aparte en progress.md.

Se observó una limitación local de WebKit Windows: con un servidor mínimo ajeno a la app recibe SameSite=Strict pero reporta None y envía la cookie en navegación entre sitios sobre HTTP loopback; Chromium lo bloquea. La app conserva Strict y las pruebas comprueban el encabezado real en los tres proyectos. Se anota la limitación del motor, sin afirmar que este entorno valide SameSite de Safari real. Antes de hosting falta probar HTTPS/Safari en macOS o iOS; [Playwright documenta diferencias por plataforma](https://github.com/microsoft/playwright/blob/main/docs/src/browsers.md#webkit).

Prueba manual sugerida: configurar/activar, crear recompensa, completar un turno de prueba ya finalizado, verificar crédito, canjear/anular, emitir tarjeta y abrirla en incógnito, revocar y comprobar bloqueo. Sin turno terminado, un ajuste con motivo «Prueba etapa 7» permite probar canje/tarjeta, sin sustituir la prueba de acreditación automática.

Fase 8 no incluida. Sin cobros, emails, scheduler, commit, push ni deploy. Retención y operación comercial requieren la revisión previa al piloto comercial.
