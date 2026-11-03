export function assertDemo() {
  if (
    (process.env.APP_MODE ?? "demo") !== "demo" ||
    process.env.LIVE_CHECKOUT_ENABLED === "true" ||
    (process.env.NODE_ENV === "production" &&
      process.env.ALLOW_LOCAL_DEMO_BUILD !== "true")
  ) {
    throw new Error(
      "Live operation refused: only the local fictional demo is implemented.",
    );
  }
}
export function allowedOrigins(host?: string | null) {
  const configured = new URL(
    process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000",
  );
  const origins = [configured.origin];
  if (["127.0.0.1", "localhost"].includes(configured.hostname))
    for (const name of ["127.0.0.1", "localhost"])
      origins.push(
        `${configured.protocol}//${name}${configured.port ? `:${configured.port}` : ""}`,
      );
  if (host) origins.push(`${configured.protocol}//${host}`);
  return [...new Set(origins)];
}
