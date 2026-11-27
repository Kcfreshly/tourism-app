import Link from "next/link";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import {
  packageLength,
  packageRoute,
  priceBasisText,
  type TripPackage,
} from "@/modules/catalogue/domain/packages";
import { shortDay } from "@/modules/catalogue/domain/schedule";
import Icon from "./icons";

// Route-led cover rather than a photo: the photo library only covers Lagos,
// and a Lagos photo must not stand in for another city.
export function PackageCover({ p }: { p: TripPackage }) {
  const stops = packageRoute(p).split(" → ");
  return (
    <div className="package-cover" aria-hidden="true">
      <ol>
        {stops.map((stop, i) => (
          <li key={`${stop}-${i}`}>{stop}</li>
        ))}
      </ol>
    </div>
  );
}

export default function PackageCard({ p }: { p: TripPackage }) {
  const next = p.departures[0];
  return (
    <article className="package-card card">
      <PackageCover p={p} />
      <div className="package-card-body">
        <p className="tile-meta">{packageLength(p)} · Sample operator</p>
        <h3>
          <Link href={`/packages/${p.slug}`}>{p.title}</Link>
        </h3>
        <p className="package-route">
          <Icon name="compass" size={14} />
          {packageRoute(p)}
        </p>
        {next && (
          <p className="package-next">
            <Icon name="calendar" size={14} />
            Next departure {shortDay(next.date)}
          </p>
        )}
        <p className="tile-price">
          From <strong>{formatMoney(p.priceMinor)}</strong>{" "}
          {priceBasisText(p.priceBasis)}
        </p>
      </div>
    </article>
  );
}
