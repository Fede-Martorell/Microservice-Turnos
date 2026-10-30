"use client";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { BusinessDashboard } from "@/features/dashboard/schema";
export default function ActivityChartContent({
  series,
}: {
  series: BusinessDashboard["series"];
}) {
  return (
    <div
      className="min-w-0"
      aria-label="Gráfico de reservas por día; valores en la tabla siguiente"
    >
      <BarChart
        responsive
        style={{ width: "100%", height: 280 }}
        data={series}
        accessibilityLayer
        margin={{ left: -18, right: 8, top: 10 }}
      >
        <CartesianGrid
          stroke="var(--color-border)"
          strokeDasharray="3 5"
          vertical={false}
        />
        <XAxis
          dataKey="day"
          tickFormatter={(v) =>
            String(v).slice(5).split("-").reverse().join("/")
          }
          minTickGap={30}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          labelFormatter={(v) => String(v).split("-").reverse().join("/")}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="total"
          name="Reservas"
          fill="var(--chart-total)"
          isAnimationActive={false}
          radius={[3, 3, 0, 0]}
        />
        <Bar
          dataKey="completed"
          name="Completadas"
          fill="var(--chart-completed)"
          isAnimationActive={false}
          radius={[3, 3, 0, 0]}
        />
        <Bar
          dataKey="canceled"
          name="Canceladas"
          fill="var(--chart-canceled)"
          isAnimationActive={false}
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </div>
  );
}
