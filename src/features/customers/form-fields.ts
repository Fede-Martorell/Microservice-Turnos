import type { Customer } from "@/types/customers";
import type { FormField } from "@/components/ui/action-form";
export function customerFields(
  item?: Pick<Customer, "name" | "email" | "phone" | "is_active">,
): FormField[] {
  return [
    {
      name: "name",
      label: "Nombre",
      required: true,
      maxLength: 100,
      value: item?.name ?? "",
    },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      maxLength: 254,
      value: item?.email ?? "",
    },
    {
      name: "phone",
      label: "Teléfono (opcional)",
      maxLength: 30,
      value: item?.phone ?? "",
    },
    {
      name: "is_active",
      label: "Cliente activo en el listado",
      type: "checkbox",
      value: item?.is_active ?? true,
      hint: "Desactivar la ficha conserva el historial y no cancela turnos.",
    },
  ];
}
