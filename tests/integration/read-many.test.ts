import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readMany } from "@/lib/supabase/read-many";
describe("lectura paginada del catálogo", () => {
  it("recorre más de una respuesta de PostgREST sin truncar registros", async () => {
    const source = Array.from({ length: 1001 }, (_, id) => ({ id }));
    const query = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));
    const result = await readMany(query);
    expect(result.data).toHaveLength(1001);
    expect(result.data?.at(-1)?.id).toBe(1000);
    expect(query).toHaveBeenCalledTimes(3);
  });
  it("no devuelve un catálogo parcial si falla una página intermedia", async () => {
    const error = { code: "42501" };
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        data: Array.from({ length: 500 }, (_, id) => ({ id })),
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error });
    expect(await readMany(query)).toEqual({ data: null, error });
  });
});
