// Capturas de la aplicación real, con SQL e identidad de pruebas SOLO en loopback.
// Las láminas se componen en HTML/CSS: no se alteran los datos ni los controles capturados.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const origin = "http://127.0.0.1:3150";
const output = "docs/showcase";
const children = [];
let browser;
async function ready(url) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("No inició el entorno local de capturas");
}
async function settled(page) {
  // Los selectores de cada pantalla indican disponibilidad; networkidle no es
  // una condición fiable tras el refresh del enlace privado en App Router.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}
const slides = [
  {
    file: "01-resumen.png",
    raw: "resumen.png",
    label: "Un SaaS para negocios con turnos",
    title: "Reservas, equipo y clientes.<br>En un mismo lugar.",
    detail:
      "Un proyecto de portfolio que conecta la agenda del negocio con la experiencia de sus clientes.",
    note: "Next.js · TypeScript · Supabase",
    alt: "Presentación de Reservas, un SaaS para negocios con turnos, con una captura de su resumen y estadísticas. Datos de demostración.",
  },
  {
    file: "02-onboarding.png",
    raw: "onboarding.png",
    label: "Puesta en marcha",
    title: "El primer paso:<br>saber qué falta.",
    detail:
      "Equipo, servicios y horarios, revisados a partir de la configuración del negocio.",
    note: "Onboarding con estado derivado de datos reales",
    alt: "Puesta en marcha con cuatro controles: profesional, servicio asignado, horarios del negocio y coincidencia de horarios. Datos de demostración.",
  },
  {
    file: "03-reserva-publica.png",
    raw: "reserva-publica.png",
    label: "La experiencia del cliente",
    title: "Elegir un turno.<br>Sin crear otra cuenta.",
    detail:
      "Disponibilidad, profesional y datos de contacto en un recorrido público de reserva.",
    note: "Reservas online · Sin cobros en esta versión",
    alt: "Formulario público de reserva con selección de profesional, fecha y horario, datos del cliente y política de cancelación. Datos de demostración.",
  },
  {
    file: "04-fidelizacion.png",
    raw: "fidelizacion-movil.png",
    label: "También después del turno",
    title: "Una tarjeta para<br>volver a encontrarse.",
    detail:
      "Fidelización opcional, con saldo, progreso y recompensas configurables por negocio.",
    note: "Diseño responsive · Tarjeta privada",
    mobile: true,
    alt: "Tarjeta de fidelización en móvil con saldo de puntos y una recompensa disponible. Función opcional por negocio. Datos de demostración.",
  },
];
try {
  for (const url of [origin, "http://127.0.0.1:54324/health"]) {
    let occupied = false;
    try {
      await fetch(url, { signal: AbortSignal.timeout(500) });
      occupied = true;
    } catch {}
    if (occupied)
      throw new Error(
        "Liberá los puertos locales 3150 y 54324 antes de capturar",
      );
  }
  children.push(
    spawn(process.execPath, ["tests/fixtures/public-api.mjs"], {
      windowsHide: true,
      stdio: "ignore",
    }),
  );
  await ready("http://127.0.0.1:54324/health");
  children.push(
    spawn(process.execPath, [".next/standalone/server.js"], {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        HOSTNAME: "127.0.0.1",
        PORT: "3150",
        PILOT_DEPLOYMENT: "0",
        NEXT_PUBLIC_APP_URL: origin,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54324",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-fixture-key",
        PUBLIC_BOOKING_GATEWAY_SECRET: "a".repeat(64),
        PUBLIC_BOOKING_TURNSTILE_SITE_KEY: "",
        PUBLIC_BOOKING_TURNSTILE_SECRET_KEY: "",
        NOTIFICATION_MODE: "disabled",
        RESEND_API_KEY: "",
      },
    }),
  );
  await ready(origin);
  const { org, token, user } = await (
    await fetch("http://127.0.0.1:54324/test-context")
  ).json();
  await mkdir(`${output}/raw`, { recursive: true });
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    deviceScaleFactor: 1,
  });
  await context.route(/^https?:\/\//, (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: `base64-${Buffer.from(JSON.stringify({ access_token: token, refresh_token: "fixture", expires_at: Math.floor(Date.now() / 1000) + 3600, user })).toString("base64url")}`,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/panel/${org}`);
  await page
    .getByRole("heading", { name: "Resumen del negocio", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Estadísticas básicas", exact: true })
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await page.evaluate(() => window.scrollBy(0, -90));
  await page.getByRole("application").waitFor();
  await settled(page);
  await page
    .getByRole("region", { name: "Estadísticas básicas", exact: true })
    .screenshot({ path: `${output}/raw/resumen.png` });
  await page.setViewportSize({ width: 1280, height: 1800 });
  await page.goto(`${origin}/panel/${org}/puesta-en-marcha`);
  await page.getByText("4 de 4 pasos completos").waitFor();
  await settled(page);
  const title = await page.locator("main .eyebrow").first().boundingBox();
  const card = await page.getByRole("progressbar").locator("..").boundingBox();
  if (!title || !card) throw new Error("No se encontró el onboarding completo");
  await page.screenshot({
    path: `${output}/raw/onboarding.png`,
    clip: {
      x: card.x - 16,
      y: title.y - 16,
      width: card.width + 32,
      height: card.y + card.height - title.y + 32,
    },
  });
  await page.setViewportSize({ width: 1120, height: 1450 });
  await page.goto(`${origin}/b/horizonte`);
  await page.getByRole("link", { name: "Elegir Consulta pública" }).click();
  await page
    .getByLabel("Fecha", { exact: true })
    .fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Ver horarios", exact: true }).click();
  await page.getByLabel("Horario disponible").waitFor();
  await settled(page);
  const bookingTitle = await page
    .getByRole("heading", { name: "Consulta pública", exact: true })
    .boundingBox();
  const bookingButton = await page
    .getByRole("button", { name: "Solicitar reserva", exact: true })
    .boundingBox();
  if (!bookingTitle || !bookingButton)
    throw new Error("No se encontró el recorrido público completo");
  await page.screenshot({
    path: `${output}/raw/reserva-publica.png`,
    clip: {
      x: 72,
      y: bookingTitle.y - 45,
      width: 976,
      height: bookingButton.y + bookingButton.height - bookingTitle.y + 70,
    },
  });
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto(`${origin}/tarjeta#token=${"b".repeat(64)}`);
  await page.getByText("12 puntos disponibles").waitFor();
  await settled(page);
  await page.screenshot({ path: `${output}/raw/fidelizacion-movil.png` });
  if (errors.length)
    throw new Error(
      "La captura detectó errores de aplicación; revisar antes de publicar",
    );
  await context.close();

  const sans = (
    await readFile(
      "node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2",
    )
  ).toString("base64");
  const display = (
    await readFile(
      "node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2",
    )
  ).toString("base64");
  const poster = await browser.newPage({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 1,
  });
  for (const [index, slide] of slides.entries()) {
    const screenshot = (await readFile(`${output}/raw/${slide.raw}`)).toString(
      "base64",
    );
    await poster.setContent(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Reservas · ${slide.label}</title><style>
      @font-face{font-family:Body;src:url(data:font/woff2;base64,${sans}) format('woff2');font-weight:100 1000}
      @font-face{font-family:Display;src:url(data:font/woff2;base64,${display}) format('woff2');font-weight:100 1000}
      *{box-sizing:border-box}html{font-size:16px}body{margin:0;background:#f6f6f0;color:#253c30;font-family:Body,Arial,sans-serif;line-height:1.5;width:1080px;height:1350px}
      article{height:100%;padding:52px 60px 38px;display:flex;flex-direction:column}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #dce2d8;padding-bottom:24px}.brand{font-size:1.625rem;font-weight:650;letter-spacing:-.04em;display:flex;align-items:center;gap:12px}.mark{width:38px;height:38px;background:#28533f;color:white;border-radius:12px;display:grid;place-items:center}.counter{font-size:.875rem;color:#647068;letter-spacing:.08em}
      .eyebrow{margin:28px 0 10px;color:#28533f;font-size:.875rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase}h1{font:450 3.75rem/1.04 Display,Georgia,serif;letter-spacing:-.025em;margin:0;text-wrap:balance}p{margin:18px 0 0;max-width:59ch;font-size:1.375rem;line-height:1.5;color:#647068;text-wrap:pretty}
      .media{flex:1;min-height:0;margin-top:28px;display:flex;align-items:center;justify-content:center;background:#e7eee7;border:1px solid #dce2d8;border-radius:22px;padding:20px;overflow:hidden}.media img{display:block;max-width:100%;max-height:100%;object-fit:contain;border-radius:10px;box-shadow:0 12px 30px #183e3014}.media.mobile{justify-content:space-evenly;padding:26px}.mobile img{height:100%;width:auto;max-width:48%;border:8px solid #253c30;border-radius:30px}.notes{max-width:40%;font-size:1.375rem;line-height:1.6}.notes div{border-top:1px solid #bdcbbd;padding:18px 0}.notes small{display:block;font-size:.875rem;color:#647068;margin-top:7px}.caption{margin:18px 0 0;color:#28533f;font-size:1rem}footer{display:flex;justify-content:space-between;gap:16px;margin-top:24px;padding-top:18px;border-top:1px solid #dce2d8;font-size:.75rem;color:#647068}
      </style><article><header><div class="brand"><span class="mark" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2"/></svg></span>Reservas.</div><div class="counter">PROYECTO DE PORTFOLIO · ${String(index + 1).padStart(2, "0")} / 04</div></header><div class="eyebrow">${slide.label}</div><h1>${slide.title}</h1><p>${slide.detail}</p><div class="media ${slide.mobile ? "mobile" : ""}">${slide.mobile ? '<div class="notes"><div>Un acceso privado<small>Consulta de la tarjeta mediante enlace.</small></div><div>Saldo y progreso<small>Visitas o puntos según el programa.</small></div><div>Recompensas<small>Canjes administrados por el negocio.</small></div></div>' : ""}<img alt="${slide.alt}" src="data:image/png;base64,${screenshot}"></div><div class="caption">${slide.note}</div><footer><span>Datos de demostración · Preparación de piloto</span><span>github.com/Fede-Martorell/Microservice-Turnos</span></footer></article></html>`);
    await poster.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.decode()));
    });
    const overflow = await poster.evaluate(
      () =>
        document.documentElement.scrollHeight > 1350 ||
        document.documentElement.scrollWidth > 1080,
    );
    if (overflow) throw new Error(`La lámina ${index + 1} tiene desborde`);
    await poster.screenshot({ path: `${output}/${slide.file}` });
  }
  await writeFile(
    `${output}/captions.json`,
    JSON.stringify(
      slides.map(({ file, alt }) => ({ file, alt })),
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Capturas listas: 4 láminas 1080×1350 y 4 capturas originales, solo con datos sintéticos. Sin reservas reales ni emails.",
  );
} finally {
  await browser?.close();
  for (const child of children) child.kill();
}
