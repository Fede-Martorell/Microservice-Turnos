import type { FormField } from "@/components/ui/action-form";
import type { Service, Professional } from "@/types/catalog";
import { priceInput } from "@/lib/utils/money";

export function serviceFields(
  currency: string,
  professionals: Professional[],
  selected: string[],
  service?: Service,
): FormField[] {
  return [
    {
      name: "name",
      label: "Nombre del servicio",
      required: true,
      maxLength: 100,
      value: service?.name,
    },
    {
      name: "description",
      label: "Descripción",
      type: "textarea",
      maxLength: 2000,
      value: service?.description,
    },
    {
      name: "category",
      label: "Categoría (opcional)",
      maxLength: 100,
      value: service?.category,
    },
    {
      name: "duration_minutes",
      label: "Duración en minutos",
      type: "number",
      min: 5,
      max: 480,
      required: true,
      value: String(service?.duration_minutes ?? 30),
    },
    {
      name: "preparation_minutes",
      label: "Preparación después del servicio (minutos)",
      type: "number",
      min: 0,
      max: 120,
      required: true,
      value: String(service?.preparation_minutes ?? 0),
      hint: "Este tiempo también ocupa la agenda del profesional.",
    },
    {
      name: "currency",
      label: "Moneda",
      required: true,
      maxLength: 3,
      value: service?.currency ?? currency,
      hint: "Código de moneda, por ejemplo ARS, USD o EUR.",
    },
    {
      name: "price",
      label: "Precio",
      required: true,
      maxLength: 20,
      value: service ? priceInput(service.price_minor, service.currency) : "0",
      hint: "Sin separadores de miles: 12500,50. Configurar un precio no registra un pago.",
    },
    {
      name: "image_url",
      label: "Imagen por URL HTTPS (opcional)",
      type: "url",
      maxLength: 2048,
      value: service?.image_url ?? "",
      hint: "Se guarda el enlace; la carga de archivos y la página pública se incorporarán después.",
    },
    {
      name: "staff_ids",
      label: "Profesionales habilitados",
      type: "checklist",
      value: selected,
      options: professionals.map((profile) => ({
        value: profile.id,
        label: profile.name + (profile.is_active ? "" : " · Inactivo"),
      })),
      hint: "Un servicio sin profesionales habilitados no podrá reservarse.",
    },
    {
      name: "is_active",
      label: "Servicio activo",
      type: "checkbox",
      value: service?.is_active ?? true,
      hint: "Desactivar conserva el registro y su historial.",
    },
  ];
}
