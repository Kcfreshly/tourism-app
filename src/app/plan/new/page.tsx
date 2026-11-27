import Intake from "@/components/intake";
import Icon from "@/components/icons";
import { pages } from "@/bootstrap/container";
import { planSeed } from "@/modules/catalogue/domain/packages";
export default async function NewPlan({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    offer?: string;
    fresh?: string;
    from?: string;
  }>;
}) {
  const { mode, offer, fresh, from } = await searchParams;
  const query = new URLSearchParams(
    Object.entries({ mode, offer, fresh, from }).filter(
      (entry): entry is [string, string] => !!entry[1],
    ),
  ).toString();
  await pages.requireSignedIn(`/plan/new${query ? `?${query}` : ""}`);
  const source = from
    ? await pages.publishedPackage(from).catch(() => undefined)
    : undefined;
  return (
    <>
      <Intake
        mode={mode}
        kemi={pages.kemiEnabled()}
        offer={offer}
        fresh={fresh === "1" || !!source}
        seed={source && planSeed(source)}
        airportPickupMinor={
          (await pages.transportSettings()).airportPickupMinor
        }
      />
      <section className="page-section how-it-works">
        <div className="section-head">
          <div>
            <p className="eyebrow">How planning works</p>
            <h2>From idea to itinerary in three steps</h2>
          </div>
        </div>
        <ol className="steps">
          <li>
            <span className="step-number">1</span>
            <h3>Tell us about your stay</h3>
            <p>
              Dates, who’s coming, where you’re staying and what you love, in
              a short form.
            </p>
          </li>
          <li>
            <span className="step-number">2</span>
            <h3>Shape your days</h3>
            <p>
              Drag experiences into each day. Opening hours, set sessions and
              travel time are checked for you, so nothing overlaps.
            </p>
          </li>
          <li>
            <span className="step-number">3</span>
            <h3>Choose your support</h3>
            <p>
              <Icon name="car" size={16} /> A driver on each activity day of a
              planned trip, and guides in any mix. Your total updates with every
              change.
            </p>
          </li>
        </ol>
      </section>
    </>
  );
}
