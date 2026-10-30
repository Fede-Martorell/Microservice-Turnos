# Material de portfolio y LinkedIn

Cuatro láminas de 1080 × 1350 (4:5), con capturas auténticas y datos de demostración. Estudio Horizonte, clientes, profesionales, fechas, precios y puntos son sintéticos; no representan resultados de negocios reales. Los títulos y marcos no modifican los controles ni valores capturados. No se enviaron reservas a Supabase ni emails para producirlas.

## Archivos y orden

1. [Resumen del producto](01-resumen.png).
2. [Onboarding del negocio](02-onboarding.png).
3. [Reserva pública](03-reserva-publica.png).
4. [Fidelización en móvil](04-fidelizacion.png).

Capturas originales sin títulos en [raw](raw/). Textos alternativos en [captions.json](captions.json). Borrador para revisar en [LINKEDIN.md](LINKEDIN.md). Las cifras solo ilustran pantallas; no son adopción, ingresos ni resultados de un piloto real.

## Publicar después de revisar

1. Leer el borrador y ajustar aprendizaje/proceso a tu experiencia. Es la primera publicación del usuario; no se afirma que sea su primer proyecto ni que tenga clientes pagos. Menciona el apoyo de IA y distingue preparación del piloto de una demo publicada.
2. Abrir una publicación de LinkedIn, elegir fotos y cargar las cuatro láminas numeradas en ese orden. Evitar mezclar los originales largos con las láminas para no repetir información.
3. Agregar el texto alternativo por imagen y pegar el borrador. Revisar previsualización, orden, legibilidad, link, audiencia y comentarios. La [ayuda oficial de LinkedIn](https://www.linkedin.com/help/linkedin/answer/a527229) explica carga, orden y texto alternativo; consultada el 30/10/2026.
4. Publicar desde la cuenta del usuario cuando apruebe el contenido. No se accedió a LinkedIn ni se publicó automáticamente. No hay demo alojada para enlazar: localhost solo abre en la máquina que ejecuta el proyecto.

El objetivo es obtener observaciones sobre primer uso y código. Priorizar problemas reproducibles y separar errores de preferencias. Para issues, usar datos sintéticos y omitir credenciales, correos y enlaces privados.

## Reproducir las capturas

```powershell
npm run build
npx playwright install chromium
npm run showcase:capture
```

El script inicia/detiene servidores propios de loopback en 3150 y 54324, rechaza puertos ocupados y usa PGlite con identidad sintética solo en el adaptador de pruebas. La aplicación mantiene su autorización real. Bloquea recursos externos del navegador, usa fuentes locales y notificaciones disabled. Verifica textos de pantalla, fuentes y ausencia de desbordes de las láminas. Revisar visualmente tras regenerar; fechas y datos descartables cambian.

Diseño coherente con pixel-perfect-ui y el sistema marfil/verde. Composición en HTML/CSS con capturas reales; no son imágenes de interfaces inexistentes. Son assets de documentación, no rutas nuevas del producto.
