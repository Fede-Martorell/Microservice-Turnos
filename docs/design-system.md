# Identidad visual · Minimalista cálida

El 30/10/2026 el usuario solicitó aplicar la skill pixel-perfect-ui y eligió la opción «Minimalista cálido». Se conserva el verde del producto y se organiza la experiencia alrededor de tres contextos: presentación pública, trabajo del negocio y reserva del cliente. No es una maqueta separada: los componentes utilizan las consultas y acciones existentes.

## Base visual

- Marfil `#f6f6f0` para el fondo; superficies blancas y verde bosque `#28533f` para acciones. Verde oscuro `#183e30` para secciones editoriales; salvia para acentos discretos.
- Texto principal `#253c30`, secundario `#647068`, bordes de campo `#87958b`. Tokens en src/styles/globals.css; sin gradientes, fotografías remotas ni librerías de animación.
- DM Sans para navegación, formularios y datos. Newsreader para titulares de portada, acceso y tarjeta. Archivos WOFF2 latinos locales mediante next/font/local y paquetes Fontsource fijados a 5.3.0; no hay consultas del navegador ni del build a Google Fonts. Licencias incluidas en ambos paquetes.
- Radios moderados, sombras muy suaves, una escala de espacios consistente y texto de datos con cifras tabulares. Estados distinguibles por texto y énfasis, además de color.

## Pantallas

La portada explica qué hace el producto y cómo empezar, con accesos reales a registro, ingreso y panel. No muestra turnos, clientes, testimonios, resultados comerciales ni métricas ficticias. El roadmap conserva su enlace explícito, separado de la experiencia principal.

El acceso tiene presentación editorial en desktop y formulario directo en móvil. El control de mostrar/ocultar contraseña conserva el valor, se anuncia mediante aria-pressed y no envía el formulario. Se mantienen restricciones y validación de servidor.

En el panel, una navegación reúne todos los módulos autorizados: se retiró la fila duplicada de pestañas de OrganizationScreen. Página pública y Notificaciones también se encuentran en el menú. El propietario ve sus accesos; el personal no recibe controles de propietario. El menú móvil es un disclosure en el flujo del documento, sin superposición modal; Escape lo cierra y devuelve foco al botón. El cambio de organización y el cierre de sesión siguen visibles.

El resumen distingue turnos de hoy, estadísticas del período, distribución de estados y listas. Se destaca solo el total de hoy; los estados secundarios se compactan. Los filtros rápidos indican la selección vigente y las métricas conservan sus definiciones. La tabla diaria sigue disponible como alternativa al gráfico.

La reserva pública conserva los colores configurados por cada negocio y sus contrastes calculados. Tarjetas, encabezados, formulario y precio tienen jerarquía consistente. La tarjeta privada de fidelización destaca el saldo y utiliza un progreso visual acorde a la paleta. La administración SaaS comparte marca, fuentes y superficies, manteniendo su acceso independiente.

## Responsive y accesibilidad

Tipografía editorial fluida mediante clamp con límites en rem. Formularios de 16px en móvil, objetivos táctiles principales de 44–48px, foco visible, etiquetas persistentes, estados deshabilitados y reducción de movimiento. El documento permite scroll normal: no se bloquean zoom ni desplazamiento. Gráficos/tablas mantienen sus alternativas y desplazamiento local cuando hace falta.

Se calcularon combinaciones concretas: texto secundario sobre blanco 5,17:1 y sobre marfil 4,77:1; blanco sobre acción principal 8,75:1; borde de campo sobre blanco 3,13:1. Esto no constituye una auditoría completa de accesibilidad. Se verifican teclado, permisos de navegación, errores, capturas desktop/móvil y ausencia de desborde, incluido viewport de 320px para portada/resumen.

Skills utilizadas: pixel-perfect-ui y modern-web-guidance. Guías consultadas mediante su CLI: responsive-design, css y forms, adaptadas al proyecto Next.js 16/Tailwind 4. No se agregaron funciones experimentales que requieran polyfills.

Sin migraciones ni cambios de RLS, reglas de reserva, planes o módulos. Sin pagos, emails, publicación, commits o push en este trabajo. La revisión visual no sustituye probar con usuarios ni con dispositivos físicos antes del piloto comercial.
