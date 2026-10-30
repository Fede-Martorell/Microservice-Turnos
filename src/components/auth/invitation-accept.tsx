"use client";

import { useActionState } from "react";
import { acceptInvitationAction } from "@/features/staff/invitation-actions";
import { Button } from "@/components/ui/button";

export function InvitationAccept({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, {});
  return (
    <form action={action} className="mt-6 space-y-4" aria-busy={pending}>
      <input type="hidden" name="token" value={token} />
      {state.message && (
        <p role="status" className="text-sm leading-6">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="min-h-11 w-full">
        {pending ? "Aceptando…" : "Aceptar acceso de personal"}
      </Button>
    </form>
  );
}
