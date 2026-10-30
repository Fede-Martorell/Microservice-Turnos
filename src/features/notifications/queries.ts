import "server-only";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/features/organizations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";
export async function loadNotifications(org: string, page: number) {
  const context = await requireOrganization(org);
  if (context.role !== "owner") notFound();
  const client = await createSupabaseServerClient();
  const [{ data: settings, error }, { data: jobs, error: jobsError }] =
    await Promise.all([
      client
        .from("notification_settings")
        .select("*")
        .eq("organization_id", org)
        .maybeSingle(),
      client
        .from("notification_jobs")
        .select(
          "id,appointment_id,kind,status,scheduled_at,created_at,sent_at,attempts,last_error",
        )
        .eq("organization_id", org)
        .order("created_at", { ascending: false })
        .order("id")
        .range(page * 50, page * 50 + 49),
    ]);
  if (error || jobsError) {
    reportServerError("notifications.read_failed", error ?? jobsError);
    throw new Error("No pudimos cargar las notificaciones");
  }
  return { context, settings, jobs: jobs ?? [] };
}
