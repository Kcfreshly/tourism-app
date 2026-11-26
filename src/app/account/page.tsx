import Account from "@/components/account";
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const { next, mode } = await searchParams;
  // Only same-site paths are honoured as a post-sign-in destination.
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return <Account next={safeNext} startWithSignup={mode === "signup"} />;
}
