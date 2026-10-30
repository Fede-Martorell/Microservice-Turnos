# Reservas y calendario

Calendario privado incorporado en Fase 3 con vista diaria y de 7 días, filtros por estado/profesional, alta de reserva, detalle, confirmación, cancelación, reprogramación, finalización y ausencia. Staff accede solo a su agenda; owner a todo el negocio. Fase 5 vincula cada reserva a una ficha de cliente; conserva nombre, email y teléfono opcional como snapshots históricos. Los enlaces públicos se incorporaron en [Fase 4](public-booking.md); emails transaccionales y recordatorios ya están en Fase 5, con habilitación explícita; pagos siguen pendientes.

## Crear un turno

1. En Disponibilidad configurar trabajo para el negocio **y** el profesional. Asignar el servicio al profesional y mantener ambos activos.
2. En Calendario → Nueva reserva elegir servicio, profesional y fecha; consultar horarios.
3. Elegir un instante disponible y cargar los datos del cliente. Pending y confirmed ocupan el horario.
4. Guardar. El detalle muestra las condiciones realmente persistidas y el historial.

La anticipación predeterminada es 60 minutos a 90 días. Owner la modifica en Disponibilidad: mínimo 0–43200 minutos y máximo 1–365 períodos de 24 horas, con una ventana coherente. Los cambios de horarios, zona, catálogo y anticipación afectan nuevas reservas/reprogramaciones; no mueven automáticamente las existentes. Cancelar conserva la reserva y libera su intervalo.

## Una regla en la base de datos

`private.slot_available` se reutiliza para listar, crear y reprogramar. Combina la unión de tramos de trabajo de cada ámbito, la intersección negocio/profesional, descansos, bloqueos y vacaciones de ambos, duración, preparación posterior, reservas existentes y anticipación. Sin trabajo configurado en uno de los ámbitos no hay turnos. Los slots empiezan cada 15 minutos y el intervalo ocupado completo debe entrar en el día y en los horarios.

Instantes en `timestamptz`, reglas locales con zona IANA. PostgreSQL convierte las fechas del negocio a UTC; el navegador nunca decide qué instante representa una hora local. Se muestran offsets para distinguir la hora repetida en otoño. No se ofrecen tramos que atraviesen un cambio de offset DST; tampoco se inventan horas inexistentes. La cuadrícula recorre instantes UTC del día local, que puede tener duración diferente de 24 horas. Las reservas no cruzan medianoche; configurar días separados cuando corresponda.

Cada reserva guarda snapshots de servicio/profesional, precio, moneda, duración, preparación y zona, más inicio, fin del servicio y fin ocupado. Cambiar el catálogo no reescribe esos valores. Reprogramar conserva las condiciones y el profesional/servicio; vuelve a comprobar disponibilidad usando duración histórica y configuración actual. La nueva zona usada se registra en la reserva. Las fechas anterior/nueva quedan en historial.

## Estados y edición concurrente

| Desde                        | Hacia               | Condición adicional           |
| ---------------------------- | ------------------- | ----------------------------- |
| pending                      | confirmed, canceled | Acceso autorizado a la agenda |
| confirmed                    | completed           | Después del fin del servicio  |
| confirmed                    | no_show             | Después del inicio            |
| confirmed                    | canceled            | Acceso autorizado a la agenda |
| completed, canceled, no_show | Ninguno             | Estados finales               |

Solo pending/confirmed futuros admiten reprogramación. Los turnos completados y ausentes conservan su ocupación histórica. Cada modificación exige la versión leída; una pantalla desactualizada recibe un conflicto y debe recargarse. No hay UPDATE/DELETE directo de reservas/historial para la API. Cambios y auditoría se guardan en la misma transacción.

Crear usa una clave UUID de solicitud y hash del contenido. Repetir la misma solicitud devuelve el mismo ID sin duplicar reservas ni historial; reutilizar la clave con contenido o actor diferente falla. Si se pierde la respuesta, revisar el calendario antes de iniciar otra solicitud. No se reintenta silenciosamente una escritura de resultado incierto.

Las escrituras bloquean la organización antes de verificar y guardar. Además, una restricción de exclusión GiST con btree_gist impide intervalos `[inicio, fin ocupado)` superpuestos para el mismo negocio/profesional, excepto canceled. Protege también escrituras privilegiadas que omitan la RPC. Referencia: [rangos y exclusión en PostgreSQL](https://www.postgresql.org/docs/current/rangetypes.html), [fechas y zonas](https://www.postgresql.org/docs/current/functions-datetime.html).

## Pruebas reproducibles de concurrencia

PGlite verifica reglas, snapshots, transiciones, aislamiento y restricciones, pero ejecuta una conexión. La simultaneidad se prueba por separado con PostgreSQL nativo y `pg` solo de desarrollo:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://usuario:clave@127.0.0.1:5432/postgres'
npm run test:concurrency
Remove-Item Env:TEST_DATABASE_URL
```

Usar exclusivamente un clúster local descartable de pruebas con permiso de crear bases/roles y extensiones. El script rechaza hosts externos, crea una base con nombre aleatorio, aplica las migraciones y carga datos sintéticos. Cierra conexiones y elimina **solo esa base nueva** al finalizar. No crea usuarios ni envía emails en Supabase. En un clúster nuevo puede crear los roles anon/authenticated; usar uno dedicado. No ejecutarlo contra una instancia productiva accesible mediante túnel local.

Verifica bloqueo observable de la segunda conexión en `pg_stat_activity` antes de confirmar la primera transacción, para tres escenarios: dos altas RPC para el mismo slot; dos INSERT privilegiados sin RPC para aislar GiST; y dos envíos de la misma clave de solicitud. Resultados esperados: un conflicto SQLSTATE 23P01 para los dos primeros y un único ID en el tercero.

Desde Fase 4 añade dos escenarios con RPC anon y credencial acotada: dos reservas públicas simultáneas del mismo horario producen un turno y un conflicto controlado; reintentar la misma solicitud pública conserva un turno y un historial. Fase 5 añade dos workers compitiendo por el mismo lease: total seis escenarios.

Ejecutado localmente en PostgreSQL 18.4 temporal, con binarios de [embedded-postgres](https://github.com/leinelissen/embedded-postgres), sin agregarlos a las dependencias/versionado ni al runtime. Servidor temporal detenido; su carpeta ignorada .local-postgres permanece porque la política del entorno bloqueó el borrado recursivo. La CI está preparada para PostgreSQL 17; aún no se ejecutó remotamente. Las versiones y el gateway de Supabase deben verificarse también con el proyecto de pruebas antes del piloto. No se declara certificación de producción.
