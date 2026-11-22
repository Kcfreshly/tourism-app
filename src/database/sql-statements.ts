// Splits a migration file into statements on `;`, except inside quotes,
// comments and dollar-quoted bodies ($$ … $$ or $tag$ … $tag$), so a
// migration can define PL/pgSQL functions.
export function sqlStatements(sql: string) {
  const statements: string[] = [];
  let start = 0;
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i);
    const dollar = /^\$[A-Za-z_]*\$/.exec(rest);
    if (dollar) {
      const end = sql.indexOf(dollar[0], i + dollar[0].length);
      i = end === -1 ? sql.length : end + dollar[0].length;
    } else if (sql[i] === "'") {
      const end = sql.indexOf("'", i + 1);
      i = end === -1 ? sql.length : end + 1;
    } else if (rest.startsWith("--")) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
    } else if (sql[i] === ";") {
      statements.push(sql.slice(start, i));
      start = ++i;
    } else i++;
  }
  statements.push(sql.slice(start));
  return statements.map((s) => s.trim()).filter(Boolean);
}
