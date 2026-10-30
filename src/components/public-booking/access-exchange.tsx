"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
export function AccessExchange({
  children,
  path = "/reserva",
  endpoint = "/api/public-booking/access",
}: {
  hasReceipt: boolean;
  children: ReactNode;
  path?: "/reserva" | "/tarjeta";
  endpoint?: "/api/public-booking/access" | "/api/loyalty/access";
}) {
  const router = useRouter();
  const [message, setMessage] = useState("Verificando tu enlace…"),
    [ready, setReady] = useState(false);
  const tokenRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    async function exchange() {
      if (tokenRef.current === undefined) {
        tokenRef.current = new URLSearchParams(
          window.location.hash.slice(1),
        ).get("token");
        if (tokenRef.current) window.history.replaceState(null, "", path);
      }
      // Continuación asíncrona: también mantiene la misma hidratación con/sin fragmento.
      await Promise.resolve();
      if (!active) return;
      const token = tokenRef.current;
      if (!token) {
        setReady(true);
        return;
      }
      if (!/^[0-9a-f]{64}$/.test(token)) {
        setMessage("El enlace no está disponible o venció.");
        return;
      }
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "same-origin",
        });
        if (!active) return;
        if (response.ok) router.refresh();
        else
          setMessage(
            "El enlace no está disponible, venció o alcanzó el límite de consultas.",
          );
      } catch {
        if (active)
          setMessage(
            "No pudimos conectar. Volvé a abrir el enlace para intentar nuevamente.",
          );
      }
    }
    void exchange();
    return () => {
      active = false;
    };
  }, [router, path, endpoint]);
  return ready ? (
    <>{children}</>
  ) : (
    <p role="status" className="rounded-xl border bg-white p-5 text-sm">
      {message}
    </p>
  );
}
