# Servicios, profesionales y horarios

Fase 2. Dentro de una organización: Servicios, Equipo y Disponibilidad. El propietario crea, consulta, edita y desactiva servicios/profesionales. Desactivar conserva el ID y las relaciones; no existe borrado físico desde la API. Las modificaciones pasan por validación del servidor y una RPC transaccional con autorización adicional en PostgreSQL.

Los servicios incluyen descripción, categoría opcional, duración (5–480 min), preparación **después** del servicio (0–120 min), precio en unidades menores enteras, moneda, URL HTTPS opcional y profesionales habilitados. Se respetan los decimales de cada moneda; no se interpretan separadores de miles. No se registran pagos. Las imágenes se guardan por URL: no hay subida de archivos ni descarga de recursos en el servidor.

Un profesional es un recurso de reserva y puede existir sin usuario. Cuenta de acceso, membresía activa y recurso activo son estados diferentes. Puede vincularse a una cuenta existente del negocio o invitarse a una nueva persona. Suspender el acceso no elimina el recurso; desactivar el recurso tampoco revoca automáticamente la membresía. La UI administra ambos por separado.

## Invitaciones

1. Guardar un profesional activo sin cuenta.
2. Generar una invitación para un correo desde su detalle.
3. Copiar el enlace mostrado una sola vez y compartirlo por el canal elegido. La app no envía email.
4. La persona crea/confirma su cuenta con ese correo, ingresa y vuelve a abrir el enlace para aceptarlo.

El enlace vence en 48 horas. Se guarda únicamente SHA-256 del token; el hash no tiene permiso de lectura para la API. El token combina dos UUID aleatorios. Inspeccionar/aceptar exige usuario confirmado, correo coincidente, organización y recurso activos, invitación vigente/no consumida/no revocada. Una cuenta solo puede vincularse a un perfil por negocio. La aceptación conserva un rol owner existente, nunca lo reemplaza por staff. Crear otra invitación revoca la anterior; máximo 20 por negocio/hora con bloqueo transaccional. La página usa no-store, no-referrer y no se indexa. No se registran tokens/correos en logs de errores.

## Disponibilidad

Seleccionar Negocio o un profesional. Ambos necesitan horarios de trabajo para ofrecer turnos. Se admiten varios tramos por día y se fusionan los contiguos al calcular disponibilidad. Los descansos pueden estar dentro o fuera del trabajo; solo se descuentan las partes coincidentes. No se admiten superposiciones del mismo tipo en el mismo ámbito/día.

Horario semanal en hora local de la zona IANA del negocio, domingo=0, fin hasta 24:00. Para cruzar medianoche, crear un tramo por día. Bloqueos, vacaciones y días no laborables usan fechas inclusivas, hasta 367 días por rango. Sin horas bloquean días completos; con ambas horas, ese tramo se repite cada día del rango.

Owner administra todo. Staff ve el catálogo, su propio perfil activo y sus horarios más los del negocio; no administra el catálogo ni las invitaciones. Las políticas y claves compuestas evitan referencias entre organizaciones. Todas las escrituras del catálogo y reservas bloquean primero la fila del negocio, con orden consistente. Las lecturas recorren páginas de PostgREST sin truncarse a la primera respuesta.

## Validación

El usuario aplicó la migración 002 y confirmó creación de profesional, servicio/asignación y horario. Tests de PostgreSQL embebido cubren RLS, relaciones, validaciones, bloqueos e invitaciones (correo equivocado, vencimiento, revocación, aceptación y suspensión). No se probó manualmente la aceptación con una segunda cuenta real; realizar ese recorrido antes del piloto. Ver resultados en progress.md.
