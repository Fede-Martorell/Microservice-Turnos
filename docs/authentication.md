# Autenticación y organizaciones · Fase 1

## Rutas y flujo

`/registro` crea la cuenta con Supabase Auth, sin aceptar rol ni organización desde el formulario. Zod valida email y contraseña de 12–128 caracteres; no se recorta la contraseña. Supabase envía el enlace de confirmación según su configuración. El texto de respuesta evita confirmar si un email ya tiene cuenta.

`/auth/confirm` acepta un código PKCE o un TokenHash, nunca ambos, valida en servidor y termina en `/panel`. No admite destinos arbitrarios con `next`. Los tokens no se registran en logs, el callback no se cachea y utiliza Referrer-Policy no-referrer.

`/ingresar` verifica email/contraseña en servidor. `/panel` lista únicamente negocios activos permitidos por RLS. `/panel/organizaciones/nueva` crea un negocio y su propietario en una transacción. `/panel/[organizationId]` permite al owner editar nombre, descripción, zona horaria y moneda; staff tiene lectura. El cierre de sesión revoca la sesión de ese dispositivo y limpia sus cookies.

## Configuración del proveedor

1. Completar `.env.local` con URL y clave publicable del proyecto, y NEXT_PUBLIC_APP_URL con el origen canónico (local http://localhost:3000).
2. En Auth → URL Configuration, Site URL debe coincidir con ese origen. Permitir http://localhost:3000/auth/confirm en Redirect URLs para desarrollo; usar los dominios autorizados del entorno cuando cambien.
3. Mantener Email provider y Confirm email habilitados. La cuenta no accede al panel si falta `email_confirmed_at` o es anónima.
4. Conservar la plantilla de confirmación predeterminada con `{{ .ConfirmationURL }}` para PKCE. El enlace debe abrirse en el navegador que inició el registro, donde está su cookie verificadora.
5. Si se necesita confirmar desde otro navegador/dispositivo, editar la plantilla de **Confirm signup** para usar el hash verificado por servidor:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"
  >Confirmar mi cuenta</a
>
```

El callback solo verifica OTP de tipo email. No implementa cambio de contraseña, OAuth ni recuperación en esta fase. En desarrollo se aplican los límites de envío del proveedor. Configurar SMTP/dominio y protección CAPTCHA antes del piloto comercial según su volumen real; no existe integración Resend activa para las cuentas.

## Sesiones y autorización

Clientes SSR creados por petición, cookies HttpOnly/SameSite=Lax y Secure cuando el origen usa HTTPS. No hay cliente Supabase en navegador ni claves de servicio. El proxy renueva cookies con getClaims, conserva sus cabeceras/cookies al redirigir y deniega rutas privadas antes de streaming si no hay claims. **No es la única barrera:** cada página, consulta y acción invoca requireUser, que valida con getUser en el proveedor. Nunca confiar en getSession ni en user_metadata para autorizar.

requireOrganization valida UUID, consulta organización y membresía activa del usuario verificado y devuelve 404 tanto ante recurso ajeno como inexistente. No se elige un tenant confiando en una cookie editable. Cada URL privada lleva su ID y se revalida en cada operación. Si Auth no responde, el acceso falla cerrado; los errores internos se registran solo con evento, referencia y código, sin datos de formulario ni mensajes crudos del proveedor.

Auth y panel usan Cache-Control privado/no-store, sin ISR de datos personales ni caché compartido de sesiones. Los clientes SSR no se comparten entre peticiones; las lecturas de BD usan fetch no-store. Server Actions usan POST con los controles de origen de Next.js y validación/autorización dentro de la acción, aun si se invocan directamente.

## Roles y límites actuales

- Owner: lectura del negocio/equipo/auditoría y edición de campos permitidos.
- Staff: lectura del negocio, settings y su propia membresía; sin escritura, listado de otros miembros ni auditoría.
- Sin membresía activa o negocio suspendido/archivado: sin acceso.
- No existe superadmin implícito ni elevación por metadata. La administración interna se implementará en Fase 6.

No hay invitaciones o altas/bajas de miembros desde la aplicación aún. La creación genera un owner; staff se prueba con fixtures aislados de integración. La gestión de cuentas del equipo se diseñará al implementar profesionales, con mecanismos explícitos y auditados; no insertar membresías a mano en producción. No se aceptan modificaciones directas de roles desde la API.

Máximo 3 organizaciones nuevas por usuario en una ventana móvil de 24 horas, protegido mediante bloqueo transaccional por usuario. Slug único, de 3–63 caracteres, en minúsculas/números/guiones y sin nombres reservados; se mantiene al editar. Organizaciones no se borran físicamente en esta fase. Su status operativo no equivale a una suscripción: planes y pilotos corresponden a Fase 6.

## Validación manual

El usuario confirmó que pudo ingresar con su correo y crear una organización en Supabase durante esta entrega. El resto del recorrido de revisión incluye editar, cerrar sesión y comprobar aislamiento con dos cuentas reales.

1. Registrar una cuenta real de prueba y confirmar el correo.
2. Ingresar, crear una organización, actualizarla y cerrar sesión.
3. Verificar que no se pueda volver al panel sin ingresar.
4. Usar otra cuenta para comprobar que no aparezca la organización anterior.

Los E2E configurados no envían emails ni crean cuentas. Las pruebas SQL con dos tenants verifican RLS sobre PostgreSQL embebido; no sustituyen la validación completa de Auth/SMTP/PostgREST. La comprobación remota automática verificó configuración pública de Auth y rechazo de API/RPC anónimas, sin modificar datos; el usuario realizó el recorrido autenticado indicado arriba.

Referencias: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Next.js Auth](https://nextjs.org/docs/app/guides/authentication) y [PGlite](https://pglite.dev/docs/).
