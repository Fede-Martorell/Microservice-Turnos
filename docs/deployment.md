# Preparar el piloto en Railway

Fase 9 para 1–3 negocios. **La aplicación todavía no está desplegada ni se contrataron servicios.** El usuario autorizó publicar el código en GitHub; la CI se dispara por push y su estado se consulta en [Actions](https://github.com/Fede-Martorell/Microservice-Turnos/actions). Las migraciones 001–012 ya se aplicaron; 012 agrega la lectura de puesta en marcha. No repetir migraciones aplicadas; detalle en progress.md.

## Paquete y comprobaciones

Node 22, `npm ci`, `npm run check`. El build produce `.next/standalone`; postbuild copia `public` y `.next/static`. `npm start` sirve el paquete local. `npm run start:pilot` exige configuración de hosting válida antes de iniciar. No aplica SQL ni activa avisos.

El Dockerfile compila en una etapa y ejecuta standalone como usuario `node` en otra. Excluye `.env*`, credenciales locales, backups y PostgreSQL de pruebas del contexto. No pasar secretos como ARG/build args: configurarlos en ejecución. El servidor web no necesita service_role ni conexión directa a PostgreSQL. No almacenar datos permanentes en su disco.

```powershell
npm run check
npm run pilot:check -- --local
# En una máquina con Docker:
docker build -t reservas-pilot:review .
# Archivo privado fuera del repositorio, con valores de STAGING:
docker run --rm --env-file C:\ruta-privada\piloto-staging.env -p 3001:3000 reservas-pilot:review
```

Docker no está instalado aquí: no se construyó la imagen localmente. La CI incluye una construcción Linux futura. Se verificó el servidor standalone; falta construir y arrancar el contenedor antes de publicar.

`npm run pilot:smoke` prueba el arranque estricto y health con valores sintéticos, sin llamadas a proveedores; ejecutarlo tras build. No sustituye la construcción del contenedor.

## Servicio preparado

Tras autorizar publicación y presupuesto, configurar Railway:

| Ajuste       | Valor                                            |
| ------------ | ------------------------------------------------ |
| Fuente       | Repositorio y revisión aprobados, raíz `.`       |
| Constructor  | Dockerfile de la raíz                            |
| Arranque     | CMD de la imagen; sin sobrescritura              |
| Red          | Respetar `PORT` de Railway, escucha `0.0.0.0`    |
| Healthcheck  | `/api/health`, timeout inicial 300 s             |
| Réplicas     | Una durante el piloto; región cercana a Supabase |
| Persistencia | Sin volumen de aplicación; datos en Supabase     |
| Avisos       | `NOTIFICATION_MODE=disabled` inicialmente        |

Revisar despliegues automáticos antes de conectar GitHub. Se usa Dockerfile y panel porque la referencia de [Config as Code](https://docs.railway.com/config-as-code/reference) está deprecada; no se agregó un archivo legacy nuevo.

`GET /api/health` devuelve 200 si el proceso y, en modo piloto, la forma de la configuración están listos; 503 si son inválidos. `HEAD` devuelve igual estado sin cuerpo. Sin caché ni datos privados. **No consulta Supabase, Turnstile o Resend:** no prueba su conexión, los hashes ni las migraciones. [Railway usa el healthcheck al desplegar y no sigue consultándolo después](https://docs.railway.com/deployments/healthchecks); falta un monitor externo para detectar caídas posteriores.

## Variables de ejecución

Usar `.env.example` sin subir su copia completada:

| Variable                                       | Comprobación de hosting                                       |
| ---------------------------------------------- | ------------------------------------------------------------- |
| NEXT_PUBLIC_APP_URL                            | Origen HTTPS canónico, sin subruta, query ni credenciales     |
| NEXT_PUBLIC_SUPABASE_URL                       | Origen HTTPS del proyecto elegido                             |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY           | Publicable o anon legacy; rechaza service_role/secret         |
| PUBLIC_BOOKING_GATEWAY_SECRET                  | 64 hex, con hash correspondiente provisionado en ese proyecto |
| PUBLIC_BOOKING_TURNSTILE_SITE_KEY / SECRET_KEY | Ambas presentes; probar dominio y Siteverify real             |
| NOTIFICATION_MODE                              | disabled inicialmente; test/live requieren más configuración  |
| PILOT_DEPLOYMENT                               | El contenedor/arranque estricto fija 1                        |

Si se habilitan avisos: RESEND_API_KEY, NOTIFICATION_FROM_EMAIL, NOTIFICATION_WORKER_SECRET (64 hex y hash remoto), CRON_SECRET (mínimo 32), NOTIFICATION_TEST_RECIPIENT en test. En live se rechaza el remitente resend.dev. La validación revisa formato, **no verifica dominio, entrega, credenciales ni hashes remotos**.

`npm run pilot:check` carga configuración privada local e informa solo identificadores de comprobaciones. `-- --local` permite loopback y omitir Turnstile local; no habilita una publicación. Rechaza nombres secretos con prefijo público. `npm run pilot:artifacts` revisa archivos privados en standalone y coincidencias de secretos conocidos en recursos públicos. Es un control adicional, no un escáner exhaustivo.

## Validación en staging

1. Elegir proyecto Supabase sin contactos reales. En instalación nueva aplicar 001–012 en orden y provisionar los hashes con scripts de preparación revisados para ese destino. No copiar secretos de desarrollo por defecto. Preparar cuenta admin expresamente.
2. Configurar Supabase Auth Site URL HTTPS y permitir `/auth/confirm` de ese origen. Mantener Confirm email, revisar SMTP, límites y plantillas. **No hay recuperación de contraseña de autoservicio:** antes de cuentas reales, implementar ese recorrido o acordar y ensayar un procedimiento con verificación de identidad. Nunca pedir contraseñas por soporte.
3. Autorizar dominio en Turnstile y probar Siteverify. Verificar entrega de Supabase Auth por separado de los avisos de reservas.
4. Arrancar contenedor; comprobar health, recursos estáticos y enlaces. En HTTPS verificar cookies Secure/HttpOnly, logout y confirmación. Un health 200 no prueba proveedores.
5. Dos propietarios y staff prueban acceso/aislamiento y denegación de `/admin`. El administrador SaaS gestiona planes desde `/admin`; no obtiene automáticamente acceso a las fichas de cada negocio.
6. Completar Puesta en marcha; crear/cancelar/reprogramar turnos internos y públicos en incógnito, incluidos enlaces vencidos/revocados. Contrastar Calendario y Resumen en igual período/zona (validación manual de Fase 8 aún pendiente).
7. Seguir [operación del piloto](pilot.md): restauración en staging, presupuesto, soporte y autorización de apertura.

Notificaciones conserva `POST /api/jobs/notifications`, Bearer CRON_SECRET y ejecuciones acotadas. `npm run notifications:run` es dry run. No se agregó scheduler ni se enviaron emails. Antes de habilitarlo, preparar prueba con destinatario/contenido concretos y autorización de envío; revisar [operación de la cola](customers-and-notifications.md).

## Reversión

Conservar imagen/revisión y variables del último despliegue válido en un gestor privado. Ante fallo, detener cambios y jobs; volver a esa imagen compatible con el esquema. La 012 es aditiva/de lectura, el código anterior no depende de ella. No ejecutar down migrations ni borrar datos para revertir UI. Ante fallo SQL, preparar migración correctiva y ensayarla en staging. Restaurar una base real reemplaza datos y necesita aprobación específica, según pilot.md.
