import "server-only";

type QueryError = { code?: string; message?: string };
export async function readMany<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: QueryError | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await query(from, from + 499);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return { data: rows, error: null };
  }
}
