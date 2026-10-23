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
