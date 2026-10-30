import { redirect } from "next/navigation";
export default async function ReservationsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  redirect(`/panel/${organizationId}/calendario`);
}
