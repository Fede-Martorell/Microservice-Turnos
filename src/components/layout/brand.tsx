import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({
  inverse = false,
  className,
}: {
  inverse?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="Reservas, inicio"
      className={cn(
        "inline-flex shrink-0 items-center gap-3",
        inverse ? "text-white" : "text-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-xl",
          inverse ? "bg-white/10 text-white" : "bg-primary text-white",
        )}
      >
        <CalendarDays aria-hidden="true" className="size-5" strokeWidth={1.7} />
      </span>
      <span className="text-xl font-semibold tracking-tight">
        Reservas
        <span
          aria-hidden="true"
          className={cn("ml-0.5", inverse ? "text-white/60" : "text-primary")}
        >
          .
        </span>
      </span>
    </Link>
  );
}
