import type { Metadata } from "next";
import { requireAdmin } from "@/server/identity";
import AdminCatalogue from "@/components/admin-catalogue";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff workspace" };
export default async function Admin() {
  const actor = await requireAdmin().catch(() => null);
  if (!actor)
    return (
      <section className="page">
        <div className="empty-state">
          <h1>Staff access required</h1>
          <p>
            This workspace is for operations staff. Customer and guest sessions
            can’t view or change catalogue data. Sign in with an account that
            has been granted the administrator role.
          </p>
          <Link className="button" href="/account">
            Sign in
          </Link>
        </div>
      </section>
    );
  return (
    <section className="admin-page">
      <div className="page-intro">
        <p className="eyebrow">Staff workspace</p>
        <h1>Catalogue operations</h1>
        <p className="lede">
          Review rates, capacity and publication status. Demo supply only; live
          sales remain disabled.
        </p>
      </div>
      <AdminCatalogue />
    </section>
  );
}
