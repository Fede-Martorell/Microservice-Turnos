"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { BusinessDashboard } from "@/features/dashboard/schema";

const Chart = dynamic(() => import("./activity-chart-content"), {
  ssr: false,
  loading: () => <Placeholder />,
});
function Placeholder() {
  return (
    <p className="text-muted-foreground flex h-[280px] items-center justify-center text-sm">
      Gráfico de reservas · datos disponibles en la tabla
    </p>
  );
}
export function ActivityChart({
  series,
}: {
  series: BusinessDashboard["series"];
}) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    if (typeof IntersectionObserver !== "function") {
      const timeout = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timeout);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={container} className="mt-5 min-h-[280px] min-w-0">
      {visible ? <Chart series={series} /> : <Placeholder />}
    </div>
  );
}
