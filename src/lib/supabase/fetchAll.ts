/**
 * Every matching row, not just the first 1,000: Supabase returns at most that
 * many per request, so a query over a month's visits or all patients would
 * quietly come back short once the clinic has more. Pages through until done.
 *
 * `page(from, to)` must build the same query each time with a stable order
 * (ending in a unique column such as id) and apply `.range(from, to)`.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = 1000
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) return { data: rows, error }
    rows.push(...(data ?? []))
    if (!data || data.length < size) return { data: rows, error: null }
  }
}
