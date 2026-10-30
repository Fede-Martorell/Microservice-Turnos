"use server";

import { z } from "zod";
import { serviceSchema } from "./schema";
import { catalogMutation, readFields, readActive } from "./mutation";
import { parseMoney } from "@/lib/utils/money";
import type { ActionState } from "@/types/actions";

export async function saveServiceAction(
  org: string,
  id: string | null,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return catalogMutation(
    org,
    "service.save_failed",
    serviceSchema.safeExtend({ id: z.uuid().nullable() }),
    {
      ...readFields(form, [
        "name",
        "description",
        "category",
        "duration_minutes",
        "preparation_minutes",
        "price",
        "currency",
        "image_url",
      ]),
      id,
      is_active: readActive(form),
      staff_ids: form.getAll("staff_ids"),
    },
    (client, input) => {
      const { staff_ids, price, id: target, ...data } = input;
      return client.rpc("save_service", {
        p_organization_id: org,
        p_id: target,
        p_data: { ...data, price_minor: parseMoney(price, data.currency)! },
        p_staff_ids: staff_ids,
      });
    },
    { destination: (serviceId) => `/panel/${org}/servicios/${serviceId}` },
  );
}
