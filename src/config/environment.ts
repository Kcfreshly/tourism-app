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

export type PaymentProvider = "disabled" | "paystack" | "simulated";

// Which payment provider checkout uses. Paystack runs with test keys only
// while the app is the demo; the simulated provider never runs in production.
// A misconfiguration throws, so it is found on the first Pay, not after.
export function paymentSettings(): {
  provider: PaymentProvider;
  secretKey: string;
} {
  const provider = process.env.PAYMENT_PROVIDER || "disabled";
  const secretKey = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (provider === "disabled") return { provider, secretKey: "" };
  if (provider === "paystack") {
    if (!secretKey.startsWith("sk_test_"))
      throw new Error(
        "PAYMENT_PROVIDER=paystack needs a Paystack test key (sk_test_…) in PAYSTACK_SECRET_KEY. Live keys are refused in the demo.",
      );
    return { provider, secretKey };
  }
  if (provider === "simulated") {
    if (process.env.NODE_ENV === "production")
      throw new Error(
        "PAYMENT_PROVIDER=simulated is for local development only.",
      );
    return { provider, secretKey: "" };
  }
  throw new Error(`Unknown PAYMENT_PROVIDER "${provider}".`);
}

export type EmailProvider = "disabled" | "outbox" | "resend";

// Where confirmation emails go. Locally they're written to .local/outbox to
// open in a browser; Resend sends real email. Unset means outbox in
// development and off in production, so nothing is sent by accident.
export function emailSettings(): {
  provider: EmailProvider;
  apiKey: string;
  from: string;
} {
  const provider =
    process.env.EMAIL_PROVIDER ||
    (process.env.NODE_ENV === "production" ? "disabled" : "outbox");
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const from = process.env.EMAIL_FROM || "Fastlife <bookings@example.com>";
  if (provider === "disabled" || provider === "outbox")
    return { provider, apiKey: "", from };
  if (provider === "resend") {
    if (!apiKey.startsWith("re_"))
      throw new Error("EMAIL_PROVIDER=resend needs RESEND_API_KEY (re_…).");
    if (!process.env.EMAIL_FROM)
      throw new Error(
        "EMAIL_PROVIDER=resend needs EMAIL_FROM, an address on a domain verified in Resend.",
      );
    return { provider, apiKey, from };
  }
  throw new Error(`Unknown EMAIL_PROVIDER "${provider}".`);
}

export function publicAppUrl() {
  return process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
}

// Kemi runs as a separate service (services/kemi). The BFF stays closed
// unless the flag is exactly "true".
export function kemiSettings() {
  return {
    enabled: process.env.KEMI_ENABLED === "true",
    url: process.env.KEMI_URL || "http://127.0.0.1:4100",
  };
}
