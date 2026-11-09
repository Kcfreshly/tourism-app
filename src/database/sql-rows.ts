// postgres.js returns an array; PGlite returns a result with a rows member.
export function sqlRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result;
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray(result.rows)
  )
    return result.rows;
  return [];
}
