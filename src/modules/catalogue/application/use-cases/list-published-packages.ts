import { lagosToday } from "../../domain/events";
import type { PackageRepository } from "../ports/package-repository";

// Published trips with only their upcoming departures, soonest trip first.
export class ListPublishedPackages {
  constructor(private readonly packages: PackageRepository) {}

  async execute(today = lagosToday()) {
    const trips = (await this.packages.listPublished()).map(({ record }) => ({
      ...record,
      departures: record.departures
        .filter((d) => d.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date)),
    }));
    const next = (t: (typeof trips)[number]) =>
      t.departures[0]?.date ?? "9999-12-31";
    return trips.sort(
      (a, b) =>
        next(a).localeCompare(next(b)) || a.title.localeCompare(b.title),
    );
  }
}
