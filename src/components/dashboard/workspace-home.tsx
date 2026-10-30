import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  UsersRound,
  Gift,
  Check,
  Clock3,
  SlidersHorizontal,
} from "lucide-react";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { es } from "@/lib/i18n/es";
const features = [
  {
    icon: CalendarDays,
    number: "01",
    title: "Una agenda que se entiende.",
    description:
      "Servicios, profesionales y horarios en su lugar. Tus clientes eligen su turno y vos mantenés el control.",
  },
  {
    icon: UsersRound,
    number: "02",
    title: "Cada cliente, más cerca.",
    description:
      "Una ficha con su información e historial. Lo necesario para conocer a quien vuelve y atenderlo mejor.",
  },
  {
    icon: Gift,
    number: "03",
    title: "Más motivos para volver.",
    description:
      "Con el complemento de fidelización, creá un programa de visitas o puntos con las reglas de tu negocio.",
  },
];
export function WorkspaceHome() {
  return (
    <div className="min-h-dvh">
      <MarketingHeader />
      <main id="contenido">
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 md:px-10 md:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <div>
            <p className="eyebrow mb-6 flex items-center gap-2">
              <span className="bg-primary h-px w-7" />
              Hecho para negocios como el tuyo
            </p>
            <h1 className="editorial-title max-w-2xl text-[clamp(3.2rem,2.2rem+3vw,5.5rem)]">
              {es.greeting}
            </h1>
            <p className="text-muted-foreground mt-6 max-w-lg text-base leading-8">
              Una agenda clara. Clientes más cerca. Un espacio para organizar tu
              negocio y dedicarle tiempo a lo que hacés mejor.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild className="min-h-12 px-6">
                <Link href="/registro">
                  Crear mi espacio
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
              <Link
                href="/ingresar"
                className="px-2 py-3 text-sm font-medium underline underline-offset-4"
              >
                Ya tengo cuenta
              </Link>
            </div>
            <p className="text-muted-foreground mt-5 flex items-center gap-2 text-xs">
              <Check className="text-primary size-3.5" />
              Creá tu cuenta sin tarjeta ni cargos automáticos.
            </p>
          </div>
          <div className="border-primary/10 bg-sage rounded-2xl border p-6 md:p-9">
            <div className="mb-8 flex items-center justify-between">
              <span className="eyebrow">Menos vueltas. Más claridad.</span>
              <CalendarDays className="text-primary size-5" strokeWidth={1.5} />
            </div>
            <h2 className="editorial-title max-w-xs text-4xl md:text-5xl">
              El día a día,
              <br />
              un poco más simple.
            </h2>
            <ol className="divide-primary/10 mt-8 divide-y">
              {[
                {
                  number: "01",
                  title: "Organizá tu espacio",
                  text: "Tu equipo, tus servicios y tus horarios.",
                },
                {
                  number: "02",
                  title: "Compartí tu página",
                  text: "Tus clientes reservan sin crear una cuenta.",
                },
                {
                  number: "03",
                  title: "Seguí desde tu panel",
                  text: "Consultá la agenda y la actividad del negocio.",
                },
              ].map((step) => (
                <li key={step.number} className="flex gap-4 py-5">
                  <span className="border-primary/20 text-primary flex size-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{step.title}</h3>
                    <p className="text-muted-foreground mt-1 text-[13px] leading-6">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section
          id="como-funciona"
          aria-labelledby="features-title"
          className="border-y bg-white"
        >
          <div className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-16">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="eyebrow mb-3">Un lugar para lo importante</p>
                <h2
                  id="features-title"
                  className="editorial-title text-4xl md:text-5xl"
                >
                  Todo más conectado.
                </h2>
              </div>
              <p className="text-muted-foreground max-w-sm text-sm leading-7">
                Una experiencia simple para vos, tu equipo y las personas que
                eligen tu negocio.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {features.map(({ icon: Icon, number, title, description }) => (
                <article key={number} className="border-t pt-6">
                  <div className="mb-6 flex items-center justify-between">
                    <Icon className="text-primary size-6" strokeWidth={1.5} />
                    <span className="text-muted-foreground text-xs">
                      {number}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-3 text-sm leading-7">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:px-10 md:py-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow mb-4">A tu manera</p>
            <h2 className="editorial-title max-w-sm text-4xl md:text-5xl">
              Tu negocio tiene su ritmo.
            </h2>
            <p className="text-muted-foreground mt-5 max-w-md text-sm leading-7">
              Configurá lo que necesitás y trabajá con las reglas que tienen
              sentido para vos. Las funciones disponibles dependen del plan y
              los módulos habilitados.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: Clock3,
                title: "Horarios claros",
                text: "Disponibilidad, descansos y tiempos de cada servicio.",
              },
              {
                icon: SlidersHorizontal,
                title: "Reglas propias",
                text: "Políticas de reserva y permisos del equipo, en un solo lugar.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="surface-panel p-6">
                <Icon className="text-primary mb-5 size-5" strokeWidth={1.6} />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-muted-foreground mt-3 text-sm leading-7">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto mb-14 max-w-7xl px-5 md:px-10">
          <div className="bg-ink grid items-center gap-7 rounded-2xl p-7 text-white md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <p className="mb-3 text-[11px] tracking-widest text-white/70 uppercase">
                Un espacio propio para tu negocio
              </p>
              <h2 className="editorial-title text-4xl">
                Empezá por hacerlo más simple.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/75">
                {es.emptyDescription}
              </p>
            </div>
            <Button
              asChild
              className="text-ink hover:bg-sage min-h-12 bg-white px-6"
            >
              <Link href="/panel">
                Ir a mi panel
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-8 md:px-10">
          <Brand />
          <p className="text-muted-foreground text-xs">
            Más orden para tu negocio. Más tiempo para vos.
          </p>
          <Link
            href="/proyecto"
            className="text-muted-foreground inline-flex items-center gap-2 py-2 text-xs underline underline-offset-4"
          >
            {es.roadmap}
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
