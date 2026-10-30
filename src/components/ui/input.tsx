import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "aria-invalid:border-destructive border-input disabled:bg-muted flex min-h-12 w-full rounded-lg border bg-white px-3.5 py-2.5 text-base shadow-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}
