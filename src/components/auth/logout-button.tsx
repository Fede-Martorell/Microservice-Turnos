"use client";

import { useActionState } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [state, action, pending] = useActionState(logoutAction, {});
  return (
    <form action={action}>
      <Button
        type="submit"
        variant="outline"
        className="min-h-11"
        disabled={pending}
      >
        {pending ? "Cerrando…" : "Cerrar sesión"}
      </Button>
      {state.message && (
        <p role="status" className="text-destructive mt-2 max-w-xs text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
