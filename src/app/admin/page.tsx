import { requireAdmin } from "@/server/identity";
import AdminCatalogue from "@/components/admin-catalogue";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const actor = await requireAdmin().catch(() => null);
  if (!actor)
    return (
      <section className="card">
        <h1>Staff access required</h1>
        <p>
          Customer and guest sessions cannot access staff data or mutations.
          Sign in with an account granted a demo administrator role by the local
          owner.
        </p>
        <Link href="/account">Sign in →</Link>
      </section>
    );
  return (
    <section>
      <h1>Catalogue operations</h1>
      <p>
        Review rates, capacity and publication status. Fictional demo supply
        only; live sales remain disabled.
      </p>
      <AdminCatalogue />
    </section>
  );
}
