# Medición del piloto

30/10/2026. `npm run pilot:measure -- before|after|latest` inicia standalone local y un adaptador SQL/identidad sintéticos en 3150/54324. Requiere build y Chromium; rechaza puertos ocupados. No apunta a Supabase real ni envía emails. Reportes temporales en test-results/performance (Playwright puede reemplazarlos).

Una navegación nueva por página, Chromium 1280×800, sin throttling; esperar networkidle/fuentes, medir recursos JavaScript y luego acercar el gráfico al viewport. No es un ensayo de carga, Lighthouse ni medición de usuarios reales. No interpretar pequeñas diferencias de tiempo de una muestra como mejora estable.

| Recurso                                  |     Antes |   Después |
| ---------------------------------------- | --------: | --------: |
| Inicio: JS transferido                   | 163.894 B | 167.468 B |
| Resumen: JS inicial decodificado         | 898.555 B | 542.097 B |
| Resumen: JS inicial transferido          | 269.106 B | 169.911 B |
| Resumen: JS transferido tras ver gráfico | 269.106 B | 274.727 B |
| Resumen: cantidad inicial de scripts     |        11 |        11 |

El gráfico Recharts se importaba al abrir el resumen aunque estaba bajo el primer viewport. Ahora un wrapper pequeño espera IntersectionObserver y después carga el componente mediante next/dynamic. Fallback para navegadores sin observer, espacio reservado y tabla siempre renderizada en servidor. Datos/consulta de métricas sin cambios; no se agregó caché ni otra llamada al API. El onboarding usa su propia RPC acotada solo al abrir su página.

En esta muestra, resumen reduce aproximadamente 40% de JS inicial decodificado y 37% transferido. No elimina el costo: al mirar el gráfico el total transferido sube 5.621 B respecto al anterior (2,1%); también aumenta la portada 3.574 B por cambios del paquete. Es un intercambio entre carga inicial y descarga posterior. FCP fue 148/140 ms y TTFB 105/97 ms antes/después, con variabilidad local y sin valor de predicción cloud.

Pendiente en staging: medir p75 de navegación/interacción, latencia RPC, memoria/CPU y concurrencia de los negocios previstos. No se hicieron promesas de capacidad ni se extrapoló el consumo de esta computadora a la factura Railway. Guía instalada de Next 16: lazy-loading; skill performance-engineer aplicada con medición previa.
